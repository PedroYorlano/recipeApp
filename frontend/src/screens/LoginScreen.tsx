import React, { useState } from 'react';
import { ActivityIndicator, Alert, Button, StyleSheet, Text, TextInput, View, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useApp } from '../context/AppContext';

// IMPORTAMOS EL TEMA
import { COLORS, SPACING, RADIUS, globalStyles } from '../theme';

export const LoginScreen = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const login = useApp();

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert("Error", "Completa todos los campos");
            return;
        }

        setLoading(true);
        try {
            await login.login(username, password);
        } catch (error) {
            Alert.alert("Error", "Usuario o contraseña incorrectos");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={globalStyles.screenContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
            >
                <View style={styles.card}>
                    <View style={styles.headerIcon}>
                        <Text style={{ fontSize: 50 }}>👨‍🍳</Text>
                    </View>

                    <Text style={styles.title}>ChefAI</Text>
                    <Text style={styles.subtitle}>Tu cocina inteligente</Text>

                    <View style={styles.form}>
                        <Text style={globalStyles.label}>Usuario</Text>
                        <TextInput
                            style={globalStyles.input}
                            placeholder="Ej: chef_pedro"
                            placeholderTextColor={COLORS.text.secondary}
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />

                        <Text style={globalStyles.label}>Contraseña</Text>
                        <TextInput
                            style={globalStyles.input}
                            placeholder="••••••"
                            placeholderTextColor={COLORS.text.secondary}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        {loading ? (
                            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
                        ) : (
                            <TouchableOpacity
                                style={[globalStyles.primaryButton, { marginTop: SPACING.l }]}
                                onPress={handleLogin}
                            >
                                <Text style={globalStyles.primaryButtonText}>Iniciar Sesión</Text>
                            </TouchableOpacity>
                        )}

                        {/* Fake link for demo purposes */}
                        <TouchableOpacity style={{ marginTop: SPACING.l, alignItems: 'center' }}>
                            <Text style={{ color: COLORS.primary, fontSize: 14 }}>¿Olvidaste tu contraseña?</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        padding: SPACING.l
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.l,
        padding: SPACING.xl,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 5,
    },
    headerIcon: {
        alignSelf: 'center',
        marginBottom: SPACING.m,
        backgroundColor: COLORS.background,
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center'
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        textAlign: 'center',
        color: COLORS.text.primary,
        letterSpacing: -1
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: SPACING.xl,
        color: COLORS.text.secondary
    },
    form: {
        marginTop: SPACING.s
    }
});