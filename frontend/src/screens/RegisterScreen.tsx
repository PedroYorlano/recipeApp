import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Flame, EyeOff, Eye, Mail, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { resendRegisterOTPService } from '../services/api';
import { notify } from '../utils/dialogs';
import { FEATURES } from '../constants/features';

export const RegisterScreen = () => {
    const [step, setStep] = useState<'form' | 'otp'>('form');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const { register, verifyRegisterOTP } = useApp();
    const router = useRouter();

    // Contador para el reenvío del OTP
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (resendCooldown > 0) {
            timer = setInterval(() => {
                setResendCooldown(prev => prev - 1);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [resendCooldown]);

    const handleRegister = async () => {
        if (!username || !email || !password) {
            notify("⚠️ Ups", "Asegurate de completar todos los campos para registrarte.");
            return;
        }

        setLoading(true);
        try {
            await register(username, email, password);
            setStep('otp');
            setResendCooldown(60);
            notify("¡Código enviado! ✉️", `Enviamos un código de verificación de 6 dígitos a ${email}.`);
        } catch (error: any) {
            notify("Error en el registro", error.message || "Ocurrió un error. Verificá los datos.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otpCode || otpCode.length !== 6) {
            notify("⚠️ Código incompleto", "Por favor ingresá el código de 6 dígitos.");
            return;
        }

        setLoading(true);
        try {
            await verifyRegisterOTP(email, otpCode);
            notify("¡Cuenta verificada! 🎉", "Te damos la bienvenida a Fogón.");
        } catch (error: any) {
            notify("Error de verificación", error.message || "El código ingresado es incorrecto o expiró.");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setLoading(true);
        try {
            await resendRegisterOTPService(email);
            setResendCooldown(60);
            notify("Reenviado ✉️", "Te enviamos un nuevo código OTP a tu correo.");
        } catch (error: any) {
            notify("Error", error.message || "No se pudo reenviar el código. Intentá más tarde.");
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
                {step === 'form' ? (
                    <>
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

                            {/* Fake link for demo purposes */}
                            <TouchableOpacity className="mt-8 mb-2 items-center" onPress={() => router.back()}>
                                <Text className="text-fogon-amber text-[15px] font-bold">¿Ya tenés cuenta? Ingresá</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <>
                        {/* Llama o Icono superior de Verificación */}
                        <View className="items-center mb-8">
                            <View className="bg-fogon-white rounded-full p-5 shadow-sm border border-fogon-amber/20 mb-4">
                                <Mail size={48} color="#EF9F27" strokeWidth={1.5} />
                            </View>
                            <Text className="text-[32px] font-bold text-fogon-brown tracking-tight text-center">Verificación</Text>
                            <Text className="text-fogon-gray text-center text-base mt-2 font-medium px-4">
                                Te enviamos un código a:{"\n"}
                                <Text className="font-bold text-fogon-brown">{email}</Text>
                            </Text>
                        </View>

                        {/* Card Blanca */}
                        <View className="bg-fogon-white rounded-[24px] p-6 shadow-sm border border-fogon-gray/10">
                            <Input
                                label="Código de 6 dígitos"
                                placeholder="123456"
                                value={otpCode}
                                onChangeText={setOtpCode}
                                keyboardType="number-pad"
                                maxLength={6}
                                autoFocus={true}
                                className="text-center text-2xl font-bold tracking-[10px] pl-3"
                            />

                            <View className="mt-2">
                                <Button
                                    title="Confirmar Código"
                                    onPress={handleVerifyOTP}
                                    loading={loading}
                                />
                            </View>

                            {/* Reenvío de código */}
                            <View className="items-center mt-6">
                                {resendCooldown > 0 ? (
                                    <Text className="text-fogon-gray text-sm font-medium">
                                        Reenviar código en <Text className="text-fogon-brown font-bold">{resendCooldown}s</Text>
                                    </Text>
                                ) : (
                                    <TouchableOpacity onPress={handleResendOTP} disabled={loading}>
                                        <Text className="text-fogon-amber text-sm font-bold">
                                            Reenviar código por correo
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <TouchableOpacity 
                                className="mt-8 flex-row items-center justify-center" 
                                onPress={() => setStep('form')}
                            >
                                <ArrowLeft size={16} color="#EF9F27" className="mr-1" />
                                <Text className="text-fogon-amber text-[15px] font-bold">Volver a registrarme</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </KeyboardAvoidingView>
        </View>
    );
};
