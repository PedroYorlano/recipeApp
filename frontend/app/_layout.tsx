import '../global.css';
import React, { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Slot, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { AppProvider, useApp } from '../src/context/AppContext';
import { PlannerProvider } from '../src/context/PlannerContext';
import { CreateMenuModal } from '../src/components/CreateMenuModal';
import { RecipeFormModal } from '../src/components/recipes/RecipeFormModal';
import * as Linking from 'expo-linking';

const MainLayout = () => {
  // 1. Extraemos TODO lo necesario del Contexto (Auth + Modales)
  const {
    isAuthenticated, isAuthLoading,                          // Para Auth
    isCreateMenuVisible, setCreateMenuVisible,               // Para Modales
    formModalVisible, setFormModalVisible,
    editingRecipe, setEditingRecipe, saveRecipe, importRecipeAI, categories,
    createMode, setCreateMode, setInitialImportUrl
  } = useApp();

  useEffect(() => {
    const handleIncomingUrl = (url: string) => {
      const parsed = Linking.parse(url);
      if (parsed.hostname === 'import' && parsed.queryParams?.url) {
        const importUrl = decodeURIComponent(parsed.queryParams.url as string);
        setCreateMode('video');
        setInitialImportUrl(importUrl);
        setFormModalVisible(true);
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url);
    });

    Linking.getInitialURL().then(url => {
      if (url) handleIncomingUrl(url);
    });

    return () => subscription.remove();
  }, [setCreateMode, setInitialImportUrl, setFormModalVisible]);

  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  // 2. Lógica de Protección de Rutas (AuthGuard)
  useEffect(() => {
    if (isAuthLoading || !rootNavigationState?.key) return;

    const isWeb = Platform.OS === 'web';
    const inLogin = segments[0] === 'login';
    const inRegister = segments[0] === 'register';
    const inForgotPassword = segments[0] === 'forgot-password';
    const isLanding = !segments[0] || segments[0] === 'index';
    const inShareExtension = segments[0] === 'share-extension';

    const isPublicRoute = (isWeb && isLanding) || inLogin || inRegister || inForgotPassword || inShareExtension;

    if (isAuthenticated) {
      if (isLanding || inLogin || inRegister || inForgotPassword) {
        // Usuario logueado intentando entrar a páginas públicas -> mandar a /(tabs)
        router.replace('/(tabs)');
      }
    } else {
      if (!isPublicRoute) {
        // Usuario NO logueado en ruta protegida -> mandar a la landing en Web, y a Login en Mobile
        router.replace(isWeb ? '/' : '/login');
      } else if (!isWeb && isLanding) {
        // Si está en Mobile y cae en la raíz (index), mandarlo a Login
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isAuthLoading, segments, rootNavigationState, router]);

  // 3. Lógica del Menú Flotante
  const handleMenuSelect = (option: string) => {
    setCreateMenuVisible(false);

    if (option === 'manual') setCreateMode('manual');
    else if (option === 'video') setCreateMode('video');
    else if (option === 'audio') setCreateMode('audio');
    else if (option === 'text') setCreateMode('text');
    else if (option === 'link-web') setCreateMode('link-web');
    setEditingRecipe(null);
    setFormModalVisible(true);
  };

  // 4. Renderizado: Loading o App + Modales
  if (isAuthLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <>
      {/* Slot renderiza la pantalla actual (Login, Home, Settings, etc.) */}
      <Slot />

      <CreateMenuModal
        visible={isCreateMenuVisible}
        onClose={() => setCreateMenuVisible(false)}
        onSelect={handleMenuSelect}
      />

      <RecipeFormModal
        visible={formModalVisible}
        onClose={() => setFormModalVisible(false)}
        onSubmit={saveRecipe}
        onImportAI={importRecipeAI}
        initialData={editingRecipe}
        categories={categories}
      />
    </>
  );
};

export default function RootLayout() {
  return (
    <AppProvider>
      <PlannerProvider>
        <MainLayout />
      </PlannerProvider>
    </AppProvider>
  );
}