import { useLocalSearchParams, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAccentColors } from '@/src/context/AccentContext';
import { useAuth } from '@/src/context/AuthContext';

export default function ProductoDeepLink() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme: c } = useAccentColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [producto, setProducto] = useState<{ nombre: string; precio: number; descripcion: string; stock: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const row = await db.getFirstAsync<{ nombre: string; precio: number; descripcion: string; stock: number }>(
            'SELECT nombre, precio, descripcion, stock FROM catalogo WHERE id = ? AND user_id = ?',
            [id, user?.id ?? '']
          );
          setProducto(row ?? null);
        } catch { setProducto(null); }
        finally { setLoading(false); }
      })();
    }, [db, id, user?.id])
  );

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 40 }]}>
        <Pressable onPress={() => router.replace('/(tabs)')}>
          <Text style={{ color: c.primary, fontWeight: '700', marginBottom: 20 }}>← Volver a la app</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator color={c.primary} size="large" />
        ) : producto ? (
          <>
            <Text style={styles.emoji}>🛍️</Text>
            <Text style={[styles.nombre, { color: c.text }]}>{producto.nombre}</Text>
            <Text style={[styles.precio, { color: c.primary }]}>${producto.precio.toFixed(2)}</Text>
            {producto.descripcion ? (
              <Text style={[styles.desc, { color: c.textSecondary }]}>{producto.descripcion}</Text>
            ) : null}
            <Text style={[styles.stock, { color: producto.stock < 5 ? c.danger : c.textSecondary }]}>
              Stock: {producto.stock} {producto.stock === 0 ? '❌' : producto.stock < 5 ? '⚠️' : '✅'}
            </Text>
            <Pressable
              style={[styles.boton, { backgroundColor: c.primary }]}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.botonTexto}>Registrar venta de este producto</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.emoji}>❌</Text>
            <Text style={[styles.nombre, { color: c.text }]}>Producto no encontrado</Text>
            <Text style={[styles.desc, { color: c.textSecondary }]}>
              El producto no existe o pertenece a otra cuenta.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 24, alignItems: 'center' },
  emoji: { fontSize: 64, marginBottom: 12 },
  nombre: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  precio: { fontSize: 32, fontWeight: '800', marginBottom: 12 },
  desc: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 12 },
  stock: { fontSize: 15, fontWeight: '600', marginBottom: 24 },
  boton: { width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
