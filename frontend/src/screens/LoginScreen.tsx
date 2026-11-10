import React, { useState } from 'react';
import { ActivityIndicator, View, TouchableOpacity, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Flame, EyeOff, Eye } from 'lucide-react-native';
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
            notify("⚠️ Ups", "Asegurate de completar ambos campos para ingresar.");
            return;
        }

        setLoading(true);
        try {
            await login.login(username.trim(), password);
        } catch (error) {
            notify("Error", "Los datos no coinciden. ¿Probamos de nuevo?");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-fogon-cream justify-center pt-10">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1 justify-center px-4 md:px-8 max-w-lg mx-auto w-full"
            >
                {/* Llama o Icono superior */}
                <View className="items-center mb-8">
                    <View className="bg-fogon-white rounded-full p-5 shadow-sm border border-fogon-amber/20 mb-4">
                        <Flame size={48} color="#EF9F27" strokeWidth={1.5} />
                    </View>
                    <Text className="text-[40px] font-bold text-fogon-brown tracking-tight">Fogón</Text>
                    <Text className="text-fogon-gray text-base mt-2 font-medium">Tu recetario, siempre a mano.</Text>
                </View>

                {/* Card Blanca */}
                <View className="bg-fogon-white rounded-[24px] p-6 shadow-sm border border-fogon-gray/10">
                    <Input
                        label="Email o Usuario"
                        placeholder="Ej: chef@fogon.com"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                    />

                    <Input
                        label="Contraseña"
                        placeholder="••••••"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        rightIcon={
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
                                {showPassword ? <EyeOff size={20} color="#A89070" /> : <Eye size={20} color="#A89070" />}
                            </TouchableOpacity>
                        }
                    />

                    <TouchableOpacity 
                        className="items-end mt-1 mb-4" 
                        onPress={() => router.push('/forgot-password')}
                    >
                        <Text className="text-fogon-amber text-sm font-semibold">¿Olvidaste tu contraseña?</Text>
                    </TouchableOpacity>

                    <View className="mt-2">
                        <Button
                            title="Ingresar"
                            onPress={handleLogin}
                            loading={loading}
                        />
                    </View>

                    {FEATURES.GOOGLE_AUTH && (
                        <>
                            {/* Separador */}
                            <View className="flex-row items-center my-6">
                                <View className="flex-1 h-[1px] bg-fogon-gray/20" />
                                <Text className="mx-4 text-fogon-gray text-sm font-semibold uppercase tracking-wider">o</Text>
                                <View className="flex-1 h-[1px] bg-fogon-gray/20" />
                            </View>

                            {/* Botón Google outline */}
                            <Button
                                title="Continuar con Google"
                                variant="outline"
                                onPress={() => notify("Próximamente", "Esta función estará disponible muy pronto.")}
                            />
                        </>
                    )}

                    {/* Link a registro */}
                    <TouchableOpacity className="mt-8 mb-2 items-center" onPress={() => router.push('/register')}>
                        <Text className="text-fogon-amber text-[15px] font-bold">¿No tenés cuenta? Registrate</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};