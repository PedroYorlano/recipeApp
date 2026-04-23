import React, { useState } from 'react';
import { Alert, View, TouchableOpacity, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Flame, EyeOff, Eye } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export const RegisterScreen = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const { register } = useApp();
    const router = useRouter();

    const handleRegister = async () => {
        if (!username || !email || !password) {
            Alert.alert("⚠️ Ups", "Asegurate de completar todos los campos para registrarte.");
            return;
        }

        setLoading(true);
        try {
            await register(username, email, password);
        } catch (error: any) {
            Alert.alert("Error en el registro", error.message || "Ocurrió un error. Verificá los datos.");
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
                    <Text className="text-[40px] font-bold text-fogon-brown tracking-tight">Registro</Text>
                    <Text className="text-fogon-gray text-base mt-2 font-medium">Unite a Fogón.</Text>
                </View>

                {/* Card Blanca */}
                <View className="bg-fogon-white rounded-[24px] p-6 shadow-sm border border-fogon-gray/10">
                    <Input
                        label="Usuario"
                        placeholder="Ej: chef_fogon"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                    />

                    <Input
                        label="Email"
                        placeholder="Ej: hola@fogon.com"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
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

                    <View className="mt-4">
                        <Button
                            title="Crear Cuenta"
                            onPress={handleRegister}
                            loading={loading}
                        />
                    </View>

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
                        onPress={() => Alert.alert("Próximamente", "Esta función estará disponible muy pronto.")}
                    />

                    {/* Fake link for demo purposes */}
                    <TouchableOpacity className="mt-8 mb-2 items-center" onPress={() => router.back()}>
                        <Text className="text-fogon-amber text-[15px] font-bold">¿Ya tenés cuenta? Ingresá</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};
