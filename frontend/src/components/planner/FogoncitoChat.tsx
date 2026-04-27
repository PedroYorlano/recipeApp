import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList,
    StyleSheet, Animated, ScrollView, KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../../theme';
import { Send } from 'lucide-react-native';
import { ChatMessage, FogoncitoSuggestion } from '../../types';
import { sendFogoncitoMessage } from '../../services/api';

const INITIAL_MESSAGE: ChatMessage = {
    id: 'initial',
    role: 'bot',
    text: '¡Hola! 👋 Contame qué tenés en casa y qué te dan ganas de comer. Busco entre tus recetas guardadas.',
};

export function FogoncitoChat() {
    const router = useRouter();
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
                            text: e.message || 'Fogoncito no está disponible en este momento. Intentá de nuevo.',
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
        // Navegar a la receta (si la ruta existe en el futuro)
        // Por ahora usamos un Alert o simplemente avisamos
        // router.push(`/recipe/${suggestion.uuid}`);
    };

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isBot = item.role === 'bot';

        return (
            <View style={[styles.msgRow, isBot ? styles.msgRowBot : styles.msgRowUser]}>
                <View style={[
                    styles.bubble,
                    isBot ? styles.bubbleBot : styles.bubbleUser,
                    item.isError && styles.bubbleError,
                ]}>
                    {item.isLoading ? (
                        <TypingIndicator />
                    ) : (
                        <Text style={[
                            styles.bubbleText,
                            isBot ? styles.bubbleTextBot : styles.bubbleTextUser,
                            item.isError && styles.bubbleTextError,
                        ]}>
                            {item.text}
                        </Text>
                    )}
                </View>

                {/* Suggestion Chips */}
                {item.suggestions && item.suggestions.length > 0 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.chipsRow}
                        contentContainerStyle={styles.chipsContent}
                    >
                        {item.suggestions.map(s => (
                            <TouchableOpacity
                                key={s.uuid}
                                style={styles.chip}
                                onPress={() => handleSuggestionPress(s)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.chipText}>🍳 {s.title}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 180 : 0}
        >
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.chatList}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={scrollToEnd}
            />

            {/* Input Bar */}
            <View style={styles.inputBar}>
                <TextInput
                    style={styles.input}
                    placeholder="Tengo papa y pollo... ¿qué puedo almorzar?"
                    placeholderTextColor={COLORS.text.secondary}
                    value={input}
                    onChangeText={setInput}
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                    multiline={false}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!input.trim()}
                    activeOpacity={0.7}
                >
                    <Send size={20} color={input.trim() ? COLORS.secondary : COLORS.text.secondary} />
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
        <View style={styles.typingContainer}>
            <Animated.View style={[styles.typingDot, dotStyle(dot1)]} />
            <Animated.View style={[styles.typingDot, dotStyle(dot2)]} />
            <Animated.View style={[styles.typingDot, dotStyle(dot3)]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    chatList: {
        paddingHorizontal: SPACING.l,
        paddingBottom: SPACING.m,
        paddingTop: SPACING.s,
    },

    // Messages
    msgRow: {
        marginBottom: SPACING.m,
    },
    msgRowBot: {
        alignItems: 'flex-start',
    },
    msgRowUser: {
        alignItems: 'flex-end',
    },
    bubble: {
        maxWidth: '82%',
        paddingHorizontal: SPACING.m,
        paddingVertical: 10,
        borderRadius: RADIUS.m,
    },
    bubbleBot: {
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: 'rgba(168, 144, 112, 0.15)',
        borderTopLeftRadius: 4,
    },
    bubbleUser: {
        backgroundColor: COLORS.primary,
        borderTopRightRadius: 4,
    },
    bubbleError: {
        borderColor: 'rgba(255, 59, 48, 0.2)',
    },
    bubbleText: {
        fontSize: 15,
        lineHeight: 21,
    },
    bubbleTextBot: {
        color: COLORS.text.primary,
    },
    bubbleTextUser: {
        color: COLORS.secondary,
    },
    bubbleTextError: {
        color: '#C0392B',
    },

    // Suggestion Chips
    chipsRow: {
        marginTop: SPACING.s,
    },
    chipsContent: {
        gap: 8,
    },
    chip: {
        backgroundColor: '#FFF0D6',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(239, 159, 39, 0.3)',
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.secondary,
    },

    // Input Bar
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E8D9C5',
        backgroundColor: COLORS.background,
    },
    input: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.l,
        paddingHorizontal: SPACING.m,
        paddingVertical: 10,
        fontSize: 15,
        color: COLORS.text.primary,
        borderWidth: 1,
        borderColor: 'rgba(168, 144, 112, 0.2)',
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: SPACING.s,
    },
    sendBtnDisabled: {
        backgroundColor: '#F5E6D0',
    },

    // Typing Indicator
    typingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
    },
    typingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.text.secondary,
    },
});
