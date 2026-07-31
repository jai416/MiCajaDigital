import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useAccentColors } from '@/src/context/AccentContext';

const WHATSAPP_URL = 'https://wa.me/5351819744';
const TELEGRAM_URL = 'https://t.me/+5351819744';
const PRECIO_MENSUAL = '$15 USD/mes';

export default function SuscripcionGate() {
  const { theme: c } = useAccentColors();
  const { estadoSuscripcion, diasRestantes, recheckSuscripcion } = useAuth();

  if (estadoSuscripcion === 'prueba') {
    return (
      <View style={[styles.banner, { backgroundColor: c.warning }]}>
        <Ionicons name="hourglass-outline" size={16} color="#1A1A2E" />
        <Text style={styles.bannerText}>
          Te quedan {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'} de prueba
        </Text>
        <Pressable onPress={() => Linking.openURL(WHATSAPP_URL)} hitSlop={8}>
          <Text style={styles.bannerEnlace}>Renovar</Text>
        </Pressable>
      </View>
    );
  }

  if (estadoSuscripcion !== 'expirado') {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.fondo}>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={[styles.iconoCirculo, { backgroundColor: c.dangerLight }]}>
            <Ionicons name="hourglass" size={40} color={c.danger} />
          </View>
          <Text style={[styles.titulo, { color: c.text }]}>Tu prueba ha terminado</Text>
          <Text style={[styles.subtitulo, { color: c.textSecondary }]}>
            Para seguir usando Mi Caja Digital, contacta a Jaison para renovar tu suscripción.
            Solo {PRECIO_MENSUAL}.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.boton, { backgroundColor: '#25D366' }, pressed && styles.botonPresionado]}
            onPress={() => Linking.openURL(WHATSAPP_URL)}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
            <Text style={styles.botonTexto}>WhatsApp</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.boton, { backgroundColor: '#0088CC' }, pressed && styles.botonPresionado]}
            onPress={() => Linking.openURL(TELEGRAM_URL)}
          >
            <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
            <Text style={styles.botonTexto}>Telegram</Text>
          </Pressable>

          <Pressable onPress={recheckSuscripcion} hitSlop={8}>
            <Text style={[styles.revisar, { color: c.textSecondary }]}>
              Ya renové mi suscripción — verificar de nuevo
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  iconoCirculo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitulo: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  botonPresionado: {
    opacity: 0.85,
  },
  botonTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  revisar: {
    fontSize: 13,
    textDecorationLine: 'underline',
    marginTop: 4,
  },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  bannerText: {
    color: '#1A1A2E',
    fontSize: 13,
    fontWeight: '600',
  },
  bannerEnlace: {
    color: '#1A1A2E',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
