import React from 'react';
import { View, Text } from 'react-native';

export default function ShareExtensionScreen() {
  return (
    <View 
      className="flex-1 justify-center items-center bg-fogon-cream p-6"
      style={{ backgroundColor: '#FAEEDA' }}
    >
      <View 
        className="items-center max-w-md w-full bg-fogon-white border border-fogon-gray/20 rounded-xl p-8 shadow-sm"
        style={{ backgroundColor: '#FFF8F0', borderColor: 'rgba(168, 144, 112, 0.2)' }}
      >
        <Text 
          className="text-4xl font-serif text-fogon-brown mb-4"
          style={{ fontFamily: 'serif', color: '#633806' }}
        >
          Fogón
        </Text>
        <Text className="text-xl font-bold text-fogon-brown mb-2 text-center" style={{ color: '#633806' }}>
          Extensión de Compartir
        </Text>
        <Text className="text-fogon-gray text-sm text-center">
          La extensión para compartir recetas directamente desde otras aplicaciones está disponible únicamente en dispositivos móviles (iOS y Android).
        </Text>
      </View>
    </View>
  );
}
