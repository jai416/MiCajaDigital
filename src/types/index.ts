export interface Venta {
  id: string;
  user_id: string;
  producto: string;
  precio: number;
  cliente: string;
  tipo: 'contado' | 'fiado';
  pagado: number;
  fecha: string;
  sincronizado: number;
  created_at: string;
}

export interface Gasto {
  id: string;
  user_id: string;
  concepto: string;
  monto: number;
  fecha: string;
  sincronizado: number;
  created_at: string;
}

export interface CuadreResumen {
  totalVentas: number;
  totalGastos: number;
  ganancia: number;
  deudores: number;
  totalCobrado: number;
  totalPendiente: number;
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
