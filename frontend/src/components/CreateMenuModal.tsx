import React from "react";
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Pencil, Link, Video, Mic, Sparkles } from 'lucide-react-native';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (option: 'manual' | 'link' | 'video' | 'audio') => void;
}

export const CreateMenuModal = ({ visible, onClose, onSelect }: Props) => {
    return (
        <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View className="flex-1 bg-black/60 justify-end">
                    <TouchableWithoutFeedback>
                        <View className="bg-fogon-white rounded-t-[32px] p-6 pb-12 shadow-sm">
                            
                            <View className="items-center mb-6">
                                <View className="w-12 h-1.5 bg-fogon-gray/30 rounded-full mb-6" />
                                <Text className="text-2xl font-serif font-bold text-fogon-brown">Agregar a tu Fogón</Text>
                            </View>

                            {/* Opciones con Inteligencia Artificial */}
                            <Text className="text-sm font-bold text-fogon-gray uppercase tracking-widest mb-4 ml-2">Importar con IA</Text>
                            <View className="flex-row justify-between mb-8 px-2">
                                <Option
                                    icon={<Link size={24} color="#FFF8F0" />}
                                    label="Link"
                                    bgColor="bg-fogon-amber"
                                    onPress={() => onSelect('link')}
                                />
                                <Option
                                    icon={<Video size={24} color="#FFF8F0" />}
                                    label="Video"
                                    bgColor="bg-fogon-amber"
                                    onPress={() => onSelect('video')}
                                />
                                <Option
                                    icon={<Mic size={24} color="#FFF8F0" />}
                                    label="Audio"
                                    bgColor="bg-fogon-amber opacity-50"
                                    onPress={() => onSelect('audio')}
                                />
                                <Option
                                    icon={<Sparkles size={24} color="#FFF8F0" />}
                                    label="Texto"
                                    bgColor="bg-fogon-amber opacity-50"
                                    onPress={() => alert("Próximamente")}
                                />
                            </View>

                            {/* Opción Manual */}
                            <Text className="text-sm font-bold text-fogon-gray uppercase tracking-widest mb-4 ml-2">Tradicional</Text>
                            <TouchableOpacity 
                                className="bg-fogon-cream rounded-2xl p-4 flex-row items-center border border-fogon-amber/20 w-full"
                                onPress={() => onSelect('manual')}
                                activeOpacity={0.8}
                            >
                                <View className="bg-fogon-brown w-12 h-12 rounded-full items-center justify-center mr-4 shadow-sm">
                                    <Pencil size={24} color="#FFF8F0" />
                                </View>
                                <View>
                                    <Text className="text-lg font-bold text-fogon-brown">Escribir Manualmente</Text>
                                    <Text className="text-sm text-fogon-gray mt-0.5">La receta de la abuela, a tu manera</Text>
                                </View>
                            </TouchableOpacity>

                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const Option = ({ icon, label, bgColor, onPress }: {icon: React.ReactNode, label: string, bgColor: string, onPress: () => void}) => (
    <TouchableOpacity className="items-center w-1/4" onPress={onPress} activeOpacity={0.8}>
        <View className={`${bgColor} w-14 h-14 rounded-full justify-center items-center mb-2 shadow-sm`}>
            {icon}
        </View>
        <Text className="text-sm font-semibold text-fogon-brown text-center">{label}</Text>
    </TouchableOpacity>
);