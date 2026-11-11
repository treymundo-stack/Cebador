import type { FechaComercial, Parametro, StockInversion, ItemLista, ListaPrecios } from '@/types';
import { sumarDias, hoyIso } from '@/lib/reglas';

export function paramMap(params: Parametro[]): Record<string, number> {
  return params.reduce((acc, p) => {
    acc[p.clave] = Number(p.valor);
    return acc;
  }, {} as Record<string, number>);
}

/**
 * R7: Fecha límite de reposición = fecha comercial - días de entrega - 21 días de venta.
 * Fecha límite de grabados = fecha comercial - días de grabado - días de envío.
 */
export function calcFechaLimiteReposicion(fechaComercial: string, diasEntrega: number, diasVentaPrevia = 21): string {
  return sumarDias(fechaComercial, -(diasEntrega + diasVentaPrevia));
}

export function calcFechaLimiteGrabados(fechaComercial: string, diasGrabado: number, diasEnvio: number): string {
  return sumarDias(fechaComercial, -(diasGrabado + diasEnvio));
}

export function getNextFechaComercial(fechas: FechaComercial[], hoy = hoyIso()): FechaComercial | null {
  const future = fechas
    .filter((f) => f.fecha.slice(0, 10) >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  return future[0] ?? null;
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
  alertaAumento: number,
  nombres: Record<string, string> = {}
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
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at));

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

      const costoActual = Number(itemActual.costo);
      const costoAnterior = Number(itemAnterior.costo);
      if (costoAnterior > 0 && costoActual > costoAnterior) {
        const pct = ((costoActual - costoAnterior) / costoAnterior) * 100;
        if (pct >= alertaAumento) {
          aumentos.push({
            producto_id: itemActual.producto_id,
            producto_nombre: nombres[itemActual.producto_id] ?? itemActual.descripcion_original,
            costo_anterior: costoAnterior,
            costo_actual: costoActual,
            porcentaje: Math.round(pct),
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
 * Lista confirmada vigente de cada proveedor: la más reciente.
 * Las listas confirmadas anteriores quedan solo para detectar aumentos (R6).
 */
export function listasVigentes(listas: ListaPrecios[]): ListaPrecios[] {
  const porProveedor = new Map<string, ListaPrecios>();
  for (const l of listas) {
    if (l.estado !== 'confirmada') continue;
    const actual = porProveedor.get(l.proveedor_id);
    if (!actual || l.fecha > actual.fecha || (l.fecha === actual.fecha && l.created_at > actual.created_at)) {
      porProveedor.set(l.proveedor_id, l);
    }
  }
  return [...porProveedor.values()];
}

/**
 * Comparación de costos por producto (H3): costo vigente en cada proveedor y el más barato.
 */
export interface CostoComparacion {
  producto_id: string;
  producto_nombre: string;
  costos: { proveedor_id: string; proveedor_nombre: string; costo: number; minimo_compra: number; es_minimo: boolean }[];
  costo_minimo: number;
  proveedor_minimo: string;
  proveedor_minimo_id: string;
  minimo_compra: number;
}

export function compararCostos(listas: ListaPrecios[], nombres: Record<string, string> = {}): CostoComparacion[] {
  const porProducto: Record<string, { nombre: string; costos: { pid: string; prov: string; costo: number; minimo: number }[] }> = {};

  for (const lista of listasVigentes(listas)) {
    if (!lista.proveedor || lista.proveedor.activo === false) continue;
    for (const item of lista.items_lista ?? []) {
      if (!item.producto_id) continue;
      if (!porProducto[item.producto_id]) {
        porProducto[item.producto_id] = { nombre: nombres[item.producto_id] ?? item.descripcion_original, costos: [] };
      }
      porProducto[item.producto_id].costos.push({
        pid: lista.proveedor.id,
        prov: lista.proveedor.nombre,
        costo: Number(item.costo),
        minimo: item.minimo_compra,
      });
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
          proveedor_id: c.pid,
          proveedor_nombre: c.prov,
          costo: c.costo,
          minimo_compra: c.minimo,
          es_minimo: c === min,
        })),
        costo_minimo: min.costo,
        proveedor_minimo: min.prov,
        proveedor_minimo_id: min.pid,
        minimo_compra: min.minimo,
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
