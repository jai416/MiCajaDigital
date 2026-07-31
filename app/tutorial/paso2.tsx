import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccentColors } from '@/src/context/AccentContext';

export default function PasoDos() {
  const { theme: c } = useAccentColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.emojiGrande}>📊</Text>
        <Text style={[styles.titulo, { color: c.text }]}>Controla tu Negocio</Text>
        <Text style={[styles.desc, { color: c.textSecondary }]}>
          Revisa cuánto has vendido en el día, cuánto has gastado y quiénes te deben dinero.
          Todo en una sola pantalla.
        </Text>
        <View style={styles.puntos}>
          <View style={[styles.punto, { backgroundColor: c.textSecondary }]} />
          <View style={[styles.punto, { backgroundColor: c.primary }]} />
          <View style={[styles.punto, { backgroundColor: c.textSecondary }]} />
        </View>
        <Pressable
          style={[styles.boton, { backgroundColor: c.primary }]}
          onPress={() => router.push('/tutorial/paso3')}
        >
          <Text style={styles.botonTexto}>Siguiente →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    padding: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiGrande: { fontSize: 80, marginBottom: 24 },
  titulo: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  desc: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 30 },
  puntos: { flexDirection: 'row', gap: 8, marginBottom: 40 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  boton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  botonTexto: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
