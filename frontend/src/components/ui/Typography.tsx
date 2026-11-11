/**
 * Text y TextInput con la tipografía de PIZCA (Nunito Sans) por defecto.
 *
 * Las fuentes custom de React Native no se heredan del contenedor, así que
 * cada texto necesita su fontFamily. Las clases de peso (font-bold, etc.) y
 * font-display ya la ponen (ver tailwind.config.js); si no hay ninguna, acá
 * se usa la regular. Un Text anidado hereda la del padre.
 */
import React, { createContext, forwardRef, useContext } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextProps,
  type TextInputProps,
} from 'react-native';

export const FONT = {
  regular: 'NunitoSans_400Regular',
  semibold: 'NunitoSans_600SemiBold',
  bold: 'NunitoSans_700Bold',
  extrabold: 'NunitoSans_800ExtraBold',
  display: 'Ranchers_400Regular',
} as const;

const HAS_FONT_CLASS = /(^|\s)font-(normal|medium|semibold|bold|extrabold|black|display|sans)(\s|$)/;

const InsideText = createContext(false);

const withDefaultFont = <S,>(className: string | undefined, style: S) =>
  className && HAS_FONT_CLASS.test(className) ? style : [{ fontFamily: FONT.regular }, style];

export const Text = forwardRef<RNText, TextProps & { className?: string }>(
  ({ className, style, ...props }, ref) => {
    const nested = useContext(InsideText);
    return (
      <InsideText.Provider value>
        <RNText
          ref={ref}
          className={className}
          style={nested ? style : withDefaultFont(className, style)}
          {...props}
        />
      </InsideText.Provider>
    );
  },
);
Text.displayName = 'Text';

export const TextInput = forwardRef<RNTextInput, TextInputProps & { className?: string }>(
  ({ className, style, ...props }, ref) => (
    <RNTextInput ref={ref} className={className} style={withDefaultFont(className, style)} {...props} />
  ),
);
TextInput.displayName = 'TextInput';
