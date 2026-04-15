import React from 'react';
import { Tabs } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { useApp } from '../../src/context/AppContext';
import { Home, Plus, Settings } from 'lucide-react-native';
import { COLORS } from '../../src/theme';

export default function TabsLayout() {
  const { setCreateMenuVisible } = useApp();

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.text.secondary,
      tabBarShowLabel: false,
      headerShown: false,
      tabBarStyle: {
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: 'rgba(168, 144, 112, 0.2)', // fogon-gray/20
        height: 80,
        paddingTop: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10,
      }
    }}>
      {/* 1. HOME */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color }) => <Home size={26} color={color} strokeWidth={2.5} />,
        }}
      />

      {/* 2. BOTÓN CREAR (El signo +) */}
      <Tabs.Screen
        name="create"
        options={{
          tabBarIcon: () => (
            <View className="bg-fogon-amber w-14 h-14 rounded-[20px] justify-center items-center -mt-6 border-[3px] border-fogon-cream shadow-sm">
              <Plus size={30} color="#633806" strokeWidth={3} />
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

      {/* 3. SETTINGS */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color }) => <Settings size={26} color={color} strokeWidth={2.5} />,
        }}
      />
    </Tabs>
  );
}