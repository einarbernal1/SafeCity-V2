import { FontAwesome } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface Denuncia {
  id_denuncia: number;
  descripcion: string;
  modulo_epi: string;
  hora: string;
  fecha: string;
  tipo: string;
  calle_avenida: string;
  evidencia: string | null;
  estado: string;
  id_ciudadano: number;
}

const EditarDenunciaScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  // Corregir la lectura del parámetro - ahora lee 'idDenuncia' que es como se envía desde Historial
  const idDenuncia = params.idDenuncia ? Number(params.idDenuncia) : 0;

  const [denuncia, setDenuncia] = useState<Denuncia | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [moduloPolicial, setModuloPolicial] = useState('');
  const [horaIncidente, setHoraIncidente] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tipoIncidente, setTipoIncidente] = useState('');
  const [calleAvenida, setCalleAvenida] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [modalErrorVisible, setModalErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // --- CONFIGURACIÓN HEROKU ---
  const RENDER_BASE_URL = 'https://safecity-1.onrender.com'; // Tu URL de Render
  const API_URL = `${RENDER_BASE_URL}/denuncia`;
  
  
  const API_URL_GET_DENUNCIA = `${API_URL}/${idDenuncia}`;
  const API_URL_UPDATE_DENUNCIA = `${API_URL}/${idDenuncia}`;
  // ----------------------------

  // Datos para los ComboBox
  const modulosPoliciales = [
    { label: 'EPI Nº 5 ALALAY', value: 'EPI_N5_Alalay' },
    { label: 'EPI Nº 1 COÑA COÑA', value: 'EPI_N1_Coña Coña' },
    { label: 'EPI Nº 3 JAIHUAYCO', value: 'EPI_N3_Jaihuayco' },
    { label: 'EPI Nº 7 SUR', value: 'EPI_N7_Sur' },
    { label: 'EPI Nº 6 CENTRAL', value: 'EPI_N6_Central' },
  ];

  const tiposIncidente = [
    { label: 'Asesinato', value: 'ASESINATO' },
    { label: 'Asalto', value: 'ASALTO' },
    { label: 'Accidente de tránsito', value: 'ACCIDENTE_TRANSITO' },
    { label: 'Violencia doméstica', value: 'VIOLENCIA_DOMESTICA' },
    { label: 'Disturbio publico', value: 'DISTURBIO_PUBLICO' },
    { label: 'Otro', value: 'OTRO' },
  ];

  const showErrorModal = (message: string) => {
    setErrorMessage(message);
    setModalErrorVisible(true);
  };

  // Cargar datos de la denuncia
  useEffect(() => {
    const fetchDenuncia = async () => {
      if (!idDenuncia) {
        showErrorModal('ID de denuncia no válido');
        router.back();
        return;
      }
  
      try {
        console.log('Fetching denuncia with ID:', idDenuncia);
        const response = await fetch(API_URL_GET_DENUNCIA, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success && data.denuncia) {
          const denunciaData = data.denuncia;
          setDenuncia(denunciaData);
          
          // Establecer los valores iniciales
          setDescripcion(denunciaData.descripcion || '');
          setModuloPolicial(denunciaData.modulo_epi || '');
          setTipoIncidente(denunciaData.tipo || '');
          setCalleAvenida(denunciaData.calle_avenida || '');
          setSelectedImage(denunciaData.evidencia);
          setImageUrl(denunciaData.evidencia); // Guardar también la URL de Cloudinary
          
          // Convertir la hora de string a Date
          if (denunciaData.hora) {
            const [hours, minutes] = denunciaData.hora.split(':').map(Number);
            const horaDate = new Date();
            horaDate.setHours(hours, minutes, 0, 0);
            setHoraIncidente(horaDate);
          }
        } else {
          showErrorModal(data.message || 'No se pudo obtener la información de la denuncia');
          setTimeout(() => router.back(), 2000);
        }
      } catch (error) {
        console.error('Error al obtener denuncia:', error);
        showErrorModal('Error de conexión al servidor');
        setTimeout(() => router.back(), 2000);
      } finally {
        setLoading(false);
      }
    };
  
    fetchDenuncia();
  }, [idDenuncia]);

  const pickImage = async () => {
    setUpdating(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para seleccionar imágenes');
        return;
      }
  
      // API actualizada de ImagePicker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // Cambio aquí
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
  
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImage(asset.uri);
        
        // Preparar FormData para Cloudinary
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg', // Usar mimeType
          name: asset.fileName || `photo_${Date.now()}.jpg`
        } as any);
        formData.append('upload_preset', 'Imagenes_Evidencia');
        
        // Configurar timeout para la petición
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
  
        // Subir a Cloudinary
        const uploadResponse = await fetch('https://api.cloudinary.com/v1_1/dcrrqn3rr/image/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
  
        if (!uploadResponse.ok) {
          throw new Error(`Error en Cloudinary: ${uploadResponse.status}`);
        }
  
        const uploadedImage = await uploadResponse.json();
        setImageUrl(uploadedImage.secure_url);
        //Alert.alert('Éxito', 'Imagen actualizada correctamente');
      }
    } catch (error) {
      console.error('Error detallado al subir la imagen:', error);
      let errorMessage = 'Error al subir la imagen. Por favor, inténtelo nuevamente.';
      
      if (error instanceof Error) {
        if (error.message.includes('Network request failed')) {
          errorMessage = 'Error de conexión. Verifique su conexión a internet.';
        } else if (error.name === 'AbortError') {
          errorMessage = 'Tiempo de espera agotado. La imagen es muy grande o la conexión es lenta.';
        }
      }
      
      showErrorModal(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setHoraIncidente(selectedTime);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
  };

  const handleUpdate = async () => {
    // Validaciones
    if (!descripcion.trim()) {
      showErrorModal('La descripción del incidente es obligatoria');
      return;
    }
    if (!moduloPolicial) {
      showErrorModal('Debe seleccionar un módulo policial');
      return;
    }
    if (!tipoIncidente) {
      showErrorModal('Debe seleccionar un tipo de incidente');
      return;
    }
    if (!calleAvenida.trim()) {
      showErrorModal('Debe ingresar la calle o avenida');
      return;
    }
  
    setUpdating(true);
  
    const denunciaData = {
      descripcion: descripcion.trim(),
      modulo_epi: moduloPolicial,
      hora: formatTime(horaIncidente),
      // ✅ DESPUÉS - fuerza el formato correcto siempre
fecha: denuncia?.fecha 
? String(denuncia.fecha).split('T')[0] 
: formatDate(new Date()),
      tipo: tipoIncidente,
      calle_avenida: calleAvenida.trim(),
      evidencia: imageUrl || null, // Usar la URL de Cloudinary
    };
  
    console.log('Updating denuncia with data:', denunciaData);
  
    try {
      const response = await fetch(API_URL_UPDATE_DENUNCIA, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(denunciaData),
      });
    
      const data = await response.json();
      console.log('Update response:', data);
    
      if (data.success) {
        Alert.alert(
          'Éxito',
          'Denuncia actualizada correctamente',
          [{ 
            text: 'OK', 
            onPress: () => {
              router.push('/(tabs)/Historial'); // Navegar de vuelta al historial
            }
          }]
        );
      } else {
        showErrorModal(data.message || 'Error al actualizar denuncia');
      }
    } catch (error) {
      console.error('Error al enviar denuncia:', error);
      showErrorModal('No se pudo conectar al servidor');
    } finally {
      setUpdating(false);
    }
  };
    
  const PickerField = ({ value, onValueChange, items, placeholder }: any) => {
    return Platform.OS === 'ios' ? (
      <View style={styles.selectContainer}>
        <Picker
          selectedValue={value}
          onValueChange={onValueChange}
          style={styles.picker}
        >
          <Picker.Item label={placeholder} value="" />
          {items.map((item: any) => (
            <Picker.Item key={item.value} label={item.label} value={item.value} />
          ))}
        </Picker>
        <View style={styles.pickerArrows}>
          <FontAwesome name="chevron-up" size={12} color="#666" />
          <FontAwesome name="chevron-down" size={12} color="#666" />
        </View>
      </View>
    ) : (
      <View style={styles.selectContainer}>
        <Picker
          selectedValue={value}
          onValueChange={onValueChange}
          style={styles.picker}
          mode="dropdown"
        >
          <Picker.Item label={placeholder} value="" />
          {items.map((item: any) => (
            <Picker.Item key={item.value} label={item.label} value={item.value} />
          ))}
        </Picker>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.menuSuperior}>
        <Stack.Screen 
          options={{
            headerTitle:"Editar Denuncia",
            headerStyle: {
              backgroundColor: '#2e5929',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2e5929" />
          <Text style={styles.loadingText}>Cargando información de la denuncia...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.menuSuperior}>
      <Stack.Screen 
        options={{
          headerTitle: "Editar Denuncia",
          headerStyle: {
            backgroundColor: '#2e5929',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <ScrollView contentContainerStyle={styles.contenedor}>
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Descripción del incidente *</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Ingrese una descripción"
            placeholderTextColor="#8D6E63" 
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Módulos policiales *</Text>
          <PickerField
            value={moduloPolicial}
            onValueChange={(value: string) => setModuloPolicial(value)}
            items={modulosPoliciales}
            placeholder="Seleccione un módulo policial"
          />

          <Text style={styles.seccionTitulo}>Hora del incidente *</Text>
          <TouchableOpacity 
            style={styles.timePickerButton} 
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.textoTiempo}>{formatTime(horaIncidente)}</Text>
            <View style={styles.pickerArrows}>
              <FontAwesome name="chevron-up" size={12} color="#666" />
              <FontAwesome name="chevron-down" size={12} color="#666" />
            </View>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={horaIncidente}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={handleTimeChange}
            />
          )}

          <Text style={styles.seccionTitulo}>Tipo de incidente *</Text>
          <PickerField
            value={tipoIncidente}
            onValueChange={(value: string) => setTipoIncidente(value)}
            items={tiposIncidente}
            placeholder="Tipo de incidente"
          />

          <Text style={styles.seccionTitulo}>Calle o Avenida *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre de la calle"
            placeholderTextColor="#8D6E63"
            value={calleAvenida}
            onChangeText={setCalleAvenida}
          />
        </View>

        <View style={styles.seccionImagen}>
          <Text style={styles.seccionTitulo}>Evidencia (Opcional)</Text>
          {selectedImage ? (
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.seleccionDeImagen}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <FontAwesome name="image" size={50} color="#ccc" />
              <Text style={styles.placeholderText}>Ninguna imagen seleccionada</Text>
            </View>
          )}
          <TouchableOpacity 
            style={styles.uploadButton} 
            onPress={pickImage}
          >
            <FontAwesome name="cloud-upload" size={24} color="black" />
            <Text style={styles.uploadButtonText}>
              {selectedImage ? 'Cambiar Imagen' : 'Subir Imagen'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, updating && styles.submitButtonDisabled]} 
          onPress={handleUpdate}
          disabled={updating}
        >
          {updating ? (
            <View style={styles.loadingButtonContent}>
              <ActivityIndicator color="#000" size="small" />
              <Text style={styles.submitButtonText}>Actualizando...</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>Actualizar Denuncia</Text>
          )}
        </TouchableOpacity>

        {/* Modal de Error */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalErrorVisible}
          onRequestClose={() => setModalErrorVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <FontAwesome name="exclamation-triangle" size={50} color="#E53935" />
              <Text style={styles.modalTitle}>Error</Text>
              <Text style={styles.modalMessage}>{errorMessage}</Text>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setModalErrorVisible(false)}
              >
                <Text style={styles.modalButtonText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  menuSuperior: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  contenedor: {
    flexGrow: 1,
    padding: 16,
  },
  seccion: {
    marginBottom: 20,
  },
  seccionTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2e5929',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    position: 'relative',
  },
  picker: {
    height: 50,
  },
  pickerArrows: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  timePickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 15,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textoTiempo: {
    fontSize: 16,
    color: '#333',
  },
  seccionImagen: {
    marginBottom: 30,
  },
  seleccionDeImagen: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  placeholderContainer: {
    height: 200,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  placeholderText: {
    marginTop: 10,
    fontSize: 16,
    color: '#ccc',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  uploadButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#2e5929',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#7a7a7a',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 10,
    alignItems: 'center',
    maxWidth: 300,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
    color: '#E53935',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  modalButton: {
    backgroundColor: '#2e5929',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 5,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EditarDenunciaScreen;