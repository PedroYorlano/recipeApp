import React from 'react';
import { View, TouchableOpacity, Image, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { LogOut } from 'lucide-react-native';
import { Text } from '../components/ui/Typography';
import { useApp } from '../context/AppContext';
import { confirmAction } from '../utils/dialogs';
import { ILLUSTRATIONS } from '../constants/brand';
import { useTabBarSpace } from '../components/FloatingTabBar';

const APP_ICON = require('../../assets/images/icon.png');

/** En la web, si no está instalada como app. */
const showInstallTip = () =>
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    !window.matchMedia?.('(display-mode: standalone)').matches;

export default function SettingsScreen() {
    const tabBarSpace = useTabBarSpace();
    const { logout, user } = useApp();
    const version = Constants.expoConfig?.version ?? '1.0.0';

    const handleLogout = async () => {
        const ok = await confirmAction({
            title: 'Cerrar sesión',
            message: '¿Seguro que querés salir?',
            confirmText: 'Salir',
            destructive: true,
        });
        if (ok) logout();
    };

    return (
        <SafeAreaView className="flex-1 bg-pizca-fondo" edges={['top']}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: tabBarSpace, gap: 20, flexGrow: 1, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
                <Text className="font-display text-[32px] leading-[34px] text-pizca-marron" accessibilityRole="header">Perfil</Text>

                {/* Cuenta */}
                <View className="flex-row items-center gap-3.5 p-[18px] rounded-[24px] bg-white border border-pizca-linea">
                    <View className="w-16 h-16 rounded-full bg-pizca-mostaza items-center justify-center">
                        <Text className="font-display text-[30px] text-pizca-marron">{(user?.username || '?').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View className="flex-1 gap-0.5">
                        <Text className="text-lg font-extrabold text-pizca-marron" numberOfLines={1}>@{user?.username || 'invitado'}</Text>
                        {user?.email ? <Text className="text-sm text-pizca-texto2" numberOfLines={1}>{user.email}</Text> : null}
                    </View>
                </View>

                {/* Sesión */}
                <View className="gap-2">
                    <Text className="mx-1 text-[13px] font-extrabold tracking-wider uppercase text-pizca-texto2">Sesión</Text>
                    <View className="bg-white rounded-[20px] border border-pizca-linea overflow-hidden">
                        <TouchableOpacity
                            className="min-h-[56px] flex-row items-center gap-3 px-4"
                            onPress={handleLogout}
                            accessibilityRole="button"
                        >
                            <LogOut size={20} color="#B23A12" strokeWidth={2.2} />
                            <Text className="text-base font-extrabold text-pizca-tomate-texto">Cerrar sesión</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {showInstallTip() ? (
                    <View className="flex-row gap-3.5 items-center p-4 rounded-[20px] bg-pizca-crema">
                        <Image source={APP_ICON} style={{ width: 48, height: 48, borderRadius: 12 }} />
                        <View className="flex-1 gap-0.5">
                            <Text className="text-[15px] font-extrabold text-pizca-marron">Tené Pizca a mano</Text>
                            <Text className="text-[13px] leading-[18px] text-pizca-texto2">Desde el navegador, tocá Compartir → Agregar a inicio.</Text>
                        </View>
                    </View>
                ) : null}

                <View className="flex-1 min-h-[24px]" />

                {/* Pie */}
                <View className="items-center gap-2 pb-4" accessible accessibilityLabel={`Pizca, versión ${version}`}>
                    <View className="flex-row gap-2.5 items-end">
                        <Image source={ILLUSTRATIONS.zanahoria} style={{ width: 36, height: 44, transform: [{ rotate: '-14deg' }] }} resizeMode="contain" />
                        <Image source={ILLUSTRATIONS.tomate} style={{ width: 33, height: 34 }} resizeMode="contain" />
                        <Image source={ILLUSTRATIONS.nabo} style={{ width: 35, height: 40 }} resizeMode="contain" />
                    </View>
                    <Text className="font-display text-[22px] text-pizca-mostaza-texto">Una pizca alcanza</Text>
                    <Text className="text-xs font-bold text-pizca-texto2">Pizca · versión {version} (beta)</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
