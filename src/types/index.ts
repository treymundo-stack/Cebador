export type Tendencia = 'en_alza' | 'estable' | 'en_baja';
export type EstadoLista = 'borrador' | 'confirmada' | 'archivada';
export type Canal = 'instagram' | 'tienda_nube' | 'otro';
export type TipoCompra = 'conservadora' | 'arriesgada';
export type EstadoCompra = 'sugerida' | 'realizada' | 'descartada';
export type Prioridad = 'alta' | 'media' | 'baja';

export interface Producto {
  id: string;
  user_id: string;
  nombre: string;
  categoria: string;
  precio_venta: number;
  stock_actual: number;
  grabable: boolean;
  tendencia: Tendencia;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Venta {
  id: string;
  user_id: string;
  producto_id: string;
  fecha: string;
  cantidad: number;
  precio_unitario: number;
  canal: Canal;
  created_at: string;
  producto?: Pick<Producto, 'id' | 'nombre' | 'precio_venta'>;
}

export interface Proveedor {
  id: string;
  user_id: string;
  nombre: string;
  contacto: string | null;
  dias_entrega: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListaPrecios {
  id: string;
  user_id: string;
  proveedor_id: string;
  fecha: string;
  archivo_url: string | null;
  estado: EstadoLista;
  created_at: string;
  updated_at: string;
  proveedor?: Proveedor;
  items_lista?: ItemLista[];
}

export interface ItemLista {
  id: string;
  lista_id: string;
  descripcion_original: string;
  producto_id: string | null;
  costo: number;
  minimo_compra: number;
  dudoso?: boolean;
  motivo_duda?: string | null;
  created_at: string;
  producto?: Pick<Producto, 'id' | 'nombre'>;
}

export interface FechaComercial {
  id: string;
  user_id: string;
  nombre: string;
  fecha: string;
  prioridad: Prioridad;
  created_at: string;
}

export interface Parametro {
  id: string;
  user_id: string;
  clave: string;
  valor: number;
  created_at: string;
  updated_at: string;
}

export interface Compra {
  id: string;
  user_id: string;
  fecha: string;
  presupuesto: number;
  objetivo: string | null;
  fecha_objetivo: string | null;
  tipo: TipoCompra;
  estado: EstadoCompra;
  created_at: string;
  updated_at: string;
  items_compra?: ItemCompra[];
}

export interface ItemCompra {
  id: string;
  compra_id: string;
  producto_id: string;
  proveedor_id: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta: number;
  explicacion: string | null;
  created_at: string;
  producto?: Pick<Producto, 'id' | 'nombre'>;
  proveedor?: Pick<Proveedor, 'id' | 'nombre'>;
}

export interface StockInversion {
  id: string;
  user_id: string;
  nombre: string;
  categoria: string;
  precio_venta: number;
  stock_actual: number;
  grabable: boolean;
  tendencia: Tendencia;
  costo_vigente: number | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  minimo_compra: number | null;
  margen: number | null;
  rotacion_dias: number | null;
  ventas_90d: number;
  unidades_90d: number;
  dias_desde_ultima_venta: number | null;
  plata_invertida: number;
}
