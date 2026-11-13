import React from 'react';
import { Tabs } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { useApp } from '../../src/context/AppContext';
import { Home, Compass, Plus, CalendarDays, User } from 'lucide-react-native';
import { COLORS } from '../../src/theme';
import { FONT } from '../../src/components/ui/Typography';

export default function TabsLayout() {
  const { setCreateMenuVisible } = useApp();

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: COLORS.secondary,
      tabBarInactiveTintColor: COLORS.text.secondary,
      tabBarLabelStyle: { fontSize: 11, fontFamily: FONT.extrabold, marginTop: 2 },
      headerShown: false,
      sceneStyle: { backgroundColor: COLORS.background },
      tabBarStyle: {
        backgroundColor: COLORS.card,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        height: 88,
        paddingTop: 8,
        elevation: 0,
      }
    }}>
      {/* 1. HOME */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, focused }) => <Home size={24} color={color} strokeWidth={2} fill={focused ? COLORS.primary : 'transparent'} />,
        }}
      />

      {/* 2. EXPLORAR */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, focused }) => <Compass size={24} color={color} strokeWidth={2} fill={focused ? COLORS.primary : 'transparent'} />,
        }}
      />

      {/* 3. BOTÓN CREAR (El signo +) */}
      <Tabs.Screen
        name="create"
        options={{
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: 'Agregar receta',
          tabBarIcon: () => (
            <View style={{
              backgroundColor: COLORS.primary,
              width: 56,
              height: 56,
              borderRadius: 18,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: -18,
              shadowColor: COLORS.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 14,
              elevation: 6,
            }}>
              <Plus size={26} color={COLORS.secondary} strokeWidth={2.6} />
            </View>
          ),
          tabBarButton: (props) => (
            <TouchableOpacity
              style={props.style}
              onPress={() => setCreateMenuVisible(true)}
              activeOpacity={0.9}
            >
              {props.children}
            </TouchableOpacity>
          )
        }}
      />

      {/* 4. PLANIFICAR */}
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Planificar',
          tabBarIcon: ({ color, focused }) => <CalendarDays size={24} color={color} strokeWidth={2} fill={focused ? COLORS.primary : 'transparent'} />,
        }}
      />

      {/* 5. PERFIL */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => <User size={24} color={color} strokeWidth={2} fill={focused ? COLORS.primary : 'transparent'} />,
        }}
      />
    </Tabs>
  );
}