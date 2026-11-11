import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, ActivityIndicator, View } from 'react-native';
import { Text } from './Typography';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  /**
   * primary: mostaza con texto marrón (acción principal).
   * cook: albahaca, para las acciones de cocinar y planificar.
   * outline: blanco con borde marrón.
   * ghost: link en mostaza oscuro.
   */
  variant?: 'primary' | 'cook' | 'outline' | 'ghost';
  loading?: boolean;
  icon?: React.ReactNode;
}

const VARIANTS = {
  primary: { box: 'bg-pizca-mostaza', text: 'text-pizca-marron', spinner: '#3F3128' },
  cook: { box: 'bg-pizca-albahaca', text: 'text-white', spinner: '#FFFFFF' },
  outline: { box: 'bg-white border-[1.5px] border-pizca-marron', text: 'text-pizca-marron', spinner: '#3F3128' },
  ghost: { box: 'bg-transparent', text: 'text-pizca-mostaza-texto', spinner: '#7A6500' },
} as const;

export function Button({ title, variant = 'primary', loading, icon, className, disabled, ...props }: ButtonProps) {
  const v = VARIANTS[variant];
  const off = disabled && variant !== 'ghost';
  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center h-[52px] px-6 rounded-[16px] ${off ? 'bg-pizca-linea' : v.box} ${className || ''}`}
      disabled={loading || disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(loading || disabled), busy: !!loading }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={v.spinner} />
      ) : (
        <>
          {icon && <View className="mr-2">{icon}</View>}
          <Text className={`text-base font-extrabold ${off ? 'text-pizca-apagado' : v.text}`}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
