// frontend/src/screens/PrivacyAccountScreen.tsx
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyAccount'>;

export default function PrivacyAccountScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  const { mutate: deleteAccount, isLoading: isDeleting } = useMutation({
    mutationFn: async () => {
      await api.delete('/users/me');
    },
    onSuccess: async () => {
      await queryClient.clear();
      await signOut();
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo eliminar la cuenta.';
      Alert.alert('Error', String(msg));
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>Privacidad y cuenta</Text>

        <Text style={styles.description}>
          Administra cómo usamos tu información y las opciones sobre tu cuenta.
        </Text>

        {/* Términos y política de datos */}
        <Pressable
          style={[styles.button, styles.buttonBlack]}
          onPress={() => navigation.navigate('Legal')}
        >
          <Text style={styles.buttonText}>Términos y política de datos</Text>
        </Pressable>

        {/* Eliminar cuenta */}
        <Pressable
          style={[styles.button, styles.buttonRed]}
          onPress={() => setOpenDeleteModal(true)}
        >
          <Text style={styles.buttonText}>Eliminar mi cuenta</Text>
        </Pressable>

        <Text style={styles.smallPrint}>
          Al eliminar tu cuenta se borrarán tus datos de perfil, direcciones y
          favoritos. Tus pedidos históricos podrán conservarse sin tus datos
          personales para fines legales y contables.
        </Text>
      </View>

      {/* Modal: eliminación de cuenta */}
      <Modal
        visible={openDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenDeleteModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Eliminar mi cuenta</Text>
            <Text style={styles.modalText}>
              Esta acción eliminará tu perfil, direcciones y favoritos. Tus
              pedidos históricos se conservarán sin tus datos personales.
              {'\n\n'}
              ¿Seguro que quieres continuar?
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setOpenDeleteModal(false)}
                disabled={isDeleting}
              >
                <Text style={styles.modalCancel}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => deleteAccount()}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#dc2626" />
                ) : (
                  <Text style={styles.modalDelete}>
                    Sí, eliminar mi cuenta
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    color: '#111827',
  },
  description: {
    color: '#6b7280',
    marginBottom: 24,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buttonBlack: {
    backgroundColor: '#111827',
  },
  buttonRed: {
    backgroundColor: '#c0392b',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  smallPrint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 24,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111827',
  },
  modalText: {
    color: '#374151',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  modalCancel: {
    color: '#111827',
  },
  modalDelete: {
    color: '#dc2626',
    fontWeight: '700',
  },
});
