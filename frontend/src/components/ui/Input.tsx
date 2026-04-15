import React from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({ label, error, leftIcon, rightIcon, className, ...props }: InputProps) {
  return (
    <View className="mb-4">
      {label && (
        <Text className="text-fogon-gray uppercase text-xs font-bold tracking-wider mb-2">
          {label}
        </Text>
      )}
      <View className={`flex-row items-center bg-fogon-white border border-fogon-gray/30 rounded-[12px] px-4 py-1 min-h-[56px] shadow-sm ${error ? 'border-red-500' : ''} ${className || ''}`}>
        {leftIcon && <View className="mr-3">{leftIcon}</View>}
        
        <TextInput
          className="flex-1 text-fogon-brown text-base h-full"
          placeholderTextColor="#A89070"
          {...props}
        />
        
        {rightIcon && <View className="ml-3">{rightIcon}</View>}
      </View>
      {error && <Text className="text-red-500 text-sm mt-1 ml-1">{error}</Text>}
    </View>
  );
}
