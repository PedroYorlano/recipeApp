import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, FlatList, Animated, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Text, TextInput } from '../ui/Typography';
import { useRouter } from 'expo-router';
import { ArrowRight, ChevronRight } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { getRecipeImage } from '../../utils';
import { ISOLOGO } from '../../constants/brand';
import { RecipeCover } from '../brand/RecipeCover';
import { ChatMessage, FogoncitoSuggestion } from '../../types';
import { sendFogoncitoMessage } from '../../services/api';

const INITIAL_MESSAGE: ChatMessage = {
    id: 'initial',
    role: 'bot',
    text: '¡Hola! Contame qué tenés en casa y qué te dan ganas de comer. Busco entre tus recetas guardadas.',
};

export function FogoncitoChat() {
    const router = useRouter();
    const { recipes } = useApp();
    const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
    const [input, setInput] = useState('');
    const flatListRef = useRef<FlatList>(null);

    const scrollToEnd = () => {
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const handleSend = async () => {
        const text = input.trim();
        if (!text) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text,
        };

        const loadingMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'bot',
            text: '',
            isLoading: true,
        };

        setMessages(prev => [...prev, userMsg, loadingMsg]);
        setInput('');
        scrollToEnd();

        try {
            const response = await sendFogoncitoMessage(text);
            setMessages(prev =>
                prev.map(m =>
                    m.id === loadingMsg.id
                        ? {
                            ...m,
                            text: response.message,
                            suggestions: response.suggestions,
                            isLoading: false,
                        }
                        : m
                )
            );
        } catch (e: any) {
            setMessages(prev =>
                prev.map(m =>
                    m.id === loadingMsg.id
                        ? {
                            ...m,
                            text: e.message || 'Ahora no puedo responder. Probá de nuevo en un rato.',
                            isLoading: false,
                            isError: true,
                        }
                        : m
                )
            );
        }
        scrollToEnd();
    };

    const handleSuggestionPress = (suggestion: FogoncitoSuggestion) => {
        router.push(`/receta/${suggestion.uuid}`);
    };

    const Avatar = () => (
        <View className="w-[34px] h-[34px] rounded-full bg-pizca-crema items-center justify-center">
            <Image source={ISOLOGO} style={{ width: 22, height: 18 }} resizeMode="contain" />
        </View>
    );

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        if (item.role === 'user') {
            return (
                <View className="self-end max-w-[80%] px-3.5 py-3 rounded-[18px] rounded-br-[6px] bg-pizca-marron mb-3">
                    <Text className="text-[15px] leading-[22px] text-pizca-fondo">{item.text}</Text>
                </View>
            );
        }

        return (
            <View className="flex-row gap-2 items-start mb-3">
                <Avatar />
                <View className="flex-1 max-w-[290px] gap-2">
                    <View
                        className={`self-start px-3.5 py-3 rounded-[18px] rounded-bl-[6px] ${item.isError ? 'bg-[#FFF1EB] border-[1.5px] border-pizca-tomate' : 'bg-white border border-pizca-linea'}`}
                        accessibilityLiveRegion="polite"
                    >
                        {item.isLoading ? (
                            <TypingIndicator />
                        ) : (
                            <Text className="text-[15px] leading-[22px] text-pizca-marron">{item.text}</Text>
                        )}
                    </View>

                    {item.suggestions?.map((s, i) => {
                        const recipe = recipes.find(r => r.uuid === s.uuid);
                        return (
                            <TouchableOpacity
                                key={s.uuid}
                                onPress={() => handleSuggestionPress(s)}
                                activeOpacity={0.8}
                                className={`flex-row items-center gap-2.5 p-2 rounded-[16px] bg-white ${i === 0 ? 'border-[1.5px] border-pizca-mostaza' : 'border border-pizca-linea'}`}
                                accessibilityRole="link"
                            >
                                <RecipeCover
                                    source={recipe ? getRecipeImage(recipe) : null}
                                    seed={s.uuid}
                                    illustrationSize={28}
                                    className="w-[52px] h-[52px] rounded-[12px]"
                                />
                                <View className="flex-1 gap-0.5">
                                    <Text className="text-sm font-extrabold text-pizca-marron" numberOfLines={2}>{s.title}</Text>
                                    {recipe?.prep_time ? <Text className="text-xs font-bold text-pizca-texto2">{recipe.prep_time} min</Text> : null}
                                </View>
                                <ChevronRight size={18} color="#3F3128" strokeWidth={2.2} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 180 : 0}
        >
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderMessage}
                contentContainerStyle={{ padding: 20, paddingTop: 16 }}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={scrollToEnd}
                keyboardShouldPersistTaps="handled"
            />

            <View className="flex-row gap-2 px-4 pb-3 pt-1">
                <View
                    className="flex-1 h-[52px] flex-row items-center px-3.5 rounded-[16px] bg-white border-[1.5px] border-pizca-linea"
                    style={{ boxShadow: '0 6px 16px rgba(63,49,40,0.08)' }}
                >
                    <TextInput
                        className="flex-1 h-full text-[15px] text-pizca-marron"
                        placeholder="Tengo papa y pollo… ¿qué almuerzo?"
                        placeholderTextColor="#8C7E70"
                        value={input}
                        onChangeText={setInput}
                        onSubmitEditing={handleSend}
                        returnKeyType="send"
                        accessibilityLabel="Escribí qué tenés o qué querés comer"
                    />
                </View>
                <TouchableOpacity
                    onPress={handleSend}
                    disabled={!input.trim()}
                    className={`w-[52px] h-[52px] rounded-[16px] items-center justify-center ${input.trim() ? 'bg-pizca-mostaza' : 'bg-pizca-linea'}`}
                    accessibilityRole="button"
                    accessibilityLabel="Enviar"
                >
                    <ArrowRight size={22} color={input.trim() ? '#3F3128' : '#8C7E70'} strokeWidth={2.4} />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

// --- Typing Indicator ---

function TypingIndicator() {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = (dot: Animated.Value, delay: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                    Animated.timing(dot, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                ])
            );
        };

        const a1 = animate(dot1, 0);
        const a2 = animate(dot2, 200);
        const a3 = animate(dot3, 400);

        a1.start();
        a2.start();
        a3.start();

        return () => {
            a1.stop();
            a2.stop();
            a3.stop();
        };
    }, []);

    const dotStyle = (anim: Animated.Value) => ({
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
        transform: [{
            translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }),
        }],
    });

    return (
        <View className="flex-row gap-1 py-1.5 px-0.5" accessibilityLabel="Escribiendo">
            {[dot1, dot2, dot3].map((d, i) => (
                <Animated.View key={i} className="w-2 h-2 rounded-full bg-pizca-mostaza" style={dotStyle(d)} />
            ))}
        </View>
    );
}
