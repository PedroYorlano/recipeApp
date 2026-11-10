import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { close, openHostApp, InitialProps } from 'expo-share-extension';
import { extractUrl } from '../utils/shareImport';

export default function ShareExtensionScreen({ url: initialUrl, text }: InitialProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Misma lógica que el share target de la PWA (app/import.tsx).
    setUrl(extractUrl(initialUrl) ?? extractUrl(text));
    setIsLoading(false);
  }, [initialUrl, text]);

  const handleImport = () => {
    if (!url) return;
    openHostApp(`fogon://import?url=${encodeURIComponent(url)}`);
    close();
  };

  const handleCancel = () => close();

  if (isLoading) {
    return (
      <View 
        className="flex-1 items-center justify-center bg-fogon-cream px-6"
        style={{ backgroundColor: '#FAEEDA' }}
      >
        <ActivityIndicator size="large" color="#EF9F27" />
        <Text className="mt-4 text-fogon-brown/70 font-medium text-center">
          Cargando contenido...
        </Text>
      </View>
    );
  }

  return (
    <View 
      className="flex-1 justify-between bg-fogon-cream p-6 pb-10"
      style={{ backgroundColor: '#FAEEDA' }}
    >
      <View className="flex-1 justify-center items-center">
        {/* Logo / Nombre "Fogón" en Serif */}
        <Text 
          className="text-4xl font-serif text-fogon-brown mb-2"
          style={{ fontFamily: 'serif', color: '#633806' }}
        >
          Fogón
        </Text>
        <Text className="text-fogon-gray text-sm text-center mb-8">
          Compartí recetas directamente a tu recetario inteligente.
        </Text>

        {/* Caja de previsualización de la URL */}
        <View 
          className="w-full bg-fogon-white border border-fogon-gray/20 rounded-xl p-4 mb-8 shadow-sm"
          style={{ backgroundColor: '#FFF8F0', borderColor: 'rgba(168, 144, 112, 0.2)' }}
        >
          <Text className="text-xs text-fogon-gray uppercase tracking-wider mb-1 font-semibold">
            Enlace compartido
          </Text>
          {url ? (
            <Text 
              className="text-fogon-brown text-base"
              style={{ color: '#633806' }}
              numberOfLines={1}
            >
              {url}
            </Text>
          ) : (
            <Text className="text-red-500 text-sm">
              No se detectó un enlace válido
            </Text>
          )}
        </View>
      </View>

      {/* Botones de acción */}
      <View className="w-full gap-4">
        {url ? (
          <TouchableOpacity
            className="w-full py-4 rounded-xl items-center justify-center shadow-sm"
            style={{ backgroundColor: '#EF9F27' }}
            onPress={handleImport}
            activeOpacity={0.8}
          >
            <Text className="text-fogon-brown text-base font-bold">
              Importar receta
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          className="w-full py-3 items-center justify-center"
          onPress={handleCancel}
          activeOpacity={0.6}
        >
          <Text className="text-fogon-brown/80 text-sm font-medium">
            Cancelar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
