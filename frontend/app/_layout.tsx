import '../global.css';
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { AppProvider, useApp } from '../src/context/AppContext';
import { CreateMenuModal } from '../src/components/CreateMenuModal';
import { RecipeFormModal } from '../src/components/recipes/RecipeFormModal';

const MainLayout = () => {
  // 1. Extraemos TODO lo necesario del Contexto (Auth + Modales)
  const {
    isAuthenticated, isAuthLoading,                          // Para Auth
    isCreateMenuVisible, setCreateMenuVisible,               // Para Modales
    formModalVisible, setFormModalVisible,
    editingRecipe, setEditingRecipe, saveRecipe, importRecipeAI, categories,
    createMode, setCreateMode
  } = useApp();

  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  // 2. Lógica de Protección de Rutas (AuthGuard)
  useEffect(() => {
    if (isAuthLoading || !rootNavigationState?.key) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const inLogin = segments[0] === 'login';
    const inRegister = segments[0] === 'register';

    if (isAuthenticated && !inTabsGroup) {
      // Usuario logueado intentando entrar a login/register -> mandar a home
      router.replace('/(tabs)');
    } else if (!isAuthenticated && !inLogin && !inRegister) {
      // Usuario NO logueado -> mandar a login
      router.replace('/login');
    }
  }, [isAuthenticated, isAuthLoading, segments, rootNavigationState]);

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
      <MainLayout />
    </AppProvider>
  );
}