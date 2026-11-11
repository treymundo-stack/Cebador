import { supabase } from '@/lib/supabase';
import type { Producto, Venta, Proveedor, ListaPrecios, ItemLista, FechaComercial, Parametro, Compra, ItemCompra, StockInversion } from '@/types';

// ============================================================
// PRODUCTOS
// ============================================================
export async function fetchProductos(): Promise<Producto[]> {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function createProducto(input: Omit<Producto, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'activo'> & { activo?: boolean }): Promise<Producto> {
  const { data, error } = await supabase
    .from('productos')
    .insert({ ...input, activo: input.activo ?? true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProducto(id: string, input: Partial<Producto>): Promise<Producto> {
  const { data, error } = await supabase
    .from('productos')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProducto(id: string): Promise<void> {
  const { error } = await supabase.from('productos').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// VENTAS
// ============================================================
export async function fetchVentas(): Promise<Venta[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select('*, producto:id(producto_id)')
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchVentasByProducto(productoId: string): Promise<Venta[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select('*')
    .eq('producto_id', productoId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createVenta(input: {
  producto_id: string;
  fecha: string;
  cantidad: number;
  precio_unitario: number;
  canal: string;
}): Promise<Venta> {
  const { data, error } = await supabase
    .from('ventas')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVenta(id: string): Promise<void> {
  const { error } = await supabase.from('ventas').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// PROVEEDORES
// ============================================================
export async function fetchProveedores(): Promise<Proveedor[]> {
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function createProveedor(input: Omit<Proveedor, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Proveedor> {
  const { data, error } = await supabase
    .from('proveedores')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProveedor(id: string, input: Partial<Proveedor>): Promise<Proveedor> {
  const { data, error } = await supabase
    .from('proveedores')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProveedor(id: string): Promise<void> {
  const { error } = await supabase.from('proveedores').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// LISTAS DE PRECIOS
// ============================================================
export async function fetchListas(): Promise<ListaPrecios[]> {
  const { data, error } = await supabase
    .from('listas_precios')
    .select('*, proveedor:proveedores(*), items_lista(*)')
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createLista(input: {
  proveedor_id: string;
  fecha: string;
  archivo_url?: string | null;
  estado?: string;
}): Promise<ListaPrecios> {
  const { data, error } = await supabase
    .from('listas_precios')
    .insert({ ...input, estado: input.estado ?? 'borrador' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLista(id: string, input: Partial<ListaPrecios>): Promise<void> {
  const { error } = await supabase.from('listas_precios').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteLista(id: string): Promise<void> {
  const { error } = await supabase.from('listas_precios').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// ITEMS LISTA
// ============================================================
export async function createItemLista(input: {
  lista_id: string;
  descripcion_original: string;
  producto_id?: string | null;
  costo: number;
  minimo_compra: number;
}): Promise<ItemLista> {
  const { data, error } = await supabase
    .from('items_lista')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateItemLista(id: string, input: Partial<ItemLista>): Promise<void> {
  const { error } = await supabase.from('items_lista').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteItemLista(id: string): Promise<void> {
  const { error } = await supabase.from('items_lista').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// FECHAS COMERCIALES
// ============================================================
export async function fetchFechasComerciales(): Promise<FechaComercial[]> {
  const { data, error } = await supabase
    .from('fechas_comerciales')
    .select('*')
    .order('fecha');
  if (error) throw error;
  return data ?? [];
}

export async function createFechaComercial(input: {
  nombre: string;
  fecha: string;
  prioridad: string;
}): Promise<FechaComercial> {
  const { data, error } = await supabase
    .from('fechas_comerciales')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFechaComercial(id: string, input: Partial<FechaComercial>): Promise<void> {
  const { error } = await supabase.from('fechas_comerciales').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteFechaComercial(id: string): Promise<void> {
  const { error } = await supabase.from('fechas_comerciales').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// PARÁMETROS
// ============================================================
export async function fetchParametros(): Promise<Parametro[]> {
  const { data, error } = await supabase
    .from('parametros')
    .select('*')
    .order('clave');
  if (error) throw error;
  return data ?? [];
}

export async function upsertParametro(clave: string, valor: number): Promise<void> {
  const { error } = await supabase
    .from('parametros')
    .upsert({ clave, valor }, { onConflict: 'user_id,clave' });
  if (error) throw error;
}

export async function getParametro(clave: string, fallback = 0): Promise<number> {
  const { data, error } = await supabase
    .from('parametros')
    .select('valor')
    .eq('clave', clave)
    .maybeSingle();
  if (error) throw error;
  return data?.valor ?? fallback;
}

// ============================================================
// STOCK INVERSIÓN (vista)
// ============================================================
export async function fetchStockInversion(): Promise<StockInversion[]> {
  const { data, error } = await supabase
    .from('stock_inversion')
    .select('*')
    .order('nombre');
  if (error) throw error;
  return data ?? [];
}

// ============================================================
// COMPRAS
// ============================================================
export async function fetchCompras(): Promise<Compra[]> {
  const { data, error } = await supabase
    .from('compras')
    .select('*, items_compra(*, producto:productos(*), proveedor:proveedores(*))')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCompra(input: {
  presupuesto: number;
  objetivo?: string | null;
  fecha_objetivo?: string | null;
  tipo: string;
  estado?: string;
}): Promise<Compra> {
  const { data, error } = await supabase
    .from('compras')
    .insert({ ...input, estado: input.estado ?? 'sugerida' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCompra(id: string, input: Partial<Compra>): Promise<void> {
  const { error } = await supabase.from('compras').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteCompra(id: string): Promise<void> {
  const { error } = await supabase.from('compras').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// ITEMS COMPRA
// ============================================================
export async function createItemCompra(input: {
  compra_id: string;
  producto_id: string;
  proveedor_id: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta: number;
  explicacion?: string | null;
}): Promise<ItemCompra> {
  const { data, error } = await supabase
    .from('items_compra')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateItemCompra(id: string, input: Partial<ItemCompra>): Promise<void> {
  const { error } = await supabase.from('items_compra').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteItemCompra(id: string): Promise<void> {
  const { error } = await supabase.from('items_compra').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// STORAGE
// ============================================================
export async function uploadListaArchivo(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('listas-precios')
    .upload(fileName, file, { upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from('listas-precios').getPublicUrl(fileName);
  return fileName;
}
