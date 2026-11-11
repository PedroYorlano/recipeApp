import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useApp } from '../src/context/AppContext';
import { PENDING_IMPORT_KEY, extractUrl, importModeForUrl } from '../src/utils/shareImport';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Destino del share target de la PWA (y de los deep links web).
 * Android suele mandar el link en `text` en vez de `url`, así que se prueban los tres.
 */
export default function ImportRoute() {
  const params = useLocalSearchParams<{ url?: string; text?: string; title?: string }>();
  const { isAuthenticated, isAuthLoading, setCreateMode, setInitialImportUrl, setFormModalVisible } = useApp();
  const router = useRouter();

  const sharedUrl = extractUrl(params.url) ?? extractUrl(params.text) ?? extractUrl(params.title);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!sharedUrl) {
      router.replace(isAuthenticated ? '/(tabs)' : '/');
      return;
    }

    if (!isAuthenticated) {
      // Se retoma en app/_layout.tsx después del login.
      AsyncStorage.setItem(PENDING_IMPORT_KEY, sharedUrl)
        .catch(() => {})
        .finally(() => router.replace('/login'));
      return;
    }

    setCreateMode(importModeForUrl(sharedUrl));
    setInitialImportUrl(sharedUrl);
    setFormModalVisible(true);
    router.replace('/(tabs)');
  }, [isAuthLoading, isAuthenticated, sharedUrl, router, setCreateMode, setInitialImportUrl, setFormModalVisible]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF9EC' }}>
      <ActivityIndicator size="large" color="#BE9F00" />
    </View>
  );
}
