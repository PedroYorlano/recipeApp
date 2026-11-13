import React from 'react';
import { View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../src/components/ui/Typography';
import { ILLUSTRATIONS } from '../../src/constants/brand';
import { useTabBarSpace } from '../../src/components/FloatingTabBar';

/** Pestaña visible pero sin contenido todavía: deja el "+" centrado en la barra. */
export default function ExplorePage() {
    const tabBarSpace = useTabBarSpace();
    return (
        <SafeAreaView className="flex-1 bg-pizca-fondo">
            <View className="flex-1 items-center justify-center px-8 gap-2" style={{ paddingBottom: tabBarSpace }}>
                <Image source={ILLUSTRATIONS.frutilla} style={{ width: 64, height: 70, marginBottom: 12 }} resizeMode="contain" />
                <Text className="font-display text-[28px] text-pizca-marron">Explorar</Text>
                <Text className="text-base font-extrabold text-pizca-mostaza-texto">Muy pronto</Text>
                <Text className="text-[15px] leading-[22px] text-pizca-texto2 text-center">
                    Acá vas a poder descubrir recetas de otras personas y compartir las tuyas.
                </Text>
            </View>
        </SafeAreaView>
    );
}
