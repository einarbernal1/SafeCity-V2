require('dotenv').config();
const { Expo } = require('expo-server-sdk');
const expo = new Expo();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cors());

// Configuración de la base de datos (Modificado para Clever Cloud)
const dbConfig = {
  host: process.env.MYSQL_ADDON_HOST || 'localhost',
  user: process.env.MYSQL_ADDON_USER || 'root',
  password: process.env.MYSQL_ADDON_PASSWORD || '',
  database: process.env.MYSQL_ADDON_DB || 'safecity',
  port: process.env.MYSQL_ADDON_PORT || 3306, // Agregamos el puerto
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Pool de conexiones
const pool = mysql.createPool(dbConfig);

// Verificar conexión a la base de datos al iniciar
pool.getConnection()
  .then(conn => {
    console.log('Conexión exitosa a MySQL');
    conn.release();
  })
  .catch(err => {
    console.error('Error de conexión a MySQL:', err);
    process.exit(1);
  });


// Función para enviar notificaciones masivas
const enviarNotificaciones = async (tokens, titulo, cuerpo, data = {}) => {
  let messages = [];
  for (let pushToken of tokens) {
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Token inválido: ${pushToken}`);
      continue;
    }
    messages.push({
      to: pushToken,
      sound: 'default',
      title: titulo,
      body: cuerpo,
      data: data,
    });
  }

  let chunks = expo.chunkPushNotifications(messages);
  for (let chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error('Error enviando chunk:', error);
    }
  }
};


// Ruta para login que verifica en las tres tablas
app.post('/login', async (req, res) => {
  const { correo, contraseña, pushToken } = req.body;

  if (!correo || !contraseña) {
    return res.status(400).json({ 
      success: false,
      message: 'Correo y contraseña son requeridos' 
    });
  }

  try {
    // 1. Buscar en la tabla de ciudadanos
    const [ciudadanos] = await pool.query(
      'SELECT id_ciudadano, nombres, apellido_paterno, apellido_materno, correo FROM ciudadano WHERE correo = ? AND contraseña = ?',
      [correo, contraseña]
    );

    if (ciudadanos.length > 0) {
      const ciudadano = ciudadanos[0];

      // 2. GUARDA EL TOKEN SI EXISTE
      if (pushToken) {
        await pool.query('UPDATE ciudadano SET push_token = ? WHERE id_ciudadano = ?', [pushToken, ciudadano.id_ciudadano]);
      }

      return res.json({
        success: true,
        message: 'Login exitoso (ciudadano)',
        usuario: {
          id_ciudadano: ciudadano.id_ciudadano,
          nombres: ciudadano.nombres,
          apellido_paterno: ciudadano.apellido_paterno,
          apellido_materno: ciudadano.apellido_materno,
          correo: ciudadano.correo,
          tipo: 'ciudadano'
        }
      });
    }

    // 2. Buscar en la tabla de policías
    const [policias] = await pool.query(
      `SELECT id_policia, nombres, apellido_paterno, apellido_materno, correo, modulo_epi 
       FROM policia 
       WHERE correo = ? AND contraseña = ?`,
      [correo, contraseña]
    );

    if (policias.length > 0) {
      const policia = policias[0];

    // 3. GUARDA EL TOKEN SI EXISTE
    if (pushToken) {
      await pool.query('UPDATE policia SET push_token = ? WHERE id_policia = ?', [pushToken, policia.id_policia]);
    }
          
      return res.json({
        success: true,
        message: 'Login exitoso (policía)',
        usuario: {
          id_policia: policia.id_policia,
          nombres: policia.nombres,
          apellido_paterno: policia.apellido_paterno,
          apellido_materno: policia.apellido_materno,
          correo: policia.correo,
          modulo_epi: policia.modulo_epi,
          tipo: 'policia'
        }
      });
    }

    // 3. Buscar en la tabla de administradores (versión simplificada)
    const [administradores] = await pool.query(
      `SELECT id_admin, correo 
       FROM administrador 
       WHERE correo = ? AND contraseña = ?`,
      [correo, contraseña]
    );

    if (administradores.length > 0) {
      const admin = administradores[0];
      return res.json({
        success: true,
        message: 'Login exitoso (administrador)',
        usuario: {
          id_admin: admin.id_admin,
          correo: admin.correo,
          tipo: 'admin'
        }
      });
    }

    // Si no encuentra en ninguna tabla
    return res.status(401).json({
      success: false,
      message: 'Credenciales incorrectas'
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// Ruta para crear denuncias
app.post('/denuncias', async (req, res) => {
  const { descripcion, modulo_epi, hora, fecha, tipo, calle_avenida, evidencia, id_ciudadano } = req.body;

  // Validaciones básicas
  if (!descripcion || !modulo_epi || !hora || !fecha || !tipo || !calle_avenida || !id_ciudadano) {
    return res.status(400).json({ 
      success: false,
      message: 'Todos los campos obligatorios son requeridos' 
    });
  }

  try {
    // Verificar que el ciudadano existe
    const [ciudadano] = await pool.query(
      'SELECT id_ciudadano FROM ciudadano WHERE id_ciudadano = ?',
      [id_ciudadano]
    );

    if (ciudadano.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Usuario no válido'
      });
    }

    // Insertar denuncia en la base de datos
    const [result] = await pool.query(
      `INSERT INTO denuncia 
      (descripcion, modulo_epi, hora, fecha, tipo, calle_avenida, evidencia, estado, id_ciudadano) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?)`,
      [descripcion, modulo_epi, hora, fecha, tipo, calle_avenida, evidencia || null, id_ciudadano]
    );

    // NOTIFICAR A POLICÍAS DEL MISMO EPI
    try {
      const [policiasEpi] = await pool.query(
        'SELECT push_token FROM policia WHERE modulo_epi = ? AND push_token IS NOT NULL',
        [modulo_epi]
      );

      const tokensPolicia = policiasEpi.map(p => p.push_token);

      if (tokensPolicia.length > 0) {
        await enviarNotificaciones(
          tokensPolicia,
          "🚨 Nueva Denuncia Urgente",
          `Se reportó un ${tipo} en ${calle_avenida}. ¡Atención inmediata!`,
          { denunciaId: result.insertId }
        );
      }
    } catch (notifError) {
      console.error("Error enviando notificación:", notifError);
    }

    res.json({ 
      success: true,
      message: 'Denuncia registrada exitosamente',
      denunciaId: result.insertId
    });
  } catch (error) {
    console.error('Error al registrar denuncia:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al registrar la denuncia en la base de datos' 
    });
  }
});


app.post('/noticias', async (req, res) => {
  const { titulo, descripcion, hora, fecha, imagen, idPolicia, zona } = req.body;

  // Debug
  if (process.env.NODE_ENV === 'development') {
    console.log('Body recibido:', req.body);
  }

  // Validaciones básicas
  if (!titulo || !descripcion || !hora || !fecha || !idPolicia || !zona) {
    return res.status(400).json({ 
      success: false,
      message: 'Todos los campos obligatorios son requeridos' 
    });
  }

  // Validar que idPolicia sea un número
  if (isNaN(idPolicia)) {
    return res.status(400).json({
      success: false,
      message: 'ID de policía no válido'
    });
  }

  // Validación de URL de Cloudinary (solo si hay imagen)
  if (imagen && !imagen.startsWith('https://res.cloudinary.com/')) {
    return res.status(400).json({
      success: false,
      message: 'Formato de imagen no válido. Debe ser una URL de Cloudinary'
    });
  }

  try {
    // Verificar si el policía existe
    const [policia] = await pool.query(
      'SELECT id_policia FROM policia WHERE id_policia = ?',
      [idPolicia]
    );

    if (policia.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Policía no válido'
      });
    }

    // Insertar la noticia
    const [noticiaResult] = await pool.query(
      `INSERT INTO noticia 
       (titulo, descripcion, hora, fecha, imagen, id_policia,zona) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [titulo, descripcion, hora, fecha, imagen || null, idPolicia, zona]
    );

    res.json({ 
      success: true,
      message: 'Noticia registrada exitosamente',
      noticiaId: noticiaResult.insertId
    });

  } catch (error) {
    console.error('Error al registrar noticia:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al registrar la noticia en la base de datos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Ruta para registro de ciudadanos
app.post('/registro', async (req, res) => {
  const { nombres, apellido_paterno, apellido_materno, correo, contraseña } = req.body;

  // Validaciones básicas
  if (!nombres || !apellido_paterno || !apellido_materno || !correo || !contraseña) {
    return res.status(400).json({ 
      success: false,
      message: 'Todos los campos son requeridos' 
    });
  }

  try {
    // Verificar si el correo ya existe
    const [existingUsers] = await pool.query(
      'SELECT id_ciudadano FROM ciudadano WHERE correo = ?',
      [correo]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico ya está registrado'
      });
    }

    // Insertar nuevo ciudadano
    const [result] = await pool.query(
      `INSERT INTO ciudadano 
      (nombres, apellido_paterno, apellido_materno, correo, contraseña) 
      VALUES (?, ?, ?, ?, ?)`,
      [nombres, apellido_paterno, apellido_materno, correo, contraseña]
    );

    res.json({ 
      success: true,
      message: 'Usuario registrado exitosamente',
      ciudadanoId: result.insertId
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al registrar el usuario en la base de datos' 
    });
  }
});
// Ruta para recuperar casos pendientes, ordenados por prioridad de tipo
app.get('/casosPendientes', async (req, res) => {
  const idPolicia = req.query.idPolicia;

  if (!idPolicia) {
    return res.status(400).json({
      success: false,
      message: 'Falta el parámetro idPolicia'
    });
  }

  try {
    // 1. Obtener el módulo EPI del policía
    const [policiaRows] = await pool.query(
      'SELECT modulo_epi FROM policia WHERE id_policia = ?',
      [idPolicia]
    );

    if (policiaRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el policía con ese ID'
      });
    }

    const moduloEpiPolicia = policiaRows[0].modulo_epi;

    // 2. Obtener solo las denuncias pendientes del MISMO módulo EPI
    const [casos] = await pool.query(`
      SELECT 
        d.id_denuncia,
        d.descripcion,
        d.tipo,
        d.fecha,
        d.hora,
        d.calle_avenida,
        d.modulo_epi,
        d.evidencia, -- <--- AGREGAR ESTO
        d.estado,    -- <--- AGREGAR ESTO
        CONCAT(c.nombres, ' ', c.apellido_paterno, ' ', c.apellido_materno) AS nombre_denunciante
      FROM denuncia d
      JOIN ciudadano c ON d.id_ciudadano = c.id_ciudadano
      WHERE d.estado = 'pendiente' 
        AND d.modulo_epi = ?
      ORDER BY
        CASE d.tipo
          WHEN 'ASESINATO' THEN 1
          WHEN 'ASALTO' THEN 2
          WHEN 'ACCIDENTE DE TRANSITO' THEN 3
          ELSE 4
        END,
        d.fecha DESC, 
        d.hora DESC
    `, [moduloEpiPolicia]); // Filtro estricto por módulo EPI

   return res.json(casos);

  } catch (error) {
    console.error('Error al obtener casos pendientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al obtener casos pendientes'
    });
  }
});

app.post('/atenderDenuncia', async (req, res) => {
  const { idDenuncia } = req.body;

  try {
    // 1. Actualizar el estado a 'ATENDIDO'
    await pool.query(
      'UPDATE denuncia SET estado = ? WHERE id_denuncia = ?',
      ['ATENDIDO', idDenuncia]
    );

    // --- CÓDIGO NUEVO PARA NOTIFICAR AL CIUDADANO ---
    
    // 2. Averiguar quién hizo la denuncia (id_ciudadano) y qué tipo de denuncia era
    const [denunciaInfo] = await pool.query(
      'SELECT id_ciudadano, tipo, calle_avenida FROM denuncia WHERE id_denuncia = ?',
      [idDenuncia]
    );

    if (denunciaInfo.length > 0) {
      const { id_ciudadano, tipo, calle_avenida } = denunciaInfo[0];

      // 3. Buscar el Token del ciudadano
      const [usuario] = await pool.query(
        'SELECT push_token FROM ciudadano WHERE id_ciudadano = ? AND push_token IS NOT NULL',
        [id_ciudadano]
      );

      // 4. Si tiene token, enviarle la notificación
      if (usuario.length > 0 && usuario[0].push_token) {
        const tokenCiudadano = usuario[0].push_token;
        
        console.log(`Enviando notificación al ciudadano (Token: ${tokenCiudadano})`);

        await enviarNotificaciones(
          [tokenCiudadano], // Debe ser un array
          "✅ Caso Atendido", // Título
          `Tu reporte de ${tipo} en ${calle_avenida} ha sido atendido por la policía. Revisa tu historial.`, // Mensaje
          { idDenuncia: idDenuncia, accion: 'ver_historial' } // Datos extra
        );
      }
    }
    // ------------------------------------------------

    // 5. Devolver la denuncia actualizada al frontend
    const [rows] = await pool.query(
      'SELECT * FROM denuncia WHERE id_denuncia = ?',
      [idDenuncia]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Denuncia no encontrada' });
    }

    res.status(200).json(rows[0]);

  } catch (error) {
    console.error('Error al actualizar denuncia y notificar:', error);
    res.status(500).json({ error: 'Error al actualizar denuncia' });
  }
});


// Ruta para obtener todas las denuncias que ya fueron atendidas
app.get('/denunciasAtendidas', async (req, res) => {
  const idPolicia = req.query.idPolicia;

  if (!idPolicia) {
    return res.status(400).json({
      success: false,
      message: 'Falta el parámetro idPolicia'
    });
  }

  try {
    // 1. Obtener el módulo EPI del policía
    const [policiaRows] = await pool.query(
      'SELECT modulo_epi FROM policia WHERE id_policia = ?',
      [idPolicia]
    );

    if (policiaRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el policía con ese ID'
      });
    }

    const moduloEpiPolicia = policiaRows[0].modulo_epi;

    // 2. Obtener denuncias atendidas solo del mismo módulo EPI
    const [denuncias] = await pool.query(`
      SELECT 
        d.id_denuncia,
        d.descripcion,
        d.tipo,
        d.fecha,
        d.hora,
        d.calle_avenida,
        d.modulo_epi,
        d.id_policia,
        d.evidencia, -- <--- AGREGAR ESTO
        d.estado,    -- <--- AGREGAR ESTO
        CONCAT(c.nombres, ' ', c.apellido_paterno, ' ', c.apellido_materno) AS nombre_denunciante,
        CONCAT(p.nombres, ' ', p.apellido_paterno) AS nombre_policia
      FROM denuncia d
      JOIN ciudadano c ON d.id_ciudadano = c.id_ciudadano
      LEFT JOIN policia p ON d.id_policia = p.id_policia
      WHERE d.estado = 'ATENDIDO'
        AND d.modulo_epi = ?
      ORDER BY d.fecha DESC, d.hora DESC
    `, [moduloEpiPolicia]);

    res.json(denuncias);
  } catch (error) {
    console.error('Error al obtener denuncias atendidas:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al obtener denuncias atendidas'
    });
  }
});

// Ruta para actualizar perfil
app.put('/perfil', async (req, res) => {
  const { id_ciudadano, nombres, apellido_paterno, apellido_materno, correo } = req.body;

  if (!id_ciudadano || !nombres || !apellido_paterno || !apellido_materno || !correo) {
    return res.status(400).json({ 
      success: false,
      message: 'Todos los campos son requeridos' 
    });
  }

  try {
    // Verificar si el correo ya existe (excluyendo al usuario actual)
    const [existingUsers] = await pool.query(
      'SELECT id_ciudadano FROM ciudadano WHERE correo = ? AND id_ciudadano != ?',
      [correo, id_ciudadano]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico ya está registrado por otro usuario'
      });
    }

    // Actualizar datos del ciudadano
    await pool.query(
      `UPDATE ciudadano 
      SET nombres = ?, apellido_paterno = ?, apellido_materno = ?, correo = ?
      WHERE id_ciudadano = ?`,
      [nombres, apellido_paterno, apellido_materno, correo, id_ciudadano]
    );

    res.json({ 
      success: true,
      message: 'Perfil actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al actualizar el perfil en la base de datos' 
    });
  }
});


// Rutas para obtener denuncias de un usuario específico
// Agregar estas rutas a server.js

// Ruta para obtener denuncias atendidas de un usuario específico
app.get('/denunciasUsuario/atendidas/:idCiudadano', async (req, res) => {
  const { idCiudadano } = req.params;

  try {
    const [denuncias] = await pool.query(`
      SELECT *
      FROM denuncia
      WHERE estado = 'ATENDIDO' AND id_ciudadano = ?
      ORDER BY fecha DESC, hora DESC
    `, [idCiudadano]);

    res.json(denuncias);
  } catch (error) {
    console.error('Error al obtener denuncias atendidas del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al obtener denuncias atendidas'
    });
  }
});

// Ruta para obtener denuncias pendientes de un usuario específico
app.get('/denunciasUsuario/pendientes/:idCiudadano', async (req, res) => {
  const { idCiudadano } = req.params;

  try {
    const [denuncias] = await pool.query(`
      SELECT *
      FROM denuncia
      WHERE estado = 'PENDIENTE' AND id_ciudadano = ?
      ORDER BY fecha DESC, hora DESC
    `, [idCiudadano]);
    
    // ✅ Aquí devolvemos la respuesta directamente, SIN meter otras rutas
    res.json(denuncias);

  } catch (error) {
    console.error('Error al obtener denuncias pendientes del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al obtener denuncias pendientes'
    });
  }
});

// ---------------------------------------------------------
// ✅ AHORA SÍ: La ruta de denuncia individual va AFUERA
// ---------------------------------------------------------

// Ruta para obtener una denuncia específica por su ID
app.get('/denuncia/:idDenuncia', async (req, res) => {
  const { idDenuncia } = req.params;

  try {
    const [denuncias] = await pool.query(
      'SELECT * FROM denuncia WHERE id_denuncia = ?',
      [idDenuncia]
    );

    if (denuncias.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Denuncia no encontrada'
      });
    }

    res.json({
      success: true,
      denuncia: denuncias[0]
    });
  } catch (error) {
    console.error('Error al obtener denuncia:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al obtener la denuncia'
    });
  }
});

// Ruta para actualizar una denuncia existente
app.put('/denuncia/:idDenuncia', async (req, res) => {
  const { idDenuncia } = req.params;
  const { descripcion, modulo_epi, hora, fecha, tipo, calle_avenida, evidencia } = req.body;

  if (!descripcion || !modulo_epi || !hora || !fecha || !tipo || !calle_avenida) {
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT fecha, hora, estado FROM denuncia WHERE id_denuncia = ?',
      [idDenuncia]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Denuncia no encontrada' });
    }

    const denuncia = rows[0];

    // --- MANEJO SEGURO DE FECHA ---
    const d = new Date(denuncia.fecha);
    const anio = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    const fechaDbLocal = `${anio}-${mes}-${dia}`;
    
    // Creamos el objeto de fecha de registro combinando fecha y hora
    const fechaRegistro = new Date(`${fechaDbLocal}T${denuncia.hora}`);
    const now = new Date();
    const diffMinutes = (now.getTime() - fechaRegistro.getTime()) / (1000 * 60);

    if (diffMinutes > 10) {
      return res.status(400).json({
        success: false,
        message: 'El tiempo para modificar esta denuncia (10 min) ha expirado'
      });
    }

    // Actualizar denuncia
    await pool.query(
      `UPDATE denuncia 
       SET descripcion = ?, modulo_epi = ?, hora = ?, fecha = ?, 
           tipo = ?, calle_avenida = ?, evidencia = ?, fue_modificada = 1
       WHERE id_denuncia = ?`,
      [descripcion, modulo_epi, hora, fecha, tipo, calle_avenida, evidencia || null, idDenuncia]
    );

    res.json({ success: true, message: 'Denuncia actualizada correctamente' });

  } catch (error) {
    // ESTO ES VITAL: Ahora verás el error real en los logs de Render
    console.error('ERROR DETALLADO AL ACTUALIZAR:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al procesar la actualización'
    });
  }
});

// Agregar o reemplazar estas rutas en tu server.js

// Ruta para obtener todas las noticias (mejorada)
app.get('/noticias', async (req, res) => {
  try {
    const [noticias] = await pool.query(`
      SELECT 
        n.*,
        CONCAT(p.nombres, ' ', p.apellido_paterno, ' ', p.apellido_materno) AS nombre_policia
      FROM noticia n
      JOIN policia p ON n.id_policia = p.id_policia
      ORDER BY n.fecha DESC, n.hora DESC
    `);

    // Formatear los datos si es necesario
// En server.js (Ruta /noticias)
const noticiasFormateadas = noticias.map(noticia => ({
  ...noticia,
  imagen: noticia.imagen || null,
  // Asegúrate de que noticia.fecha sea YYYY-MM-DD
  fecha: noticia.fecha, 
  hora: noticia.hora
}));

    res.json(noticiasFormateadas);
  } catch (error) {
    console.error('Error al obtener noticias:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al obtener noticias',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Ruta para obtener noticias por categoría/filtro
app.get('/noticias/categoria/:categoria', async (req, res) => {
  const { categoria } = req.params;
  
  try {
    let whereClause = '';
    let queryParams = [];

    // Definir filtros según la categoría
    switch (categoria.toLowerCase()) {
      case 'robos':
        whereClause = 'WHERE (LOWER(n.titulo) LIKE ? OR LOWER(n.descripcion) LIKE ?)';
        queryParams = ['%robo%', '%robo%'];
        break;
      case 'accidentes':
        whereClause = 'WHERE (LOWER(n.titulo) LIKE ? OR LOWER(n.descripcion) LIKE ? OR LOWER(n.titulo) LIKE ? OR LOWER(n.descripcion) LIKE ?)';
        queryParams = ['%accidente%', '%accidente%', '%tránsito%', '%tránsito%'];
        break;
      case 'alertas':
        whereClause = 'WHERE (LOWER(n.titulo) LIKE ? OR LOWER(n.descripcion) LIKE ? OR LOWER(n.titulo) LIKE ? OR LOWER(n.descripcion) LIKE ?)';
        queryParams = ['%alerta%', '%alerta%', '%emergencia%', '%emergencia%'];
        break;
      case 'reciente':
      default:
        // Sin filtro, mostrar todas
        whereClause = '';
        queryParams = [];
        break;
    }

    const query = `
      SELECT 
        n.*,
        CONCAT(p.nombres, ' ', p.apellido_paterno, ' ', p.apellido_materno) AS nombre_policia
      FROM noticia n
      JOIN policia p ON n.id_policia = p.id_policia
      ${whereClause}
      ORDER BY n.fecha DESC, n.hora DESC
    `;

    const [noticias] = await pool.query(query, queryParams);

    const noticiasFormateadas = noticias.map(noticia => ({
      ...noticia,
      imagen: noticia.imagen || null,
      fecha: noticia.fecha,
      hora: noticia.hora
    }));

    res.json(noticiasFormateadas);
  } catch (error) {
    console.error('Error al obtener noticias por categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al obtener noticias por categoría',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Ruta para obtener estadísticas de noticias (opcional)
app.get('/noticias/estadisticas', async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_noticias,
        COUNT(CASE WHEN LOWER(titulo) LIKE '%robo%' OR LOWER(descripcion) LIKE '%robo%' THEN 1 END) as robos,
        COUNT(CASE WHEN LOWER(titulo) LIKE '%accidente%' OR LOWER(descripcion) LIKE '%accidente%' THEN 1 END) as accidentes,
        COUNT(CASE WHEN LOWER(titulo) LIKE '%alerta%' OR LOWER(descripcion) LIKE '%alerta%' THEN 1 END) as alertas,
        DATE(MAX(fecha)) as ultima_noticia
      FROM noticia
    `);

    res.json(stats[0]);
  } catch (error) {
    console.error('Error al obtener estadísticas de noticias:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al obtener estadísticas'
    });
  }
});

// Ruta para buscar noticias por texto
app.get('/noticias/buscar/:texto', async (req, res) => {
  const { texto } = req.params;
  
  try {
    const [noticias] = await pool.query(`
      SELECT 
        n.*,
        CONCAT(p.nombres, ' ', p.apellido_paterno, ' ', p.apellido_materno) AS nombre_policia
      FROM noticia n
      JOIN policia p ON n.id_policia = p.id_policia
      WHERE (LOWER(n.titulo) LIKE ? OR LOWER(n.descripcion) LIKE ?)
      ORDER BY n.fecha DESC, n.hora DESC
    `, [`%${texto.toLowerCase()}%`, `%${texto.toLowerCase()}%`]);

    const noticiasFormateadas = noticias.map(noticia => ({
      ...noticia,
      imagen: noticia.imagen || null,
      fecha: noticia.fecha,
      hora: noticia.hora
    }));

    res.json(noticiasFormateadas);
  } catch (error) {
    console.error('Error al buscar noticias:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al buscar noticias'
    });
  }
});

// Ruta para registro de policías con id_admin
app.post('/registro-policia', async (req, res) => {
  const { nombres, apellido_paterno, apellido_materno, correo, contraseña, modulo_epi, id_admin } = req.body;

  // Validaciones básicas
  if (!nombres || !apellido_paterno || !apellido_materno || !correo || !contraseña || !modulo_epi || !id_admin) {
    return res.status(400).json({ 
      success: false,
      message: 'Todos los campos son requeridos, incluyendo el módulo EPI y ID de administrador' 
    });
  }

  // Validar que el módulo EPI sea uno de los permitidos
  const modulosPermitidos = [
    'EPI_N5_Alalay',
    'EPI_N1_Coña Coña',
    'EPI_N3_Jaihuayco',
    'EPI_N7_Sur',
    'EPI_N6_Central'
  ];

  if (!modulosPermitidos.includes(modulo_epi)) {
    return res.status(400).json({
      success: false,
      message: 'El módulo EPI seleccionado no es válido'
    });
  }

  // Validar que el id_admin existe y es válido
  try {
    const [admin] = await pool.query(
      'SELECT id_admin FROM administrador WHERE id_admin = ?',
      [id_admin]
    );

    if (admin.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El ID de administrador no es válido'
      });
    }
  } catch (error) {
    console.error('Error al validar administrador:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al validar el administrador' 
    });
  }

  try {
    // Verificar si el correo ya existe
    const [existingUsers] = await pool.query(
      'SELECT id_policia FROM policia WHERE correo = ?',
      [correo]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico ya está registrado'
      });
    }

    // Insertar nuevo policía con id_admin
    const [result] = await pool.query(
      `INSERT INTO policia 
      (nombres, apellido_paterno, apellido_materno, correo, contraseña, modulo_epi, id_admin) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombres, apellido_paterno, apellido_materno, correo, contraseña, modulo_epi, id_admin]
    );

    res.json({ 
      success: true,
      message: 'Policía registrado exitosamente',
      policiaId: result.insertId,
      id_admin: id_admin
    });
  } catch (error) {
    console.error('Error al registrar policía:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al registrar el policía en la base de datos' 
    });
  }
});

// [NUEVO] Obtener lista de todos los policías
app.get('/policias', async (req, res) => {
  try {
    const [policias] = await pool.query(`
      SELECT id_policia, nombres, apellido_paterno, apellido_materno, correo, modulo_epi 
      FROM policia 
      ORDER BY id_policia DESC
    `);
    res.json(policias);
  } catch (error) {
    console.error('Error al obtener policías:', error);
    res.status(500).json({ message: 'Error al obtener la lista de policías' });
  }
});

// [NUEVO] Eliminar un policía
app.delete('/policia/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Primero verificamos si existe
    const [exist] = await pool.query('SELECT id_policia FROM policia WHERE id_policia = ?', [id]);
    if (exist.length === 0) {
      return res.status(404).json({ message: 'Policía no encontrado' });
    }

    // Eliminamos (Ojo: Si tiene noticias o denuncias asociadas, podrías necesitar borrar esas primero
    // o usar "ON DELETE CASCADE" en tu base de datos SQL. Por ahora intentaremos el borrado directo).
    await pool.query('DELETE FROM policia WHERE id_policia = ?', [id]);

    res.json({ success: true, message: 'Policía eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar policía:', error);
    res.status(500).json({ message: 'Error al eliminar el registro' });
  }
});

// [NUEVO] Actualizar datos de un policía
app.put('/policia/:id', async (req, res) => {
  const { id } = req.params;
  const { nombres, apellido_paterno, apellido_materno, correo, modulo_epi, nueva_contrasena } = req.body;

  try {
    // 1. Validar si el policía existe
    const [exist] = await pool.query('SELECT id_policia FROM policia WHERE id_policia = ?', [id]);
    if (exist.length === 0) {
      return res.status(404).json({ success: false, message: 'Policía no encontrado' });
    }

    // 2. Preparar la consulta SQL
    // Si envían nueva contraseña, la actualizamos. Si no, mantenemos la anterior.
    let query = '';
    let params = [];

    if (nueva_contrasena && nueva_contrasena.trim() !== '') {
      query = `UPDATE policia 
               SET nombres=?, apellido_paterno=?, apellido_materno=?, correo=?, modulo_epi=?, contraseña=? 
               WHERE id_policia=?`;
      params = [nombres, apellido_paterno, apellido_materno, correo, modulo_epi, nueva_contrasena, id];
    } else {
      query = `UPDATE policia 
               SET nombres=?, apellido_paterno=?, apellido_materno=?, correo=?, modulo_epi=? 
               WHERE id_policia=?`;
      params = [nombres, apellido_paterno, apellido_materno, correo, modulo_epi, id];
    }

    await pool.query(query, params);

    res.json({ success: true, message: 'Datos actualizados correctamente' });

  } catch (error) {
    console.error('Error al actualizar policía:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor al actualizar' });
  }
});

// CHATBOT SIMPLE DE AYUDA
app.post("/chatbot", (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ reply: "Mensaje vacío." });
  }

  const msg = message.toLowerCase();

  let reply = "";

  if (msg.includes("descripcion")) {
    reply =
      "En la descripción debes detallar claramente lo ocurrido: qué pasó, cuándo ocurrió y si hubo personas involucradas.";
  } 
  else if (msg.includes("modulo") || msg.includes("epi")) {
    reply =
      "Selecciona el módulo policial (EPI) más cercano al lugar del incidente para que puedan atender tu denuncia.";
  } 
  else if (msg.includes("hora")) {
    reply =
      "Indica la hora aproximada en la que ocurrió el incidente.";
  } 
  else if (msg.includes("tipo")) {
    reply =
      "Selecciona el tipo de incidente que mejor describa lo sucedido (robo, accidente, violencia, etc.).";
  } 
  else if (msg.includes("imagen") || msg.includes("foto")) {
    reply =
      "Puedes adjuntar una imagen como evidencia. Esto ayuda a respaldar tu denuncia.";
  } 
  else if (msg.includes("direccion") || msg.includes("calle")) {
    reply =
      "Indica la calle o avenida donde ocurrió el incidente con la mayor precisión posible.";
  } 
  else if (msg.includes("terminar") || msg.includes("finalizar")) {
    reply =
      "Una vez completes todos los campos correctamente y presiones 'Enviar Denuncia', aparecerá un modal de confirmación y podrás dirigirte al historial para ver el estado de tu denuncia.";
  } 
  else {
    reply =
      "Puedo ayudarte a llenar tu denuncia. Pregúntame sobre: descripción, módulo policial, hora, tipo de incidente, dirección o imagen.";
  }

  res.json({ reply });
});



// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
  });
