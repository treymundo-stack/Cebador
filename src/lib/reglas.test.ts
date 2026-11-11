/**
 * Criterios de aceptación de la v1 (PRD §12) que dependen de las reglas R1 a R9.
 */
import { describe, expect, it } from 'vitest';
import type { ListaPrecios, StockInversion } from '@/types';
import {
  UMBRALES_DEFAULT as U,
  CLASIFICACION_LABEL,
  clasificar,
  plataInvertida,
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
  it('en baja nunca es Reforzar: como máximo Mantener', () => {
    const p = prod({ costo_vigente: 5000, rotacion_dias: 3, tendencia: 'en_baja' });
    expect(p.margen).toBe(50);
    const r = clasificar(p, U);
    expect(r.clasificacion).toBe('mantener');
    expect(r.motivo).toMatch(/en baja/);
  });
  it('en baja igual puede ser No recomprar o Revisar precio', () => {
    expect(clasificar(prod({ tendencia: 'en_baja', dias_desde_ultima_venta: 80 }), U).clasificacion).toBe('no_recomprar');
    expect(clasificar(prod({ tendencia: 'en_baja', costo_vigente: 8000 }), U).clasificacion).toBe('revisar_precio');
  });
  it('sin costo vigente → "Sin costo cargado", aunque esté en alza o sin ventas', () => {
    for (const over of [{}, { tendencia: 'en_alza' as const }, { dias_desde_ultima_venta: 90 }]) {
      const p = prod({ costo_vigente: null, margen: null, proveedor_id: null, plata_invertida: 0, ...over });
      const r = clasificar(p, U);
      expect(r.clasificacion).toBe('sin_costo');
      expect(CLASIFICACION_LABEL[r.clasificacion]).toBe('Sin costo cargado');
    }
  });
  it('sin costo cargado no suma a la plata invertida ni a la parada', () => {
    const stock = [
      prod({ stock_actual: 2, costo_vigente: 1000 }),
      prod({ stock_actual: 5, costo_vigente: null, margen: null, dias_desde_ultima_venta: 80 }),
    ];
    expect(plataInvertida(stock)).toBe(2000);
    expect(plataParada(stock, U)).toBe(0);
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

  describe('R8 · tope por producto', () => {
    it('el tope sale de parametros (tope_por_producto, 25 por defecto)', () => {
      expect(U.topePorProducto).toBe(25);
      expect(umbralesDesde({ tope_por_producto: 40 }).topePorProducto).toBe(40);
    });

    for (const tipo of ['conservadora', 'arriesgada'] as const) {
      it(`${tipo}: con $300.000, ningún renglón supera $75.000`, () => {
        const c = recomendarCompra(stock, { ...opts, tipo }, U);
        expect(c.items.length).toBeGreaterThan(0);
        for (const i of c.items) expect(i.cantidad * i.costo_unitario).toBeLessThanOrEqual(75000);
      });
    }

    it('el producto que llega al tope se recorta y lo dice', () => {
      const c = recomendarCompra(stock, { ...opts, tipo: 'conservadora' }, U);
      const camionero = c.items.find((i) => i.producto_nombre === 'Camionero')!;
      // quería 9 u. × $19.000 = $171.000; el tope es $75.000 → 3 u.
      expect(camionero.cantidad).toBe(3);
      expect(camionero.explicacion).toContain('Recortado a 3 u. por tope por producto');
    });

    it('lo que no se lleva el recortado pasa a los siguientes de la lista', () => {
      const s = clasificarTodo(
        [
          prod({ nombre: 'Caro y rápido', precio_venta: 20000, costo_vigente: 10000, unidades_90d: 60, ventas_90d: 60, rotacion_dias: 1.5, stock_actual: 0 }),
          prod({ nombre: 'Barato y lento', precio_venta: 2000, costo_vigente: 1100, unidades_90d: 30, ventas_90d: 30, rotacion_dias: 3, stock_actual: 0 }),
        ],
        U,
      );
      const sinTope = recomendarCompra(s, { ...opts, presupuesto: 100000, tipo: 'conservadora' }, { ...U, topePorProducto: 100 });
      expect(sinTope.items.map((i) => i.producto_nombre)).toEqual(['Caro y rápido']);
      const conTope = recomendarCompra(s, { ...opts, presupuesto: 100000, tipo: 'conservadora' }, U);
      expect(conTope.items.map((i) => i.producto_nombre)).toEqual(['Caro y rápido', 'Barato y lento']);
      expect(conTope.items[0].cantidad).toBe(2);
      expect(conTope.items[0].explicacion).toContain('Recortado a 2 u. por tope por producto');
      expect(conTope.items[1].cantidad).toBe(10);
    });

    it('si el mínimo de compra ya supera el tope, el producto queda afuera y se avisa', () => {
      const s = clasificarTodo([prod({ nombre: 'Kit', precio_venta: 200000, costo_vigente: 100000, minimo_compra: 1 })], U);
      const c = recomendarCompra(s, { ...opts, tipo: 'conservadora' }, U);
      expect(c.items).toHaveLength(0);
      expect(c.superanTope).toEqual(['Kit']);
    });
  });

  describe('R9 · conservadora vs arriesgada', () => {
    const apostado = (c: ReturnType<typeof recomendarCompra>) =>
      c.items.filter((i) => i.apuesta).reduce((s, i) => s + i.cantidad * i.costo_unitario, 0);
    const porNombre = new Map(stock.map((s) => [s.nombre, s]));

    it('conservadora: nunca incluye productos sin historial de ventas, con ningún presupuesto', () => {
      for (const presupuesto of [50000, 300000, 10_000_000]) {
        const c = recomendarCompra(stock, { ...opts, presupuesto, tipo: 'conservadora' }, U);
        for (const i of c.items) expect(porNombre.get(i.producto_nombre)!.ventas_90d).toBeGreaterThan(0);
        expect(apostado(c)).toBe(0);
      }
    });

    it('arriesgada: destina entre el 15% y el 30% a apuestas en alza', () => {
      for (const presupuesto of [300000, 500000, 1_000_000]) {
        const c = recomendarCompra(stock, { ...opts, presupuesto, tipo: 'arriesgada' }, U);
        expect(apostado(c)).toBeGreaterThanOrEqual(presupuesto * 0.15);
        expect(apostado(c)).toBeLessThanOrEqual(presupuesto * 0.3);
        for (const i of c.items.filter((x) => x.apuesta)) {
          expect(porNombre.get(i.producto_nombre)!.tendencia).toBe('en_alza');
          expect(i.explicacion).toMatch(/^Apuesta/);
        }
      }
    });

    it('arriesgada: si las apuestas no llegan al 15%, suma unidades hasta llegar', () => {
      // Solo el termo es apuesta: 1 u. = $19.000 (6%) → sube a 3 u. = $57.000 (19%)
      const soloTermo = stock.filter((s) => s.nombre !== 'Mate nuevo');
      const c = recomendarCompra(soloTermo, { ...opts, tipo: 'arriesgada' }, U);
      const termo = c.items.find((i) => i.producto_nombre === 'Termo nuevo')!;
      expect(termo.cantidad).toBe(3);
      expect(termo.explicacion).toContain('15%');
      expect(apostado(c)).toBeGreaterThanOrEqual(45000);
    });

    it('arriesgada: respeta el tope_arriesgada de parametros', () => {
      const u = umbralesDesde({ tope_arriesgada: 20 });
      const c = recomendarCompra(stock, { ...opts, tipo: 'arriesgada' }, u);
      expect(apostado(c)).toBeGreaterThanOrEqual(45000);
      expect(apostado(c)).toBeLessThanOrEqual(60000);
    });

    it('las dos compras son distintas de verdad', () => {
      const cons = recomendarCompra(stock, { ...opts, tipo: 'conservadora' }, U);
      const arr = recomendarCompra(stock, { ...opts, tipo: 'arriesgada' }, U);
      expect(arr.items.some((i) => i.apuesta)).toBe(true);
      expect(arr.items.map((i) => `${i.producto_nombre}×${i.cantidad}`)).not.toEqual(
        cons.items.map((i) => `${i.producto_nombre}×${i.cantidad}`),
      );
    });

    it('arriesgada sin productos en alza: avisa que no hay apuestas', () => {
      const sinAlza = stock.filter((s) => s.tendencia !== 'en_alza');
      const c = recomendarCompra(sinAlza, { ...opts, tipo: 'arriesgada' }, U);
      expect(apostado(c)).toBe(0);
      expect(c.avisos.join(' ')).toMatch(/15%/);
    });
  });

  it('prioriza por margen × velocidad cuando no alcanza la plata', () => {
    const c = recomendarCompra(stock, { ...opts, presupuesto: 60000, tipo: 'conservadora' }, { ...U, topePorProducto: 100 });
    expect(c.items[0].producto_nombre).toBe('Camionero');
  });
});
