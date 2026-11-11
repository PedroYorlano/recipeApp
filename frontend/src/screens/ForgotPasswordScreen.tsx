import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { Text } from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EyeOff, Eye, ChevronLeft } from 'lucide-react-native';
import { ILLUSTRATIONS } from '../constants/brand';
import { CodeInput } from '../components/ui/CodeInput';
import { useRouter } from 'expo-router';
import { requestPasswordResetService, verifyPasswordResetOTPService } from '../services/api';
import { notify } from '../utils/dialogs';

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
        let timer: ReturnType<typeof setInterval> | undefined;
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
            notify("Falta el email", "Escribí el email de tu cuenta.");
            return;
        }

        setLoading(true);
        try {
            await requestPasswordResetService(email.trim());
            setStep('verify');
            setResendCooldown(60);
        } catch (error: any) {
            notify("Error", error.message || "No pudimos mandar el código. Probá de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAndReset = async () => {
        if (!otpCode || otpCode.length !== 6) {
            notify("Código incompleto", "Ingresá el código de 6 dígitos.");
            return;
        }

        if (!newPassword || newPassword.length < 8) {
            notify("Contraseña muy corta", "Tiene que tener al menos 8 caracteres.");
            return;
        }

        setLoading(true);
        try {
            await verifyPasswordResetOTPService(email.trim(), otpCode, newPassword);
            notify("¡Listo!", "Ya podés ingresar con tu nueva contraseña.", () => router.replace('/login'));
        } catch (error: any) {
            notify("Error", error.message || "No pudimos cambiar la contraseña. Revisá el código.");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setLoading(true);
        try {
            await requestPasswordResetService(email);
            setResendCooldown(60);
            notify("Código enviado", "Te mandamos uno nuevo a tu email.");
        } catch (error: any) {
            notify("Error", error.message || "No pudimos mandar otro código.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-pizca-fondo">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 20, maxWidth: 480, width: '100%', alignSelf: 'center' }}
                    keyboardShouldPersistTaps="handled"
                >
                    <TouchableOpacity
                        onPress={() => (step === 'verify' ? setStep('request') : router.replace('/login'))}
                        className="w-11 h-11 rounded-full bg-white border border-pizca-linea items-center justify-center mb-5"
                        accessibilityLabel="Volver"
                    >
                        <ChevronLeft size={22} color="#3F3128" strokeWidth={2.4} />
                    </TouchableOpacity>

                    <View className="flex-row items-end justify-between gap-3 mb-2">
                        <Text className="font-display text-[40px] leading-[42px] text-pizca-marron flex-1" accessibilityRole="header">
                            {step === 'request' ? 'Recuperá tu cuenta' : 'Nueva contraseña'}
                        </Text>
                        <Image source={ILLUSTRATIONS.frutilla} style={{ width: 50, height: 55 }} resizeMode="contain" accessible={false} />
                    </View>
                    <Text className="text-base text-pizca-texto2 mb-6">
                        {step === 'request'
                            ? 'Te mandamos un código a tu email para elegir una contraseña nueva.'
                            : <>Si <Text className="font-extrabold text-pizca-marron">{email}</Text> tiene cuenta, te llegó un código de 6 dígitos.</>}
                    </Text>

                    {step === 'request' ? (
                        <>
                            <Input label="Email" placeholder="Ej: hola@pizca.app" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" onSubmitEditing={handleRequestOTP} />
                            <Button title="Mandarme el código" onPress={handleRequestOTP} loading={loading} className="mt-1.5" />
                        </>
                    ) : (
                        <>
                            <Text className="text-[13px] font-extrabold text-pizca-marron mb-1.5">Código</Text>
                            <View className="mb-4"><CodeInput value={otpCode} onChange={setOtpCode} autoFocus /></View>
                            <Input
                                label="Contraseña nueva"
                                placeholder="Mínimo 8 caracteres"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showPassword}
                                autoComplete="new-password"
                                rightIcon={
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-1" accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                                        {showPassword ? <EyeOff size={20} color="#6B5A4E" /> : <Eye size={20} color="#6B5A4E" />}
                                    </TouchableOpacity>
                                }
                            />
                            <Button title="Guardar contraseña" onPress={handleVerifyAndReset} loading={loading} className="mt-1.5" />
                            <View className="items-center pt-4">
                                {resendCooldown > 0 ? (
                                    <Text className="text-pizca-texto2 text-sm">
                                        Podés pedir otro en <Text className="text-pizca-marron font-extrabold">{resendCooldown} s</Text>
                                    </Text>
                                ) : (
                                    <TouchableOpacity onPress={handleResendOTP} disabled={loading} className="py-1" accessibilityRole="button">
                                        <Text className="text-pizca-mostaza-texto text-sm font-extrabold">Mandarme otro código</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </>
                    )}

                    <View className="flex-1 min-h-[24px]" />
                    <TouchableOpacity className="self-center p-3" onPress={() => router.replace('/login')} accessibilityRole="link">
                        <Text className="text-pizca-mostaza-texto text-[15px] font-extrabold">
                            ¿Te acordaste? <Text className="underline">Ingresá</Text>
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};
