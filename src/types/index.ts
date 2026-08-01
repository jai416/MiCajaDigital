export interface Venta {
  id: string;
  user_id: string;
  producto: string;
  precio: number;
  costo: number;
  cliente: string;
  tipo: 'contado' | 'fiado' | 'pedido';
  pagado: number;
  fecha: string;
  sincronizado: number;
  created_at: string;
  updated_at: string;
  catalogo_id?: string;
  metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia';
  moneda: 'CUP' | 'USD' | 'MLC';
  tipo_pedido: 'contado' | 'fiado' | 'pedido';
  anticipo: number;
  saldo_pendiente: number;
  fecha_entrega?: string;
  estado_pedido: 'pendiente' | 'entregado' | 'cancelado';
  nota: string;
}

export interface Gasto {
  id: string;
  user_id: string;
  concepto: string;
  monto: number;
  fecha: string;
  foto: string;
  sincronizado: number;
  created_at: string;
  updated_at: string;
}

export interface CatalogoItem {
  id: string;
  user_id: string;
  nombre: string;
  precio: number;
  stock: number;
  codigo_barras: string;
  descripcion: string;
  categoria: string;
  foto: string;
  sincronizado: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Compra {
  id: string;
  user_id: string;
  producto: string;
  costo_unitario: number;
  cantidad: number;
  costo_total: number;
  proveedor: string;
  fecha: string;
  sincronizado: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface MetodosPagoDesglose {
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  sugerencia: string;
}

export interface CuadreResumen {
  totalVentas: number;
  totalGastos: number;
  ganancia: number;
  deudores: number;
  totalCobrado: number;
  totalPendiente: number;
  metodosPago: MetodosPagoDesglose;
  pedidosPendientes: number;
  pedidosEntregadosHoy: number;
  ventasPorMoneda: Record<'CUP' | 'USD' | 'MLC', number>;
}

export interface Negocio {
  id: string;
  email: string;
  nombre_negocio: string;
  telefono: string;
  activo: boolean;
  plan: string;
  fecha_registro: string;
  fecha_expiracion: string;
}
