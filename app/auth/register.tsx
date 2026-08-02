import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccentColors } from '@/src/context/AccentContext';
import { useAuth } from '@/src/context/AuthContext';

export default function RegisterScreen() {
  const { theme: c } = useAccentColors();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exito, setExito] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleRegister = async () => {
    setError('');
    if (!nombre.trim() || !email.trim() || !password.trim()) {
      setError('Completa todos los campos.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const msg = await register(email.trim(), password, nombre.trim());
    setLoading(false);
    if (msg) {
      setError(msg);
    } else {
      setExito(true);
      timerRef.current = setTimeout(() => router.replace('/auth/login'), 2000);
    }
  };

  if (exito) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 48 }}>✅</Text>
        <Text style={[styles.title, { color: c.text, marginTop: 16 }]}>¡Registrado!</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Revisa tu correo para confirmar tu cuenta.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require('../../assets/images/icon.png')} style={styles.logo} contentFit="contain" />
        <Text style={[styles.title, { color: c.text }]}>Crear Cuenta</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Registra tu negocio en Mi Caja Digital
        </Text>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: c.dangerLight }]}>
              <Text style={{ color: c.danger, fontWeight: '600' }}>{error}</Text>
            </View>
          ) : null}

          <Text style={[styles.label, { color: c.textSecondary }]}>Nombre de tu negocio</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
            placeholder="Ej: Bodega de Juan"
            placeholderTextColor={c.textSecondary}
            value={nombre}
            onChangeText={setNombre}
          />

          <Text style={[styles.label, { color: c.textSecondary }]}>Correo electrónico</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
            placeholder="ejemplo@correo.com"
            placeholderTextColor={c.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={[styles.label, { color: c.textSecondary }]}>Contraseña</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={c.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            style={[styles.boton, { backgroundColor: c.primary, opacity: loading ? 0.6 : 1 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botonTexto}>Crear Cuenta</Text>
            )}
          </Pressable>

          <Link href="/auth/login" style={[styles.link, { color: c.primary }]}>
            ¿Ya tienes cuenta? Inicia sesión
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  logo: { width: 100, height: 100, alignSelf: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 24, marginTop: 4 },
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  errorBox: { borderRadius: 10, padding: 12, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontWeight: '500',
  },
  boton: {
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  botonTexto: { color: '#fff', fontSize: 18, fontWeight: '800' },
  link: { textAlign: 'center', marginTop: 16, fontSize: 14, fontWeight: '600' },
});
