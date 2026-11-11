import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, TouchableOpacity, View } from 'react-native';
import { Text } from '../../src/components/ui/Typography';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { ILLUSTRATIONS, ISOLOGO } from '../../src/constants/brand';
import { RecipeDetailView } from '../../src/components/recipes/RecipeDetailModal';
import { Button } from '../../src/components/ui/Button';
import { useApp } from '../../src/context/AppContext';
import { getSharedRecipeService } from '../../src/services/api';
import { Recipe } from '../../src/types';

/**
 * Receta compartida (/receta/<uuid>). Pública: se ve sin sesión.
 * También la usa Ideas para abrir las recetas que sugiere.
 */
export default function SharedRecipePage() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { isAuthenticated } = useApp();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!uuid) return;
    setError(false);
    getSharedRecipeService(uuid)
      .then(setRecipe)
      .catch(() => setError(true));
  }, [uuid, isAuthenticated]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(isAuthenticated ? '/(tabs)' : '/');
  };

  if (error) {
    return (
      <View className="flex-1 bg-pizca-fondo items-center justify-center px-8 gap-2">
        <Image source={ILLUSTRATIONS.berenjena} style={{ width: 64, height: 68, marginBottom: 12 }} resizeMode="contain" />
        <Text className="font-display text-[28px] text-pizca-marron text-center">No encontramos esta receta</Text>
        <Text className="text-base text-pizca-texto2 text-center mb-6">
          Puede que el link esté mal o que ya no esté compartida.
        </Text>
        <Button title={isAuthenticated ? 'Ir a mis recetas' : 'Conocer Pizca'} onPress={goBack} />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View className="flex-1 bg-pizca-fondo items-center justify-center">
        <ActivityIndicator size="large" color="#BE9F00" />
      </View>
    );
  }

  return (
    <>
      <Head>
        <title>{`${recipe.title} · Pizca`}</title>
      </Head>
      <RecipeDetailView
        recipe={recipe}
        onBack={goBack}
        backIcon="back"
        brandHeader={
          isAuthenticated ? undefined : (
            <View className="h-16 px-4 pt-3 flex-row items-center justify-between">
              <TouchableOpacity onPress={() => router.replace('/')} className="flex-row items-center gap-2" accessibilityRole="link" accessibilityLabel="Pizca">
                <Image source={ISOLOGO} style={{ width: 35, height: 28 }} resizeMode="contain" />
                <Text className="font-display text-2xl text-pizca-mostaza">PIZCA</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/login')}
                className="h-10 px-3.5 rounded-[12px] border-[1.5px] border-pizca-marron justify-center"
                accessibilityRole="link"
              >
                <Text className="text-sm font-extrabold text-pizca-marron">Ingresar</Text>
              </TouchableOpacity>
            </View>
          )
        }
        footer={
          isAuthenticated ? null : (
            <View className="bg-pizca-albahaca rounded-[24px] p-[22px] gap-2.5 overflow-hidden">
              <Image source={ILLUSTRATIONS.remolacha} style={{ position: 'absolute', right: -8, top: -6, width: 84, height: 76 }} resizeMode="contain" accessible={false} />
              <Text className="font-display text-[26px] leading-[28px] text-white max-w-[230px]">¿Te gustó esta receta?</Text>
              <Text className="text-[15px] leading-[22px] text-[#E4EDE3]">
                Guardala en tu recetario y sumá las tuyas de TikTok, Instagram o blogs.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/register')}
                className="mt-1 h-[50px] rounded-[14px] bg-pizca-ambar items-center justify-center"
                accessibilityRole="button"
              >
                <Text className="text-base font-extrabold text-pizca-marron">Crear mi cuenta gratis</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </>
  );
}
