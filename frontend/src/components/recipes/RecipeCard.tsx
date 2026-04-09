import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Recipe } from '../../types';
import { COLORS, SPACING, RADIUS, globalStyles } from '../../theme';
import { getRecipeImage } from '../../utils';

interface Props {
  item: Recipe;
  onPress: (recipe: Recipe) => void;
}

export const RecipeCard = ({ item, onPress }: Props) => {
  // Use the existing utility for image resolution which seems robust
  const imageSource = getRecipeImage(item);

  const categoryName = item.categories && item.categories.length > 0 ? item.categories_details[0].name : '';

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      activeOpacity={0.9} // Efecto al tocar
      onPress={() => onPress(item)}
    >
      {/* IMAGEN DE PORTADA */}
      <View style={styles.imageWrapper}>
        <Image
          source={imageSource || { uri: 'https://via.placeholder.com/400x300/e0e0e0/ffffff?text=Sin+Foto' }}
          style={styles.image}
          resizeMode="cover"
        />
        {/* 1. DEGRADADO SUPERPUESTO PARA LECTURA */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.gradient}
        />

        {/* 2. CATEGORÍA FLOTANTE (Arriba a la izquierda) */}
        {categoryName && (
          <View style={styles.categoryTag}>
            <Text style={styles.categoryText}>{categoryName}</Text>
          </View>
        )}

        {/* 3. TÍTULO FLOTANTE (Abajo sobre el degradado) */}
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    ...globalStyles.card, // Hereda sombra y fondo blanco
    padding: 0, // Quitamos padding del container para que la imagen toque los bordes
    overflow: 'hidden', // Para que la imagen respete el border radius
    marginBottom: SPACING.l,
    flex: 1,
    maxWidth: '48%',
    height: 240,
  },
  imageWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.card,
    position: 'relative',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  categoryTag: {
    position: 'absolute',
    top: SPACING.s,
    left: SPACING.s,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.s,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    bottom: SPACING.s,
    right: SPACING.s,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: RADIUS.s,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tagContainer: {
    backgroundColor: COLORS.background,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4
  },
  tagText: {
    fontSize: 10,
    color: COLORS.text.secondary,
    fontWeight: '600'
  },
  content: {
    padding: SPACING.m,
  },
  title: {
    position: 'absolute',
    bottom: SPACING.m,
    left: SPACING.m,
    right: SPACING.m,
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text.light,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  description: {
    fontSize: 14,
    color: COLORS.text.secondary,
    lineHeight: 20,
    marginBottom: SPACING.s,
  },
  floatingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catDot: {
    marginRight: 10,
  },
  catText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600'
  }
});