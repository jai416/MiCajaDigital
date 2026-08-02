import { useCallback, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAccentColors } from '@/src/context/AccentContext';
import { useGastos } from '@/src/hooks/useGastos';
import { parseNumero } from '@/src/utils/numero';
import { mensajeErrorAmigable } from '@/src/utils/mensajes';
import { logError } from '@/src/services/logger';

export default function GastosScreen() {
  const { theme: c } = useAccentColors();
  const insets = useSafeAreaInsets();
  const { addGasto, loading } = useGastos();
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [foto, setFoto] = useState('');

  const pickFoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permiso', 'Necesitamos acceso a la galería.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
    if (!res.canceled && res.assets[0]) setFoto(res.assets[0].uri);
  };

  const takeFoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permiso', 'Necesitamos acceso a la cámara.'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    if (!res.canceled && res.assets[0]) setFoto(res.assets[0].uri);
  };

  const handleGuardar = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    if (!concepto.trim()) { Alert.alert('Error', 'El concepto es obligatorio'); return; }
    const numMonto = parseNumero(monto);
    if (isNaN(numMonto) || numMonto <= 0) { Alert.alert('Error', 'Monto inválido'); return; }
    try {
      await addGasto(concepto.trim(), numMonto, foto);
    } catch (e) {
      logError('guardar_gasto', e);
      Alert.alert('Error', mensajeErrorAmigable(e));
      return;
    }
    Alert.alert('Guardado', 'Gasto registrado correctamente');
    setConcepto(''); setMonto(''); setFoto('');
  }, [concepto, monto, foto, addGasto]);

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: c.text }]}>📉 Registrar Gasto</Text>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Concepto *</Text>
          <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
            placeholder="Ej: Electricidad, Agua, Transporte..." placeholderTextColor={c.textSecondary}
            value={concepto} onChangeText={setConcepto} />

          <Text style={[styles.label, { color: c.textSecondary }]}>Monto *</Text>
          <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
            placeholder="0.00" placeholderTextColor={c.textSecondary} keyboardType="decimal-pad"
            value={monto} onChangeText={setMonto} />

          <Text style={[styles.label, { color: c.textSecondary }]}>Foto del recibo (opcional)</Text>
          {foto ? (
            <View style={{ alignItems: 'center', marginVertical: 8 }}>
              <Image source={{ uri: foto }} style={styles.fotoPreview} cachePolicy="memory-disk" />
              <Pressable onPress={() => setFoto('')}><Text style={{ color: c.danger, fontWeight: '600', marginTop: 4 }}>Eliminar foto</Text></Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={[styles.btnFoto, { borderColor: c.primary }]} onPress={pickFoto}>
                <Text style={{ color: c.primary, fontWeight: '700' }}>🖼️ Galería</Text>
              </Pressable>
              <Pressable style={[styles.btnFoto, { borderColor: c.primary }]} onPress={takeFoto}>
                <Text style={{ color: c.primary, fontWeight: '700' }}>📷 Cámara</Text>
              </Pressable>
            </View>
          )}

          <Pressable style={[styles.botonGrande, { backgroundColor: c.danger, opacity: loading ? 0.6 : 1 }]}
            onPress={handleGuardar} disabled={loading}>
            <Text style={styles.botonTexto}>📉 Guardar Gasto</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  card: { borderRadius: 16, padding: 20, borderWidth: 1, elevation: 3 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, fontWeight: '500' },
  fotoPreview: { width: '100%', height: 160, borderRadius: 12 },
  btnFoto: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 2, alignItems: 'center' },
  botonGrande: { marginTop: 24, paddingVertical: 18, borderRadius: 14, alignItems: 'center', elevation: 6 },
  botonTexto: { color: '#fff', fontSize: 20, fontWeight: '800' },
});
