import React from 'react';
import { View, Image, type ImageSourcePropType } from 'react-native';
import { coverFor } from '../../constants/brand';

interface Props {
  /** Foto de la receta, si tiene. */
  source?: ImageSourcePropType | null;
  /** uuid o id: elige la ilustración cuando no hay foto. */
  seed?: string | number;
  className?: string;
  /** Alto de la ilustración en px. */
  illustrationSize?: number;
  children?: React.ReactNode;
}

/** Foto de la receta o, si no tiene, una ilustración sobre un fondo pastel. */
export function RecipeCover({ source, seed, className, illustrationSize = 56, children }: Props) {
  const cover = coverFor(seed);
  return (
    <View
      className={`overflow-hidden items-center justify-center ${className || ''}`}
      style={source ? undefined : { backgroundColor: cover.background }}
    >
      {source ? (
        <Image source={source} className="absolute inset-0 w-full h-full" resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Image
          source={cover.illustration}
          style={{ height: illustrationSize, width: illustrationSize }}
          resizeMode="contain"
          accessible={false}
        />
      )}
      {children}
    </View>
  );
}
