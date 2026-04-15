import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { Button, Image, Modal, SafeAreaView, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View, StatusBar } from 'react-native';
import { SERVER_URL } from '../../constants';
import { Recipe } from '../../types';
import { formatQuantity, getRecipeImage, parseQuantity } from '../../utils';

// IMPORTAMOS EL TEMA
import { COLORS, SPACING, RADIUS, globalStyles } from '../../theme';

interface Props {
  visible: boolean;
  recipe: Recipe | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const RecipeDetailModal = ({ visible, recipe, onClose, onEdit, onDelete }: Props) => {
  const [currentServings, setCurrentServings] = useState(1);

  // Cada vez que se abre una receta nueva, reiniciamos las porciones
  useEffect(() => {
    if (recipe) {
      setCurrentServings(recipe.servings || 1);
    }
  }, [recipe]);

  if (!recipe) return null;

  const handleShare = async () => {
    if (!recipe?.uuid) return;

    const link = Linking.createURL("", {
      queryParams: {
        share: recipe.uuid
      }
    });

    try {
      await Share.share({
        message: `¡Mira esta receta de ${recipe.title}!\nVer aquí: ${link}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Usamos un View simple para el fondo y SafAreaView o padding manual según convenga, 
            pero para consistencia usaremos SafeAreaView dentro o el global container */}

        {/* HEADER PERSONALIZADO */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
              <Text style={{ fontSize: 20 }}>🔗</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onEdit} style={styles.iconBtn}>
              <Text style={{ fontSize: 20 }}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={[styles.iconBtn, { backgroundColor: '#FFE5E5' }]}>
              <Text style={{ fontSize: 20 }}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* IMAGEN PORTADA */}
          <View style={styles.imageWrapper}>
            {getRecipeImage(recipe) ? (
              <Image
                source={getRecipeImage(recipe)!}
                style={styles.coverImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.coverImage, { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 40 }}>🍳</Text>
              </View>
            )}
          </View>

          <View style={styles.body}>
            <Text style={styles.title}>{recipe.title}</Text>

            {recipe.description ? (
              <Text style={styles.description}>{recipe.description}</Text>
            ) : null}

            {/* URL ORIGINAL */}
            {recipe.original_url && (
              <TouchableOpacity
                style={styles.originalLinkBtn}
                onPress={() => Linking.openURL(recipe.original_url!)}
              >
                <Text style={styles.originalLinkText}>▶ Ver receta original</Text>
              </TouchableOpacity>
            )}

            {/* CALCULADORA DE PORCIONES */}
            <View style={styles.servingsCard}>
              <Text style={styles.sectionTitle}>Ingredientes</Text>

              {recipe.servings ? (
                <View style={styles.servingsControl}>
                  <Text style={styles.servingsLabel}>Porciones:</Text>
                  <View style={styles.counterWrapper}>
                    <TouchableOpacity
                      onPress={() => setCurrentServings(p => Math.max(1, p - 1))}
                      style={styles.counterBtn}
                    >
                      <Text style={styles.counterBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{currentServings}</Text>
                    <TouchableOpacity
                      onPress={() => setCurrentServings(p => p + 1)}
                      style={styles.counterBtn}
                    >
                      <Text style={styles.counterBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* LISTA INGREDIENTES */}
              <View style={styles.ingredientsList}>
                {recipe.ingredients?.map((ing, index) => {
                  let displayQuantity = ing.quantity;
                  if (recipe.servings && currentServings !== recipe.servings) {
                    const { value, unit } = parseQuantity(ing.quantity);
                    if (value !== null) {
                      const newValue = (value / recipe.servings) * currentServings;
                      displayQuantity = formatQuantity(newValue, unit);
                    }
                  }
                  return (
                    <View key={index} style={styles.ingredientRow}>
                      <View style={styles.checkCircle} />
                      <Text style={styles.ingredientText}>
                        <Text style={{ fontWeight: 'bold' }}>{displayQuantity} </Text>
                        {ing.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* PASOS */}
            <View style={styles.stepsSection}>
              <Text style={styles.sectionTitle}>Instrucciones</Text>
              {recipe.steps?.map((step, index) => (
                <View key={index} style={styles.stepCard}>
                  <View style={styles.stepHeader}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>{step.order}</Text>
                    </View>
                    <Text style={styles.stepTitle}>Paso {step.order}</Text>
                  </View>

                  <Text style={styles.stepInstruction}>{step.instruction}</Text>
                </View>
              ))}
            </View>

          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: COLORS.background },

  // Header Flotante
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 50, // Safe Area simulación
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  closeBtn: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  closeBtnText: { fontSize: 18, color: COLORS.text.primary, fontWeight: 'bold' },

  headerActions: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: { flex: 1 },

  // Portada
  imageWrapper: {
    width: '100%',
    height: 350,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  coverImage: { width: '100%', height: '100%' },

  // Cuerpo
  body: { paddingHorizontal: SPACING.l, marginTop: SPACING.l },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text.primary,
    marginBottom: SPACING.s,
    letterSpacing: -0.5
  },
  description: {
    fontSize: 16,
    color: COLORS.text.secondary,
    lineHeight: 24,
    marginBottom: SPACING.m
  },

  originalLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.l
  },
  originalLinkText: { color: COLORS.primary, fontWeight: '600', fontSize: 15 },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.m
  },

  // Porciones Card
  servingsCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.l,
    padding: SPACING.l,
    marginBottom: SPACING.l,
    // Sombra
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  servingsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.m,
    paddingBottom: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  servingsLabel: { fontSize: 16, color: COLORS.text.secondary, fontWeight: '500' },
  counterWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: RADIUS.xl, padding: 4 },
  counterBtn: {
    width: 32,
    height: 32,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  counterBtnText: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  counterValue: { fontSize: 16, fontWeight: 'bold', marginHorizontal: 15, color: COLORS.text.primary, minWidth: 20, textAlign: 'center' },

  // Ingredientes
  ingredientsList: {},
  ingredientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    marginRight: 10,
    opacity: 0.5
  },
  ingredientText: { fontSize: 16, color: COLORS.text.primary, flex: 1, lineHeight: 22 },

  // Pasos
  stepsSection: {},
  stepCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  stepBadge: {
    backgroundColor: COLORS.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  stepBadgeText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  stepTitle: { fontWeight: '700', fontSize: 16, color: COLORS.text.primary },
  stepInstruction: { fontSize: 16, color: COLORS.text.secondary, lineHeight: 24 },
  stepImage: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.s,
    marginTop: SPACING.m,
    backgroundColor: '#f0f0f0'
  }
});