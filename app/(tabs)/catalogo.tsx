import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import {
  Alert, FlatList, Linking, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAccentColors } from '@/src/context/AccentContext';
import { useCatalogo } from '@/src/hooks/useCatalogo';
import { useCompras } from '@/src/hooks/useCompras';
import { type CatalogoItem, type Compra } from '@/src/types';
import BarcodeScanner from '@/src/components/BarcodeScanner';
import { parseNumero } from '@/src/utils/numero';

export default function CatalogoScreen() {
  const { theme: c } = useAccentColors();
  const insets = useSafeAreaInsets();
  const { getAll, getCategorias, buscarPorCategoria, addProducto, updateProducto, deleteProducto } = useCatalogo();
  const { getAll: getCompras, addCompra, deleteCompra } = useCompras();
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [paginando, setPaginando] = useState(false);
  const [finAlcanzado, setFinAlcanzado] = useState(false);
  const PAGE_SIZE = 30;
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [categoria, setCategoria] = useState('');
  const [foto, setFoto] = useState('');
  // compras
  const [showCompras, setShowCompras] = useState(false);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [paginandoCompras, setPaginandoCompras] = useState(false);
  const [showAddCompra, setShowAddCompra] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [compraProducto, setCompraProducto] = useState('');
  const [compraCosto, setCompraCosto] = useState('');
  const [compraCant, setCompraCant] = useState('1');
  const [compraProv, setCompraProv] = useState('');

  const load = useCallback(async () => {
    setFinAlcanzado(false);
    setItems(await getAll(PAGE_SIZE, 0));
    setCategorias(await getCategorias());
  }, [getAll, getCategorias]);

  const cargarMas = useCallback(async () => {
    if (paginando || finAlcanzado) return;
    setPaginando(true);
    try {
      const mas = await getAll(PAGE_SIZE, items.length);
      if (mas.length === 0) setFinAlcanzado(true);
      else setItems(prev => [...prev, ...mas]);
    } finally {
      setPaginando(false);
    }
  }, [getAll, paginando, finAlcanzado, items.length]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  };

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

  const filtrar = useCallback(async (cat: string) => {
    setCategoriaFiltro(cat);
    setFinAlcanzado(false);
    setItems(cat ? await buscarPorCategoria(cat) : await getAll(PAGE_SIZE, 0));
  }, [buscarPorCategoria, getAll]);

  const openAdd = () => {
    setEditId(null); setNombre(''); setPrecio(''); setStock('0');
    setDescripcion(''); setCodigoBarras(''); setCategoria(''); setFoto('');
    setModalVisible(true);
  };

  const openEdit = (item: CatalogoItem) => {
    setEditId(item.id); setNombre(item.nombre);
    setPrecio(item.precio.toString()); setStock(item.stock.toString());
    setDescripcion(item.descripcion ?? ''); setCodigoBarras(item.codigo_barras ?? '');
    setCategoria(item.categoria ?? ''); setFoto(item.foto ?? '');
    setModalVisible(true);
  };

  const handleGuardar = async () => {
    if (!nombre.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return; }
    const p = parseNumero(precio);
    if (isNaN(p) || p <= 0) { Alert.alert('Error', 'Precio inválido'); return; }
    const s = parseInt(stock, 10) || 0;
    try {
      if (editId) {
        await updateProducto(editId, nombre.trim(), p, s, descripcion.trim(), categoria.trim(), foto, codigoBarras.trim());
      } else {
        await addProducto(nombre.trim(), p, s, descripcion.trim(), categoria.trim(), foto, codigoBarras.trim());
      }
    } catch {
      Alert.alert('Error', 'No se pudo guardar el producto.');
      return;
    }
    setModalVisible(false); load();
  };

  const abrirCompras = async () => {
    setCompras(await getCompras()); setShowCompras(true);
  };

  const handleAddCompra = async () => {
    if (!compraProducto.trim()) { Alert.alert('Error', 'Producto obligatorio'); return; }
    const cu = parseNumero(compraCosto);
    if (isNaN(cu) || cu <= 0) { Alert.alert('Error', 'Costo inválido'); return; }
    const cant = parseInt(compraCant, 10);
    if (isNaN(cant) || cant <= 0) { Alert.alert('Error', 'Cantidad inválida'); return; }
    try {
      await addCompra(compraProducto.trim(), cu, cant, compraProv.trim());
    } catch {
      Alert.alert('Error', 'No se pudo registrar la compra.');
      return;
    }
    setShowAddCompra(false); setCompraProducto(''); setCompraCosto(''); setCompraCant('1'); setCompraProv('');
    Alert.alert('Guardado', 'Compra registrada. Stock actualizado al sincronizar.');
    setCompras(await getCompras());
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <FlatList
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
        data={items}
        keyExtractor={(item) => item.id}
        onEndReachedThreshold={0.4}
        onEndReached={!categoriaFiltro ? cargarMas : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <Text style={[styles.title, { color: c.text }]}>📦 Productos</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <Pressable style={[styles.botonAgregar, { backgroundColor: c.primary, flex: 1 }]} onPress={openAdd}>
                <Text style={styles.botonAgregarTexto}>+ Producto</Text>
              </Pressable>
              <Pressable style={[styles.botonAgregar, { backgroundColor: c.success || '#16A34A', flex: 1 }]} onPress={abrirCompras}>
                <Text style={styles.botonAgregarTexto}>📦 Compras</Text>
              </Pressable>
            </View>
            {categorias.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosScroll}>
                <Pressable style={[styles.filtroBtn, { borderColor: c.primary, backgroundColor: !categoriaFiltro ? c.primary : 'transparent' }]}
                  onPress={() => filtrar('')}>
                  <Text style={{ color: !categoriaFiltro ? '#fff' : c.primary, fontWeight: '700', fontSize: 13 }}>Todas</Text>
                </Pressable>
                {categorias.map(cat => (
                  <Pressable key={cat} style={[styles.filtroBtn, { borderColor: c.primary, backgroundColor: categoriaFiltro === cat ? c.primary : 'transparent' }]}
                    onPress={() => filtrar(cat)}>
                    <Text style={{ color: categoriaFiltro === cat ? '#fff' : c.primary, fontWeight: '700', fontSize: 13 }}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {items.length === 0 && (
              <Text style={[styles.empty, { color: c.textSecondary }]}>No hay productos. Agrega tu primer producto.</Text>
            )}
            {paginando && (
              <Text style={[styles.empty, { color: c.textSecondary }]}>Cargando más…</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {item.foto ? (
                  <Image source={{ uri: item.foto }} style={styles.fotoMini} cachePolicy="memory-disk" />
                ) : null}
                <Text style={[styles.nombre, { color: c.text, flex: 1 }]}>{item.nombre}</Text>
              </View>
              <View style={styles.cardActions}>
                <Pressable onPress={() => openEdit(item)}><Text style={[styles.actionBtn, { color: c.primary }]}>✏️</Text></Pressable>
                <Pressable onPress={() => {
                  const txt = `🛍️ ${item.nombre}\n💰 ${item.precio.toFixed(2)}${item.descripcion ? `\n📝 ${item.descripcion}` : ''}\n🔗 micajadigital://producto/${item.id}`;
                  Linking.openURL(`https://wa.me/?text=${encodeURIComponent(txt)}`).catch(() =>
                    Alert.alert('Error', 'No se pudo abrir WhatsApp.')
                  );
                }}><Text style={[styles.actionBtn, { color: '#25D366' }]}>📤</Text></Pressable>
                <Pressable onPress={() => {
                  Alert.alert('Eliminar', '¿Eliminar este producto?', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: async () => {
                      try { await deleteProducto(item.id); } catch { Alert.alert('Error', 'No se pudo eliminar.'); }
                      load();
                    } },
                  ]);
                }}><Text style={styles.actionBtn}>🗑️</Text></Pressable>
              </View>
            </View>
            {item.categoria ? (
              <Text style={[styles.categoriaTag, { backgroundColor: c.primaryLight, color: c.primary }]}>{item.categoria}</Text>
            ) : null}
            <Text style={[styles.detalle, { color: c.textSecondary }]}>${item.precio.toFixed(2)}</Text>
            {item.descripcion ? (
              <Text style={[styles.detalle, { color: c.textSecondary, marginTop: 2 }]} numberOfLines={2}>{item.descripcion}</Text>
            ) : null}
            <Text style={[styles.stock, { color: item.stock < 5 ? c.danger : c.textSecondary }]}>
              Stock: {item.stock} {item.stock === 0 ? '❌' : item.stock < 5 ? '⚠️' : '✅'}
            </Text>
          </View>
        )}
      />

      {/* Modal producto */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalContent, { backgroundColor: c.surface }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>{editId ? 'Editar Producto' : 'Nuevo Producto'}</Text>
            {foto ? (
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <Image source={{ uri: foto }} style={styles.fotoPreview} cachePolicy="memory-disk" />
                <Pressable onPress={() => setFoto('')}><Text style={{ color: c.danger, fontWeight: '600' }}>Eliminar foto</Text></Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <Pressable style={[styles.btnFoto, { borderColor: c.primary }]} onPress={pickFoto}>
                  <Text style={{ color: c.primary, fontWeight: '700' }}>🖼️ Galería</Text>
                </Pressable>
                <Pressable style={[styles.btnFoto, { borderColor: c.primary }]} onPress={takeFoto}>
                  <Text style={{ color: c.primary, fontWeight: '700' }}>📷 Cámara</Text>
                </Pressable>
              </View>
            )}
            <Text style={[styles.label, { color: c.textSecondary }]}>Nombre *</Text>
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              value={nombre} onChangeText={setNombre} placeholder="Nombre del producto" placeholderTextColor={c.textSecondary} />
            <Text style={[styles.label, { color: c.textSecondary }]}>Precio *</Text>
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              value={precio} onChangeText={setPrecio} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={c.textSecondary} />
            <Text style={[styles.label, { color: c.textSecondary }]}>Stock inicial</Text>
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              value={stock} onChangeText={setStock} keyboardType="number-pad" placeholder="0" placeholderTextColor={c.textSecondary} />
            <Text style={[styles.label, { color: c.textSecondary }]}>Categoría</Text>
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              value={categoria} onChangeText={setCategoria} placeholder="Ej: Comida, Bebida..." placeholderTextColor={c.textSecondary} />
            <Text style={[styles.label, { color: c.textSecondary }]}>Código de barras</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border, flex: 1 }]}
                value={codigoBarras} onChangeText={setCodigoBarras} placeholder="Código de barras"
                placeholderTextColor={c.textSecondary} />
              <Pressable style={[styles.btnScanner, { borderColor: c.primary }]} onPress={() => setShowScanner(true)}>
                <Text style={{ fontSize: 20 }}>📷</Text>
              </Pressable>
            </View>
            <Text style={[styles.label, { color: c.textSecondary }]}>Descripción</Text>
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              value={descripcion} onChangeText={setDescripcion} placeholder="Breve descripción" placeholderTextColor={c.textSecondary}
              multiline numberOfLines={2} />
            <View style={styles.modalActions}>
              <Pressable style={[styles.btn, { borderColor: c.border, borderWidth: 1 }]} onPress={() => setModalVisible(false)}>
                <Text style={[styles.btnTexto, { color: c.textSecondary }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: c.primary }]} onPress={handleGuardar}>
                <Text style={[styles.btnTexto, { color: '#fff' }]}>Guardar</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal compras */}
      <Modal visible={showCompras} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.surface, minHeight: '50%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.modalTitle, { color: c.text }]}>📦 Historial de Compras</Text>
              <Pressable onPress={() => setShowCompras(false)}><Text style={{ color: c.textSecondary, fontWeight: '600' }}>Cerrar</Text></Pressable>
            </View>
            <Pressable style={[styles.botonAgregar, { backgroundColor: c.primary, marginBottom: 12 }]}
              onPress={() => { setCompraProducto(''); setCompraCosto(''); setCompraCant('1'); setCompraProv(''); setShowAddCompra(true); }}>
              <Text style={styles.botonAgregarTexto}>+ Nueva Compra</Text>
            </Pressable>
            <FlatList data={compras} keyExtractor={(item) => item.id}
              onEndReachedThreshold={0.4}
              onEndReached={() => {
                if (paginandoCompras || compras.length < PAGE_SIZE) return;
                setPaginandoCompras(true);
                getCompras(PAGE_SIZE, compras.length)
                  .then(mas => setCompras(prev => [...prev, ...mas]))
                  .finally(() => setPaginandoCompras(false));
              }}
              ListEmptyComponent={<Text style={{ color: c.textSecondary, textAlign: 'center', padding: 20 }}>Sin compras registradas</Text>}
              renderItem={({ item }) => (
                <View style={[styles.card, { backgroundColor: c.background, borderColor: c.border, marginBottom: 8 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: c.text, fontWeight: '700' }}>{item.producto}</Text>
                    <Pressable onPress={() => { Alert.alert('Eliminar', '¿Eliminar esta compra?', [{ text: 'No' }, { text: 'Sí', style: 'destructive', onPress: async () => {
                      try { await deleteCompra(item.id); } catch { Alert.alert('Error', 'No se pudo eliminar.'); }
                      setCompras(await getCompras());
                    } }]); }}>
                      <Text style={{ color: c.danger }}>🗑️</Text>
                    </Pressable>
                  </View>
                  <Text style={{ color: c.textSecondary, fontSize: 13 }}>
                    ${item.costo_unitario.toFixed(2)} × {item.cantidad} = ${item.costo_total.toFixed(2)}
                    {item.proveedor ? ` — ${item.proveedor}` : ''} — {item.fecha}
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Modal nueva compra */}
      <Modal visible={showAddCompra} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.surface }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>➕ Nueva Compra</Text>
            <Text style={[styles.label, { color: c.textSecondary }]}>Producto *</Text>
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              value={compraProducto} onChangeText={setCompraProducto} placeholder="Nombre del producto" placeholderTextColor={c.textSecondary} />
            <Text style={[styles.label, { color: c.textSecondary }]}>Costo unitario *</Text>
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              value={compraCosto} onChangeText={setCompraCosto} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={c.textSecondary} />
            <Text style={[styles.label, { color: c.textSecondary }]}>Cantidad</Text>
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              value={compraCant} onChangeText={setCompraCant} keyboardType="number-pad" placeholder="1" placeholderTextColor={c.textSecondary} />
            <Text style={[styles.label, { color: c.textSecondary }]}>Proveedor (opcional)</Text>
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              value={compraProv} onChangeText={setCompraProv} placeholder="Nombre del proveedor" placeholderTextColor={c.textSecondary} />
            <View style={styles.modalActions}>
              <Pressable style={[styles.btn, { borderColor: c.border, borderWidth: 1 }]} onPress={() => setShowAddCompra(false)}>
                <Text style={[styles.btnTexto, { color: c.textSecondary }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: c.primary }]} onPress={handleAddCompra}>
                <Text style={[styles.btnTexto, { color: '#fff' }]}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <BarcodeScanner visible={showScanner} onScan={(code) => { setCodigoBarras(code); setShowScanner(false); }} onClose={() => setShowScanner(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 16 },
  botonAgregar: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  botonAgregarTexto: { color: '#fff', fontSize: 15, fontWeight: '700' },
  filtrosScroll: { marginBottom: 12 },
  filtroBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, borderWidth: 2, marginRight: 8 },
  card: { borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nombre: { fontSize: 17, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { fontSize: 20, padding: 4 },
  fotoMini: { width: 40, height: 40, borderRadius: 8 },
  fotoPreview: { width: 120, height: 120, borderRadius: 12 },
  btnFoto: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 2, alignItems: 'center' },
  btnScanner: { padding: 12, borderRadius: 10, borderWidth: 2, justifyContent: 'center' },
  categoriaTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 11, fontWeight: '700', marginTop: 4, overflow: 'hidden' },
  detalle: { fontSize: 15, marginTop: 4 },
  stock: { fontSize: 13, marginTop: 2, fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnTexto: { fontSize: 16, fontWeight: '700' },
});
