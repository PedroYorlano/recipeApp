import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { Text } from '../components/ui/Typography';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EyeOff, Eye, ChevronLeft } from 'lucide-react-native';
import { ILLUSTRATIONS } from '../constants/brand';
import { CodeInput } from '../components/ui/CodeInput';
import { useRouter } from 'expo-router';
import { resendRegisterOTPService } from '../services/api';
import { notify, getErrorMessage } from '../utils/dialogs';
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

    const handleRegister = async () => {
        if (!username.trim() || !email.trim() || !password) {
            notify("Faltan datos", "Completá usuario, email y contraseña.");
            return;
        }
        if (password.length < 8) {
            notify("Contraseña muy corta", "La contraseña tiene que tener al menos 8 caracteres.");
            return;
        }

        setLoading(true);
        try {
            await register(username.trim(), email.trim(), password);
            setStep('otp');
            setResendCooldown(60);
                    } catch (error) {
            notify("Error en el registro", getErrorMessage(error, "Algo salió mal. Revisá los datos."));
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otpCode || otpCode.length !== 6) {
            notify("Código incompleto", "Ingresá el código de 6 dígitos.");
            return;
        }

        setLoading(true);
        try {
            await verifyRegisterOTP(email.trim(), otpCode);
            notify("¡Listo!", "Te damos la bienvenida a Pizca.");
        } catch (error) {
            notify("Error de verificación", getErrorMessage(error, "El código ingresado es incorrecto o expiró."));
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setLoading(true);
        try {
            await resendRegisterOTPService(email.trim());
            setResendCooldown(60);
            notify("Código enviado", "Te mandamos uno nuevo a tu email.");
        } catch (error) {
            notify("Error", getErrorMessage(error, "No pudimos mandar otro código. Probá más tarde."));
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
                        onPress={() => (step === 'otp' ? setStep('form') : router.replace('/login'))}
                        className="w-11 h-11 rounded-full bg-white border border-pizca-linea items-center justify-center mb-5"
                        accessibilityLabel="Volver"
                    >
                        <ChevronLeft size={22} color="#3F3128" strokeWidth={2.4} />
                    </TouchableOpacity>

                    <View className="flex-row items-end justify-between gap-3 mb-2">
                        <Text className="font-display text-[40px] leading-[42px] text-pizca-marron flex-1" accessibilityRole="header">
                            {step === 'form' ? 'Creá tu cuenta' : 'Revisá tu email'}
                        </Text>
                        <Image source={ILLUSTRATIONS.nabo} style={{ width: 52, height: 60 }} resizeMode="contain" accessible={false} />
                    </View>
                    <Text className="text-base text-pizca-texto2 mb-6">
                        {step === 'form' ? 'Tus recetas, en orden y en un solo lugar.' : <>Te mandamos un código de 6 dígitos a <Text className="font-extrabold text-pizca-marron">{email}</Text>.</>}
                    </Text>

                    {step === 'form' ? (
                        <>
                            <Input label="Usuario" placeholder="Ej: ana_cocina" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" />
                            <Input label="Email" placeholder="Ej: hola@pizca.app" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
                            <Input
                                label="Contraseña"
                                placeholder="Mínimo 8 caracteres"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoComplete="new-password"
                                rightIcon={
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-1" accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                                        {showPassword ? <EyeOff size={20} color="#6B5A4E" /> : <Eye size={20} color="#6B5A4E" />}
                                    </TouchableOpacity>
                                }
                            />
                            <Button title="Crear cuenta" onPress={handleRegister} loading={loading} className="mt-1.5" />

                            {FEATURES.GOOGLE_AUTH && (
                                <>
                                    <View className="flex-row items-center gap-3 my-[22px]">
                                        <View className="flex-1 h-px bg-pizca-linea" />
                                        <Text className="text-pizca-texto2 text-[13px] font-extrabold">o</Text>
                                        <View className="flex-1 h-px bg-pizca-linea" />
                                    </View>
                                    <Button title="Continuar con Google" variant="outline" onPress={() => notify('Próximamente', 'Esta función va a estar disponible muy pronto.')} />
                                </>
                            )}
                        </>
                    ) : (
                        <View className="p-[18px] rounded-[20px] bg-white border border-pizca-linea gap-3">
                            <Text className="text-xs font-extrabold tracking-wider uppercase text-pizca-albahaca">Paso 2 · Verificación</Text>
                            <Text className="text-sm leading-5 text-pizca-texto2">Escribí el código que te llegó. Si no lo ves, fijate en spam.</Text>
                            <CodeInput value={otpCode} onChange={setOtpCode} autoFocus />
                            <Button title="Confirmar código" onPress={handleVerifyOTP} loading={loading} className="mt-1" />
                            <View className="items-center pt-1">
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
                        </View>
                    )}

                    <View className="flex-1 min-h-[24px]" />
                    <TouchableOpacity className="self-center p-3" onPress={() => router.replace('/login')} accessibilityRole="link">
                        <Text className="text-pizca-mostaza-texto text-[15px] font-extrabold">
                            ¿Ya tenés cuenta? <Text className="underline">Ingresá</Text>
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};
