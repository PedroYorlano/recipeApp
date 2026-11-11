import React from 'react';
import { View } from 'react-native';
import { Text } from '../components/ui/Typography';

export default function ShareExtensionScreen() {
  return (
    <View 
      className="flex-1 justify-center items-center bg-pizca-fondo p-6"
      style={{ backgroundColor: '#FFF9EC' }}
    >
      <View 
        className="items-center max-w-md w-full bg-white border border-pizca-linea rounded-xl p-8 shadow-sm"
        style={{ backgroundColor: '#FFFFFF', borderColor: '#EADFC8' }}
      >
        <Text className="font-display text-4xl text-pizca-mostaza mb-4">PIZCA</Text>
        <Text className="text-xl font-extrabold text-pizca-marron mb-2 text-center">
          Compartir a Pizca
        </Text>
        <Text className="text-pizca-texto2 text-sm text-center">
          Compartir recetas desde otras apps a Pizca funciona en el celular (iOS y Android).
        </Text>
      </View>
    </View>
  );
}
