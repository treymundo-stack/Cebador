/**
 * Reglas de negocio de Cebador (PRD §7, R1 a R11).
 *
 * Todo lo que es un número (márgenes, cantidades, totales) sale de acá, con
 * funciones puras y verificables (ver reglas.test.ts). La IA nunca calcula.
 */
import type { StockInversion, TipoCompra } from '@/types';

// ---------------------------------------------------------------------------
// Parámetros (tabla `parametros`)
// ---------------------------------------------------------------------------
export interface Umbrales {
  margenMinimo: number; // R3 Revisar precio: margen < margenMinimo
  margenReforzar: number; // R3 Reforzar: margen >= margenReforzar ...
  rotacionReforzarDias: number; // ... y rotación <= rotacionReforzarDias
  diasSinVentaNoRecomprar: number; // R3/R4
  topeArriesgada: number; // R9: % máximo del presupuesto a apuestas
  alertaAumento: number; // R6: % mínimo para alertar
  diasGrabado: number; // R7
  diasEnvio: number; // R7
  diasVentaPrevia: number; // R7: días de venta antes de la fecha
}

export const UMBRALES_DEFAULT: Umbrales = {
  margenMinimo: 30,
  margenReforzar: 40,
  rotacionReforzarDias: 15,
  diasSinVentaNoRecomprar: 60,
  topeArriesgada: 30,
  alertaAumento: 5,
  diasGrabado: 12,
  diasEnvio: 3,
  diasVentaPrevia: 21,
};

export function umbralesDesde(pm: Record<string, number>): Umbrales {
  const v = (k: string, d: number) => (typeof pm[k] === 'number' && !isNaN(pm[k]) ? Number(pm[k]) : d);
  const d = UMBRALES_DEFAULT;
  return {
    margenMinimo: v('margen_minimo', d.margenMinimo),
    margenReforzar: v('margen_reforzar', d.margenReforzar),
    rotacionReforzarDias: v('rotacion_reforzar_dias', d.rotacionReforzarDias),
    diasSinVentaNoRecomprar: v('dias_sin_venta_no_recomprar', d.diasSinVentaNoRecomprar),
    topeArriesgada: v('tope_arriesgada', d.topeArriesgada),
    alertaAumento: v('alerta_aumento', d.alertaAumento),
    diasGrabado: v('dias_grabado', d.diasGrabado),
    diasEnvio: v('dias_envio', d.diasEnvio),
    diasVentaPrevia: v('dias_venta_previa', d.diasVentaPrevia),
  };
}

// ---------------------------------------------------------------------------
// R1 · Margen
// ---------------------------------------------------------------------------
export function margen(precioVenta: number, costo: number | null | undefined): number | null {
  if (!precioVenta || costo === null || costo === undefined) return null;
  return ((precioVenta - costo) / precioVenta) * 100;
}

// ---------------------------------------------------------------------------
// R3 · Clasificación
// ---------------------------------------------------------------------------
export type Clasificacion = 'no_recomprar' | 'revisar_precio' | 'reforzar' | 'mantener';

export const CLASIFICACION_LABEL: Record<Clasificacion, string> = {
  reforzar: 'Reforzar',
  mantener: 'Mantener',
  revisar_precio: 'Revisar precio',
  no_recomprar: 'No recomprar',
};

export interface ResultadoClasificacion {
  clasificacion: Clasificacion;
  motivo: string;
}

const pct = (n: number) => `${Math.round(n * 10) / 10}%`.replace('.', ',');

export function clasificar(s: StockInversion, u: Umbrales): ResultadoClasificacion {
  // 1. No recomprar: sin ventas en más de N días
  if (s.dias_desde_ultima_venta !== null && s.dias_desde_ultima_venta > u.diasSinVentaNoRecomprar) {
    return {
      clasificacion: 'no_recomprar',
      motivo: `Sin ventas hace ${s.dias_desde_ultima_venta} días (más de ${u.diasSinVentaNoRecomprar}).`,
    };
  }
  // 2. Revisar precio: margen bajo
  if (s.margen !== null && s.margen < u.margenMinimo) {
    return {
      clasificacion: 'revisar_precio',
      motivo: `Margen de ${pct(s.margen)}, por debajo del ${u.margenMinimo}%.`,
    };
  }
  // 3. Reforzar: buen margen y rotación rápida, o tendencia en alza
  const rinde =
    s.margen !== null &&
    s.margen >= u.margenReforzar &&
    s.rotacion_dias !== null &&
    s.rotacion_dias <= u.rotacionReforzarDias;
  if (rinde) {
    return {
      clasificacion: 'reforzar',
      motivo: `Margen de ${pct(s.margen!)} y se vende una unidad cada ${s.rotacion_dias} días.`,
    };
  }
  if (s.tendencia === 'en_alza') {
    return { clasificacion: 'reforzar', motivo: 'Tendencia marcada en alza.' };
  }
  // 4. Mantener
  const partes: string[] = [];
  if (s.margen === null) partes.push('sin costo en listas confirmadas');
  else partes.push(`margen de ${pct(s.margen)}`);
  if (s.rotacion_dias === null) partes.push(s.ventas_90d === 0 ? 'sin ventas en 90 días' : 'poca rotación');
  else partes.push(`una venta cada ${s.rotacion_dias} días`);
  const txt = partes.join(', ');
  return { clasificacion: 'mantener', motivo: txt.charAt(0).toUpperCase() + txt.slice(1) + '.' };
}

export type StockClasificado = StockInversion & ResultadoClasificacion;

export function clasificarTodo(stock: StockInversion[], u: Umbrales): StockClasificado[] {
  return stock.map((s) => ({ ...s, ...clasificar(s, u) }));
}

// ---------------------------------------------------------------------------
// R4 · Plata parada
// ---------------------------------------------------------------------------
export function plataParada(stock: StockInversion[], u: Umbrales): number {
  return stock
    .filter((s) => s.dias_desde_ultima_venta !== null && s.dias_desde_ultima_venta > u.diasSinVentaNoRecomprar)
    .reduce((sum, s) => sum + s.stock_actual * (s.costo_vigente ?? 0), 0);
}

// ---------------------------------------------------------------------------
// R7 · Fechas límite (fechas ISO YYYY-MM-DD, sin zona horaria)
// ---------------------------------------------------------------------------
export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + dias);
  return t.toISOString().slice(0, 10);
}

export function diasEntre(desdeIso: string, hastaIso: string): number {
  const a = Date.parse(desdeIso.slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse(hastaIso.slice(0, 10) + 'T00:00:00Z');
  return Math.round((b - a) / 86_400_000);
}

export function hoyIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Fecha límite de reposición = fecha − días de entrega del proveedor − días de venta previa. */
export function fechaLimiteReposicion(fecha: string, diasEntrega: number, u: Umbrales): string {
  return sumarDias(fecha, -(diasEntrega + u.diasVentaPrevia));
}

/** Fecha límite de grabados = fecha − días de grabado − días de envío. */
export function fechaLimiteGrabados(fecha: string, u: Umbrales): string {
  return sumarDias(fecha, -(u.diasGrabado + u.diasEnvio));
}

// ---------------------------------------------------------------------------
// R8 / R9 · Compra recomendada
// ---------------------------------------------------------------------------
export interface ItemRecomendado {
  producto_id: string;
  producto_nombre: string;
  proveedor_id: string;
  proveedor_nombre: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta: number;
  minimo_compra: number;
  clasificacion: Clasificacion;
  apuesta: boolean; // producto "en alza" con poco historial (R9)
  demanda_esperada: number;
  stock_actual: number;
  margen: number;
  explicacion: string;
}

export interface CompraRecomendada {
  tipo: TipoCompra;
  presupuesto: number;
  diasHorizonte: number;
  items: ItemRecomendado[];
  inversion: number;
  inversionApuestas: number;
  ventaEsperada: number;
  ganancia: number;
  presupuestoRestante: number;
  /** Productos que convenía reponer pero no entraron en el presupuesto. */
  sinPresupuesto: string[];
}

export interface OpcionesCompra {
  presupuesto: number;
  tipo: TipoCompra;
  /** Fecha objetivo ISO. Si no hay, se usan `diasPorDefecto` días. */
  fechaObjetivo?: string | null;
  hoy?: string;
  diasPorDefecto?: number;
}

/** Con menos ventas que esto en 90 días, un producto "tiene poco historial". */
export const VENTAS_HISTORIAL_MINIMO = 3;

interface Candidato {
  s: StockClasificado;
  cantidadIdeal: number;
  demanda: number;
  apuesta: boolean;
  prioridad: number;
}

export function recomendarCompra(stock: StockClasificado[], opts: OpcionesCompra, u: Umbrales): CompraRecomendada {
  const hoy = opts.hoy ?? hoyIso();
  const presupuesto = Math.max(0, opts.presupuesto);
  const diasHorizonte = opts.fechaObjetivo
    ? Math.max(1, diasEntre(hoy, opts.fechaObjetivo))
    : (opts.diasPorDefecto ?? 30);

  const candidatos: Candidato[] = [];

  for (const s of stock) {
    // R8: solo Reforzar y Mantener, con costo vigente y precio de venta
    if (s.clasificacion !== 'reforzar' && s.clasificacion !== 'mantener') continue;
    if (s.costo_vigente === null || !s.proveedor_id || !s.precio_venta || s.margen === null) continue;
    if (s.costo_vigente <= 0) continue;

    const minimo = Math.max(1, s.minimo_compra ?? 1);
    const velocidad = s.unidades_90d / 90; // unidades por día
    const demanda = Math.ceil(velocidad * diasHorizonte);
    const tieneHistorial = s.ventas_90d > 0;
    const pocoHistorial = s.ventas_90d < VENTAS_HISTORIAL_MINIMO;

    if (opts.tipo === 'arriesgada' && s.tendencia === 'en_alza' && pocoHistorial) {
      // R9: apuesta a tendencia. Se compra el mínimo (o lo que pida la demanda) si queda poco stock.
      if (s.stock_actual > 1) continue;
      const cantidad = Math.max(minimo, demanda - s.stock_actual, 1);
      candidatos.push({ s, cantidadIdeal: cantidad, demanda, apuesta: true, prioridad: s.margen });
      continue;
    }

    // R9: la conservadora (y la base de la arriesgada) solo usa productos con historial
    if (!tieneHistorial) continue;

    const necesidad = demanda - s.stock_actual;
    if (necesidad <= 0) continue;
    const cantidad = Math.max(necesidad, minimo);
    // R8: prioridad = margen × velocidad de venta
    candidatos.push({ s, cantidadIdeal: cantidad, demanda, apuesta: false, prioridad: s.margen * velocidad });
  }

  const items: ItemRecomendado[] = [];
  const sinPresupuesto: string[] = [];
  let restante = presupuesto;
  let inversionApuestas = 0;
  const topeApuestas = opts.tipo === 'arriesgada' ? (presupuesto * u.topeArriesgada) / 100 : 0;

  const agregar = (c: Candidato, disponible: number): number => {
    const costo = c.s.costo_vigente!;
    const minimo = Math.max(1, c.s.minimo_compra ?? 1);
    const alcanza = Math.floor(disponible / costo);
    if (alcanza < minimo) {
      sinPresupuesto.push(c.s.nombre);
      return 0;
    }
    const cantidad = Math.min(c.cantidadIdeal, alcanza);
    items.push(armarItem(c, cantidad, diasHorizonte, opts.fechaObjetivo ?? null));
    return cantidad * costo;
  };

  // Primero las apuestas (hasta el tope), después el resto por prioridad.
  const apuestas = candidatos.filter((c) => c.apuesta).sort((a, b) => b.prioridad - a.prioridad);
  for (const c of apuestas) {
    const gasto = agregar(c, Math.min(restante, topeApuestas - inversionApuestas));
    inversionApuestas += gasto;
    restante -= gasto;
  }

  const base = candidatos.filter((c) => !c.apuesta).sort((a, b) => b.prioridad - a.prioridad);
  for (const c of base) {
    restante -= agregar(c, restante);
  }

  const inversion = items.reduce((sum, i) => sum + i.cantidad * i.costo_unitario, 0);
  const ventaEsperada = items.reduce((sum, i) => sum + i.cantidad * i.precio_venta, 0);

  return {
    tipo: opts.tipo,
    presupuesto,
    diasHorizonte,
    items,
    inversion,
    inversionApuestas,
    ventaEsperada,
    ganancia: ventaEsperada - inversion,
    presupuestoRestante: presupuesto - inversion,
    sinPresupuesto,
  };
}

function armarItem(c: Candidato, cantidad: number, dias: number, fechaObjetivo: string | null): ItemRecomendado {
  const s = c.s;
  const minimo = Math.max(1, s.minimo_compra ?? 1);
  const hasta = fechaObjetivo ? `hasta el ${fechaObjetivo.slice(8, 10)}/${fechaObjetivo.slice(5, 7)}` : `en ${dias} días`;
  let explicacion: string;
  if (c.apuesta) {
    explicacion = `Apuesta: está en alza y casi no tiene historial. Margen ${pct(s.margen!)}.`;
  } else {
    explicacion =
      `${CLASIFICACION_LABEL[s.clasificacion]}: margen ${pct(s.margen!)}, ` +
      `se esperan ${c.demanda} u. ${hasta} y tenés ${s.stock_actual}.`;
  }
  if (cantidad < c.cantidadIdeal) explicacion += ` Recortado a ${cantidad} u. por presupuesto.`;
  else if (minimo > 1 && cantidad === minimo && c.cantidadIdeal === minimo) explicacion += ` Mínimo del proveedor: ${minimo} u.`;
  return {
    producto_id: s.id,
    producto_nombre: s.nombre,
    proveedor_id: s.proveedor_id!,
    proveedor_nombre: s.proveedor_nombre ?? '',
    cantidad,
    costo_unitario: s.costo_vigente!,
    precio_venta: s.precio_venta,
    minimo_compra: minimo,
    clasificacion: s.clasificacion,
    apuesta: c.apuesta,
    demanda_esperada: c.demanda,
    stock_actual: s.stock_actual,
    margen: s.margen!,
    explicacion,
  };
}
