import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const DenunciaExito = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Image 
        source={require('@/assets/images/success-icon.png')}
        style={styles.successImage}
      />
      <Text style={styles.title}>¡Denuncia enviada con éxito!</Text>
      
      <TouchableOpacity 
        style={styles.buttonR}
        onPress={() => router.push('/(tabs)/Historial')}
      >
        <FontAwesome/>
        <Text style={styles.buttonTextR}>Ver mis reportes</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.buttonI}
        onPress={() => router.replace('/(tabs)')}
      >
        <FontAwesome />
        <Text style={styles.buttonTextI}>Volver al inicio</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  successImage: {
    width: 200,
    height: 200,
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e5929',
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonR: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    padding: 15,
    backgroundColor: '#2E4A28',
    borderRadius: 8,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#2e5929',
    justifyContent:'center',
  },
  buttonI: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2e5929',
    justifyContent:'center'
  },
  buttonTextR: {
    marginLeft: 10,
    fontSize: 25,
    color: '#FFFFFF',
    fontWeight:'bold',
  },
  buttonTextI: {
    marginLeft: 10,
    fontSize: 25,
    color: '#2E4A28',
    fontWeight:'bold',
  },
});

export default DenunciaExito;