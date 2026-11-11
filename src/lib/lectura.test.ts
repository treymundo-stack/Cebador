/**
 * Lectura de una lista pegada como texto (sin IA, o para completar lo que la IA no asoció).
 * Caso de prueba pedido: lista de noviembre del Proveedor B.
 */
import { describe, expect, it } from 'vitest';
import type { ItemLista, ListaPrecios, Proveedor } from '@/types';
import { LISTAS, PRODUCTOS } from '@/lib/datosFicticios';
import { asociarProducto, leerTextoLista } from '@/lib/lectura';
import { compararCostos, detectarAumentos } from '@/lib/calculations';

const TEXTO_B = `Hola! Te paso lista actualizada noviembre 👇
- Bombilla acero inox recta ...... $4.800 (min 3)
- Mate camionero algarrobo ....... $21.500 (min 2)
- Golondrina algarrobo ........... $10.000
- Termo acero 500ml .............. $19.900
- Mate imperial cuero crudo ...... $31.000
Precios sin IVA. Cualquier cosa avisame!`;

const productos = PRODUCTOS.map((p) => ({ id: p.clave, nombre: p.nombre }));
const listaB = LISTAS.find((l) => l.proveedor === 'B' && l.estado === 'confirmada')!;
const minimosPrevios = Object.fromEntries(listaB.items.map((i) => [i.producto, i.minimo]));

const proveedorB: Proveedor = {
  id: 'B', user_id: 'u', nombre: 'Proveedor B', contacto: null, dias_entrega: 5, activo: true, created_at: '', updated_at: '',
};
const aLista = (id: string, fecha: string, estado: ListaPrecios['estado'], items: Omit<ItemLista, 'id' | 'lista_id' | 'created_at'>[]): ListaPrecios => ({
  id, user_id: 'u', proveedor_id: 'B', fecha, archivo_url: null, estado, created_at: fecha, updated_at: fecha, proveedor: proveedorB,
  items_lista: items.map((it, k) => ({ ...it, id: `${id}-${k}`, lista_id: id, created_at: fecha })),
});
const vieja = aLista('b-oct', '2026-10-28', 'confirmada',
  listaB.items.map((i) => ({ descripcion_original: i.descripcion, producto_id: i.producto, costo: i.costo, minimo_compra: i.minimo })));

describe('Lista de noviembre del Proveedor B', () => {
  const renglones = leerTextoLista(TEXTO_B, productos, minimosPrevios);

  it('lee 5 renglones con costo y mínimo, sin el saludo ni la nota de IVA', () => {
    expect(renglones).toHaveLength(5);
    expect(renglones.map((r) => [r.costo, r.minimo_compra])).toEqual([
      [4800, 3],
      [21500, 2],
      [10000, 2], // sin mínimo en el texto: usa el de la lista anterior del proveedor
      [19900, 1],
      [31000, 1],
    ]);
    expect(renglones[0].descripcion_original).toBe('Bombilla acero inox recta');
  });

  it('asocia los 4 primeros aunque el nombre no sea idéntico', () => {
    expect(renglones.slice(0, 4).map((r) => r.producto_id)).toEqual(['bombilla_recta', 'camionero_alg', 'golondrina_alg', 'termo_500']);
    for (const r of renglones.slice(0, 4)) expect(r.dudoso).toBe(false);
  });

  it('el último queda sin asociar y marcado para revisar', () => {
    const r = renglones[4];
    expect(r.producto_id).toBeNull();
    expect(r.dudoso).toBe(true);
    expect(r.motivo_duda).toMatch(/sin producto/i);
  });

  const nueva = (estado: ListaPrecios['estado']) => aLista('b-nov', '2026-11-13', estado, renglones);

  it('en borrador no cambia ningún cálculo', () => {
    const antes = compararCostos([vieja]);
    const despues = compararCostos([vieja, nueva('borrador')]);
    expect(despues).toEqual(antes);
    expect(detectarAumentos([vieja, nueva('borrador')], 5)).toEqual([]);
  });

  it('al confirmarla: alerta en la bombilla y el camionero, ninguna en el termo (sube menos del 5%)', () => {
    const alertas = detectarAumentos([vieja, nueva('confirmada')], 5);
    expect(alertas.map((a) => a.producto_id).sort()).toEqual(['bombilla_recta', 'camionero_alg']);
    expect(alertas.find((a) => a.producto_id === 'bombilla_recta')!.porcentaje).toBe(14);
    expect(alertas.find((a) => a.producto_id === 'camionero_alg')!.porcentaje).toBe(13);
    // el termo pasó de 19.000 a 19.900: +4,7%
    const termo = compararCostos([vieja, nueva('confirmada')]).find((c) => c.producto_id === 'termo_500')!;
    expect(termo.costo_minimo).toBe(19900);
  });
});

describe('formatos de precio y mínimo', () => {
  it.each([
    ['Yerbera lona impermeable: 6.500', 6500, 1],
    ['Bombilla alpaca pico de loro $ 7.800,50 x2', 7800.5, 2],
    ['Matera lona impermeable - 19900 - mín. 6', 19900, 6],
    ['Mate camionero quebracho, 23000, 2', 23000, 2],
    ['Golondrina calabaza $13.500 caja de 12', 13500, 12],
  ])('%s', (linea, costo, minimo) => {
    const [r] = leerTextoLista(linea, productos);
    expect(r.costo).toBe(costo);
    expect(r.minimo_compra).toBe(minimo);
    expect(r.producto_id).not.toBeNull();
  });

  it('si la descripción encaja con dos productos, no elige: queda para revisar', () => {
    const r = asociarProducto('Mate imperial', productos);
    expect(r.producto_id).toBeNull();
    expect(r.motivo).toMatch(/varios/i);
  });
});
