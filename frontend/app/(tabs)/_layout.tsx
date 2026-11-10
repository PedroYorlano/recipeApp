import React from 'react';
import { Tabs } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { useApp } from '../../src/context/AppContext';
import { Home, Compass, Plus, CalendarDays, User } from 'lucide-react-native';
import { COLORS } from '../../src/theme';
import { FEATURES } from '../../src/constants/features';

export default function TabsLayout() {
  const { setCreateMenuVisible } = useApp();

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.text.secondary,
      tabBarShowLabel: false,
      headerShown: false,
      tabBarStyle: {
        backgroundColor: COLORS.card,
        borderTopWidth: 1,
        borderTopColor: 'rgba(168, 144, 112, 0.12)',
        height: 80,
        paddingTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 8,
      }
    }}>
      {/* 1. HOME */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Home size={24} color={color} strokeWidth={2} />,
        }}
      />

      {/* 2. EXPLORAR */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorar',
          href: FEATURES.EXPLORE ? undefined : null,
          tabBarIcon: ({ color }) => <Compass size={24} color={color} strokeWidth={2} />,
        }}
      />

      {/* 3. BOTÓN CREAR (El signo +) */}
      <Tabs.Screen
        name="create"
        options={{
          tabBarIcon: () => (
            <View style={{
              backgroundColor: COLORS.primary,
              width: 52,
              height: 52,
              borderRadius: 18,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: -20,
              borderWidth: 3,
              borderColor: COLORS.card,
            }}>
              <Plus size={28} color={COLORS.secondary} strokeWidth={3} />
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
          tabBarIcon: ({ color }) => <CalendarDays size={24} color={color} strokeWidth={2} />,
        }}
      />

      {/* 5. PERFIL */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <User size={24} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}