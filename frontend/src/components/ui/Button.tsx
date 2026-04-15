import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps, ActivityIndicator, View } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({ title, variant = 'primary', loading, icon, className, ...props }: ButtonProps) {
  const baseClass = "flex-row items-center justify-center p-4 rounded-[16px]";
  
  const variantClass = {
    primary: "bg-fogon-amber shadow-sm",
    secondary: "bg-fogon-brown",
    outline: "bg-transparent border border-fogon-brown",
    ghost: "bg-transparent p-2"
  }[variant];

  const textClass = {
    primary: "text-fogon-brown font-bold text-lg",
    secondary: "text-fogon-white font-bold text-lg",
    outline: "text-fogon-brown font-bold text-lg",
    ghost: "text-fogon-brown font-semibold text-base"
  }[variant];

  return (
    <TouchableOpacity 
      className={`${baseClass} ${variantClass} ${className || ''} ${props.disabled ? 'opacity-50' : ''}`}
      disabled={loading || props.disabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#633806' : (variant === 'outline' || variant === 'ghost' ? '#633806' : '#FFF8F0')} />
      ) : (
        <>
          {icon && <View className="mr-2">{icon}</View>}
          <Text className={textClass}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
