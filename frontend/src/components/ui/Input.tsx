import React, { useState } from 'react';
import { View, TextInputProps } from 'react-native';
import { TextInput, Text } from './Typography';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/** Campo PIZCA: fondo crema; enfocado, borde mostaza; con error, fondo rosado y borde tomate. */
export function Input({ label, error, leftIcon, rightIcon, className, multiline, onFocus, onBlur, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View className="mb-4">
      {label && <Text className="text-[13px] font-extrabold text-pizca-marron mb-1.5">{label}</Text>}
      <View
        className={`flex-row items-center rounded-[14px] px-4 ${multiline ? 'py-3 min-h-[96px]' : 'min-h-[52px]'} ${
          error ? 'bg-[#FFF1EB] border-[1.5px] border-pizca-tomate'
            : `bg-pizca-crema border-[1.5px] ${focused ? 'border-pizca-mostaza' : 'border-transparent'}`
        } ${className || ''}`}
      >
        {leftIcon && <View className="mr-3">{leftIcon}</View>}
        <TextInput
          className={`flex-1 text-pizca-marron text-base ${multiline ? '' : 'h-[49px]'}`}
          placeholderTextColor="#8C7E70"
          multiline={multiline}
          onFocus={e => { setFocused(true); onFocus?.(e); }}
          onBlur={e => { setFocused(false); onBlur?.(e); }}
          {...props}
        />
        {rightIcon && <View className="ml-3">{rightIcon}</View>}
      </View>
      {error && <Text className="text-pizca-tomate-texto text-[13px] font-bold mt-1.5">{error}</Text>}
    </View>
  );
}
