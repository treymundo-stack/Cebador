/**
 * Datos ficticios de Cebador (nunca datos reales).
 *
 * Es la única fuente de los datos de prueba: de acá sale el SQL de
 * `seed_datos_ficticios()` (ver scripts/generar-seed.ts) y los tests verifican
 * que den lo pedido: 1 a 3 ventas por día, ~8 Reforzar, 10 Mantener,
 * 5 Revisar precio, 5 No recomprar con stock y 2 apuestas en alza.
 *
 * Las fechas son "hace N días" porque el seed se calcula sobre CURRENT_DATE.
 */
import type { Canal, EstadoLista, Tendencia } from '@/types';

export interface ProductoFicticio {
  clave: string;
  nombre: string;
  categoria: string;
  precio_venta: number;
  stock: number;
  grabable: boolean;
  tendencia: Tendencia;
  /** Ventas repartidas en los últimos 90 días. */
  ventas: number;
  /** Cada cuántas ventas una es de 2 unidades (0 = siempre 1). */
  dobleCada?: number;
  /** Ventas en días fijos (hace N días), además de las repartidas. */
  diasFijos?: number[];
}

export const PRODUCTOS: ProductoFicticio[] = [
  // Reforzar: margen ≥ 40% y una venta cada ≤ 15 días
  { clave: 'camionero_alg', nombre: 'Mate Camionero Algarrobo', categoria: 'Mates', precio_venta: 38000, stock: 2, grabable: true, tendencia: 'estable', ventas: 20 },
  { clave: 'imperial_premium', nombre: 'Mate Imperial Calabaza Premium', categoria: 'Mates', precio_venta: 95000, stock: 1, grabable: true, tendencia: 'estable', ventas: 8 },
  { clave: 'bombilla_recta', nombre: 'Bombilla Acero Inoxidable Recta', categoria: 'Bombillas', precio_venta: 8000, stock: 3, grabable: false, tendencia: 'estable', ventas: 16, dobleCada: 3 },
  { clave: 'bombilla_alpaca', nombre: 'Bombilla Alpaca Pico de Loro', categoria: 'Bombillas', precio_venta: 15000, stock: 2, grabable: false, tendencia: 'estable', ventas: 12 },
  { clave: 'golondrina_alg', nombre: 'Mate Golondrina Algarrobo', categoria: 'Mates', precio_venta: 22000, stock: 1, grabable: false, tendencia: 'estable', ventas: 10 },
  { clave: 'yerbera_lona', nombre: 'Yerbera Lona Impermeable', categoria: 'Yerberas', precio_venta: 12000, stock: 2, grabable: false, tendencia: 'estable', ventas: 9 },
  // En alza con poco historial: las apuestas de la compra arriesgada (R9)
  { clave: 'termo_500', nombre: 'Termo Acero 500ml Compacto', categoria: 'Termos', precio_venta: 35000, stock: 0, grabable: false, tendencia: 'en_alza', ventas: 0 },
  { clave: 'mate_pintado', nombre: 'Mate Calabaza Pintado a Mano', categoria: 'Mates', precio_venta: 40000, stock: 1, grabable: false, tendencia: 'en_alza', ventas: 0, diasFijos: [12] },
  // Mantener
  { clave: 'imperial_forrado', nombre: 'Mate Imperial Forrado en Cuero', categoria: 'Mates', precio_venta: 72000, stock: 1, grabable: true, tendencia: 'estable', ventas: 6 },
  { clave: 'quebracho', nombre: 'Mate Camionero Quebracho', categoria: 'Mates', precio_venta: 35000, stock: 2, grabable: true, tendencia: 'estable', ventas: 8 },
  { clave: 'torpedo_forrado', nombre: 'Mate Torpedo Forrado Cuero', categoria: 'Mates', precio_venta: 32000, stock: 1, grabable: false, tendencia: 'estable', ventas: 4 },
  { clave: 'bombilla_pico_acero', nombre: 'Bombilla Acero Pico de Loro', categoria: 'Bombillas', precio_venta: 12000, stock: 3, grabable: false, tendencia: 'estable', ventas: 7 },
  { clave: 'matera_simple', nombre: 'Matera Cuero Simple', categoria: 'Materas', precio_venta: 45000, stock: 1, grabable: false, tendencia: 'estable', ventas: 4 },
  { clave: 'matera_lona', nombre: 'Matera Lona Impermeable', categoria: 'Materas', precio_venta: 30000, stock: 2, grabable: false, tendencia: 'estable', ventas: 5 },
  { clave: 'yerbera_trenzado', nombre: 'Yerbera Cuero Trenzado', categoria: 'Yerberas', precio_venta: 18000, stock: 2, grabable: false, tendencia: 'estable', ventas: 5 },
  { clave: 'termo_1l', nombre: 'Termo Acero 1L Mateador', categoria: 'Termos', precio_venta: 55000, stock: 2, grabable: false, tendencia: 'estable', ventas: 4 },
  // Rinde como para Reforzar, pero está en baja → Mantener (R3)
  { clave: 'mate_acero', nombre: 'Mate Acero Inoxidable', categoria: 'Mates', precio_venta: 30000, stock: 2, grabable: false, tendencia: 'en_baja', ventas: 9 },
  { clave: 'yerbera_madera', nombre: 'Yerbera Madera Algarrobo', categoria: 'Yerberas', precio_venta: 22000, stock: 1, grabable: false, tendencia: 'estable', ventas: 3 },
  // Revisar precio: margen < 30%
  { clave: 'torpedo_ceramica', nombre: 'Mate Torpedo Cerámica Negra', categoria: 'Mates', precio_venta: 25000, stock: 3, grabable: false, tendencia: 'estable', ventas: 5 },
  { clave: 'matera_trenzada', nombre: 'Matera Cuero Trenzado Grande', categoria: 'Materas', precio_venta: 65000, stock: 1, grabable: false, tendencia: 'estable', ventas: 3 },
  { clave: 'bombilla_floral', nombre: 'Bombilla Alpaca Floral Grabada', categoria: 'Bombillas', precio_venta: 20000, stock: 2, grabable: true, tendencia: 'estable', ventas: 4 },
  { clave: 'golondrina_cal', nombre: 'Mate Golondrina Calabaza', categoria: 'Mates', precio_venta: 18000, stock: 2, grabable: false, tendencia: 'estable', ventas: 5 },
  { clave: 'kit_imperial', nombre: 'Kit Mate Completo Imperial', categoria: 'Kits', precio_venta: 120000, stock: 1, grabable: false, tendencia: 'estable', ventas: 3 },
  // No recomprar: última venta hace más de 60 días, con stock (plata parada)
  { clave: 'bombilla_bronce', nombre: 'Bombilla Bronce Antigua', categoria: 'Bombillas', precio_venta: 28000, stock: 3, grabable: false, tendencia: 'estable', ventas: 0, diasFijos: [75] },
  { clave: 'matera_termo', nombre: 'Matera Cuero con Termo', categoria: 'Materas', precio_venta: 85000, stock: 1, grabable: false, tendencia: 'estable', ventas: 0, diasFijos: [70] },
  { clave: 'imperial_chico', nombre: 'Mate Imperial Chico', categoria: 'Mates', precio_venta: 55000, stock: 2, grabable: false, tendencia: 'estable', ventas: 0, diasFijos: [85, 68] },
  { clave: 'yerbera_simple', nombre: 'Yerbera Cuero Simple', categoria: 'Yerberas', precio_venta: 15000, stock: 3, grabable: false, tendencia: 'estable', ventas: 0, diasFijos: [64] },
  { clave: 'matera_madera', nombre: 'Matera Madera Algarrobo', categoria: 'Materas', precio_venta: 52000, stock: 2, grabable: false, tendencia: 'estable', ventas: 0, diasFijos: [80] },
  // Sin costo cargado: ningún proveedor lo tiene en una lista confirmada
  { clave: 'set_regalo', nombre: 'Set Matero de Regalo', categoria: 'Kits', precio_venta: 60000, stock: 2, grabable: false, tendencia: 'estable', ventas: 0, diasFijos: [40, 5] },
];

export interface ProveedorFicticio {
  clave: 'A' | 'B';
  nombre: string;
  contacto: string;
  dias_entrega: number;
}

export const PROVEEDORES: ProveedorFicticio[] = [
  { clave: 'A', nombre: 'Proveedor A', contacto: 'WhatsApp 11-0000-0001 (ficticio)', dias_entrega: 7 },
  { clave: 'B', nombre: 'Proveedor B', contacto: 'Instagram @proveedor_b_ficticio', dias_entrega: 5 },
];

export interface ItemListaFicticio {
  producto: string; // clave del producto
  descripcion: string; // como lo escribe el proveedor
  costo: number;
  minimo: number;
}

export interface ListaFicticia {
  proveedor: 'A' | 'B';
  haceDias: number;
  estado: EstadoLista;
  items: ItemListaFicticio[];
}

export const LISTAS: ListaFicticia[] = [
  {
    proveedor: 'A',
    haceDias: 20,
    estado: 'confirmada',
    items: [
      { producto: 'imperial_premium', descripcion: 'Imperial calabaza premium virola alpaca', costo: 57000, minimo: 1 },
      { producto: 'camionero_alg', descripcion: 'Camionero algarrobo', costo: 22000, minimo: 2 },
      { producto: 'bombilla_recta', descripcion: 'Bombilla inox recta', costo: 4500, minimo: 3 },
      { producto: 'bombilla_alpaca', descripcion: 'Bombilla alpaca pico loro', costo: 8500, minimo: 2 },
      { producto: 'golondrina_alg', descripcion: 'Golondrina algarrobo', costo: 12000, minimo: 2 },
      { producto: 'yerbera_lona', descripcion: 'Yerbera lona', costo: 7000, minimo: 3 },
      { producto: 'quebracho', descripcion: 'Camionero quebracho', costo: 24000, minimo: 2 },
      { producto: 'torpedo_forrado', descripcion: 'Torpedo forrado cuero', costo: 19000, minimo: 1 },
      { producto: 'termo_1l', descripcion: 'Termo acero 1 litro', costo: 36000, minimo: 1 },
      { producto: 'yerbera_madera', descripcion: 'Yerbera madera algarrobo', costo: 14500, minimo: 2 },
      { producto: 'kit_imperial', descripcion: 'Kit imperial completo', costo: 88000, minimo: 1 },
      { producto: 'mate_pintado', descripcion: 'Mate calabaza pintado a mano', costo: 22000, minimo: 2 },
      { producto: 'bombilla_bronce', descripcion: 'Bombilla bronce antigua', costo: 15000, minimo: 2 },
      { producto: 'matera_termo', descripcion: 'Matera cuero c/ termo', costo: 50000, minimo: 1 },
      { producto: 'matera_madera', descripcion: 'Matera madera algarrobo', costo: 30000, minimo: 1 },
    ],
  },
  {
    proveedor: 'B',
    haceDias: 15,
    estado: 'confirmada',
    items: [
      { producto: 'camionero_alg', descripcion: 'Mate camionero algarrobo', costo: 19000, minimo: 2 },
      { producto: 'imperial_premium', descripcion: 'Mate imperial calabaza', costo: 53000, minimo: 1 },
      { producto: 'bombilla_recta', descripcion: 'Bombilla acero inox recta', costo: 4200, minimo: 3 },
      { producto: 'bombilla_alpaca', descripcion: 'Bombilla alpaca pico de loro', costo: 7800, minimo: 2 },
      { producto: 'golondrina_alg', descripcion: 'Golondrina algarrobo', costo: 10000, minimo: 2 },
      { producto: 'yerbera_lona', descripcion: 'Yerbera lona impermeable', costo: 6500, minimo: 3 },
      { producto: 'imperial_forrado', descripcion: 'Mate imperial forrado cuero', costo: 46000, minimo: 1 },
      { producto: 'quebracho', descripcion: 'Mate camionero quebracho', costo: 23000, minimo: 2 },
      { producto: 'bombilla_pico_acero', descripcion: 'Bombilla acero pico de loro', costo: 7800, minimo: 2 },
      { producto: 'matera_simple', descripcion: 'Matera cuero simple', costo: 28000, minimo: 1 },
      { producto: 'matera_lona', descripcion: 'Matera lona impermeable', costo: 19000, minimo: 2 },
      { producto: 'yerbera_trenzado', descripcion: 'Yerbera cuero trenzado', costo: 11500, minimo: 2 },
      { producto: 'mate_acero', descripcion: 'Mate acero inoxidable', costo: 16000, minimo: 1 },
      { producto: 'torpedo_ceramica', descripcion: 'Mate torpedo cerámica negra', costo: 19000, minimo: 2 },
      { producto: 'matera_trenzada', descripcion: 'Matera trenzada grande', costo: 48000, minimo: 1 },
      { producto: 'bombilla_floral', descripcion: 'Bombilla alpaca floral grabada', costo: 15000, minimo: 1 },
      { producto: 'golondrina_cal', descripcion: 'Golondrina calabaza', costo: 13500, minimo: 3 },
      { producto: 'imperial_chico', descripcion: 'Mate imperial chico', costo: 33000, minimo: 1 },
      { producto: 'yerbera_simple', descripcion: 'Yerbera cuero simple', costo: 8500, minimo: 2 },
      { producto: 'termo_500', descripcion: 'Termo acero 500ml', costo: 19000, minimo: 1 },
    ],
  },
  {
    // Borrador pendiente: no cambia ningún cálculo hasta que se confirme (R5)
    proveedor: 'A',
    haceDias: 0,
    estado: 'borrador',
    items: [
      { producto: 'imperial_premium', descripcion: 'Imperial calabaza premium virola alpaca', costo: 60000, minimo: 1 },
      { producto: 'camionero_alg', descripcion: 'Camionero algarrobo', costo: 24000, minimo: 2 },
      { producto: 'bombilla_alpaca', descripcion: 'Bombilla alpaca pico loro', costo: 10000, minimo: 2 },
    ],
  },
];

export interface VentaFicticia {
  producto: string;
  haceDias: number;
  cantidad: number;
  precio_unitario: number;
  canal: Canal;
}

/** Días hacia atrás que cubre el historial de ventas. */
export const DIAS_HISTORIAL = 90;

/** Ventas por día (total entre todos los productos), para cada día de hace 0 a hace 89. */
function ventasPorDia(total: number): number[] {
  // Generador pseudoaleatorio fijo: el seed da siempre lo mismo.
  let x = 20261113;
  const rnd = () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
  const dias = Array.from({ length: DIAS_HISTORIAL }, () => 1);
  let extra = total - DIAS_HISTORIAL;
  while (extra > 0) {
    const d = Math.floor(rnd() * DIAS_HISTORIAL);
    if (dias[d] < 3) {
      dias[d]++;
      extra--;
    }
  }
  return dias;
}

/**
 * Genera las ventas: las de días fijos van en su día, y las demás se reparten
 * parejo en el tiempo, de lo más viejo a lo más nuevo, llenando los lugares
 * libres de cada día (1 a 3 ventas por día en total).
 */
export function generarVentas(): VentaFicticia[] {
  const fijas: VentaFicticia[] = [];
  const turnos: { p: ProductoFicticio; k: number; orden: number }[] = [];
  PRODUCTOS.forEach((p, idx) => {
    for (const d of p.diasFijos ?? []) {
      fijas.push({ producto: p.clave, haceDias: d, cantidad: 1, precio_unitario: p.precio_venta, canal: 'instagram' });
    }
    for (let k = 0; k < p.ventas; k++) turnos.push({ p, k, orden: (k + 0.5) / p.ventas + idx * 1e-6 });
  });
  turnos.sort((a, b) => a.orden - b.orden);

  const porDia = ventasPorDia(fijas.length + turnos.length);
  const fijasPorDia = new Map<number, number>();
  for (const f of fijas) fijasPorDia.set(f.haceDias, (fijasPorDia.get(f.haceDias) ?? 0) + 1);

  const lugares: number[] = [];
  for (let d = DIAS_HISTORIAL - 1; d >= 0; d--) {
    const libres = Math.max(0, porDia[d] - (fijasPorDia.get(d) ?? 0));
    for (let i = 0; i < libres; i++) lugares.push(d);
  }

  const repartidas = turnos.map(({ p, k }, i): VentaFicticia => ({
    producto: p.clave,
    haceDias: lugares[i],
    cantidad: p.dobleCada && k % p.dobleCada === 0 ? 2 : 1,
    precio_unitario: p.precio_venta,
    canal: i % 4 === 0 ? 'tienda_nube' : i % 9 === 0 ? 'otro' : 'instagram',
  }));
  return [...fijas, ...repartidas].sort((a, b) => b.haceDias - a.haceDias);
}

export const PARAMETROS: Record<string, number> = {
  margen_minimo: 30,
  margen_reforzar: 40,
  rotacion_reforzar_dias: 15,
  dias_sin_venta_no_recomprar: 60,
  dias_grabado: 12,
  dias_envio: 3,
  dias_venta_previa: 21,
  tope_arriesgada: 30,
  tope_por_producto: 25,
  alerta_aumento: 5,
};
