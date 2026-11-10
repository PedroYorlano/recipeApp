import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { LogOut, User, Flame } from 'lucide-react-native';
import { confirmAction } from '../utils/dialogs';

export default function SettingsScreen() {
    const { logout, user } = useApp();

    const handleLogout = async () => {
        const ok = await confirmAction({
            title: "Cerrar sesión",
            message: "¿Seguro que querés salir?",
            confirmText: "Salir",
            destructive: true,
        });
        if (ok) logout();
    };

    return (
        <SafeAreaView className="flex-1 bg-fogon-cream">
            {/* Header */}
            <View className="px-6 py-4 border-b border-fogon-gray/10">
                <Text className="text-[32px] font-bold text-fogon-brown tracking-tight">Perfil</Text>
            </View>

            <View className="p-6">
                {/* Sección: Cuenta */}
                <Text className="text-[13px] font-bold text-fogon-gray ml-1 mb-2 uppercase tracking-wider">Cuenta</Text>
                <View className="bg-fogon-white rounded-[16px] overflow-hidden border border-fogon-gray/15 mb-8">
                    <View className="flex-row items-center p-4">
                        <View className="w-10 h-10 bg-fogon-cream rounded-full justify-center items-center mr-4">
                            <User size={20} color="#A89070" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm text-fogon-gray mb-0.5">Usuario</Text>
                            <Text className="text-base font-semibold text-fogon-brown">@{user?.username || 'Invitado'}</Text>
                            {user?.email ? <Text className="text-sm text-fogon-gray mt-0.5">{user.email}</Text> : null}
                        </View>
                    </View>
                </View>

                {/* Sección: Sesión */}
                <Text className="text-[13px] font-bold text-fogon-gray ml-1 mb-2 uppercase tracking-wider">Sesión</Text>
                <TouchableOpacity
                    className="bg-fogon-white py-4 rounded-[16px] items-center border border-red-400 flex-row justify-center"
                    onPress={handleLogout}
                >
                    <LogOut size={18} color="#FF3B30" />
                    <Text className="text-red-500 font-semibold text-base ml-2">Cerrar sesión</Text>
                </TouchableOpacity>

                {/* Footer */}
                <View className="mt-10 items-center opacity-50">
                    <Flame size={30} color="#EF9F27" strokeWidth={1.5} />
                    <Text className="font-bold text-fogon-brown mt-2 mb-1">Fogón</Text>
                    <Text className="text-fogon-gray text-xs">Versión 1.0.0 (Beta)</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}