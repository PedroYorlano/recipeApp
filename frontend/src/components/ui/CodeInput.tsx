import React, { useRef, useState } from 'react';
import { Pressable, View, TextInput as RNTextInput } from 'react-native';
import { Text, TextInput } from './Typography';

interface Props {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
}

/**
 * Código de verificación en casillas (una por dígito). Por debajo es un solo
 * input numérico invisible, así se puede pegar el código entero.
 */
export function CodeInput({ value, onChange, length = 6, autoFocus, onComplete }: Props) {
  const ref = useRef<RNTextInput>(null);
  const [focused, setFocused] = useState(!!autoFocus);
  const digits = value.split('');

  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={`Código de ${length} dígitos`}>
      <View className="flex-row gap-2">
        {Array.from({ length }, (_, i) => {
          const active = focused && i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              className={`flex-1 h-12 rounded-[12px] items-center justify-center ${active ? 'bg-white border-2 border-pizca-mostaza' : 'bg-pizca-crema'}`}
            >
              <Text className="text-xl font-extrabold text-pizca-marron">{digits[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={t => {
          const code = t.replace(/\D/g, '').slice(0, length);
          onChange(code);
          if (code.length === length) onComplete?.(code);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        caretHidden
        className="absolute inset-0 opacity-0"
        accessibilityLabel={`Código de ${length} dígitos`}
      />
    </Pressable>
  );
}
