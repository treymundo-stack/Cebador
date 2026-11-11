import type { FechaComercial, Parametro, StockInversion, ItemLista, ListaPrecios } from '@/types';

export function paramMap(params: Parametro[]): Record<string, number> {
  return params.reduce((acc, p) => {
    acc[p.clave] = p.valor;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * R7: Fecha límite de reposición = fecha comercial - días de entrega - 21 días de venta.
 * Fecha límite de grabados = fecha comercial - días de grabado - días de envío.
 */
export function calcFechaLimiteReposicion(fechaComercial: string, diasEntrega: number): string {
  const fecha = new Date(fechaComercial);
  fecha.setDate(fecha.getDate() - diasEntrega - 21);
  return fecha.toISOString().split('T')[0];
}

export function calcFechaLimiteGrabados(fechaComercial: string, diasGrabado: number, diasEnvio: number): string {
  const fecha = new Date(fechaComercial);
  fecha.setDate(fecha.getDate() - diasGrabado - diasEnvio);
  return fecha.toISOString().split('T')[0];
}

export function getNextFechaComercial(fechas: FechaComercial[]): FechaComercial | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const future = fechas
    .filter((f) => new Date(f.fecha) >= today)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  return future[0] ?? null;
}

/**
 * R1: Margen = (precio_venta - costo) / precio_venta, usando el costo más bajo.
 */
export function calcMargen(precioVenta: number, costo: number | null): number | null {
  if (!precioVenta || costo === null || costo === undefined) return null;
  return ((precioVenta - costo) / precioVenta) * 100;
}

/**
 * R2: Rotación = días promedio entre unidades vendidas en últimos 90 días.
 * Sin ventas en 90 días = sin rotación (null).
 */
export function calcRotacion(fechaVentas: string[], totalUnidades: number): number | null {
  if (totalUnidades === 0 || fechaVentas.length === 0) return null;
  return Math.round(90 / totalUnidades * 10) / 10;
}

/**
 * R4: Plata parada = suma de stock × costo de productos sin ventas en más de 60 días.
 */
export function calcPlataParada(stock: StockInversion[], diasSinVentaNoRecomprar: number): number {
  return stock
    .filter((s) => s.dias_desde_ultima_venta !== null && s.dias_desde_ultima_venta > diasSinVentaNoRecomprar)
    .reduce((sum, s) => sum + s.stock_actual * (s.costo_vigente ?? 0), 0);
}

/**
 * R6: Detecta aumentos comparando costos de listas confirmadas del mismo proveedor.
 */
export interface AumentoInfo {
  producto_id: string;
  producto_nombre: string;
  costo_anterior: number;
  costo_actual: number;
  porcentaje: number;
  proveedor_id: string;
  proveedor_nombre: string;
}

export function detectarAumentos(
  listas: ListaPrecios[],
  alertaAumento: number
): AumentoInfo[] {
  const aumentos: AumentoInfo[] = [];

  // Agrupar items por proveedor, de listas confirmadas
  const porProveedor: Record<string, { anterior: ItemLista[]; actual: ItemLista[] }> = {};

  for (const lista of listas) {
    if (lista.estado !== 'confirmada' || !lista.proveedor) continue;
    const pid = lista.proveedor.id;
    if (!porProveedor[pid]) porProveedor[pid] = { anterior: [], actual: [] };
  }

  // Por proveedor, buscar las dos listas confirmadas más recientes
  const confirmadas = listas
    .filter((l) => l.estado === 'confirmada' && l.proveedor)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  for (const lista of confirmadas) {
    const pid = lista.proveedor!.id;
    if (porProveedor[pid].actual.length === 0) {
      porProveedor[pid].actual = lista.items_lista ?? [];
    } else if (porProveedor[pid].anterior.length === 0) {
      porProveedor[pid].anterior = lista.items_lista ?? [];
    }
  }

  for (const [pid, { anterior, actual }] of Object.entries(porProveedor)) {
    if (anterior.length === 0 || actual.length === 0) continue;
    const prov = confirmadas.find((l) => l.proveedor?.id === pid)?.proveedor;
    if (!prov) continue;

    for (const itemActual of actual) {
      if (!itemActual.producto_id) continue;
      const itemAnterior = anterior.find((a) => a.producto_id === itemActual.producto_id);
      if (!itemAnterior) continue;

      if (itemActual.costo > itemAnterior.costo) {
        const pct = ((itemActual.costo - itemAnterior.costo) / itemAnterior.costo) * 100;
        if (pct >= alertaAumento) {
          aumentos.push({
            producto_id: itemActual.producto_id,
            producto_nombre: itemActual.descripcion_original,
            costo_anterior: itemAnterior.costo,
            costo_actual: itemActual.costo,
            porcentaje: Math.round(pct * 10) / 10,
            proveedor_id: pid,
            proveedor_nombre: prov.nombre,
          });
        }
      }
    }
  }

  return aumentos;
}

/**
 * Costo más bajo por producto en listas confirmadas.
 */
export interface CostoComparacion {
  producto_id: string;
  producto_nombre: string;
  costos: { proveedor_nombre: string; costo: number; es_minimo: boolean }[];
  costo_minimo: number;
  proveedor_minimo: string;
}

export function compararCostos(listas: ListaPrecios[]): CostoComparacion[] {
  const porProducto: Record<string, { nombre: string; costos: { prov: string; costo: number }[] }> = {};

  for (const lista of listas) {
    if (lista.estado !== 'confirmada' || !lista.proveedor) continue;
    for (const item of lista.items_lista ?? []) {
      if (!item.producto_id) continue;
      if (!porProducto[item.producto_id]) {
        porProducto[item.producto_id] = { nombre: item.descripcion_original, costos: [] };
      }
      porProducto[item.producto_id].costos.push({ prov: lista.proveedor.nombre, costo: item.costo });
    }
  }

  return Object.entries(porProducto)
    .map(([pid, { nombre, costos }]) => {
      const sorted = [...costos].sort((a, b) => a.costo - b.costo);
      const min = sorted[0];
      return {
        producto_id: pid,
        producto_nombre: nombre,
        costos: sorted.map((c) => ({
          proveedor_nombre: c.prov,
          costo: c.costo,
          es_minimo: c.prov === min.prov && c.costo === min.costo,
        })),
        costo_minimo: min.costo,
        proveedor_minimo: min.prov,
      };
    })
    .sort((a, b) => a.producto_nombre.localeCompare(b.producto_nombre));
}

/**
 * Totales del carrito de compra.
 */
export interface CartItem {
  producto_id: string;
  producto_nombre: string;
  proveedor_id: string;
  proveedor_nombre: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta: number;
  minimo_compra: number;
}

export interface CartTotals {
  inversion: number;
  ventaEsperada: number;
  ganancia: number;
  presupuestoRestante: number;
}

export function calcCartTotals(items: CartItem[], presupuesto: number): CartTotals {
  const inversion = items.reduce((sum, i) => sum + i.cantidad * i.costo_unitario, 0);
  const ventaEsperada = items.reduce((sum, i) => sum + i.cantidad * i.precio_venta, 0);
  const ganancia = ventaEsperada - inversion;
  const presupuestoRestante = presupuesto - inversion;
  return { inversion, ventaEsperada, ganancia, presupuestoRestante };
}

/**
 * Días desde la última venta.
 */
export function calcDiasDesdeUltimaVenta(fechaVentas: string[]): number | null {
  if (fechaVentas.length === 0) return null;
  const ultima = fechaVentas
    .map((f) => new Date(f))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  ultima.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24));
}
