/**
 * Criterios de aceptación de la v1 (PRD §12) que dependen de las reglas R1 a R9.
 */
import { describe, expect, it } from 'vitest';
import type { ListaPrecios, StockInversion } from '@/types';
import {
  UMBRALES_DEFAULT as U,
  clasificar,
  clasificarTodo,
  fechaLimiteGrabados,
  fechaLimiteReposicion,
  margen,
  plataParada,
  recomendarCompra,
  umbralesDesde,
} from '@/lib/reglas';
import { compararCostos, detectarAumentos } from '@/lib/calculations';

let n = 0;
function prod(over: Partial<StockInversion> = {}): StockInversion {
  n++;
  const base: StockInversion = {
    id: `p${n}`,
    user_id: 'u',
    nombre: `Producto ${n}`,
    categoria: 'Mates',
    precio_venta: 10000,
    stock_actual: 1,
    grabable: false,
    tendencia: 'estable',
    costo_vigente: 6000,
    proveedor_id: 'provA',
    proveedor_nombre: 'Proveedor A',
    minimo_compra: 1,
    margen: 40,
    rotacion_dias: 10,
    ventas_90d: 9,
    unidades_90d: 9,
    dias_desde_ultima_venta: 3,
    plata_invertida: 6000,
  };
  const s = { ...base, ...over };
  if (over.margen === undefined && s.costo_vigente !== null) s.margen = margen(s.precio_venta, s.costo_vigente);
  return s;
}

describe('R1 · margen', () => {
  it('(venta − costo) ÷ venta', () => {
    expect(margen(10000, 6000)).toBe(40);
    expect(margen(10000, null)).toBeNull();
  });
});

describe('R3 · clasificación', () => {
  it('sin ventas en 61 días → No recomprar', () => {
    expect(clasificar(prod({ dias_desde_ultima_venta: 61 }), U).clasificacion).toBe('no_recomprar');
  });
  it('60 días justos todavía no es No recomprar', () => {
    expect(clasificar(prod({ dias_desde_ultima_venta: 60 }), U).clasificacion).not.toBe('no_recomprar');
  });
  it('margen 25% → Revisar precio aunque se venda rápido', () => {
    const p = prod({ costo_vigente: 7500, rotacion_dias: 2, unidades_90d: 45 });
    expect(p.margen).toBe(25);
    expect(clasificar(p, U).clasificacion).toBe('revisar_precio');
  });
  it('margen ≥ 40% y rotación ≤ 15 días → Reforzar', () => {
    expect(clasificar(prod({ costo_vigente: 5500, rotacion_dias: 15 }), U).clasificacion).toBe('reforzar');
  });
  it('tendencia en alza → Reforzar', () => {
    expect(clasificar(prod({ costo_vigente: 6500, rotacion_dias: 40, tendencia: 'en_alza' }), U).clasificacion).toBe('reforzar');
  });
  it('lo demás → Mantener', () => {
    expect(clasificar(prod({ costo_vigente: 6500, rotacion_dias: 40 }), U).clasificacion).toBe('mantener');
  });
  it('los umbrales salen de la tabla de parámetros', () => {
    const u = umbralesDesde({ margen_minimo: 50 });
    expect(clasificar(prod({ costo_vigente: 5500 }), u).clasificacion).toBe('revisar_precio');
  });
});

describe('R4 · plata parada', () => {
  it('suma stock × costo de los productos sin ventas en más de 60 días', () => {
    const stock = [
      prod({ dias_desde_ultima_venta: 61, stock_actual: 3, costo_vigente: 1000 }),
      prod({ dias_desde_ultima_venta: 10, stock_actual: 5, costo_vigente: 1000 }),
    ];
    expect(plataParada(stock, U)).toBe(3000);
  });
});

describe('R6 / H3 · aumentos y comparación de costos', () => {
  const prov = (id: string, nombre: string) => ({
    id, nombre, user_id: 'u', contacto: null, dias_entrega: 5, activo: true, created_at: '', updated_at: '',
  });
  const lista = (id: string, provId: string, provNombre: string, fecha: string, costo: number): ListaPrecios => ({
    id, user_id: 'u', proveedor_id: provId, fecha, archivo_url: null, estado: 'confirmada',
    created_at: fecha, updated_at: fecha, proveedor: prov(provId, provNombre),
    items_lista: [{ id: id + 'i', lista_id: id, descripcion_original: 'Bombilla', producto_id: 'bombilla', costo, minimo_compra: 1, created_at: fecha }],
  });
  const listas = [
    lista('a1', 'A', 'Proveedor A', '2026-09-01', 3300),
    lista('a2', 'A', 'Proveedor A', '2026-10-01', 3900),
    lista('b1', 'B', 'Proveedor B', '2026-10-01', 3600),
  ];

  it('3.300 → 3.900 dispara una alerta del 18%', () => {
    const a = detectarAumentos(listas, 5);
    expect(a).toHaveLength(1);
    expect(a[0].porcentaje).toBe(18);
  });

  it('B a 3.600 es el más barato (la lista vieja de A ya no vale)', () => {
    const [c] = compararCostos(listas);
    expect(c.proveedor_minimo).toBe('Proveedor B');
    expect(c.costo_minimo).toBe(3600);
  });

  it('un borrador no cambia la comparación', () => {
    const borrador = { ...lista('a3', 'A', 'Proveedor A', '2026-11-01', 1000), estado: 'borrador' as const };
    const [c] = compararCostos([...listas, borrador]);
    expect(c.costo_minimo).toBe(3600);
  });
});

describe('R7 · fechas límite', () => {
  it('Navidad con 12 días de grabado y 3 de envío → 10/12', () => {
    expect(fechaLimiteGrabados('2026-12-25', U)).toBe('2026-12-10');
  });
  it('reposición = fecha − entrega − 21 días de venta', () => {
    expect(fechaLimiteReposicion('2026-12-25', 7, U)).toBe('2026-11-27');
  });
});

describe('R8 / R9 · compra recomendada', () => {
  const stock = clasificarTodo(
    [
      // Rápidos y rentables
      prod({ nombre: 'Camionero', precio_venta: 38000, costo_vigente: 19000, unidades_90d: 30, ventas_90d: 30, rotacion_dias: 3, stock_actual: 1, minimo_compra: 2 }),
      prod({ nombre: 'Imperial', precio_venta: 95000, costo_vigente: 53000, unidades_90d: 22, ventas_90d: 22, rotacion_dias: 4, stock_actual: 2 }),
      prod({ nombre: 'Bombilla', precio_venta: 8000, costo_vigente: 4200, unidades_90d: 20, ventas_90d: 20, rotacion_dias: 4.5, stock_actual: 0, minimo_compra: 3 }),
      // No recomprar
      prod({ nombre: 'Bronce', dias_desde_ultima_venta: 68, unidades_90d: 3, ventas_90d: 3 }),
      // Revisar precio
      prod({ nombre: 'Barato', precio_venta: 10000, costo_vigente: 8000, unidades_90d: 40, ventas_90d: 40 }),
      // En alza sin historial
      prod({ nombre: 'Termo nuevo', tendencia: 'en_alza', precio_venta: 35000, costo_vigente: 19000, unidades_90d: 0, ventas_90d: 0, rotacion_dias: null, dias_desde_ultima_venta: null, stock_actual: 0 }),
      prod({ nombre: 'Mate nuevo', tendencia: 'en_alza', precio_venta: 60000, costo_vigente: 30000, unidades_90d: 1, ventas_90d: 1, rotacion_dias: 90, dias_desde_ultima_venta: 20, stock_actual: 0, minimo_compra: 2 }),
    ],
    U,
  );
  const opts = { presupuesto: 300000, fechaObjetivo: '2026-12-25', hoy: '2026-11-25' };

  for (const tipo of ['conservadora', 'arriesgada'] as const) {
    it(`${tipo}: nunca supera el presupuesto`, () => {
      for (const presupuesto of [0, 15000, 50000, 120000, 300000, 2000000]) {
        const c = recomendarCompra(stock, { ...opts, presupuesto, tipo }, U);
        expect(c.inversion).toBeLessThanOrEqual(presupuesto);
      }
    });
    it(`${tipo}: no incluye No recomprar ni Revisar precio`, () => {
      const c = recomendarCompra(stock, { ...opts, tipo }, U);
      const nombres = c.items.map((i) => i.producto_nombre);
      expect(nombres).not.toContain('Bronce');
      expect(nombres).not.toContain('Barato');
    });
    it(`${tipo}: respeta el mínimo de compra`, () => {
      const c = recomendarCompra(stock, { ...opts, tipo }, U);
      for (const i of c.items) expect(i.cantidad).toBeGreaterThanOrEqual(i.minimo_compra);
    });
  }

  it('conservadora: no incluye productos sin historial', () => {
    const c = recomendarCompra(stock, { ...opts, tipo: 'conservadora' }, U);
    expect(c.items.map((i) => i.producto_nombre)).not.toContain('Termo nuevo');
    expect(c.items.every((i) => !i.apuesta)).toBe(true);
  });

  it('arriesgada: incluye apuestas, como mucho 30% del presupuesto', () => {
    const c = recomendarCompra(stock, { ...opts, tipo: 'arriesgada' }, U);
    expect(c.items.some((i) => i.apuesta)).toBe(true);
    const enApuestas = c.items.filter((i) => i.apuesta).reduce((s, i) => s + i.cantidad * i.costo_unitario, 0);
    expect(enApuestas).toBeLessThanOrEqual(300000 * 0.3);
    expect(enApuestas).toBe(c.inversionApuestas);
  });

  it('cantidad = demanda esperada hasta la fecha − stock', () => {
    const c = recomendarCompra(stock, { ...opts, presupuesto: 10_000_000, tipo: 'conservadora' }, U);
    const camionero = c.items.find((i) => i.producto_nombre === 'Camionero')!;
    // 30 u. en 90 días → 1 cada 3 días → 10 u. en 30 días, tiene 1 → 9
    expect(camionero.demanda_esperada).toBe(10);
    expect(camionero.cantidad).toBe(9);
  });

  it('prioriza por margen × velocidad cuando no alcanza la plata', () => {
    const c = recomendarCompra(stock, { ...opts, presupuesto: 60000, tipo: 'conservadora' }, U);
    expect(c.items[0].producto_nombre).toBe('Camionero');
  });
});
