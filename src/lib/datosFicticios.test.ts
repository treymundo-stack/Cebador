/**
 * Los datos ficticios tienen que ser realistas para un emprendimiento chico de mates
 * y mostrar todas las clasificaciones. Se simula la vista stock_inversion (mismo
 * cálculo que el SQL) y se clasifican con las reglas reales.
 */
import { describe, expect, it } from 'vitest';
import type { StockInversion } from '@/types';
import { DIAS_HISTORIAL, LISTAS, PARAMETROS, PRODUCTOS, PROVEEDORES, generarVentas } from '@/lib/datosFicticios';
import { clasificarTodo, plataParada, recomendarCompra, umbralesDesde, type Clasificacion } from '@/lib/reglas';

const ventas = generarVentas();
const u = umbralesDesde(PARAMETROS);

/** Igual que la vista stock_inversion: costo más barato entre las listas confirmadas vigentes. */
export function stockSimulado(): StockInversion[] {
  const vigentes = PROVEEDORES.map((p) =>
    LISTAS.filter((l) => l.proveedor === p.clave && l.estado === 'confirmada').sort((a, b) => a.haceDias - b.haceDias)[0],
  ).filter(Boolean);

  return PRODUCTOS.map((p) => {
    const costos = vigentes
      .flatMap((l) => l.items.filter((i) => i.producto === p.clave).map((i) => ({ ...i, prov: l.proveedor })))
      .sort((a, b) => a.costo - b.costo);
    const c = costos[0];
    const vs = ventas.filter((v) => v.producto === p.clave);
    const v90 = vs.filter((v) => v.haceDias <= 90);
    const unidades = v90.reduce((s, v) => s + v.cantidad, 0);
    return {
      id: p.clave,
      user_id: 'u',
      nombre: p.nombre,
      categoria: p.categoria,
      precio_venta: p.precio_venta,
      stock_actual: p.stock,
      grabable: p.grabable,
      tendencia: p.tendencia,
      costo_vigente: c?.costo ?? null,
      proveedor_id: c ? c.prov : null,
      proveedor_nombre: c ? `Proveedor ${c.prov}` : null,
      minimo_compra: c?.minimo ?? null,
      margen: c ? Math.round(((p.precio_venta - c.costo) / p.precio_venta) * 1000) / 10 : null,
      rotacion_dias: unidades > 0 ? Math.round((90 / unidades) * 10) / 10 : null,
      ventas_90d: v90.length,
      unidades_90d: unidades,
      dias_desde_ultima_venta: vs.length ? Math.min(...vs.map((v) => v.haceDias)) : null,
      plata_invertida: p.stock * (c?.costo ?? 0),
    };
  });
}

const clasificado = clasificarTodo(stockSimulado(), u);
const de = (c: Clasificacion) => clasificado.filter((s) => s.clasificacion === c);

describe('datos ficticios', () => {
  it('entre 1 y 3 ventas por día en total, todos los días', () => {
    for (let d = 0; d < DIAS_HISTORIAL; d++) {
      const n = ventas.filter((v) => v.haceDias === d).length;
      expect(n, `hace ${d} días`).toBeGreaterThanOrEqual(1);
      expect(n, `hace ${d} días`).toBeLessThanOrEqual(3);
    }
    expect(ventas.every((v) => v.haceDias >= 0 && v.haceDias < DIAS_HISTORIAL)).toBe(true);
  });

  it('aparecen las cuatro clasificaciones en las cantidades pedidas', () => {
    expect(de('reforzar')).toHaveLength(8);
    expect(de('mantener')).toHaveLength(10);
    expect(de('revisar_precio')).toHaveLength(5);
    expect(de('no_recomprar')).toHaveLength(5);
    expect(de('sin_costo')).toHaveLength(1);
  });

  it('Revisar precio es por margen menor al 30%', () => {
    for (const s of de('revisar_precio')) expect(s.margen!).toBeLessThan(30);
  });

  it('No recomprar tiene stock entre 1 y 3, así la plata parada es mayor a cero', () => {
    for (const s of de('no_recomprar')) {
      expect(s.stock_actual).toBeGreaterThanOrEqual(1);
      expect(s.stock_actual).toBeLessThanOrEqual(3);
    }
    expect(plataParada(stockSimulado(), u)).toBeGreaterThan(0);
  });

  it('hay 2 productos en alza con poco historial y la compra arriesgada los usa de apuesta', () => {
    const enAlza = clasificado.filter((s) => s.tendencia === 'en_alza' && s.ventas_90d < 3);
    expect(enAlza).toHaveLength(2);
    const c = recomendarCompra(clasificado, { presupuesto: 300000, tipo: 'arriesgada' }, u);
    const apuestas = c.items.filter((i) => i.apuesta);
    expect(apuestas.map((i) => i.producto_id).sort()).toEqual(enAlza.map((s) => s.id).sort());
    expect(c.inversionApuestas).toBeGreaterThanOrEqual(45000);
    expect(c.inversionApuestas).toBeLessThanOrEqual(90000);
  });

  it('con $300.000, ningún renglón de la compra supera $75.000', () => {
    for (const tipo of ['conservadora', 'arriesgada'] as const) {
      const c = recomendarCompra(clasificado, { presupuesto: 300000, tipo }, u);
      expect(c.items.length).toBeGreaterThan(3);
      for (const i of c.items) expect(i.cantidad * i.costo_unitario).toBeLessThanOrEqual(75000);
      expect(c.inversion).toBeLessThanOrEqual(300000);
    }
  });

  it('un producto en baja que rinde queda en Mantener', () => {
    const acero = clasificado.find((s) => s.id === 'mate_acero')!;
    expect(acero.margen!).toBeGreaterThanOrEqual(40);
    expect(acero.rotacion_dias!).toBeLessThanOrEqual(15);
    expect(acero.clasificacion).toBe('mantener');
  });

  it('todas las listas apuntan a productos que existen', () => {
    const claves = new Set(PRODUCTOS.map((p) => p.clave));
    for (const l of LISTAS) for (const i of l.items) expect(claves.has(i.producto), i.producto).toBe(true);
  });
});
