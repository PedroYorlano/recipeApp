import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Image, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useApp } from '../../context/AppContext';
import { Recipe, Category } from '../../types';

// IMPORTAMOS EL TEMA
import { COLORS, SPACING, RADIUS, globalStyles } from '../../theme';

// Definimos una receta vacía para iniciar el modo manual
const emptyRecipe: Recipe = {
  uuid: '',
  title: '',
  description: '',
  ingredients: [],
  steps: [],
  categories: [],
  categories_details: [],
  servings: 1,
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (recipe: any) => Promise<void>;
  onImportAI: (url: string) => Promise<any>;
  initialData: Recipe | null;
  categories: Category[];
}

export const RecipeFormModal = ({ visible, onClose, onSubmit, onImportAI, initialData, categories }: Props) => {
  // --- ESTADOS ---
  const [draftRecipe, setDraftRecipe] = useState<Recipe | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImported, setIsImported] = useState(false);
  const [saving, setSaving] = useState(false);

  // Contexto y Modos
  const { createMode, setCreateMode, createCategory } = useApp();

  // Estado para categoría nueva
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // --- EFECTO DE INICIALIZACIÓN ---
  useEffect(() => {
    if (visible) {
      if (initialData) {
        // MODO EDICIÓN
        setDraftRecipe(JSON.parse(JSON.stringify(initialData)));
        setIsImported(false);
      } else if (createMode === 'manual') {
        // MODO MANUAL
        setDraftRecipe({ ...emptyRecipe });
        setIsImported(false);
      } else {
        // MODO IMPORTACIÓN
        setDraftRecipe(null);
        setImportUrl('');
        setIsImported(false);
      }
    }
  }, [visible, initialData, createMode]);

  // --- LÓGICA DE IMPORTACIÓN ---
  const handleImport = async () => {
    if (!importUrl) return Alert.alert("Error", "Ingresa una URL");
    setIsProcessing(true);
    try {
      const recipe = await onImportAI(importUrl);
      setDraftRecipe({ ...recipe, original_url: importUrl });
      setIsImported(true);
    } catch (e) {
      Alert.alert("Error", "No se pudo extraer la receta.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualCreate = () => {
    setDraftRecipe({ ...emptyRecipe });
    setIsImported(false);
  };

  // --- LÓGICA DE CATEGORÍAS ---
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setIsAddingCategory(false);
      return;
    }
    try {
      await createCategory(newCategoryName);
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (e) {
      Alert.alert("Error", "No se pudo crear la categoría.");
    }
  };

  // --- MANEJO DE IMÁGENES ---
  const pickImage = async (target: 'cover' | 'step', stepIndex?: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permiso denegado');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setDraftRecipe(prev => {
        if (!prev) return null;
        if (target === 'cover') {
          return { ...prev, localImage: uri };
        } else if (target === 'step' && stepIndex !== undefined) {
          const newSteps = [...prev.steps];
          newSteps[stepIndex] = { ...newSteps[stepIndex], localImage: uri };
          return { ...prev, steps: newSteps };
        }
        return prev;
      });
    }
  };

  const processImage = async (uri: string) => {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri, [{ resize: { width: 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return `data:image/jpeg;base64,${manipResult.base64}`;
  };

  const removeStepImage = (index: number) => {
    setDraftRecipe(prev => {
      if (!prev) return null;
      const newSteps = [...prev.steps];
      newSteps[index] = { ...newSteps[index], remove_image: true, localImage: undefined, image: undefined };
      return { ...prev, steps: newSteps };
    });
  };

  const removeCoverImage = () => {
    setDraftRecipe(prev => prev ? ({ ...prev, remove_image: true, localImage: undefined, image: undefined }) : null);
  };

  // --- LÓGICA DE LISTAS (Ingredientes/Pasos) ---
  const addIngredient = () => {
    setDraftRecipe(prev => prev ? ({ ...prev, ingredients: [...prev.ingredients, { name: '', quantity: '' }] }) : null);
  };
  const addStep = () => {
    setDraftRecipe(prev => prev ? ({ ...prev, steps: [...prev.steps, { order: prev.steps.length + 1, instruction: '' }] }) : null);
  };
  const removeStep = (index: number) => {
    setDraftRecipe(prev => {
      if (!prev) return null;
      const newSteps = prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
      return { ...prev, steps: newSteps };
    });
  };

  // --- GUARDADO FINAL ---
  const handleSaveInternal = async () => {
    if (!draftRecipe) return;
    if (!draftRecipe.title.trim()) return Alert.alert("Error", "El título es obligatorio");

    setSaving(true);
    try {
      const payload: any = { ...draftRecipe };

      if (payload.localImage) {
        payload.image_base64 = await processImage(payload.localImage);
      }

      payload.steps = await Promise.all(payload.steps.map(async (step: any) => {
        if (step.localImage) {
          return { ...step, image_base64: await processImage(step.localImage) };
        }
        return step;
      }));

      await onSubmit(payload);
      onClose();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo guardar la receta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>

        {/* HEADER */}
        <View style={styles.modalHeader}>
          <Text style={globalStyles.title}>
            {!draftRecipe ? 'Importar Receta' : (initialData ? 'Editar Receta' : 'Nueva Receta')}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: COLORS.danger, fontWeight: '600', fontSize: 16 }}>Cancelar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>

          {/* === FASE 1: IMPORTACIÓN === */}
          {!draftRecipe && (
            <View style={styles.importContainer}>
              <Text style={styles.labelLarge}>
                {createMode === 'video' ? 'Pega el link del video (YouTube/Instagram):' : 'Pega el link de la receta:'}
              </Text>

              <TextInput
                style={globalStyles.input}
                placeholder="https://..."
                placeholderTextColor={COLORS.text.secondary}
                value={importUrl}
                onChangeText={setImportUrl}
                autoCapitalize="none"
              />

              {isProcessing ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={{ marginTop: 10, color: COLORS.text.secondary }}>La IA está leyendo la receta...</Text>
                </View>
              ) : (
                <TouchableOpacity style={globalStyles.primaryButton} onPress={handleImport}>
                  <Text style={globalStyles.primaryButtonText}>✨ Extraer con IA</Text>
                </TouchableOpacity>
              )}

              <View style={styles.separator}>
                <Text style={styles.separatorText}>— O —</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleManualCreate}>
                  <Text style={styles.secondaryButtonText}>Crear manualmente en blanco</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* === FASE 2: FORMULARIO === */}
          {draftRecipe && (
            <View style={styles.formContainer}>
              {isImported && (
                <View style={styles.successBanner}>
                  <Text style={styles.successText}>¡Receta importada! Revisa los datos.</Text>
                </View>
              )}

              {/* TÍTULO */}
              <Text style={globalStyles.label}>Título</Text>
              <TextInput
                style={globalStyles.input}
                value={draftRecipe.title}
                onChangeText={t => setDraftRecipe({ ...draftRecipe, title: t })}
                placeholder="Ej: Tarta de Manzana"
              />

              {/* PORTADA */}
              <View style={styles.coverSection}>
                {draftRecipe.localImage || draftRecipe.image ? (
                  <View style={styles.imagePreviewWrapper}>
                    <Image
                      source={{ uri: draftRecipe.localImage || draftRecipe.image }}
                      style={styles.coverImage}
                    />
                    <TouchableOpacity
                      style={styles.deleteImageBtn}
                      onPress={removeCoverImage}
                    >
                      <Text style={{ color: 'white', fontWeight: 'bold' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.coverPlaceholder} onPress={() => pickImage('cover')}>
                    <Text style={{ fontSize: 40, marginBottom: 10 }}>📷</Text>
                    <Text style={{ color: COLORS.text.secondary }}>Subir Foto de Portada</Text>
                  </TouchableOpacity>
                )}

                {(draftRecipe.localImage || draftRecipe.image) && (
                  <TouchableOpacity style={styles.changeImageBtn} onPress={() => pickImage('cover')}>
                    <Text style={styles.changeImageText}>Cambiar Foto</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={globalStyles.label}>Descripción</Text>
              <TextInput
                style={[globalStyles.input, { height: 100, textAlignVertical: 'top' }]}
                multiline
                value={draftRecipe.description}
                placeholder="Breve descripción del plato..."
                onChangeText={t => setDraftRecipe({ ...draftRecipe, description: t })}
              />

              {/* CATEGORÍAS */}
              <Text style={globalStyles.label}>Categorías</Text>
              <View style={styles.chipsContainer}>
                {isAddingCategory ? (
                  <View style={[styles.inputChipContainer]}>
                    <TextInput
                      style={styles.inputChip}
                      placeholder="Nueva..."
                      autoFocus
                      value={newCategoryName}
                      onChangeText={setNewCategoryName}
                      onSubmitEditing={handleAddCategory}
                    />
                    <TouchableOpacity onPress={handleAddCategory} style={styles.okBtn}>
                      <Text style={styles.okText}>OK</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addChip} onPress={() => setIsAddingCategory(true)}>
                    <Text style={styles.addChipText}>+ Nueva</Text>
                  </TouchableOpacity>
                )}

                {categories.map((cat) => {
                  const isSelected = draftRecipe.categories?.includes(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.chip, isSelected && styles.selectedChip]}
                      onPress={() => {
                        const current = draftRecipe.categories || [];
                        const newCats = current.includes(cat.id)
                          ? current.filter(id => id !== cat.id)
                          : [...current, cat.id];
                        setDraftRecipe({ ...draftRecipe, categories: newCats });
                      }}
                    >
                      <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* INGREDIENTES */}
              <Text style={[globalStyles.label, { marginTop: SPACING.m }]}>Ingredientes</Text>
              {draftRecipe.ingredients.map((ing, index) => (
                <View key={index} style={styles.ingredientRow}>
                  <TextInput
                    placeholder="100g"
                    style={[styles.ingQtyInput]}
                    value={ing.quantity}
                    onChangeText={t => {
                      const newIngs = [...draftRecipe.ingredients];
                      newIngs[index].quantity = t;
                      setDraftRecipe({ ...draftRecipe, ingredients: newIngs });
                    }}
                  />
                  <TextInput
                    placeholder="Nombre del ingrediente"
                    style={[styles.ingNameInput]}
                    value={ing.name}
                    onChangeText={t => {
                      const newIngs = [...draftRecipe.ingredients];
                      newIngs[index].name = t;
                      setDraftRecipe({ ...draftRecipe, ingredients: newIngs });
                    }}
                  />
                  <TouchableOpacity onPress={() => {
                    const newIngs = draftRecipe.ingredients.filter((_, i) => i !== index);
                    setDraftRecipe({ ...draftRecipe, ingredients: newIngs });
                  }}>
                    <Text style={{ fontSize: 18, color: COLORS.danger }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.smallAddBtn} onPress={addIngredient}>
                <Text style={styles.smallAddBtnText}>+ Agregar Ingrediente</Text>
              </TouchableOpacity>

              {/* PASOS */}
              <Text style={[globalStyles.label, { marginTop: SPACING.l }]}>Pasos de preparación</Text>
              {draftRecipe.steps.map((step, index) => (
                <View key={index} style={styles.stepContainer}>
                  <View style={styles.stepHeader}>
                    <View style={styles.stepNumberBadge}>
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepTitle}>Paso {index + 1}</Text>
                    <TouchableOpacity onPress={() => removeStep(index)}>
                      <Text style={{ color: COLORS.danger, fontWeight: '600', fontSize: 12 }}>ELIMINAR</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    placeholder={`Describe el paso ${index + 1}...`}
                    multiline
                    style={styles.stepInput}
                    value={step.instruction}
                    onChangeText={t => {
                      const newSteps = [...draftRecipe.steps];
                      newSteps[index].instruction = t;
                      setDraftRecipe({ ...draftRecipe, steps: newSteps });
                    }}
                  />

                  {/* FOTO DEL PASO */}
                  <View style={styles.stepFooter}>
                    <TouchableOpacity onPress={() => pickImage('step', index)} style={styles.stepPhotoBtn}>
                      <Text style={styles.stepPhotoText}>📷 {step.localImage || step.image ? 'Cambiar Foto' : 'Agregar Foto'}</Text>
                    </TouchableOpacity>

                    {(step.localImage || step.image) && (
                      <View style={{ marginLeft: 10, position: 'relative' }}>
                        <Image
                          source={{ uri: step.localImage || step.image }}
                          style={{ width: 60, height: 60, borderRadius: 8 }}
                        />
                        <TouchableOpacity
                          onPress={() => removeStepImage(index)}
                          style={styles.removeStepImgBtn}
                        >
                          <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.smallAddBtn} onPress={addStep}>
                <Text style={styles.smallAddBtnText}>+ Agregar Paso</Text>
              </TouchableOpacity>

              {/* FOOTER */}
              <View style={styles.footerButtons}>
                {saving ? (
                  <ActivityIndicator size="large" color={COLORS.primary} />
                ) : (
                  <TouchableOpacity style={globalStyles.primaryButton} onPress={handleSaveInternal}>
                    <Text style={globalStyles.primaryButtonText}>GUARDAR RECETA</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    marginTop: SPACING.l,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border
  },
  modalContent: { padding: SPACING.l },

  // Import Styles
  importContainer: { marginTop: 40, alignItems: 'center' },
  labelLarge: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.m,
    textAlign: 'center'
  },
  loadingBox: { alignItems: 'center', marginVertical: 20 },
  separator: { marginTop: 40, alignItems: 'center', width: '100%' },
  separatorText: { color: COLORS.text.secondary, marginBottom: SPACING.m },
  secondaryButton: {
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.l,
    borderRadius: RADIUS.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    alignItems: 'center'
  },
  secondaryButtonText: { color: COLORS.text.primary, fontWeight: '600' },

  // Form Styles
  formContainer: { paddingBottom: 100 },
  successBanner: { backgroundColor: COLORS.success + '20', padding: SPACING.m, borderRadius: RADIUS.s, marginBottom: SPACING.l },
  successText: { color: COLORS.success, textAlign: 'center', fontWeight: 'bold' },

  // Cover
  coverSection: { alignItems: 'center', marginBottom: SPACING.l },
  coverPlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.m,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed'
  },
  imagePreviewWrapper: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.m,
    overflow: 'hidden',
    position: 'relative'
  },
  coverImage: { width: '100%', height: '100%' },
  deleteImageBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center'
  },
  changeImageBtn: { marginTop: 10 },
  changeImageText: { color: COLORS.primary, fontWeight: '600' },

  // Chips
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: SPACING.m },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.card,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  selectedChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.text.secondary, fontWeight: '600', fontSize: 13 },
  selectedChipText: { color: 'white' },

  addChip: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.xl,
    marginRight: 8,
    marginBottom: 8
  },
  addChipText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },

  inputChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'white'
  },
  inputChip: { minWidth: 60, color: COLORS.text.primary },
  okBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginLeft: 5 },
  okText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // Ingredients
  ingredientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  ingQtyInput: {
    width: 80,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    borderRadius: RADIUS.s,
    marginRight: 10,
    textAlign: 'center'
  },
  ingNameInput: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    borderRadius: RADIUS.s,
    marginRight: 10
  },
  smallAddBtn: { marginVertical: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.s, borderStyle: 'dashed' },
  smallAddBtnText: { color: COLORS.text.secondary, fontWeight: '600' },

  // Steps
  stepContainer: {
    marginBottom: SPACING.m,
    padding: SPACING.m,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.m,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.s },
  stepNumberBadge: {
    width: 24,
    height: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  stepNumberText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  stepTitle: { fontWeight: 'bold', fontSize: 16, color: COLORS.text.primary, flex: 1 },

  stepInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.s,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 10
  },
  stepFooter: { flexDirection: 'row', alignItems: 'center' },
  stepPhotoBtn: {
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.s
  },
  stepPhotoText: { fontSize: 12, fontWeight: '600', color: COLORS.text.secondary },
  removeStepImgBtn: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.danger,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'white'
  },

  // Footer
  footerButtons: { marginTop: SPACING.xl, alignItems: 'center' },
});