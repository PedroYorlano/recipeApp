import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Compass } from 'lucide-react-native';
import { COLORS, SPACING } from '../../src/theme';

export default function ExplorePage() {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Compass size={56} color={COLORS.primary} strokeWidth={1.2} />
                </View>
                <Text style={styles.title}>Explorar</Text>
                <Text style={styles.subtitle}>Próximamente</Text>
                <Text style={styles.description}>
                    Acá vas a poder descubrir recetas de otros usuarios y compartir las tuyas con la comunidad.
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
    },
    iconContainer: {
        backgroundColor: 'rgba(239, 159, 39, 0.1)',
        padding: SPACING.l,
        borderRadius: 50,
        marginBottom: SPACING.l,
        borderWidth: 1,
        borderColor: 'rgba(239, 159, 39, 0.2)',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.text.primary,
        fontFamily: 'Georgia',
        marginBottom: SPACING.s,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.primary,
        marginBottom: SPACING.m,
    },
    description: {
        fontSize: 15,
        color: COLORS.text.secondary,
        textAlign: 'center',
        lineHeight: 22,
    },
});
