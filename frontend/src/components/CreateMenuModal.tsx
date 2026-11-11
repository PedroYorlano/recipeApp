import React from 'react';
import { Modal, View, TouchableOpacity, Pressable, Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ChevronRight, Lightbulb } from 'lucide-react-native';
import { Text } from './ui/Typography';
import { ICONS } from '../constants/brand';
import { DialogHost } from './ui/DialogHost';
import { closeDialogOr } from '../utils/dialogs';
import type { CreateMode as Option } from '../context/AppContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (option: Option) => void;
}

const IMPORTS: { key: Option; label: string; hint: string; icon: any }[] = [
  { key: 'link-web', label: 'Link web', hint: 'Blogs y sitios de recetas', icon: ICONS.web },
  { key: 'video', label: 'Video', hint: 'TikTok, Instagram, YouTube, Facebook', icon: ICONS.video },
  { key: 'audio', label: 'Audio', hint: 'Dictala o subí un audio', icon: ICONS.audio },
  { key: 'text', label: 'Texto', hint: 'Pegá la receta como está', icon: ICONS.texto },
];

export const CreateMenuModal = ({ visible, onClose, onSelect }: Props) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={closeDialogOr(onClose)}>
      <Pressable className="flex-1 bg-[#3F3128]/50" onPress={onClose} accessibilityLabel="Cerrar" />
      <View
        className="bg-pizca-fondo rounded-t-[32px] px-5 pt-3 gap-[18px] w-full max-w-xl self-center"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 20 }}
      >
        <View className="self-center w-11 h-[5px] rounded-full bg-pizca-linea" />
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-[30px] leading-[32px] text-pizca-marron" accessibilityRole="header">Agregar receta</Text>
          <TouchableOpacity onPress={onClose} className="w-11 h-11 rounded-full bg-pizca-crema items-center justify-center" accessibilityLabel="Cerrar">
            <X size={20} color="#3F3128" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false} bounces={false}>
          <View className="gap-2.5">
            <Text className="text-[13px] font-extrabold tracking-wider uppercase text-pizca-texto2">Importar</Text>
            <View className="flex-row flex-wrap gap-3">
              {IMPORTS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => onSelect(opt.key)}
                  activeOpacity={0.8}
                  className="p-4 rounded-[20px] bg-white border border-pizca-linea gap-2.5"
                  style={{ flexBasis: '47%', flexGrow: 1 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${opt.label}: ${opt.hint}`}
                >
                  <View className="w-12 h-12 rounded-[14px] bg-pizca-crema items-center justify-center">
                    <Image source={opt.icon} style={{ width: 30, height: 30 }} />
                  </View>
                  <View className="gap-0.5">
                    <Text className="text-base font-extrabold text-pizca-marron">{opt.label}</Text>
                    <Text className="text-[13px] text-pizca-texto2">{opt.hint}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="gap-2.5">
            <Text className="text-[13px] font-extrabold tracking-wider uppercase text-pizca-texto2">A mano</Text>
            <TouchableOpacity
              className="flex-row items-center gap-3.5 p-4 rounded-[20px] bg-pizca-albahaca"
              onPress={() => onSelect('manual')}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <View className="w-12 h-12 rounded-[14px] bg-pizca-fondo items-center justify-center">
                <Image source={ICONS.pasos} style={{ width: 28, height: 28 }} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-extrabold text-white">Cargar a mano</Text>
                <Text className="text-[13px] text-[#CFE0CC]">La receta de la abuela, a tu manera</Text>
              </View>
              <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center gap-2">
            <Lightbulb size={16} color="#6B5A4E" strokeWidth={2.2} />
            <Text className="text-[13px] text-pizca-texto2 flex-1">Tip: desde TikTok o Instagram, tocá Compartir y elegí Pizca.</Text>
          </View>
        </ScrollView>
      </View>
      <DialogHost />
    </Modal>
  );
};
