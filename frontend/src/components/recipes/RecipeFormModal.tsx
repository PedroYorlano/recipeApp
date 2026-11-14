import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, ScrollView, TouchableOpacity, Image, Platform, Animated, Easing, StyleSheet } from 'react-native';
import { Text, TextInput } from '../ui/Typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../../context/AppContext';
import { Recipe, Category, Ingredient } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Camera, X, ChevronLeft, AlertCircle } from 'lucide-react-native';
import { ICONS, ISOLOGO } from '../../constants/brand';
import { notify, getErrorMessage, closeDialogOr } from '../../utils/dialogs';
import { DialogHost } from '../ui/DialogHost';
import { AudioRecorder, AudioFile } from './AudioRecorder';
import { CollectionImport, CollectionData } from './CollectionImport';
import { listCollectionService } from '../../services/api';
import { mightBeCollection } from '../../utils/shareImport';

const emptyRecipe: Recipe = {
  uuid: '', title: '', description: '', ingredients: [], steps: [], categories: [], categories_details: [], servings: 1,
};

const emptyIngredient: Ingredient = { name: '', quantity: null, unit: '', order: 0 };

/** Acepta coma o punto decimal ("1,5" → 1.5). Devuelve null si no es un número. */
const parseDecimal = (text: string): number | null => {
  const n = parseFloat(text.replace(',', '.'));
  return isNaN(n) ? null : n;
};

/**
 * Input de cantidad que guarda el texto tal cual mientras se escribe.
 * Si se parseara en cada tecla, "0," o "1." se volverían "0"/"1" y no se podrían cargar decimales.
 */
const formatDecimal = (value: number | null | undefined) => (value !== null && value !== undefined ? String(value) : '');

const QuantityInput = ({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) => {
  const [text, setText] = useState(formatDecimal(value));

  useEffect(() => {
    // Sincroniza si el valor cambió desde afuera (ej: se borró un ingrediente de arriba).
    setText(prev => (parseDecimal(prev) !== (value ?? null) ? formatDecimal(value) : prev));
  }, [value]);

  return (
    <TextInput
      className="bg-pizca-crema rounded-[12px] px-2.5 h-[46px] text-pizca-marron text-[15px] w-16"
      placeholder="200"
      placeholderTextColor="#8C7E70"
      accessibilityLabel="Cantidad"
      keyboardType="decimal-pad"
      value={text}
      onChangeText={t => {
        setText(t);
        onChange(parseDecimal(t));
      }}
    />
  );
};

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
  // Error de la última importación, se muestra en la pantalla en vez de un alert.
  const [importError, setImportError] = useState<string | null>(null);
  // Colección de TikTok o playlist de YouTube pegada en "Importar video".
  const [collection, setCollection] = useState<CollectionData | null>(null);

  const { createMode, setCreateMode, createCategory, fetchRecipes, importRecipeAIAudio, importRecipeAIText, importRecipeAIWeb, initialImportUrl, setInitialImportUrl } = useApp();
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const isConsumingUrlRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setImportError(null);
      setCollection(null);
      if (initialData) {
        setDraftRecipe(JSON.parse(JSON.stringify(initialData)));
        setIsImported(false);
      } else if (createMode === 'manual') {
        setDraftRecipe({ ...emptyRecipe });
        setIsImported(false);
      } else {
        setDraftRecipe(null);
        setIsImported(false);
        if (initialImportUrl) {
          setImportUrl(initialImportUrl);
          isConsumingUrlRef.current = true;
          setInitialImportUrl(null);
        } else {
          if (isConsumingUrlRef.current) {
            isConsumingUrlRef.current = false;
          } else {
            setImportUrl('');
          }
        }
      }
    }
  }, [visible, initialData, createMode, initialImportUrl, setInitialImportUrl]);

  const handleImport = async () => {
    setImportError(null);
    if (!importUrl.trim()) return notify("Falta el link", "Pegá el link del video.");
    setIsProcessing(true);
    try {
      if (mightBeCollection(importUrl.trim())) {
        const listing = await listCollectionService(importUrl.trim());
        if (listing.is_collection) {
          setCollection(listing);
          return;
        }
      }
      const recipe = await onImportAI(importUrl.trim());
      setDraftRecipe({ ...emptyRecipe, ...recipe, original_url: importUrl.trim() });
      setIsImported(true);
    } catch (e: any) {
      console.error("Error importando receta:", e);
      setImportError(getErrorMessage(e, "Revisá que el link sea público. Si sigue sin andar, probá pegando el texto de la receta."));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportText = async () => {
    setImportError(null);
    if (!importText.trim()) return notify("Falta el texto", "Escribí o pegá el texto de la receta.");
    setIsProcessing(true);
    try {
      const recipe = await importRecipeAIText(importText);
      setDraftRecipe({ ...emptyRecipe, ...recipe });
      setIsImported(true);
    } catch (e) {
      setImportError(getErrorMessage(e, "No encontramos una receta en el texto. Probá sumando ingredientes y pasos."));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportWeb = async () => {
    setImportError(null);
    if (!importUrl.trim()) return notify("Falta el link", "Pegá el link del blog o sitio web.");
    setIsProcessing(true);
    try {
      const recipe = await importRecipeAIWeb(importUrl.trim());
      setDraftRecipe({ ...emptyRecipe, ...recipe, original_url: importUrl.trim() });
      setIsImported(true);
    } catch (e) {
      setImportError(getErrorMessage(e, "Este sitio no nos dejó leer la receta. Probá pegando el texto."));
    } finally {
      setIsProcessing(false);
    }
  };

  const importAudioFile = async (file: AudioFile) => {
    setImportError(null);
    setIsProcessing(true);
    try {
      const recipe = await importRecipeAIAudio(file.uri, file.name, file.type, file.webFile);
      setDraftRecipe({ ...emptyRecipe, ...recipe });
      setIsImported(true);
    } catch (e) {
      setImportError(getErrorMessage(e, "No pudimos entender el audio. Probá de nuevo."));
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePickAudio = async () => {
    setImportError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      await importAudioFile({
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'audio/mpeg',
        webFile: Platform.OS === 'web' ? file.file : undefined,
      });
    } catch (e) {
      setImportError(getErrorMessage(e, "No pudimos abrir el audio. Probá con otro."));
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
      const created = await createCategory(newCategoryName);
      // La categoría recién creada queda seleccionada en la receta.
      setDraftRecipe(prev => prev ? ({ ...prev, categories: [...(prev.categories || []), created.id] }) : null);
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (e) {
      notify("Error", getErrorMessage(e, "No se pudo crear la categoría."));
    }
  };

  const pickImage = async (target: 'cover') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return notify('Sin permiso', 'Necesitamos acceso a tus fotos para elegir la portada.');

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      // Foto nueva: deja sin efecto un "quitar foto" anterior.
      setDraftRecipe(prev => prev ? ({ ...prev, localImage: uri, remove_image: false }) : null);
    }
  };

  const processImage = async (uri: string) => {
    const manipResult = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1200 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
    return `data:image/jpeg;base64,${manipResult.base64}`;
  };

  const removeCoverImage = () => {
    setDraftRecipe(prev => prev ? ({ ...prev, remove_image: true, localImage: undefined, image: undefined, image_url: undefined }) : null);
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

  const updateStep = (index: number, instruction: string) => setDraftRecipe(prev => {
    if (!prev) return null;
    const newSteps = prev.steps.map((s, i) => (i === index ? { ...s, instruction } : s));
    return { ...prev, steps: newSteps };
  });

  const addStep = () => setDraftRecipe(prev => prev ? ({ ...prev, steps: [...prev.steps, { order: prev.steps.length + 1, instruction: '' }] }) : null);
  const removeStep = (index: number) => setDraftRecipe(prev => {
    if (!prev) return null;
    const newSteps = prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
    return { ...prev, steps: newSteps };
  });

  const handleSaveInternal = async () => {
    if (!draftRecipe) return;
    if (!draftRecipe.title.trim()) return notify("Falta el título", "El título de la receta es obligatorio.");

    setSaving(true);
    try {
      const payload: any = {
        ...draftRecipe,
        // Ingredientes vacíos (fila agregada y nunca completada) los descartamos.
        ingredients: draftRecipe.ingredients.filter(i => i.name.trim()),
        steps: draftRecipe.steps.filter(s => s.instruction.trim()).map((s, i) => ({ ...s, order: i + 1 })),
      };
      if (payload.localImage) payload.image_base64 = await processImage(payload.localImage);
      await onSubmit(payload);
      onClose();
    } catch (error) {
      notify("Error", getErrorMessage(error, "No pudimos guardar la receta."));
    } finally {
      setSaving(false);
    }
  };

  const IMPORT_COPY: Record<string, { title: string; label: string; hint: string; icon: any }> = {
    video: { title: 'Importar video', label: 'Pegá el link del video o de una colección', hint: 'Funciona con TikTok, Instagram, YouTube y Facebook. Con una colección de TikTok o una playlist de YouTube, importamos todas las recetas de una.', icon: ICONS.video },
    'link-web': { title: 'Importar de la web', label: 'Pegá el link de la receta', hint: 'Nos quedamos con la receta y salteamos la historia y las publicidades.', icon: ICONS.web },
    text: { title: 'Importar texto', label: 'Pegá o escribí la receta', hint: 'Con cantidades y pasos, mejor. Lo que falte lo completamos.', icon: ICONS.texto },
    audio: { title: 'Dictar receta', label: 'Contanos la receta', hint: 'Decí el nombre, los ingredientes con sus cantidades y los pasos. Nosotros la pasamos a texto.', icon: ICONS.audio },
  };
  const copy = IMPORT_COPY[createMode ?? "video"] ?? IMPORT_COPY.video;
  const isUrlMode = createMode === 'video' || createMode === 'link-web';
  const runImport = createMode === 'link-web' ? handleImportWeb : createMode === 'text' ? handleImportText : createMode === 'audio' ? handlePickAudio : handleImport;
  const coverUri = draftRecipe ? (draftRecipe.localImage || draftRecipe.image || draftRecipe.image_url) : undefined;

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={closeDialogOr(onClose)}>
      <SafeAreaView className="flex-1 bg-pizca-fondo" edges={['top', 'bottom']}>
        {/* FASE 1: IMPORTACIÓN */}
        {collection && !draftRecipe && (
          <CollectionImport
            collection={collection}
            categories={categories}
            onBack={() => setCollection(null)}
            onImported={() => { fetchRecipes(); }}
            onClose={onClose}
          />
        )}

        {!draftRecipe && !collection && (
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 20, maxWidth: 640, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
            <View className="flex-row items-center gap-3">
              <TouchableOpacity onPress={onClose} className="w-11 h-11 rounded-full bg-white border border-pizca-linea items-center justify-center" accessibilityLabel="Volver">
                <ChevronLeft size={22} color="#3F3128" strokeWidth={2.4} />
              </TouchableOpacity>
              <Text className="font-display text-[28px] leading-[30px] text-pizca-marron flex-1" accessibilityRole="header">{copy.title}</Text>
            </View>

            <View className="gap-2">
              <Text className="text-sm font-extrabold text-pizca-marron">{copy.label}</Text>
              {isUrlMode ? (
                <View className={`h-14 flex-row items-center gap-2.5 pl-3.5 pr-2 rounded-[16px] bg-white border-2 ${importUrl ? 'border-pizca-mostaza' : 'border-pizca-linea'}`}>
                  <Image source={copy.icon} style={{ width: 22, height: 22 }} />
                  <TextInput
                    className="flex-1 text-[15px] text-pizca-marron h-full"
                    placeholder="https://…"
                    placeholderTextColor="#8C7E70"
                    value={importUrl}
                    onChangeText={t => { setImportUrl(t); setImportError(null); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    accessibilityLabel={copy.label}
                  />
                  {importUrl ? (
                    <TouchableOpacity onPress={() => setImportUrl('')} className="w-10 h-10 rounded-full bg-pizca-crema items-center justify-center" accessibilityLabel="Borrar link">
                      <X size={18} color="#3F3128" strokeWidth={2.4} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : createMode === 'text' ? (
                <TextInput
                  className="bg-pizca-crema rounded-[16px] p-4 text-pizca-marron text-[15px] min-h-[180px]"
                  multiline
                  textAlignVertical="top"
                  placeholder="Ej: Mezclar 200 g de harina con 1 huevo y hornear 20 minutos…"
                  placeholderTextColor="#8C7E70"
                  value={importText}
                  onChangeText={t => { setImportText(t); setImportError(null); }}
                  accessibilityLabel={copy.label}
                />
              ) : null}
              <Text className="text-[13px] text-pizca-texto2">{copy.hint}</Text>
            </View>

            {/* Queda montado mientras procesa, así si falla se puede reenviar sin grabar de nuevo. */}
            {createMode === 'audio' ? (
              <View style={{ display: isProcessing ? 'none' : 'flex' }}>
                <AudioRecorder onSubmit={importAudioFile} onPickFile={handlePickAudio} onError={setImportError} />
              </View>
            ) : !isProcessing && (
              <Button title="Importar receta" onPress={runImport} />
            )}

            {isProcessing && (
              <View className="mt-2 p-[22px] rounded-[24px] bg-white border border-pizca-linea items-center gap-3.5" accessibilityLiveRegion="polite">
                <Spinner />
                <Text className="text-xl font-extrabold text-pizca-marron text-center">Ordenando tu receta…</Text>
                <Text className="text-[15px] leading-[22px] text-pizca-texto2 text-center max-w-[280px]">
                  {createMode === 'video'
                    ? 'Estamos mirando el video y anotando ingredientes y pasos. Tarda unos segundos.'
                    : createMode === 'audio'
                      ? 'Estamos escuchando el audio y anotando ingredientes y pasos. Tarda unos segundos.'
                      : 'Estamos leyendo la receta y anotando ingredientes y pasos. Tarda unos segundos.'}
                </Text>
              </View>
            )}

            {importError && !isProcessing ? (
              <View className="p-4 rounded-[20px] bg-[#FFF1EB] border-[1.5px] border-pizca-tomate flex-row gap-3 items-start" accessibilityLiveRegion="polite">
                <AlertCircle size={22} color="#B23A12" strokeWidth={2.2} />
                <View className="flex-1 gap-1">
                  <Text className="text-[15px] font-extrabold text-pizca-marron">
                    {isUrlMode ? 'No pudimos leer este link' : 'No pudimos armar la receta'}
                  </Text>
                  <Text className="text-sm leading-5 text-pizca-texto2">{importError}</Text>
                  {isUrlMode ? (
                    <TouchableOpacity onPress={() => { setImportError(null); setCreateMode('text'); }} className="pt-1 self-start" accessibilityRole="button">
                      <Text className="text-sm font-extrabold text-pizca-mostaza-texto">Pegar como texto</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View className="flex-row items-center gap-4 my-2">
              <View className="flex-1 h-px bg-pizca-linea" />
              <Text className="text-pizca-texto2 text-[13px] font-bold">o</Text>
              <View className="flex-1 h-px bg-pizca-linea" />
            </View>
            <Button title="Cargar a mano" variant="outline" onPress={handleManualCreate} />
          </ScrollView>
        )}

        {/* FASE 2: EDICIÓN / MANUAL */}
        {draftRecipe && (
          <>
            <View className="flex-row items-center justify-between px-4 pt-2 pb-3 border-b border-pizca-linea">
              <TouchableOpacity onPress={onClose} className="w-11 h-11 rounded-full bg-pizca-crema items-center justify-center" accessibilityLabel="Cerrar">
                <X size={20} color="#3F3128" strokeWidth={2.4} />
              </TouchableOpacity>
              <Text className="font-display text-2xl text-pizca-marron" accessibilityRole="header">
                {initialData ? 'Editar receta' : 'Nueva receta'}
              </Text>
              <View className="w-11" />
            </View>

            <ScrollView
              className="flex-1"
              contentContainerStyle={{ padding: 20, paddingTop: 18, gap: 18, maxWidth: 640, width: '100%', alignSelf: 'center' }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {isImported && (
                <View className="bg-[#D5E4D3] px-4 py-3 rounded-[16px] flex-row items-center gap-2.5">
                  <Image source={ICONS.guardado} style={{ width: 22, height: 22 }} />
                  <Text className="text-pizca-albahaca font-extrabold flex-1">¡Receta importada! Revisá los datos antes de guardar.</Text>
                </View>
              )}

              {/* Foto */}
              {coverUri ? (
                <View className="w-full h-[180px] rounded-[24px] overflow-hidden">
                  <Image source={{ uri: coverUri }} className="w-full h-full" resizeMode="cover" />
                  <TouchableOpacity className="absolute top-3 right-3 bg-white w-9 h-9 rounded-full items-center justify-center" onPress={removeCoverImage} accessibilityLabel="Quitar foto">
                    <X size={18} color="#3F3128" strokeWidth={2.4} />
                  </TouchableOpacity>
                  <TouchableOpacity className="absolute bottom-3 left-3 bg-white px-3.5 h-9 justify-center rounded-full" onPress={() => pickImage('cover')}>
                    <Text className="text-pizca-marron text-[13px] font-extrabold">Cambiar foto</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  className="h-[150px] rounded-[24px] bg-pizca-crema border-2 border-pizca-linea items-center justify-center gap-2"
                  onPress={() => pickImage('cover')}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <Camera size={28} color="#3F3128" strokeWidth={2} />
                  <Text className="text-[15px] font-extrabold text-pizca-marron">Agregar foto</Text>
                  <Text className="text-[13px] text-pizca-texto2">Opcional</Text>
                </TouchableOpacity>
              )}

              <View>
                <Input label="Título" placeholder="Ej: Tarta de manzana de la abuela" value={draftRecipe.title} onChangeText={t => setDraftRecipe({ ...draftRecipe, title: t })} />
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Input
                      label="Porciones"
                      placeholder="4"
                      keyboardType="number-pad"
                      value={draftRecipe.servings ? String(draftRecipe.servings) : ''}
                      onChangeText={t => {
                        const n = parseInt(t.replace(/\D/g, ''), 10);
                        setDraftRecipe({ ...draftRecipe, servings: isNaN(n) ? null : n });
                      }}
                    />
                  </View>
                  <View className="flex-1">
                    <Input
                      label="Tiempo (min)"
                      placeholder="30"
                      keyboardType="number-pad"
                      value={draftRecipe.prep_time ? String(draftRecipe.prep_time) : ''}
                      onChangeText={t => {
                        const n = parseInt(t.replace(/\D/g, ''), 10);
                        setDraftRecipe({ ...draftRecipe, prep_time: isNaN(n) ? null : n });
                      }}
                    />
                  </View>
                </View>
                <Input
                  label="Descripción (opcional)"
                  placeholder="Una historia o un tip de por qué esta receta es especial…"
                  multiline
                  textAlignVertical="top"
                  value={draftRecipe.description}
                  onChangeText={t => setDraftRecipe({ ...draftRecipe, description: t })}
                />
              </View>

              {/* Categorías */}
              <View className="gap-2 -mt-2">
                <Text className="text-[13px] font-extrabold text-pizca-marron">Categorías</Text>
                <View className="flex-row flex-wrap gap-2">
                  {categories.map((cat) => {
                    const isSelected = draftRecipe.categories?.includes(cat.id);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        className={`h-9 px-3.5 justify-center rounded-full ${isSelected ? 'bg-pizca-marron' : 'bg-pizca-crema'}`}
                        onPress={() => {
                          const current = draftRecipe.categories || [];
                          const newCats = current.includes(cat.id) ? current.filter(id => id !== cat.id) : [...current, cat.id];
                          setDraftRecipe({ ...draftRecipe, categories: newCats });
                        }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: !!isSelected }}
                      >
                        <Text className={`text-sm ${isSelected ? 'font-extrabold text-pizca-fondo' : 'font-bold text-pizca-marron'}`}>{cat.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {isAddingCategory ? (
                    <View className="h-9 flex-row items-center rounded-full pl-3.5 pr-1 border-[1.5px] border-pizca-marron bg-white">
                      <TextInput
                        className="text-pizca-marron text-sm min-w-[90px] h-full"
                        placeholder="Nombre…"
                        placeholderTextColor="#8C7E70"
                        autoFocus
                        value={newCategoryName}
                        onChangeText={setNewCategoryName}
                        onSubmitEditing={handleAddCategory}
                      />
                      <TouchableOpacity onPress={handleAddCategory} className="bg-pizca-mostaza h-7 px-3 justify-center rounded-full">
                        <Text className="text-pizca-marron text-xs font-extrabold">Crear</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity className="h-9 px-3.5 justify-center rounded-full border-[1.5px] border-pizca-marron" onPress={() => setIsAddingCategory(true)}>
                      <Text className="text-pizca-marron font-extrabold text-sm">+ Nueva</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Ingredientes */}
              <View className="gap-2.5">
                <View className="flex-row items-center gap-2">
                  <Image source={ICONS.ingredientes} style={{ width: 22, height: 22 }} />
                  <Text className="text-lg font-extrabold text-pizca-marron">Ingredientes</Text>
                </View>
                {draftRecipe.ingredients.length ? (
                  <View className="flex-row gap-1.5 px-0.5">
                    <Text className="w-16 text-xs font-extrabold text-pizca-texto2">Cantidad</Text>
                    <Text className="w-[72px] text-xs font-extrabold text-pizca-texto2">Unidad</Text>
                    <Text className="flex-1 text-xs font-extrabold text-pizca-texto2">Ingrediente</Text>
                  </View>
                ) : null}
                {draftRecipe.ingredients.map((ing, index) => (
                  <View key={index} className="flex-row items-center gap-1.5">
                    <QuantityInput value={ing.quantity} onChange={v => updateIngredient(index, 'quantity', v)} />
                    <TextInput
                      className="bg-pizca-crema rounded-[12px] px-2.5 h-[46px] text-pizca-marron text-[15px] w-[72px]"
                      placeholder="g"
                      placeholderTextColor="#8C7E70"
                      value={ing.unit}
                      onChangeText={t => updateIngredient(index, 'unit', t)}
                      accessibilityLabel="Unidad"
                    />
                    <TextInput
                      className="bg-pizca-crema rounded-[12px] px-2.5 h-[46px] text-pizca-marron text-[15px] flex-1 min-w-0"
                      placeholder="harina, huevos…"
                      placeholderTextColor="#8C7E70"
                      value={ing.name}
                      onChangeText={t => updateIngredient(index, 'name', t)}
                      accessibilityLabel="Ingrediente"
                    />
                    <TouchableOpacity onPress={() => removeIngredient(index)} className="w-9 h-[46px] items-center justify-center" accessibilityLabel="Quitar ingrediente">
                      <X size={18} color="#6B5A4E" strokeWidth={2.4} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity className="h-[46px] items-center justify-center rounded-[12px] border-[1.5px] border-pizca-linea" onPress={addIngredient}>
                  <Text className="text-pizca-mostaza-texto font-extrabold text-[15px]">+ Agregar ingrediente</Text>
                </TouchableOpacity>
              </View>

              {/* Pasos */}
              <View className="gap-2.5">
                <View className="flex-row items-center gap-2">
                  <Image source={ICONS.pasos} style={{ width: 18, height: 18 }} />
                  <Text className="text-lg font-extrabold text-pizca-marron">Pasos</Text>
                </View>
                {draftRecipe.steps.map((step, index) => (
                  <View key={index} className="flex-row gap-2.5 items-start">
                    <View className="w-7 h-7 mt-2.5 bg-pizca-mostaza rounded-full items-center justify-center">
                      <Text className="text-pizca-marron font-extrabold text-sm">{index + 1}</Text>
                    </View>
                    <TextInput
                      className="flex-1 bg-pizca-crema rounded-[14px] p-3 text-pizca-marron text-[15px] min-h-[84px]"
                      placeholder="Describí el paso…"
                      placeholderTextColor="#8C7E70"
                      multiline
                      textAlignVertical="top"
                      value={step.instruction}
                      onChangeText={t => updateStep(index, t)}
                      accessibilityLabel={`Paso ${index + 1}`}
                    />
                    <TouchableOpacity onPress={() => removeStep(index)} className="w-9 h-[46px] items-center justify-center" accessibilityLabel={`Quitar paso ${index + 1}`}>
                      <X size={18} color="#6B5A4E" strokeWidth={2.4} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity className="h-[46px] items-center justify-center rounded-[12px] border-[1.5px] border-pizca-linea" onPress={addStep}>
                  <Text className="text-pizca-mostaza-texto font-extrabold text-[15px]">+ Agregar paso</Text>
                </TouchableOpacity>
              </View>

              <Input
                label="Link original (opcional)"
                placeholder="https://…"
                autoCapitalize="none"
                keyboardType="url"
                value={draftRecipe.original_url ?? ''}
                onChangeText={t => setDraftRecipe({ ...draftRecipe, original_url: t })}
              />
            </ScrollView>

            <View className="px-5 pt-3.5 pb-3 bg-pizca-fondo border-t border-pizca-linea">
              <View className="w-full max-w-[600px] self-center">
                <Button title="Guardar receta" onPress={handleSaveInternal} loading={saving} />
              </View>
            </View>
          </>
        )}
      </SafeAreaView>
      <DialogHost />
    </Modal>
  );
};

/** Anillo mostaza girando alrededor del isologo (estado "importando"). */
const Spinner = () => {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View className="w-[120px] h-[120px] items-center justify-center">
      <View className="absolute inset-0 rounded-full border-8 border-pizca-crema" />
      {/* Todo por style: NativeWind no aplica className a un Animated.View en web. */}
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject, borderRadius: 60, borderWidth: 8,
          borderColor: 'transparent', borderTopColor: '#BE9F00', borderRightColor: '#BE9F00', transform: [{ rotate }],
        }}
      />
      <Image source={ISOLOGO} style={{ width: 57, height: 46 }} resizeMode="contain" />
    </View>
  );
};
