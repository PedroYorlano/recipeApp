import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';
import { useApp } from '../../src/context/AppContext';

export default function TabsLayout() {
  const { setCreateMenuVisible } = useApp();

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#007bff',
      tabBarShowLabel: false,
      headerShown: false,
    }}>
      {/* 1. HOME */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />

      {/* 2. BOTÓN CREAR (El signo +) */}
      <Tabs.Screen
        name="create"
        options={{
          tabBarIcon: () => (
            <View style={{
              backgroundColor: '#007bff',
              width: 50, height: 50, borderRadius: 25,
              justifyContent: 'center', alignItems: 'center', marginBottom: 20,
              shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 2 }
            }}>
              <Ionicons name="add" size={32} color="white" />
            </View>
          ),
          tabBarButton: (props) => (
            <TouchableOpacity
              style={props.style}
              onPress={() => setCreateMenuVisible(true)}
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
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}