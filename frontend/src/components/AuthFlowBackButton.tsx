// frontend/src/components/AuthFlowBackButton.tsx
import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  /**
   * Si se pasa, se usa esta función de back (lógica específica de la pantalla).
   * Si no se pasa, se usa el fallback genérico.
   */
  onBack?: () => void;
};

export default function AuthFlowBackButton({ onBack }: Props) {
  const navigation = useNavigation<Navigation>();
  const { isAuthenticated } = useAuth();

  const handlePress = () => {
    // 1) Si la pantalla definió su propia lógica de back, usarla
    if (onBack) {
      onBack();
      return;
    }

    const state = navigation.getState?.();
    const canPop = navigation.canGoBack() && (state?.routes?.length ?? 0) > 1;

    // 2) Si se puede hacer goBack() normal, perfecto
    if (canPop) {
      navigation.goBack();
      return;
    }

    // 3) Fallback: si está autenticado → Dashboard, si no → AuthChooser
    if (isAuthenticated) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Dashboard' as never }],
      });
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'AuthChooser' as never }],
      });
    }
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <TouchableOpacity
        onPress={handlePress}
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <Ionicons name="chevron-back" size={20} color="#111827" />
        <Text
          style={{
            marginLeft: 4,
            color: '#111827',
            fontSize: 14,
            fontWeight: '600',
          }}
        >
          Volver
        </Text>
      </TouchableOpacity>
    </View>
  );
}
