import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const DenunciaScreen = () => {
  const [descripcion, setDescripcion] = useState('');
  const [moduloPolicial, setModuloPolicial] = useState('');
  const [horaIncidente, setHoraIncidente] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tipoIncidente, setTipoIncidente] = useState('');
  const [calleAvenida, setCalleAvenida] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [idCiudadano, setIdCiudadano] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const router = useRouter();

  // Estados para manejar los pickers en iOS
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [currentPicker, setCurrentPicker] = useState<'modulo' | 'tipo' | null>(null);

  const [modalErrorVisible, setModalErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const showErrorModal = (message: string) => {
    setErrorMessage(message);
    setModalErrorVisible(true);
  };


 const HEROKU_BASE_URL = 'https://safecity-1.onrender.com'; // Sin la barra al final
const API_URL = `${HEROKU_BASE_URL}/denuncias`;

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userDataString = await AsyncStorage.getItem('userData');
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          setIdCiudadano(userData.id_ciudadano);
        }
      } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
      }
    };

    loadUserData();
  }, []);

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

  const pickImage = async () => {
    setLoading(true);
    try {
      // Solicitar permisos
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para seleccionar imágenes');
        return;
      }
  
      // Seleccionar imagen (con API actualizada)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // API actualizada
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
  
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImage(asset.uri);
        
        // Crear FormData correctamente
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg', // Usar mimeType si está disponible
          name: asset.fileName || `photo_${Date.now()}.jpg`
        } as any);
        formData.append('upload_preset', 'Imagenes_Evidencia');
        
        // Subir a Cloudinary con timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout
  
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
          throw new Error(`HTTP error! status: ${uploadResponse.status}`);
        }
  
        const uploadedImage = await uploadResponse.json();
        setImageUrl(uploadedImage.secure_url);
        //Alert.alert('Éxito', 'Imagen subida correctamente a Cloudinary');
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
      setLoading(false);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setHoraIncidente(selectedTime);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  };

  const handleSubmit = async () => {
    if (!descripcion) {
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
    if (!calleAvenida) {
      showErrorModal('Debe ingresar la calle o avenida');
      return;
    }
    if (!idCiudadano) {
      showErrorModal('No se pudo identificar al usuario. Por favor, inicie sesión nuevamente.');
      return;
    }
  
    setLoading(true);
  
// ✅ DESPUÉS
const hoy = new Date();
const year = hoy.getFullYear();
const month = String(hoy.getMonth() + 1).padStart(2, '0');
const day = String(hoy.getDate()).padStart(2, '0');
const fechaLocal = `${year}-${month}-${day}`;

    const denunciaData = {
      descripcion,
      modulo_epi: moduloPolicial,
      hora: `${horaIncidente.getHours().toString().padStart(2, '0')}:${horaIncidente.getMinutes().toString().padStart(2, '0')}`,
      fecha: fechaLocal,
      tipo: tipoIncidente,
      calle_avenida: calleAvenida,
      evidencia: imageUrl || null, // Usamos la URL de Cloudinary
      estado: 'PENDIENTE',
      id_ciudadano: idCiudadano
    };
  
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(denunciaData),
      });
  
      const data = await response.json();
  
      if (data.success) {
        router.push('/auth/DenunciaExito');
      } else {
        showErrorModal(data.message || 'Error al registrar denuncia');
      }
    } catch (error) {
      console.error('Error al enviar denuncia:', error);
      showErrorModal('No se pudo conectar al servidor');
    } finally {
      setLoading(false);
    }
  };

  const renderPicker = () => {
    if (Platform.OS === 'android') {
      return (
        <>
          <Text style={styles.seccionTitulo}>Módulos policiales *</Text>
          <View style={styles.selectContainer}>
            <Picker
              selectedValue={moduloPolicial}
              onValueChange={(value) => setModuloPolicial(value)}
              style={styles.picker}
              mode="dropdown"
            >
              <Picker.Item label="Seleccione un módulo policial" value="" />
              {modulosPoliciales.map((item) => (
                <Picker.Item key={item.value} label={item.label} value={item.value} />
              ))}
            </Picker>
          </View>

          <Text style={styles.seccionTitulo}>Tipo de incidente *</Text>
          <View style={styles.selectContainer}>
            <Picker
              selectedValue={tipoIncidente}
              onValueChange={(value) => setTipoIncidente(value)}
              style={styles.picker}
              mode="dropdown"
            >
              <Picker.Item label="Seleccione un tipo de incidente" value="" />
              {tiposIncidente.map((item) => (
                <Picker.Item key={item.value} label={item.label} value={item.value} />
              ))}
            </Picker>
          </View>
        </>
      );
    } else {
      return (
        <>
          <Text style={styles.seccionTitulo}>Módulos policiales *</Text>
          <TouchableOpacity 
            style={styles.selectContainer} 
            onPress={() => {
              setCurrentPicker('modulo');
              setShowPickerModal(true);
            }}
          >
            <Text style={styles.pickerText}>
              {moduloPolicial ? modulosPoliciales.find(m => m.value === moduloPolicial)?.label : 'Seleccione un módulo policial'}
            </Text>
            <FontAwesome name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>

          <Text style={styles.seccionTitulo}>Tipo de incidente *</Text>
          <TouchableOpacity 
            style={styles.selectContainer} 
            onPress={() => {
              setCurrentPicker('tipo');
              setShowPickerModal(true);
            }}
          >
            <Text style={styles.pickerText}>
              {tipoIncidente ? tiposIncidente.find(t => t.value === tipoIncidente)?.label : 'Seleccione un tipo de incidente'}
            </Text>
            <FontAwesome name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </>
      );
    }
  };

   const renderPickerModal = () => (
  <Modal
    visible={showPickerModal}
    transparent={true}
    animationType="slide"
    onRequestClose={() => setShowPickerModal(false)}
  >
    <View style={styles.pickerModalContainer}>
      <TouchableOpacity 
        style={styles.pickerModalBackdrop}
        activeOpacity={1}
        onPress={() => setShowPickerModal(false)}
      />
      <View style={styles.pickerModalContent}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity 
            onPress={() => setShowPickerModal(false)}
            style={styles.pickerButton}
          >
            <Text style={styles.pickerButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <View style={styles.pickerTitleContainer}>
            <Text style={styles.pickerTitle}>
              {currentPicker === 'modulo' ? 'Seleccione módulo policial' : 'Seleccione tipo de incidente'}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => setShowPickerModal(false)}
            style={styles.pickerButton}
          >
            <Text style={[styles.pickerButtonText, styles.pickerButtonTextConfirm]}>Listo</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={currentPicker === 'modulo' ? moduloPolicial : tipoIncidente}
            onValueChange={(value) => {
              if (currentPicker === 'modulo') {
                setModuloPolicial(value);
              } else {
                setTipoIncidente(value);
              }
            }}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {currentPicker === 'modulo' ? (
              modulosPoliciales.map((item) => (
                <Picker.Item 
                  key={item.value} 
                  label={item.label} 
                  value={item.value} 
                />
              ))
            ) : (
              tiposIncidente.map((item) => (
                <Picker.Item 
                  key={item.value} 
                  label={item.label} 
                  value={item.value} 
                />
              ))
            )}
          </Picker>
        </View>
      </View>
    </View>
  </Modal>
);

  

  return (
    <SafeAreaView style={styles.menuSuperior}>
      <Stack.Screen 
        options={{
          headerTitle: " Nueva Denuncia",
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
          />
        </View>

        <View style={styles.seccion}>
          {renderPicker()}

          <Text style={styles.seccionTitulo}>Hora del incidente *</Text>
          <TouchableOpacity 
            style={styles.timePickerButton} 
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.textoTiempo}>{formatTime(horaIncidente)}</Text>
            <FontAwesome name="chevron-down" size={16} color="#666" />
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
            <Text style={styles.uploadButtonText}>Subir Imagen</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.submitButton} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.submitButtonText}>Enviar Denuncia</Text>
          )}
        </TouchableOpacity>

        {renderPickerModal()}

        <Modal
          animationType="slide"
          transparent={true}
          visible={modalErrorVisible}
          onRequestClose={() => setModalErrorVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalText}>{errorMessage}</Text>
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
  contenedor: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  seccion: {
    marginBottom: 15,
  },
  seccionTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  multilineInput: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 15,
  },
  timePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  textoTiempo: {
    fontSize: 16,
    color: '#333',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
  },
  selectContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    marginBottom: 15,
  },

  // Estilos mejorados para el Picker Modal en iOS
  pickerModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pickerModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
   pickerModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '50%',
    paddingBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2e5929',
  },
  pickerButton: {
    minWidth: 8,
    padding: 10,
  },
  pickerButtonText: {
    fontSize: 15,
    color: '#666',
  },
  pickerButtonTextConfirm: {
    color: '#2e5929',
    fontWeight: 'bold',
  },
  pickerContainer: {
    height: 80, // Aumenta esta altura para mostrar más opciones
  },
  picker: {
    width: '100%',
    height: '100%',
    marginLeft:-15,
  },
  pickerItem: {
    fontSize: 20,
    color: '#333',
    height: 40, // Altura de cada item
  },

  // Resto de estilos...
  seccionImagen: {
    alignItems: 'center',
    marginBottom: 20,
  },
  seleccionDeImagen: {
    width: '90%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  uploadButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: 'black',
    borderRadius: 5,
    backgroundColor: '#fff',
    width: '100%',
    height: 58,
  },
  uploadButtonText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#000',
  },
  submitButton: {
    width: '100%',
    height: 55,
    backgroundColor: '#FFD600',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1
  },
  submitButtonText: {
    color: '#000',
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholderContainer: {
    width: '80%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 10,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#2e5929',
    padding: 10,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
  },
});
 


export default DenunciaScreen;