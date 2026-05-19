import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../../context/AppContext';
import { Recipe, Category, Ingredient } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Camera, X, Plus, Trash2, ArrowLeft, Wand2, ChefHat, Sparkles, Mic } from 'lucide-react-native';

const emptyRecipe: Recipe = {
  uuid: '', title: '', description: '', ingredients: [], steps: [], categories: [], categories_details: [], servings: 1,
};

const emptyIngredient: Ingredient = { name: '', quantity: null, unit: '', order: 0 };

interface Props {
  visible: boolean; onClose: () => void; onSubmit: (recipe: any) => Promise<void>; onImportAI: (url: string) => Promise<any>; initialData: Recipe | null; categories: Category[];
}

export const RecipeFormModal = ({ visible, onClose, onSubmit, onImportAI, initialData, categories }: Props) => {
  const [draftRecipe, setDraftRecipe] = useState<Recipe | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importText, setImportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImported, setIsImported] = useState(false);
  const [saving, setSaving] = useState(false);

  const { createMode, setCreateMode, createCategory, importRecipeAIAudio, importRecipeAIText, importRecipeAIWeb } = useApp();
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setDraftRecipe(JSON.parse(JSON.stringify(initialData)));
        setIsImported(false);
      } else if (createMode === 'manual') {
        setDraftRecipe({ ...emptyRecipe });
        setIsImported(false);
      } else {
        setDraftRecipe(null);
        setImportUrl('');
        setIsImported(false);
      }
    }
  }, [visible, initialData, createMode]);

  const handleImport = async () => {
    if (!importUrl) return Alert.alert("Error", "Ingresa una URL");
    setIsProcessing(true);
    try {
      const recipe = await onImportAI(importUrl);
      setDraftRecipe({ ...recipe, original_url: importUrl });
      setIsImported(true);
    } catch (e: any) {
      console.error("Error importando receta:", e);
      let errorMsg = "No se pudo extraer la receta.";
      try {
        const parsed = JSON.parse(e.message);
        if (parsed.error) errorMsg = parsed.error;
      } catch {}
      Alert.alert("Error", errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportText = async () => {
    if (!importText.trim()) return Alert.alert("Error", "Ingresa el texto de la receta.");
    setIsProcessing(true);
    try {
      const recipe = await importRecipeAIText(importText);
      setDraftRecipe({ ...recipe });
      setIsImported(true);
    } catch (e) {
      Alert.alert("Error", "La IA no pudo entender o extraer la receta del texto.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportWeb = async () => {
    if (!importUrl) return Alert.alert("Error", "Ingresa una URL de blog o sitio web");
    setIsProcessing(true);
    try {
      const recipe = await importRecipeAIWeb(importUrl);
      setDraftRecipe({ ...recipe, original_url: importUrl });
      setIsImported(true);
    } catch (e) {
      Alert.alert("Error", "No se pudo extraer la receta, prueba de otra manera.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsProcessing(true);
        const file = result.assets[0];
        const recipe = await importRecipeAIAudio(file.uri, file.name, file.mimeType || 'audio/mp3');
        setDraftRecipe({ ...recipe });
        setIsImported(true);
      }
    } catch (e) {
       Alert.alert("Error", "Fallo al subir o procesar el audio.");
    } finally {
       setIsProcessing(false);
    }
  };

  const handleManualCreate = () => {
    setDraftRecipe({ ...emptyRecipe });
    setIsImported(false);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setIsAddingCategory(false); return;
    }
    try {
      await createCategory(newCategoryName);
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (e) {
      Alert.alert("Error", "No se pudo crear la categoría.");
    }
  };

  const pickImage = async (target: 'cover') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permiso denegado al carrete');

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setDraftRecipe(prev => prev ? ({ ...prev, localImage: uri }) : null);
    }
  };

  const processImage = async (uri: string) => {
    const manipResult = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1200 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
    return `data:image/jpeg;base64,${manipResult.base64}`;
  };

  const removeCoverImage = () => {
    setDraftRecipe(prev => prev ? ({ ...prev, remove_image: true, localImage: undefined, image: undefined }) : null);
  };

  const addIngredient = () => setDraftRecipe(prev => prev ? ({ 
    ...prev, 
    ingredients: [...prev.ingredients, { ...emptyIngredient, order: prev.ingredients.length }] 
  }) : null);
  
  const removeIngredient = (index: number) => setDraftRecipe(prev => {
    if (!prev) return null;
    const newIngredients = prev.ingredients.filter((_, i) => i !== index).map((ing, i) => ({ ...ing, order: i }));
    return { ...prev, ingredients: newIngredients };
  });

  const updateIngredient = (index: number, field: keyof Ingredient, value: any) => {
    setDraftRecipe(prev => {
      if (!prev) return null;
      const newIngredients = [...prev.ingredients];
      newIngredients[index] = { ...newIngredients[index], [field]: value };
      return { ...prev, ingredients: newIngredients };
    });
  };

  const addStep = () => setDraftRecipe(prev => prev ? ({ ...prev, steps: [...prev.steps, { order: prev.steps.length + 1, instruction: '' }] }) : null);
  const removeStep = (index: number) => setDraftRecipe(prev => {
    if (!prev) return null;
    const newSteps = prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
    return { ...prev, steps: newSteps };
  });

  const handleSaveInternal = async () => {
    if (!draftRecipe) return;
    if (!draftRecipe.title.trim()) return Alert.alert("Falta título", "El título de la receta es obligatorio.");

    setSaving(true);
    try {
      const payload: any = { ...draftRecipe };
      if (payload.localImage) payload.image_base64 = await processImage(payload.localImage);
      await onSubmit(payload);
      onClose();
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar la receta en tu Fogón.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-fogon-cream">
        {/* HEADER */}
        <View className="flex-row justify-between items-center px-6 py-4 pt-[60px] bg-fogon-white border-b border-fogon-gray/10 shadow-sm z-10">
          <Text className="text-xl font-bold font-serif text-fogon-brown">
            {!draftRecipe ? 'Importar al Fogón' : (initialData ? 'Editar Receta' : 'Nueva Receta')}
          </Text>
          <TouchableOpacity onPress={onClose} className="bg-fogon-cream p-2 rounded-full">
            <X size={20} color="#633806" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>

          {/* FASE 1: IMPORTACIÓN */}
          {!draftRecipe && (
            <View className="items-center mt-10">
              <View className="bg-fogon-white p-6 rounded-full shadow-sm border border-fogon-amber/20 mb-6">
                <Wand2 size={48} color="#EF9F27" />
              </View>
              {createMode === 'video' ? (
                <>
                  <Text className="text-xl font-bold text-fogon-brown mb-6 text-center px-4">
                    Pegá el link del video (YouTube o TikTok)
                  </Text>
                  <View className="w-full">
                    <Input placeholder="https://..." value={importUrl} onChangeText={setImportUrl} autoCapitalize="none" />
                  </View>
                  {!isProcessing && (
                    <View className="w-full mt-2">
                       <Button title="Extraer con IA" onPress={handleImport} icon={<Sparkles color="#633806" size={20} />} />
                    </View>
                  )}
                </>
              ) : createMode === 'link-web' ? (
                <>
                  <Text className="text-xl font-bold text-fogon-brown mb-2 text-center px-4">
                    Pegá el link del Blog Web
                  </Text>
                  <Text className="text-xs text-fogon-gray mb-6 text-center px-4">
                    Extraemos la receta eliminando todas las historias y publicidades del sitio
                  </Text>
                  <View className="w-full">
                    <Input placeholder="https://..." value={importUrl} onChangeText={setImportUrl} autoCapitalize="none" />
                  </View>
                  {!isProcessing && (
                    <View className="w-full mt-2">
                       <Button title="Analizar Blog" onPress={handleImportWeb} icon={<Sparkles color="#633806" size={20} />} />
                    </View>
                  )}
                </>
              ) : createMode === 'text' ? (
                <>
                  <Text className="text-xl font-bold text-fogon-brown mb-2 text-center px-4">
                    Escribí la receta a tu manera
                  </Text>
                  <Text className="text-xs text-fogon-gray mb-6 text-center px-4">
                    Recuerda ser súper específico con las cantidades y pasos. La IA intentará intuir mágicamente toda la información faltante.
                  </Text>
                  <View className="w-full">
                    <TextInput 
                      className="bg-fogon-white border border-fogon-amber/30 rounded-[12px] p-4 text-fogon-brown text-base mb-4 shadow-sm text-left align-top min-h-[150px]" 
                      multiline 
                      placeholder="Ejemplo: Mezclar 200g de harina con 1 huevo, hornear por 20 minutos..." 
                      placeholderTextColor="#A89070" 
                      value={importText} 
                      onChangeText={setImportText} 
                    />
                  </View>
                  {!isProcessing && (
                    <View className="w-full mt-2">
                       <Button title="Analizar Texto" onPress={handleImportText} icon={<Sparkles color="#633806" size={20} />} />
                    </View>
                  )}
                </>
              ) : createMode === 'audio' ? (
                <>
                  <Text className="text-xl font-bold text-fogon-brown mb-6 text-center px-4">
                    Subir Nota de Voz (Audio)
                  </Text>
                  <Text className="text-xs text-fogon-gray mb-6 text-center px-4">
                    Sube un archivo de audio relatando la receta y la IA la transcribirá.
                  </Text>
                  {!isProcessing && (
                    <View className="w-full mt-2">
                       <Button title="Seleccionar Audio" onPress={handleImportAudio} icon={<Mic color="#633806" size={20} />} />
                    </View>
                  )}
                </>
              ) : null}

              {isProcessing && (
                <View className="items-center my-6">
                  <ActivityIndicator size="large" color="#EF9F27" />
                  <Text className="mt-4 text-fogon-gray font-semibold text-center">Cocinando la magia...{'\n'}La IA está procesando los datos.</Text>
                </View>
              )}

              <View className="flex-row items-center w-full my-8">
                <View className="flex-1 h-[1px] bg-fogon-gray/20" />
                <Text className="mx-4 text-fogon-gray text-sm font-semibold uppercase tracking-widest">o</Text>
                <View className="flex-1 h-[1px] bg-fogon-gray/20" />
              </View>
              
              <View className="w-full">
                <Button title="Cargar a la vieja usanza (Manual)" variant="outline" onPress={handleManualCreate} icon={<ChefHat color="#633806" size={20} />} />
              </View>
            </View>
          )}

          {/* FASE 2: EDICIÓN / MANUAL */}
          {draftRecipe && (
            <View className="pb-32">
              {isImported && (
                <View className="bg-[#3B6D11]/10 px-4 py-3 rounded-[12px] border border-[#3B6D11]/20 mb-6 flex-row items-center">
                  <Text className="text-[#3B6D11] text-lg mr-2">✨</Text>
                  <Text className="text-[#3B6D11] font-bold flex-1">¡Receta importada con éxito! Revisa los datos para asegurar que quedó perfecta.</Text>
                </View>
              )}

              <Input label="Título de la receta" placeholder="Ej: Tarta de Manzanas de la abuela" value={draftRecipe.title} onChangeText={t => setDraftRecipe({ ...draftRecipe, title: t })} />

              {/* PORTADA */}
              <Text className="text-fogon-gray uppercase text-xs font-bold tracking-wider mb-2 mt-4 ml-1">Foto de portada</Text>
              <View className="mb-6">
                {draftRecipe.localImage || draftRecipe.image || draftRecipe.image_url ? (
                  <View className="w-full aspect-[4/3] rounded-[16px] overflow-hidden relative shadow-sm border border-fogon-gray/10">
                    <Image source={{ uri: draftRecipe.localImage || draftRecipe.image || draftRecipe.image_url }} className="w-full h-full" resizeMode="cover" />
                    <TouchableOpacity className="absolute top-3 right-3 bg-black/50 w-8 h-8 rounded-full items-center justify-center border border-white/20" onPress={removeCoverImage}>
                      <X size={16} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity className="absolute bottom-3 left-3 bg-fogon-white/90 px-3 py-1.5 rounded-full shadow-sm" onPress={() => pickImage('cover')}>
                      <Text className="text-fogon-brown text-xs font-bold">Cambiar Foto</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity className="w-full aspect-[5/3] bg-fogon-white rounded-[16px] border-2 border-dashed border-fogon-gray/30 items-center justify-center" onPress={() => pickImage('cover')} activeOpacity={0.7}>
                    <Camera size={32} color="#A89070" className="mb-2" />
                    <Text className="text-fogon-gray font-semibold">Subir Foto de Portada</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* DESCRIPCION */}
              <Text className="text-fogon-gray uppercase text-xs font-bold tracking-wider mb-2 ml-1">Descripción corta</Text>
              <TextInput className="bg-fogon-white border border-fogon-gray/30 rounded-[12px] p-4 text-fogon-brown text-base mb-6 min-h-[100px] shadow-sm text-left align-top" multiline placeholder="Breve historia o tips de por qué esta receta es especial..." placeholderTextColor="#A89070" value={draftRecipe.description} onChangeText={t => setDraftRecipe({ ...draftRecipe, description: t })} />

              {/* CATEGORIAS */}
              <Text className="text-fogon-gray uppercase text-xs font-bold tracking-wider mb-2 ml-1">Categorías</Text>
              <View className="flex-row flex-wrap items-center mb-6">
                {isAddingCategory ? (
                  <View className="flex-row items-center border border-fogon-amber rounded-full px-3 py-1 mr-2 mb-2 bg-fogon-white">
                    <TextInput className="text-fogon-brown mr-2 py-1 min-w-[70px]" placeholder="Nombre..." autoFocus value={newCategoryName} onChangeText={setNewCategoryName} onSubmitEditing={handleAddCategory} />
                    <TouchableOpacity onPress={handleAddCategory} className="bg-fogon-amber px-2 py-1.5 rounded-full">
                      <Text className="text-fogon-brown text-[10px] font-bold">OK</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity className="border border-dashed border-fogon-amber px-4 py-2 rounded-full mr-2 mb-2 bg-fogon-amber/5" onPress={() => setIsAddingCategory(true)}>
                    <Text className="text-fogon-amber font-bold text-xs">+ Nueva</Text>
                  </TouchableOpacity>
                )}

                {categories.map((cat) => {
                  const isSelected = draftRecipe.categories?.includes(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      className={`px-4 py-2 rounded-full mr-2 mb-2 border shadow-sm ${isSelected ? 'bg-fogon-amber border-fogon-amber' : 'bg-fogon-white border-fogon-gray/20'}`}
                      onPress={() => {
                        const current = draftRecipe.categories || [];
                        const newCats = current.includes(cat.id) ? current.filter(id => id !== cat.id) : [...current, cat.id];
                        setDraftRecipe({ ...draftRecipe, categories: newCats });
                      }}
                    >
                      <Text className={`font-semibold text-xs ${isSelected ? 'text-fogon-brown' : 'text-fogon-gray'}`}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* INGREDIENTES - 3 campos: cantidad, unidad, nombre */}
              <Text className="text-fogon-brown text-xl font-bold font-serif mb-4 mt-2">Ingredientes</Text>
              {draftRecipe.ingredients.map((ing, index) => (
                <View key={index} className="flex-row items-center mb-3">
                  {/* Cantidad (numérica) */}
                  <TextInput 
                    className="bg-fogon-white border border-fogon-gray/30 rounded-[12px] p-3 text-fogon-brown text-base w-[70px] mr-2 shadow-sm text-center" 
                    placeholder="200" 
                    placeholderTextColor="#A89070" 
                    keyboardType="decimal-pad"
                    value={ing.quantity !== null && ing.quantity !== undefined ? String(ing.quantity) : ''} 
                    onChangeText={t => {
                      const num = t === '' ? null : parseFloat(t);
                      updateIngredient(index, 'quantity', isNaN(num as number) ? null : num);
                    }} 
                  />
                  {/* Unidad */}
                  <TextInput 
                    className="bg-fogon-white border border-fogon-gray/30 rounded-[12px] p-3 text-fogon-brown text-base w-[65px] mr-2 shadow-sm text-center" 
                    placeholder="g" 
                    placeholderTextColor="#A89070" 
                    value={ing.unit} 
                    onChangeText={t => updateIngredient(index, 'unit', t)} 
                  />
                  {/* Nombre */}
                  <TextInput 
                    className="bg-fogon-white border border-fogon-gray/30 rounded-[12px] p-3 text-fogon-brown text-base flex-1 mr-2 shadow-sm" 
                    placeholder="Harina, Huevos..." 
                    placeholderTextColor="#A89070" 
                    value={ing.name} 
                    onChangeText={t => updateIngredient(index, 'name', t)} 
                  />
                  <TouchableOpacity onPress={() => removeIngredient(index)} className="p-2">
                    <Trash2 size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity className="my-2 py-3 items-center border border-dashed border-fogon-gray/40 rounded-[12px] bg-fogon-white/50" onPress={addIngredient}>
                <Text className="text-fogon-gray font-bold text-sm">+ Agregar Ingrediente</Text>
              </TouchableOpacity>

              {/* PASOS */}
              <Text className="text-fogon-brown text-xl font-bold font-serif mb-4 mt-8">Pasos de Preparación</Text>
              {draftRecipe.steps.map((step, index) => (
                <View key={index} className="bg-fogon-white rounded-[16px] p-4 mb-4 shadow-sm border border-fogon-gray/10 relative">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center">
                      <View className="w-6 h-6 bg-fogon-amber rounded-full items-center justify-center mr-2">
                         <Text className="text-fogon-brown font-bold text-xs">{index + 1}</Text>
                      </View>
                      <Text className="text-fogon-brown font-bold">Paso {index + 1}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeStep(index)} className="px-2 py-1 bg-red-50 rounded-lg">
                      <Text className="text-red-500 font-bold text-[10px] uppercase">Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <TextInput className="bg-fogon-cream border border-fogon-gray/20 rounded-[12px] p-4 text-fogon-brown text-base min-h-[80px]" placeholder="Trituramos las galletas hasta hacerlas polvo..." placeholderTextColor="#A89070" multiline textAlignVertical="top" value={step.instruction} onChangeText={t => { const n = [...draftRecipe.steps]; n[index].instruction = t; setDraftRecipe({ ...draftRecipe, steps: n }); }} />
                </View>
              ))}
              <TouchableOpacity className="my-2 py-3 items-center border border-dashed border-fogon-gray/40 rounded-[12px] bg-fogon-white/50" onPress={addStep}>
                <Text className="text-fogon-gray font-bold text-sm">+ Agregar Paso</Text>
              </TouchableOpacity>

              {/* BOTON FINAL DE GUARDADO */}
              <View className="mt-10">
                <Button title="Guardar Receta en el Fogón" onPress={handleSaveInternal} loading={saving} />
              </View>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};