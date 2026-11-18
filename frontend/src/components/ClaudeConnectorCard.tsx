import React, { useState } from 'react';
import { View, TouchableOpacity, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ChevronDown, ChevronUp, Copy, Check, ExternalLink, Sparkles } from 'lucide-react-native';
import { Text } from './ui/Typography';
import { MCP_URL } from '../constants';

const CONNECTORS_URL = 'https://claude.ai/settings/connectors';

/**
 * Guía para agregar Pizca como conector personalizado de Claude (el MCP remoto con OAuth).
 * No se muestra si el build no tiene EXPO_PUBLIC_MCP_URL.
 */
export function ClaudeConnectorCard() {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const url = MCP_URL;
    if (!url) return null;

    const copy = async () => {
        try {
            await Clipboard.setStringAsync(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Sin permiso para el portapapeles: la dirección igual se ve y se puede seleccionar.
        }
    };

    return (
        <View className="gap-2">
            <Text className="mx-1 text-[13px] font-extrabold tracking-wider uppercase text-pizca-texto2">Claude</Text>
            <View className="bg-white rounded-[20px] border border-pizca-linea overflow-hidden">
                <TouchableOpacity
                    className="flex-row items-center gap-3 p-4"
                    onPress={() => setOpen(o => !o)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                >
                    <View className="w-11 h-11 rounded-[14px] bg-pizca-crema items-center justify-center">
                        <Sparkles size={22} color="#7A6500" strokeWidth={2.2} />
                    </View>
                    <View className="flex-1 gap-0.5">
                        <Text className="text-[15px] font-extrabold text-pizca-marron">Usá Pizca desde Claude</Text>
                        <Text className="text-[13px] leading-[18px] text-pizca-texto2">Pasale recetas a Claude y que las guarde en tu Pizca.</Text>
                    </View>
                    {open ? <ChevronUp size={20} color="#6B5A4E" strokeWidth={2.4} /> : <ChevronDown size={20} color="#6B5A4E" strokeWidth={2.4} />}
                </TouchableOpacity>

                {open && (
                    <View className="px-4 pb-4 gap-4 border-t border-pizca-linea pt-4">
                        <Step n={1} title="Copiá la dirección del conector">
                            <View className="flex-row items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-[12px] bg-pizca-crema">
                                <Text className="flex-1 text-[13px] text-pizca-marron" numberOfLines={1} selectable>{url}</Text>
                                <TouchableOpacity
                                    onPress={copy}
                                    className="flex-row items-center gap-1.5 h-9 px-3 rounded-[10px] bg-pizca-mostaza"
                                    accessibilityRole="button"
                                    accessibilityLabel={copied ? 'Dirección copiada' : 'Copiar dirección'}
                                >
                                    {copied ? <Check size={16} color="#3F3128" strokeWidth={2.6} /> : <Copy size={16} color="#3F3128" strokeWidth={2.4} />}
                                    <Text className="text-[13px] font-extrabold text-pizca-marron">{copied ? 'Copiada' : 'Copiar'}</Text>
                                </TouchableOpacity>
                            </View>
                        </Step>

                        <Step n={2} title="Agregalo en Claude">
                            <Text className="text-[13px] leading-[19px] text-pizca-texto2">
                                En claude.ai, entrá a Configuración → Conectores → «Agregar conector personalizado». Ponele de nombre Pizca y pegá la dirección.
                            </Text>
                            <TouchableOpacity
                                onPress={() => Linking.openURL(CONNECTORS_URL).catch(() => {})}
                                className="self-start flex-row items-center gap-1.5 pt-1"
                                accessibilityRole="link"
                            >
                                <Text className="text-sm font-extrabold text-pizca-mostaza-texto">Abrir Claude</Text>
                                <ExternalLink size={14} color="#7A6500" strokeWidth={2.4} />
                            </TouchableOpacity>
                        </Step>

                        <Step n={3} title="Conectalo con tu cuenta">
                            <Text className="text-[13px] leading-[19px] text-pizca-texto2">
                                Tocá «Conectar», entrá con tu usuario de Pizca y tocá «Autorizar».
                            </Text>
                        </Step>

                        <Step n={4} title="¡Listo! Pedíselo a Claude">
                            <Text className="text-[13px] leading-[19px] text-pizca-texto2">
                                También anda en la app de Claude del celu. Probá con:
                            </Text>
                            <View className="px-3 py-2.5 rounded-[12px] bg-pizca-crema">
                                <Text className="text-[13px] leading-[19px] text-pizca-marron italic">
                                    «Guardá en Pizca esta receta: …» o «¿Qué tengo planificado para esta semana?»
                                </Text>
                            </View>
                        </Step>

                        <Text className="text-xs leading-[17px] text-pizca-apagado">
                            El plan gratis de Claude permite un solo conector personalizado. Mientras esté conectado, Claude puede ver, crear y editar recetas en tu cuenta; lo desconectás cuando quieras desde la misma pantalla de Claude.
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
    <View className="flex-row gap-3">
        <View className="w-7 h-7 rounded-full bg-pizca-marron items-center justify-center">
            <Text className="text-[13px] font-extrabold text-pizca-fondo">{n}</Text>
        </View>
        <View className="flex-1 gap-1.5">
            <Text className="text-[15px] font-extrabold text-pizca-marron">{title}</Text>
            {children}
        </View>
    </View>
);
