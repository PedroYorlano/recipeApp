import React from 'react';
import { Tabs } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { COLORS } from '../../src/theme';
import { FloatingTabBar } from '../../src/components/FloatingTabBar';

/**
 * Pestañas con barra flotante (ver FloatingTabBar). "create" no es una pantalla: el "+" de
 * la barra abre el menú de agregar receta.
 */
export default function TabsLayout() {
  const { setCreateMenuVisible } = useApp();

  return (
    <Tabs
      tabBar={props => <FloatingTabBar {...props} onCreate={() => setCreateMenuVisible(true)} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explorar' }} />
      <Tabs.Screen name="create" options={{ title: 'Agregar receta' }} />
      <Tabs.Screen name="planner" options={{ title: 'Planificar' }} />
      <Tabs.Screen name="settings" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
