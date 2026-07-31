import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import { useAccentColors } from '@/src/context/AccentContext';

export default function BarcodeScanner({ visible, onScan, onClose }: { visible: boolean; onScan: (code: string) => void; onClose: () => void }) {
  const { theme: c } = useAccentColors();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) setScanned(false);
  }, [visible]);

  const handleBarCodeScanned = (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    onScan(result.data);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        >
          <View style={styles.overlayContent}>
            <Text style={styles.instruccion}>Coloca el código de barras frente a la cámara</Text>
            <View style={styles.cuadro} />
            <Pressable style={[styles.btnCerrar, { backgroundColor: c.danger }]} onPress={() => { setScanned(false); onClose(); }}>
              <Text style={styles.btnTexto}>Cancelar</Text>
            </Pressable>
          </View>
        </CameraView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlayContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  instruccion: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 40, backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 10 },
  cuadro: { width: 250, height: 150, borderWidth: 3, borderColor: '#fff', borderRadius: 12, marginBottom: 60 },
  btnCerrar: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 },
  btnTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
