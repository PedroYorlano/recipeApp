import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { UtensilsCrossed } from 'lucide-react-native';
import { RecipeDetailView } from '../../src/components/recipes/RecipeDetailModal';
import { Button } from '../../src/components/ui/Button';
import { useApp } from '../../src/context/AppContext';
import { getSharedRecipeService } from '../../src/services/api';
import { Recipe } from '../../src/types';

/**
 * Receta compartida (/receta/<uuid>). Pública: se ve sin sesión.
 * También la usa Fogoncito para abrir las recetas que sugiere.
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
      <View className="flex-1 bg-fogon-cream items-center justify-center px-8">
        <UtensilsCrossed size={48} color="#A89070" strokeWidth={1} />
        <Text className="text-xl font-bold text-fogon-brown text-center mt-6 mb-2">No encontramos esta receta</Text>
        <Text className="text-base text-fogon-gray text-center mb-8">
          Puede que el link esté mal o que ya no esté compartida.
        </Text>
        <Button title={isAuthenticated ? 'Ir a mis recetas' : 'Conocer Fogón'} onPress={goBack} />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View className="flex-1 bg-fogon-cream items-center justify-center">
        <ActivityIndicator size="large" color="#EF9F27" />
      </View>
    );
  }

  return (
    <>
      <Head>
        <title>{`${recipe.title} · Fogón`}</title>
      </Head>
      <RecipeDetailView
        recipe={recipe}
        onBack={goBack}
        backIcon="back"
        footer={
          isAuthenticated ? null : (
            <View className="bg-fogon-white rounded-[24px] p-6 mt-4 border border-fogon-amber/20 items-center">
              <Text className="text-lg font-bold text-fogon-brown text-center mb-2">¿Te gustó esta receta?</Text>
              <Text className="text-sm text-fogon-gray text-center mb-4">
                Guardá tus recetas de TikTok, Instagram y blogs en un solo lugar.
              </Text>
              <Button title="Crear mi cuenta gratis" onPress={() => router.push('/register')} />
            </View>
          )
        }
      />
    </>
  );
}
