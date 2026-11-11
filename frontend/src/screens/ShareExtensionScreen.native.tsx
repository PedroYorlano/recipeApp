import { useEffect, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Text } from 'react-native';
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
        className="flex-1 items-center justify-center bg-pizca-fondo px-6"
        style={{ backgroundColor: '#FFF9EC' }}
      >
        <ActivityIndicator size="large" color="#BE9F00" />
        <Text className="mt-4 text-pizca-marron/70 font-medium text-center">
          Cargando…
        </Text>
      </View>
    );
  }

  return (
    <View 
      className="flex-1 justify-between bg-pizca-fondo p-6 pb-10"
      style={{ backgroundColor: '#FFF9EC' }}
    >
      <View className="flex-1 justify-center items-center">
        {/* Nombre de la app. La extensión corre aparte y no carga las fuentes de la app: va con la del sistema. */}
        <Text
          className="text-4xl text-pizca-mostaza mb-2"
          style={{ fontWeight: '900', color: '#BE9F00', letterSpacing: 1 }}
        >
          PIZCA
        </Text>
        <Text className="text-pizca-texto2 text-sm text-center mb-8">
          Guardá esta receta en tu recetario.
        </Text>

        {/* Caja de previsualización de la URL */}
        <View 
          className="w-full bg-white border border-pizca-linea rounded-xl p-4 mb-8 shadow-sm"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#EADFC8' }}
        >
          <Text className="text-xs text-pizca-texto2 uppercase tracking-wider mb-1 font-semibold">
            Link
          </Text>
          {url ? (
            <Text 
              className="text-pizca-marron text-base"
              style={{ color: '#3F3128' }}
              numberOfLines={1}
            >
              {url}
            </Text>
          ) : (
            <Text className="text-sm" style={{ color: '#B23A12' }}>
              No encontramos un link en lo que compartiste
            </Text>
          )}
        </View>
      </View>

      {/* Botones de acción */}
      <View className="w-full gap-4">
        {url ? (
          <TouchableOpacity
            className="w-full py-4 rounded-2xl items-center justify-center"
            style={{ backgroundColor: '#BE9F00' }}
            onPress={handleImport}
            activeOpacity={0.8}
          >
            <Text className="text-pizca-marron text-base" style={{ fontWeight: '800', color: '#3F3128' }}>
              Importar receta
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          className="w-full py-3 items-center justify-center"
          onPress={handleCancel}
          activeOpacity={0.6}
        >
          <Text className="text-pizca-marron/80 text-sm font-medium">
            Cancelar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
