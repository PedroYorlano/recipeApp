import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, StatusBar } from 'react-native';
import { useApp } from '../context/AppContext';

// IMPORTAMOS EL TEMA
import { COLORS, SPACING, RADIUS, globalStyles } from '../theme';

export default function SettingsScreen() {
    const { logout, user } = useApp();

    const handleLogout = () => {
        Alert.alert(
            "Cerrar Sesión",
            "¿Estás seguro que quieres salir?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Salir",
                    style: "destructive",
                    onPress: () => logout()
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Configuración</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>CUENTA</Text>
                    <View style={styles.card}>
                        <View style={styles.row}>
                            <View style={styles.rowIcon}>
                                <Text style={{ fontSize: 20 }}>👤</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabel}>Usuario</Text>
                                <Text style={styles.rowValue}>@{user?.username || 'Invitado'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SESIÓN</Text>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <Text style={styles.logoutText}>Cerrar Sesión actual</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={{ fontSize: 30, marginBottom: 10 }}>👨‍🍳</Text>
                    <Text style={styles.footerText}>ChefAI App</Text>
                    <Text style={styles.versionText}>Versión 1.0.0 (Beta)</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background
    },
    header: {
        paddingHorizontal: SPACING.l,
        paddingVertical: SPACING.m,
        backgroundColor: COLORS.card,
        borderBottomWidth: 1,
        borderColor: 'transparent'
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.text.primary,
        letterSpacing: -0.5
    },
    content: {
        padding: SPACING.l
    },
    section: {
        marginBottom: SPACING.xl
    },
    sectionTitle: {
        fontSize: 13,
        color: COLORS.text.secondary,
        marginBottom: SPACING.s,
        fontWeight: 'bold',
        marginLeft: SPACING.xs
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.m,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border + '40' // Muy sutil
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m
    },
    rowIcon: {
        width: 40,
        height: 40,
        backgroundColor: COLORS.background,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m
    },
    rowLabel: { fontSize: 14, color: COLORS.text.secondary, marginBottom: 2 },
    rowValue: { fontSize: 16, color: COLORS.text.primary, fontWeight: '600' },

    logoutButton: {
        backgroundColor: COLORS.card,
        paddingVertical: SPACING.m,
        borderRadius: RADIUS.m,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.danger,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10
    },
    logoutText: {
        color: COLORS.danger,
        fontWeight: '600',
        fontSize: 16
    },

    footer: {
        marginTop: SPACING.xl,
        alignItems: 'center',
        opacity: 0.5
    },
    footerText: {
        fontWeight: 'bold',
        color: COLORS.text.primary,
        marginBottom: 4
    },
    versionText: {
        color: COLORS.text.secondary,
        fontSize: 12
    }
});