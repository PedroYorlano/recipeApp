import React, { useState } from 'react';
import { View, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { Text } from '../components/ui/Typography';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EyeOff, Eye } from 'lucide-react-native';
import { ILLUSTRATIONS, LOGO } from '../constants/brand';
import { useRouter } from 'expo-router';
import { notify } from '../utils/dialogs';
import { FEATURES } from '../constants/features';

export const LoginScreen = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const login = useApp();
    const router = useRouter();

    const handleLogin = async () => {
        if (!username.trim() || !password) {
            notify("Faltan datos", "Completá tu usuario y tu contraseña para entrar.");
            return;
        }

        setLoading(true);
        try {
            await login.login(username.trim(), password);
        } catch {
            notify("Algo no coincide", "Revisá tu usuario y tu contraseña, y probá de nuevo.", undefined, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-pizca-fondo overflow-hidden">
            {/* Ilustraciones de fondo */}
            <Image source={ILLUSTRATIONS.zanahoria} style={{ position: 'absolute', right: -14, top: 40, width: 68, height: 84, transform: [{ rotate: '24deg' }] }} resizeMode="contain" accessible={false} />
            <Image source={ILLUSTRATIONS.tomate} style={{ position: 'absolute', left: -16, top: 150, width: 54, height: 56 }} resizeMode="contain" accessible={false} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 24, maxWidth: 480, width: '100%', alignSelf: 'center' }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="items-center gap-3 mb-9">
                        <Image source={LOGO} style={{ width: 121, height: 128 }} resizeMode="contain" accessibilityLabel="Pizca" />
                        <Text className="text-base font-bold text-pizca-texto2">Tu recetario, siempre a mano.</Text>
                    </View>

                    <Input
                        label="Email o usuario"
                        placeholder="Ej: hola@pizca.app"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="username"
                    />
                    <Input
                        label="Contraseña"
                        placeholder="Tu contraseña"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoComplete="current-password"
                        onSubmitEditing={handleLogin}
                        rightIcon={
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-1" accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                                {showPassword ? <EyeOff size={20} color="#6B5A4E" /> : <Eye size={20} color="#6B5A4E" />}
                            </TouchableOpacity>
                        }
                    />

                    <TouchableOpacity className="self-end py-1 -mt-1 mb-4" onPress={() => router.push('/forgot-password')} accessibilityRole="link">
                        <Text className="text-pizca-mostaza-texto text-sm font-extrabold">¿Olvidaste tu contraseña?</Text>
                    </TouchableOpacity>

                    <Button title="Ingresar" onPress={handleLogin} loading={loading} />

                    {FEATURES.GOOGLE_AUTH && (
                        <>
                            <View className="flex-row items-center gap-3 my-[22px]">
                                <View className="flex-1 h-px bg-pizca-linea" />
                                <Text className="text-pizca-texto2 text-[13px] font-extrabold">o</Text>
                                <View className="flex-1 h-px bg-pizca-linea" />
                            </View>
                            <Button
                                title="Continuar con Google"
                                variant="outline"
                                onPress={() => notify('Próximamente', 'Esta función va a estar disponible muy pronto.')}
                            />
                        </>
                    )}

                    <View className="flex-1 min-h-[24px]" />
                    <TouchableOpacity className="self-center p-3" onPress={() => router.push('/register')} accessibilityRole="link">
                        <Text className="text-pizca-mostaza-texto text-[15px] font-extrabold">
                            ¿No tenés cuenta? <Text className="underline">Registrate</Text>
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};
