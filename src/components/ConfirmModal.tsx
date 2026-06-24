import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, Dimensions, ActivityIndicator, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: "#FF90BB",
  text: "#1E293B",
  danger: "#EF4444",
};

const { width, height } = Dimensions.get('window');

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  isDestructive = true,
  isLoading = false,
}: ConfirmModalProps) {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      animatedValue.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) });
    } else {
      animatedValue.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: animatedValue.value * 0.5,
  }));

  const modalStyle = useAnimatedStyle(() => {
    return {
      opacity: animatedValue.value,
      transform: [
        { scale: interpolate(animatedValue.value, [0, 1], [0.95, 1]) },
      ],
    };
  });

  return (
    <Modal visible={visible} transparent={true} animationType="none" onRequestClose={onCancel}>
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={!isLoading ? onCancel : undefined} />
        </Animated.View>

        {/* Modal Content */}
        <Animated.View style={[styles.modalBox, modalStyle]}>
          {/* Icon Banner */}
          <View style={[styles.iconContainer, { backgroundColor: isDestructive ? '#FFE5E5' : '#E5F3FF' }]}>
            <Ionicons 
              name={isDestructive ? "trash-outline" : "information-circle-outline"} 
              size={32} 
              color={isDestructive ? COLORS.danger : COLORS.primary} 
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonRow}>
            <Pressable 
              style={[styles.button, styles.cancelButton]} 
              onPress={onCancel}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </Pressable>
            
            <Pressable 
              style={[
                styles.button, 
                isDestructive ? styles.confirmDestructive : styles.confirmPrimary,
                isLoading && styles.buttonDisabled
              ]} 
              onPress={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>{confirmText}</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: '#000000',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  confirmDestructive: {
    backgroundColor: COLORS.danger,
  },
  confirmPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  cancelButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#666666',
  },
  confirmButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
