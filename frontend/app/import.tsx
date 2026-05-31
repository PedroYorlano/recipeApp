import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../src/context/AppContext';
import { ActivityIndicator, View } from 'react-native';

export default function ImportRoute() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const { setCreateMode, setInitialImportUrl, setFormModalVisible } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!url) {
      router.replace('/(tabs)');
      return;
    }

    const decodedUrl = decodeURIComponent(url);
    
    // 1. Configurar los valores en el AppContext
    setCreateMode('video');
    setInitialImportUrl(decodedUrl);
    setFormModalVisible(true);

    // 2. Redirigir al Home de las pestañas
    router.replace('/(tabs)');
  }, [url]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAEEDA' }}>
      <ActivityIndicator size="large" color="#EF9F27" />
    </View>
  );
}
