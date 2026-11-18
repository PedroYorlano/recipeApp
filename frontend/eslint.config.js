// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // En web, NativeWind solo traduce className en los componentes que registra (View, Text,
      // Image, ScrollView, Pressable, Touchable*, TextInput…). Un Animated.* lo ignora en silencio
      // y queda sin estilos: ya rompió el diálogo, el spinner de importación y el grabador.
      'no-restricted-syntax': ['error', {
        selector: "JSXOpeningElement[name.object.name='Animated'] > JSXAttribute[name.name=/ClassName$|^className$/]",
        message: 'className no se aplica a Animated.* en web: usá style, o poné las clases en un View de adentro.',
      }],
    },
  },
]);
