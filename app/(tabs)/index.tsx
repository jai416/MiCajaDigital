import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import {
  Alert, FlatList, KeyboardAvoidingView, Linking, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccentColors } from '@/src/context/AccentContext';
import { useVentas } from '@/src/hooks/useVentas';
import { useCatalogo } from '@/src/hooks/useCatalogo';
import { type CatalogoItem } from '@/src/types';
import Calculadora from '@/src/components/Calculadora';
import BarcodeScanner from '@/src/components/BarcodeScanner';
import { parseNumero } from '@/src/utils/numero';

export default function VentasScreen() {
  const { theme: c } = useAccentColors();
  const insets = useSafeAreaInsets();
  const { addVenta, loading } = useVentas();
  const { getAll: getCatalogo, buscar: buscarCatalogo, buscarPorCodigo, getCategorias, buscarPorCategoria, addProducto: addProdCatalogo } = useCatalogo();

  const [producto, setProducto] = useState('');
  const [precio, setPrecio] = useState('');
  const [cliente, setCliente] = useState('');
  const [tipoPedido, setTipoPedido] = useState<'contado' | 'fiado' | 'pedido'>('contado');
  const [anticipo, setAnticipo] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [catalogoId, setCatalogoId] = useState<string | undefined>();
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo');
  const [moneda, setMoneda] = useState<'CUP' | 'USD' | 'MLC'>('CUP');
  const [showCatalogo, setShowCatalogo] = useState(false);
  const [catalogoItems, setCatalogoItems] = useState<CatalogoItem[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [catFiltro, setCatFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickNombre, setQuickNombre] = useState('');
  const [quickPrecio, setQuickPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [showCalc, setShowCalc] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  // recibo
  const [showRecibo, setShowRecibo] = useState(false);
  const reciboData = useRef<{ producto: string; precio: number; cliente: string; tipo_pedido: string; metodo_pago: string; moneda: string; fecha: string } | null>(null);

  const abrirCatalogo = useCallback(async () => {
    setBusqueda(''); setCatFiltro('');
    const [items, cats] = await Promise.all([getCatalogo(), getCategorias()]);
    setCatalogoItems(items);
    setCategorias(cats);
    setShowCatalogo(true);
  }, [getCatalogo, getCategorias]);

  const buscarEnCatalogo = useCallback(async (q: string) => {
    setBusqueda(q);
    setCatalogoItems(q.trim() ? await buscarCatalogo(q) : await getCatalogo());
  }, [buscarCatalogo, getCatalogo]);

  const filtrarCat = useCallback(async (cat: string) => {
    setCatFiltro(cat);
    setCatalogoItems(cat ? await buscarPorCategoria(cat) : await getCatalogo());
  }, [buscarPorCategoria, getCatalogo]);

  const seleccionarCatalogo = useCallback((item: CatalogoItem) => {
    setProducto(item.nombre);
    setPrecio(item.precio.toString());
    setCatalogoId(item.id);
    setShowCatalogo(false);
    setCatFiltro('');
    setBusqueda('');
  }, []);

  const handleQuickAdd = useCallback(async () => {
    if (!quickNombre.trim() || !quickPrecio.trim()) return;
    const p = parseNumero(quickPrecio);
    if (isNaN(p) || p <= 0) return;
    await addProdCatalogo(quickNombre.trim(), p, 0, '', '');
    setQuickNombre(''); setQuickPrecio('');
    setShowQuickAdd(false);
    setCatalogoItems(await getCatalogo());
  }, [quickNombre, quickPrecio, addProdCatalogo, getCatalogo]);

  const handleVender = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!producto.trim()) { Alert.alert('Error', 'El producto es obligatorio'); return; }
    const numPrecio = parseNumero(precio);
    if (isNaN(numPrecio) || numPrecio <= 0) { Alert.alert('Error', 'Precio inválido'); return; }
    if (tipoPedido !== 'contado' && !cliente.trim()) {
      Alert.alert('Error', 'El cliente es obligatorio para fiado o pedido');
      return;
    }
    if (tipoPedido === 'pedido') {
      const numAnticipo = parseNumero(anticipo) || 0;
      if (numAnticipo >= numPrecio) {
        Alert.alert('Anticipo inválido', 'El anticipo no puede ser mayor o igual al precio total.');
        return;
      }
    }

    try {
      await addVenta({
        producto: producto.trim(), precio: numPrecio, costo: parseNumero(costo) || 0,
        cliente: cliente.trim(), moneda,
        tipo_pedido: tipoPedido, catalogo_id: catalogoId, metodo_pago: metodoPago,
        anticipo: parseNumero(anticipo) || 0, fecha_entrega: fechaEntrega.trim() || undefined,
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar la venta.');
      return;
    }

    reciboData.current = {
      producto: producto.trim(), precio: numPrecio, cliente: cliente.trim(),
      tipo_pedido: tipoPedido, metodo_pago: metodoPago, moneda,
      fecha: new Date().toLocaleDateString('es-CU'),
    };
    setShowRecibo(true);

    setProducto(''); setPrecio(''); setCosto(''); setCliente('');
    setCatalogoId(undefined); setAnticipo(''); setFechaEntrega('');
    setTipoPedido('contado'); setMetodoPago('efectivo'); setMoneda('CUP');
  }, [producto, precio, costo, cliente, tipoPedido, anticipo, fechaEntrega, catalogoId, metodoPago, moneda, addVenta]);

  const compartirWhatsApp = useCallback(() => {
    const d = reciboData.current;
    if (!d) return;
    const txt = `🧾 *Mi Caja Digital - Comprobante*\n\n📦 Producto: ${d.producto}\n💰 Precio: $${d.precio.toFixed(2)}\n💳 Método: ${d.metodo_pago}\n📋 Tipo: ${d.tipo_pedido}${d.cliente ? `\n👤 Cliente: ${d.cliente}` : ''}\n📅 Fecha: ${d.fecha}\n\nGracias por su compra.`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(txt)}`).catch(() =>
      Alert.alert('Error', 'No se pudo abrir WhatsApp.')
    );
  }, []);

  const handleCambiarProducto = useCallback((t: string) => {
    setProducto(t);
    if (t !== producto) setCatalogoId(undefined);
  }, [producto]);

  const coloresTipo = { contado: c.primary, fiado: c.warning, pedido: '#8B5CF6' };

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: c.text }]}>💲 Nueva Venta</Text>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Producto *</Text>
          <View style={styles.productoRow}>
            <TextInput style={[styles.inputProducto, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              placeholder="Ej: Pan, Leche..." placeholderTextColor={c.textSecondary}
              value={producto} onChangeText={handleCambiarProducto} />
            <Pressable style={[styles.btnCatalogo, { borderColor: c.primary }]} onPress={abrirCatalogo}>
              <Text style={{ fontSize: 20 }}>📦</Text>
            </Pressable>
            <Pressable style={[styles.btnCatalogo, { borderColor: '#6366F1' }]} onPress={() => setShowScanner(true)}>
              <Text style={{ fontSize: 20 }}>📷</Text>
            </Pressable>
          </View>

          <Text style={[styles.label, { color: c.textSecondary }]}>Precio *</Text>
          <View style={styles.productoRow}>
            <TextInput style={[styles.inputProducto, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              placeholder="0.00" placeholderTextColor={c.textSecondary} keyboardType="decimal-pad"
              value={precio} onChangeText={setPrecio} />
            <Pressable style={[styles.btnCatalogo, { borderColor: c.warning }]} onPress={() => setShowCalc(true)}>
              <Text style={{ fontSize: 20 }}>🔢</Text>
            </Pressable>
          </View>

          <Text style={[styles.label, { color: c.textSecondary }]}>Tipo de venta</Text>
          <View style={styles.tipoRow}>
            {(['contado', 'fiado', 'pedido'] as const).map((t) => {
              const color = coloresTipo[t];
              return (
                <Pressable key={t} style={[styles.tipoBtn, { backgroundColor: tipoPedido === t ? color : c.surface, borderColor: color }]}
                  onPress={() => setTipoPedido(t)}>
                  <Text style={{ color: tipoPedido === t ? '#fff' : color, fontWeight: '700', fontSize: 12 }}>
                    {t === 'contado' ? '💵 Contado' : t === 'fiado' ? '📝 Fiado' : '📋 Pedido'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tipoPedido === 'pedido' && (
            <>
              <Text style={[styles.label, { color: c.textSecondary }]}>💰 Anticipo</Text>
              <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
                placeholder="0.00" placeholderTextColor={c.textSecondary} keyboardType="decimal-pad"
                value={anticipo} onChangeText={setAnticipo} />
              <Text style={[styles.label, { color: c.textSecondary }]}>📅 Fecha de entrega</Text>
              <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
                placeholder="YYYY-MM-DD (opcional)" placeholderTextColor={c.textSecondary}
                value={fechaEntrega} onChangeText={setFechaEntrega} />
            </>
          )}

          <Text style={[styles.label, { color: c.textSecondary }]}>💳 Método de pago</Text>
          <View style={styles.tipoRow}>
            {(['efectivo', 'tarjeta', 'transferencia'] as const).map((m) => {
              const isActive = metodoPago === m;
              const color = m === 'efectivo' ? c.primary : m === 'tarjeta' ? '#6366F1' : '#8B5CF6';
              return (
                <Pressable key={m} style={[styles.tipoBtn, { backgroundColor: isActive ? color : c.surface, borderColor: color }]}
                  onPress={() => setMetodoPago(m)}>
                  <Text style={{ color: isActive ? '#fff' : color, fontWeight: '700', fontSize: 12 }}>
                    {m === 'efectivo' ? '💰 Efectivo' : m === 'tarjeta' ? '💳 Tarjeta' : '📲 Transf.'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: c.textSecondary }]}>💱 Moneda</Text>
          <View style={styles.tipoRow}>
            {(['CUP', 'USD', 'MLC'] as const).map((m) => {
              const isActive = moneda === m;
              const color = m === 'CUP' ? c.primary : m === 'USD' ? '#16A34A' : '#2563EB';
              return (
                <Pressable key={m} style={[styles.tipoBtn, { backgroundColor: isActive ? color : c.surface, borderColor: color }]}
                  onPress={() => setMoneda(m)}>
                  <Text style={{ color: isActive ? '#fff' : color, fontWeight: '700', fontSize: 12 }}>{m}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: c.textSecondary }]}>Costo (para calcular ganancia)</Text>
          <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
            placeholder="0.00" placeholderTextColor={c.textSecondary} keyboardType="decimal-pad"
            value={costo} onChangeText={setCosto} />

          <Text style={[styles.label, { color: c.textSecondary }]}>
            Cliente {tipoPedido !== 'contado' ? '*' : '(opcional)'}
          </Text>
          <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
            placeholder="Nombre del cliente" placeholderTextColor={c.textSecondary}
            value={cliente} onChangeText={setCliente} />

          <Pressable style={[styles.botonGrande, { backgroundColor: c.primary, opacity: loading ? 0.6 : 1 }]}
            onPress={handleVender} disabled={loading}>
            <Text style={styles.botonTexto}>💲 Vender</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modal catálogo con búsqueda + filtro categorías */}
      <Modal visible={showCatalogo} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: c.text }]}>📦 Catálogo</Text>
              <Pressable onPress={() => setShowCatalogo(false)}>
                <Text style={[styles.modalCerrar, { color: c.textSecondary }]}>Cerrar</Text>
              </Pressable>
            </View>
            <TextInput style={[styles.inputBuscar, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              placeholder="Buscar producto..." placeholderTextColor={c.textSecondary}
              value={busqueda} onChangeText={buscarEnCatalogo} />
            {categorias.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <Pressable style={[styles.catBtn, { borderColor: c.primary, backgroundColor: !catFiltro ? c.primary : 'transparent' }]}
                  onPress={() => filtrarCat('')}>
                  <Text style={{ color: !catFiltro ? '#fff' : c.primary, fontWeight: '700', fontSize: 12 }}>Todas</Text>
                </Pressable>
                {categorias.map(cat => (
                  <Pressable key={cat} style={[styles.catBtn, { borderColor: c.primary, backgroundColor: catFiltro === cat ? c.primary : 'transparent' }]}
                    onPress={() => filtrarCat(cat)}>
                    <Text style={{ color: catFiltro === cat ? '#fff' : c.primary, fontWeight: '700', fontSize: 12 }}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <FlatList data={catalogoItems} keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={{ color: c.textSecondary, marginBottom: 12 }}>{busqueda.trim() ? 'Sin resultados' : 'Catálogo vacío'}</Text>
                  <Pressable style={[styles.btnQuickAdd, { borderColor: c.primary }]}
                    onPress={() => { setQuickNombre(busqueda); setQuickPrecio(''); setShowQuickAdd(true); }}>
                    <Text style={{ color: c.primary, fontWeight: '700' }}>➕ Agregar "{busqueda || 'nuevo'}"</Text>
                  </Pressable>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable style={[styles.itemCatalogo, { borderBottomColor: c.border, flexDirection: 'row', alignItems: 'center' }]}
                  onPress={() => seleccionarCatalogo(item)}>
                  {item.foto ? (
                    <Image source={{ uri: item.foto }} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 10 }} cachePolicy="memory-disk" />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemNombre, { color: c.text }]}>{item.nombre}</Text>
                    <Text style={[styles.itemDetalle, { color: c.textSecondary }]}>
                      ${item.precio.toFixed(2)} — Stock: {item.stock}
                      {item.descripcion ? ` — ${item.descripcion}` : ''}
                      {item.categoria ? ` • ${item.categoria}` : ''}
                    </Text>
                  </View>
                  <Text style={{ color: c.primary, fontSize: 20 }}>›</Text>
                </Pressable>
              )}
            />
            {!busqueda.trim() && catalogoItems.length > 0 && (
              <Pressable style={[styles.btnQuickAdd, { borderColor: c.primary, marginTop: 8 }]}
                onPress={() => { setQuickNombre(''); setQuickPrecio(''); setShowQuickAdd(true); }}>
                <Text style={{ color: c.primary, fontWeight: '700' }}>➕ Agregar nuevo producto</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal quick-add */}
      <Modal visible={showQuickAdd} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.surface, paddingBottom: 30 }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>➕ Nuevo producto</Text>
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border }]}
              placeholder="Nombre" placeholderTextColor={c.textSecondary}
              value={quickNombre} onChangeText={setQuickNombre} />
            <TextInput style={[styles.input, { backgroundColor: c.background, color: c.text, borderColor: c.border, marginTop: 8 }]}
              placeholder="Precio" placeholderTextColor={c.textSecondary} keyboardType="decimal-pad"
              value={quickPrecio} onChangeText={setQuickPrecio} />
            <View style={styles.modalActions}>
              <Pressable style={[styles.btn, { borderColor: c.border, borderWidth: 1 }]} onPress={() => setShowQuickAdd(false)}>
                <Text style={[styles.btnTexto, { color: c.textSecondary }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: c.primary }]} onPress={handleQuickAdd}>
                <Text style={[styles.btnTexto, { color: '#fff' }]}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Escáner código de barras */}
      <BarcodeScanner visible={showScanner} onScan={async (code) => {
        setShowScanner(false);
        const item = await buscarPorCodigo(code);
        if (item) {
          seleccionarCatalogo(item);
        } else {
          setProducto(code);
          Alert.alert('No encontrado', `No hay producto con código "${code}". Puedes agregarlo desde el catálogo.`);
        }
      }} onClose={() => setShowScanner(false)} />
      {/* Calculadora */}
      <Calculadora visible={showCalc} onClose={() => setShowCalc(false)} onResult={(val) => setPrecio(val.toString())} />

      {/* Modal recibo */}
      <Modal visible={showRecibo} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentRecibo, { backgroundColor: c.surface }]}>
            <Text style={[styles.reciboTitulo, { color: c.text }]}>🧾 Comprobante de Venta</Text>
            <View style={[styles.reciboLinea, { borderBottomColor: c.border }]}>
              <Text style={{ color: c.textSecondary }}>Producto</Text>
              <Text style={{ color: c.text, fontWeight: '700' }}>{reciboData.current?.producto}</Text>
            </View>
            <View style={[styles.reciboLinea, { borderBottomColor: c.border }]}>
              <Text style={{ color: c.textSecondary }}>Precio</Text>
              <Text style={{ color: c.primary, fontWeight: '800', fontSize: 18 }}>${reciboData.current?.precio.toFixed(2)}</Text>
            </View>
            <View style={[styles.reciboLinea, { borderBottomColor: c.border }]}>
              <Text style={{ color: c.textSecondary }}>Método</Text>
              <Text style={{ color: c.text }}>{reciboData.current?.metodo_pago}</Text>
            </View>
            <View style={[styles.reciboLinea, { borderBottomColor: c.border }]}>
              <Text style={{ color: c.textSecondary }}>Tipo</Text>
              <Text style={{ color: c.text }}>{reciboData.current?.tipo_pedido}</Text>
            </View>
            {reciboData.current?.cliente ? (
              <View style={[styles.reciboLinea, { borderBottomColor: c.border }]}>
                <Text style={{ color: c.textSecondary }}>Cliente</Text>
                <Text style={{ color: c.text }}>{reciboData.current?.cliente}</Text>
              </View>
            ) : null}
            <View style={[styles.reciboLinea, { borderBottomColor: c.border }]}>
              <Text style={{ color: c.textSecondary }}>Fecha</Text>
              <Text style={{ color: c.text }}>{reciboData.current?.fecha}</Text>
            </View>

            <Pressable style={[styles.botonWhatsApp, { backgroundColor: '#25D366' }]} onPress={compartirWhatsApp}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>📤 Compartir por WhatsApp</Text>
            </Pressable>
            <Pressable style={[styles.botonCerrar, { borderColor: c.border }]} onPress={() => setShowRecibo(false)}>
              <Text style={{ color: c.textSecondary, fontWeight: '700' }}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  productoRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inputProducto: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, fontWeight: '500' },
  btnCatalogo: { borderWidth: 2, borderRadius: 12, padding: 12 },
  tipoRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tipoBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 2, alignItems: 'center' },
  botonGrande: { marginTop: 24, paddingVertical: 18, borderRadius: 14, alignItems: 'center', elevation: 6 },
  botonTexto: { color: '#fff', fontSize: 20, fontWeight: '800' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%', paddingBottom: 40 },
  modalContentRecibo: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalCerrar: { fontSize: 16, fontWeight: '600' },
  inputBuscar: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12 },
  catBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 2, marginRight: 6 },
  itemCatalogo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  itemNombre: { fontSize: 16, fontWeight: '600' },
  itemDetalle: { fontSize: 13, marginTop: 2 },
  btnQuickAdd: { padding: 12, borderRadius: 10, borderWidth: 2, alignItems: 'center' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnTexto: { fontSize: 16, fontWeight: '700' },
  reciboTitulo: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 20 },
  reciboLinea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  botonWhatsApp: { marginTop: 24, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  botonCerrar: { marginTop: 10, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
});
