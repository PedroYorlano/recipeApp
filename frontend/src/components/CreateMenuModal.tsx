import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (option: 'manual' | 'link' | 'video' | 'audio') => void;
}

export const CreateMenuModal = ({ visible, onClose, onSelect }: Props) => {
    return (
        <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.menuContainer}>
                            <Text style={styles.title}>Crear Receta</Text>
                            <View style={styles.grid}>
                                <Option
                                    icon="link-outline" label="Link" color="#4CAF50"
                                    onPress={() => onSelect('link')}
                                />
                                <Option
                                    icon="videocam-outline" label="Video" color="#E91E63"
                                    onPress={() => onSelect('video')}
                                />
                                <Option
                                    icon="mic-outline" label="Audio" color="#FF9800"
                                    onPress={() => onSelect('audio')}
                                />
                                <Option
                                    icon="create-outline" label="Manual" color="#2196F3"
                                    onPress={() => onSelect('manual')}
                                />
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const Option = ({ icon, label, color, onPress }: any) => (
    <TouchableOpacity style={styles.optionBtn} onPress={onPress}>
        <View style={[styles.iconCircle, { backgroundColor: color }]}>
            <Ionicons name={icon} size={24} color="white" />
        </View>
        <Text style={styles.optionText}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    menuContainer: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
    title: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#333' },
    grid: { flexDirection: 'row', justifyContent: 'space-around' },
    optionBtn: { alignItems: 'center' },
    iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
    optionText: { fontSize: 12, color: '#666' }
});