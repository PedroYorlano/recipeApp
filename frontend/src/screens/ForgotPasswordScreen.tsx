import React, { useState, useEffect } from 'react';
import { Alert, View, TouchableOpacity, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Flame, EyeOff, Eye, KeyRound, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { requestPasswordResetService, verifyPasswordResetOTPService } from '../services/api';

export const ForgotPasswordScreen = () => {
    const [step, setStep] = useState<'request' | 'verify'>('request');
    const [email, setEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const router = useRouter();

    // Contador para reenviar el OTP
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

    const handleRequestOTP = async () => {
        if (!email) {
            Alert.alert("⚠️ Ups", "Por favor ingresá tu correo electrónico.");
            return;
        }

        setLoading(true);
        try {
            await requestPasswordResetService(email);
            setStep('verify');
            setResendCooldown(60);
            Alert.alert("Código enviado ✉️", "Si tu correo está registrado, recibirás un código de 6 dígitos.");
        } catch (error: any) {
            Alert.alert("Error", error.message || "No pudimos enviar el código. Intentá de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAndReset = async () => {
        if (!otpCode || otpCode.length !== 6) {
            Alert.alert("⚠️ Código incompleto", "Por favor ingresá el código OTP de 6 dígitos.");
            return;
        }

        if (!newPassword || newPassword.length < 8) {
            Alert.alert("⚠️ Contraseña inválida", "La nueva contraseña debe tener al menos 8 caracteres.");
            return;
        }

        setLoading(true);
        try {
            await verifyPasswordResetOTPService(email, otpCode, newPassword);
            Alert.alert("¡Éxito! 🎉", "Tu contraseña ha sido restablecida con éxito.", [
                { text: "Ingresar", onPress: () => router.replace('/login') }
            ]);
        } catch (error: any) {
            Alert.alert("Error", error.message || "No se pudo restablecer la contraseña. Verificá los datos.");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setLoading(true);
        try {
            await requestPasswordResetService(email);
            setResendCooldown(60);
            Alert.alert("Reenviado ✉️", "Enviamos un nuevo código OTP a tu correo.");
        } catch (error: any) {
            Alert.alert("Error", error.message || "No se pudo reenviar el código.");
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
                {step === 'request' ? (
                    <>
                        {/* Cabecera */}
                        <View className="items-center mb-8">
                            <View className="bg-fogon-white rounded-full p-5 shadow-sm border border-fogon-amber/20 mb-4">
                                <KeyRound size={48} color="#EF9F27" strokeWidth={1.5} />
                            </View>
                            <Text className="text-[32px] font-bold text-fogon-brown tracking-tight text-center">Recuperación</Text>
                            <Text className="text-fogon-gray text-center text-base mt-2 font-medium px-6">
                                Ingresá tu correo electrónico para recibir un código de restablecimiento.
                            </Text>
                        </View>

                        {/* Card blanca */}
                        <View className="bg-fogon-white rounded-[24px] p-6 shadow-sm border border-fogon-gray/10">
                            <Input
                                label="Email"
                                placeholder="Ej: chef@fogon.com"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />

                            <View className="mt-4">
                                <Button
                                    title="Enviar Código"
                                    onPress={handleRequestOTP}
                                    loading={loading}
                                />
                            </View>

                            <TouchableOpacity 
                                className="mt-8 flex-row items-center justify-center" 
                                onPress={() => router.back()}
                            >
                                <ArrowLeft size={16} color="#EF9F27" className="mr-1" />
                                <Text className="text-fogon-amber text-[15px] font-bold">Volver al Ingreso</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <>
                        {/* Cabecera para verificación */}
                        <View className="items-center mb-8">
                            <View className="bg-fogon-white rounded-full p-5 shadow-sm border border-fogon-amber/20 mb-4">
                                <Flame size={48} color="#EF9F27" strokeWidth={1.5} />
                            </View>
                            <Text className="text-[32px] font-bold text-fogon-brown tracking-tight text-center">Nueva Contraseña</Text>
                            <Text className="text-fogon-gray text-center text-base mt-2 font-medium px-4">
                                Ingresá el código enviado a{"\n"}
                                <Text className="font-bold text-fogon-brown">{email}</Text>
                            </Text>
                        </View>

                        {/* Card blanca */}
                        <View className="bg-fogon-white rounded-[24px] p-6 shadow-sm border border-fogon-gray/10">
                            <Input
                                label="Código OTP"
                                placeholder="123456"
                                value={otpCode}
                                onChangeText={setOtpCode}
                                keyboardType="number-pad"
                                maxLength={6}
                                autoFocus={true}
                                className="text-center text-2xl font-bold tracking-[10px] pl-3"
                            />

                            <Input
                                label="Nueva Contraseña"
                                placeholder="Mínimo 8 caracteres"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showPassword}
                                rightIcon={
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
                                        {showPassword ? <EyeOff size={20} color="#A89070" /> : <Eye size={20} color="#A89070" />}
                                    </TouchableOpacity>
                                }
                            />

                            <View className="mt-4">
                                <Button
                                    title="Restablecer Contraseña"
                                    onPress={handleVerifyAndReset}
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
                                onPress={() => setStep('request')}
                            >
                                <ArrowLeft size={16} color="#EF9F27" className="mr-1" />
                                <Text className="text-fogon-amber text-[15px] font-bold">Volver a pedir código</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </KeyboardAvoidingView>
        </View>
    );
};
