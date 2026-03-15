import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import HamburgerMenu from '../auth/MenuHamburguesa';

const { width } = Dimensions.get('window');

// Definición de tipos para las noticias
interface Noticia {
  id_noticia: number;
  titulo: string;
  descripcion: string;
  hora: string;
  fecha: string;
  imagen: string | null;
  id_policia: number;
  nombre_policia?: string;
  zona:string
}

type CategoriaNoticia = 'Reciente' | 'Robos' | 'Accidentes' | 'Alertas';

const formatearTiempoRelativo = (fechaStr: string, horaStr: string) => {
  try {
    // Combinamos fecha (YYYY-MM-DD) y hora (HH:mm:ss) para crear un objeto Date
    // Si tu backend envía solo HH:mm, se añade :00
    const fechaPublicacion = new Date(`${fechaStr.split('T')[0]}T${horaStr}`);
    const ahora = new Date();
    
    const diferenciaEnSegundos = Math.floor((ahora.getTime() - fechaPublicacion.getTime()) / 1000);

    if (diferenciaEnSegundos < 60) return 'Ahora mismo';
    
    const minutos = Math.floor(diferenciaEnSegundos / 60);
    if (minutos < 60) return `Hace ${minutos} min`;
    
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
    
    const dias = Math.floor(horas / 24);
    if (dias === 1) return 'Ayer';
    if (dias < 7) return `Hace ${dias} días`;
    
    // Si es más de una semana, mostramos la fecha normal
    return fechaPublicacion.toLocaleDateString();
  } catch (error) {
    return 'Recientemente';
  }
};

const NoticiasScreen = () => {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [noticiasFiltradas, setNoticiasFiltradas] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<CategoriaNoticia>('Reciente');
  const router = useRouter();

 const HEROKU_BASE_URL = 'https://safecity-1.onrender.com'; // Sin la barra al final
const API_URL_NOTICIAS = `${HEROKU_BASE_URL}/noticias`;

  useEffect(() => {
    fetchNoticias();
  }, []);

  useEffect(() => {
    filtrarNoticias();
  }, [noticias, categoriaSeleccionada]);

  const fetchNoticias = async () => {
    if (!refreshing) {
      setLoading(true);
    }
    
    try {
      const response = await fetch(API_URL_NOTICIAS, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setNoticias(Array.isArray(data) ? data : []);
      } else {
        console.error('Error al obtener noticias:', response.status);
        setNoticias([]);
      }
    } catch (error) {
      console.error('Error al obtener noticias:', error);
      setNoticias([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filtrarNoticias = () => {
    let noticiasFiltradas = [...noticias];
    
    switch (categoriaSeleccionada) {
      case 'Robos':
        noticiasFiltradas = noticias.filter(noticia => 
          noticia.titulo.toLowerCase().includes('robo') || 
          noticia.descripcion.toLowerCase().includes('robo')
        );
        break;
      case 'Accidentes':
        noticiasFiltradas = noticias.filter(noticia => 
          noticia.titulo.toLowerCase().includes('accidente') || 
          noticia.descripcion.toLowerCase().includes('accidente') ||
          noticia.titulo.toLowerCase().includes('tránsito') ||
          noticia.descripcion.toLowerCase().includes('tránsito')
        );
        break;
      case 'Alertas':
        noticiasFiltradas = noticias.filter(noticia => 
          noticia.titulo.toLowerCase().includes('alerta') || 
          noticia.descripcion.toLowerCase().includes('alerta') ||
          noticia.titulo.toLowerCase().includes('emergencia') ||
          noticia.descripcion.toLowerCase().includes('emergencia')
        );
        break;
      default: // 'Reciente'
        noticiasFiltradas = noticias;
        break;
    }
    
    setNoticiasFiltradas(noticiasFiltradas);
  };

  // Función para manejar el pull-to-refresh
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchNoticias();
  }, []);

  // Función para calcular el tiempo transcurrido
  const calcularTiempoTranscurrido = (fecha: string, hora: string) => {
    try {
      const fechaNoticia = new Date(`${fecha}T${hora}`);
      const ahora = new Date();
      const diffMs = ahora.getTime() - fechaNoticia.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        return diffDays === 1 ? 'Ayer' : `Hace ${diffDays} días`;
      } else if (diffHours > 0) {
        return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
      } else if (diffMinutes > 0) {
        return `Hace ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
      } else {
        return 'Ahora mismo';
      }
    } catch (error) {
      return 'Fecha no válida';
    }
  };

  // Función para obtener el icono según el tipo de noticia
  const obtenerIconoNoticia = (titulo: string, descripcion: string) => {
    const textoCompleto = `${titulo} ${descripcion}`.toLowerCase();
    
    if (textoCompleto.includes('robo') || textoCompleto.includes('asalto')) {
      return <FontAwesome name="user-secret" size={24} color="#2e5929" />;
    } else if (textoCompleto.includes('accidente') || textoCompleto.includes('tránsito')) {
      return <MaterialIcons name="traffic" size={24} color="#2e5929" />;
    } else if (textoCompleto.includes('alerta') || textoCompleto.includes('emergencia')) {
      return <FontAwesome name="exclamation-triangle" size={24} color="#2e5929" />;
    } else {
      return <FontAwesome name="newspaper-o" size={24} color="#2e5929" />;
    }
  };

  // Componente para renderizar cada noticia
  const NoticiaItem = ({ noticia }: { noticia: Noticia }) => (
    <TouchableOpacity style={styles.noticiaContainer}>
      <View style={styles.iconContainer}>
        {obtenerIconoNoticia(noticia.titulo, noticia.descripcion)}
      </View>
      <View style={styles.contenidoContainer}>
        <Text style={styles.tituloNoticia} numberOfLines={2}>
          {noticia.titulo}
        </Text>
        <Text style={styles.descripcionNoticia} numberOfLines={2}>
          {noticia.descripcion}
        </Text>
        <Text style={styles.ubicacionNoticia}>
        <FontAwesome name="map-marker" size={14} color="#b98f45" /> {noticia.zona || 'Zona no especificada'}
        </Text>
      </View>
      <View style={styles.tiempoContainer}>
        <Text style={styles.tiempoTexto}>
        {formatearTiempoRelativo(noticia.fecha, noticia.hora)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Componente para las categorías
  const CategoriaButton = ({ categoria }: { categoria: CategoriaNoticia }) => (
    <TouchableOpacity
      style={[
        styles.categoriaButton,
        categoriaSeleccionada === categoria && styles.categoriaButtonActive
      ]}
      onPress={() => setCategoriaSeleccionada(categoria)}
    >
      <Text
        style={[
          styles.categoriaButtonText,
          categoriaSeleccionada === categoria && styles.categoriaButtonTextActive
        ]}
      >
        {categoria}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          headerTitle: "SafeCityy",
          headerStyle: {
            backgroundColor: '#2e5929',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 20,
          },
          headerLeft: () => <HamburgerMenu/>
        }}
      />
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2e5929" />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2e5929']} // Android
              tintColor={'#2e5929'} // iOS
              title="Actualizando..." // iOS
              titleColor={'#2e5929'} // iOS
            />
          }
        >
          {/* Categorías */}
          <View style={styles.categoriasContainer}>
            <CategoriaButton categoria="Reciente" />
            <CategoriaButton categoria="Robos" />
            <CategoriaButton categoria="Accidentes" />
            <CategoriaButton categoria="Alertas" />
          </View>

          {/* Lista de noticias */}
          <View style={styles.noticiasContainer}>
            {noticiasFiltradas.length > 0 ? (
              noticiasFiltradas.map((noticia) => (
                <NoticiaItem key={noticia.id_noticia} noticia={noticia} />
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <FontAwesome name="newspaper-o" size={50} color="#ccc" />
                <Text style={styles.emptyMessage}>
                  {categoriaSeleccionada === 'Reciente' 
                    ? 'No hay noticias disponibles' 
                    : `No hay noticias de ${categoriaSeleccionada.toLowerCase()}`
                  }
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  categoriasContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  categoriaButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#e8e8e8',
    borderRadius: 20,
    marginRight: 8,
  },
  categoriaButtonActive: {
    backgroundColor: '#2e5929',
  },
  categoriaButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoriaButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  noticiasContainer: {
    flex: 1,
  },
  noticiaContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 50,
    height: 50,
    backgroundColor: '#f9f5e8',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    marginRight: 12,
  },
  contenidoContainer: {
    flex: 1,
    paddingRight: 8,
  },
  tituloNoticia: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 6,
    lineHeight: 20,
  },
  descripcionNoticia: {
    fontSize: 13,
    color: '#b98f45',
    marginBottom: 4,
    lineHeight: 16,
  },
  ubicacionNoticia: {
    fontSize: 13,
    color: '#b98f45',
    fontStyle: 'italic',
  },
  tiempoContainer: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 80,
  },
  tiempoTexto: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default NoticiasScreen;