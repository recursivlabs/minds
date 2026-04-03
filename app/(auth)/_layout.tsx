import { Slot } from 'expo-router';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Container } from '../../components';

export default function AuthLayout() {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <Container centered maxWidth={400}>
        <Slot />
      </Container>
    </KeyboardAvoidingView>
  );
}
