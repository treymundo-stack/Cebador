/**
 * Lectura de listas de precios pegadas como texto, sin IA (H2 / R5 / R10).
 *
 * Sirve cuando la IA no está disponible y para asociar lo que la IA dejó sin
 * producto. Es conservadora: si un renglón no encaja con un único producto,
 * lo deja sin asociar y marcado para revisar. Nunca inventa productos.
 */

export interface ProductoParaAsociar {
  id: string;
  nombre: string;
}

export interface RenglonLeido {
  descripcion_original: string;
  costo: number;
  minimo_compra: number;
  producto_id: string | null;
  dudoso: boolean;
  motivo_duda: string | null;
}

// ---------------------------------------------------------------------------
// Asociación por nombre
// ---------------------------------------------------------------------------
const PALABRAS_VACIAS = new Set(['de', 'del', 'en', 'con', 'c', 'la', 'el', 'los', 'las', 'y', 'a', 'para', 'p']);

function palabras(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !PALABRAS_VACIAS.has(w))
    .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));
}

/** "inox" encaja con "inoxidable"; "500ml" solo con "500ml". */
function encaja(a: string, b: string): boolean {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return false;
  return (a.length >= 3 && b.startsWith(a)) || (b.length >= 3 && a.startsWith(b));
}

export function asociarProducto(
  descripcion: string,
  productos: ProductoParaAsociar[],
): { producto_id: string | null; motivo: string | null } {
  const buscadas = palabras(descripcion);
  if (buscadas.length === 0) return { producto_id: null, motivo: 'Sin producto asociado: descripción vacía' };

  // Candidatos: productos que contienen TODAS las palabras del renglón.
  const candidatos = productos
    .map((p) => {
      const propias = palabras(p.nombre);
      const todas = buscadas.every((b) => propias.some((w) => encaja(b, w)));
      const sobran = propias.filter((w) => !buscadas.some((b) => encaja(b, w))).length;
      return { p, todas, sobran };
    })
    .filter((c) => c.todas);

  if (candidatos.length === 1) return { producto_id: candidatos[0].p.id, motivo: null };
  const exactos = candidatos.filter((c) => c.sobran === 0);
  if (exactos.length === 1) return { producto_id: exactos[0].p.id, motivo: null };
  if (candidatos.length > 1) {
    const nombres = candidatos.slice(0, 3).map((c) => c.p.nombre).join(', ');
    return { producto_id: null, motivo: `Coincide con varios productos (${nombres}): elegí cuál` };
  }
  return { producto_id: null, motivo: 'Sin producto asociado: revisá si es nuevo o tiene otro nombre' };
}

// ---------------------------------------------------------------------------
// Lectura de renglones
// ---------------------------------------------------------------------------
/** "$4.800" → 4800 · "7.800,50" → 7800.5 · "19900" → 19900 · "19.90" → 19.9 */
export function leerMonto(txt: string): number | null {
  const t = txt.replace(/[$\s]/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/^\d+(,\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  if (/^\d+\.\d{1,2}$/.test(t)) return Number(t);
  if (/^\d{1,3}(,\d{3})+$/.test(t)) return Number(t.replace(/,/g, ''));
  return null;
}

const MINIMO = [
  /\(?\s*m[ií]n(?:imo)?\.?\s*:?\s*(\d+)\s*(?:u\.?|unidades)?\s*\)?/i,
  /\bcaja\s+(?:de\s+)?(\d+)\b/i,
  /\bpack\s+(?:de\s+)?(\d+)\b/i,
  /(?:^|\s)x\s?(\d+)\b/i,
];

// Un número que no sea parte de una medida (500ml, 1L, 20cm) ni de una palabra.
const MONTO = /(\$\s*)?(\d[\d.,]*\d|\d)(?![\d.,]*\s*(?:ml|cc|cm|mm|kg|gr|g|lts?|litros?|l)\b)(?![a-z])/gi;

function limpiarDescripcion(d: string): string {
  return d
    .replace(/^\s*[-•*·–—>]+\s*/, '')
    .replace(/[\s.…:\-–—|$]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function leerLinea(linea: string): { descripcion_original: string; costo: number; minimo: number | null } | null {
  let l = linea.trim();
  if (!l) return null;

  // Formato "descripción, costo, mínimo"
  const partes = l.split(/,\s+/);
  if (partes.length >= 2 && leerMonto(partes[1]) !== null) {
    const costo = leerMonto(partes[1])!;
    const minimo = partes[2] && /^\d+$/.test(partes[2].trim()) ? Number(partes[2]) : null;
    const descripcion_original = limpiarDescripcion(partes[0]);
    return descripcion_original && costo > 0 ? { descripcion_original, costo, minimo } : null;
  }

  let minimo: number | null = null;
  for (const re of MINIMO) {
    const m = re.exec(l);
    if (m) {
      minimo = Number(m[1]);
      l = l.slice(0, m.index) + ' ' + l.slice(m.index + m[0].length);
      break;
    }
  }

  const montos = [...l.matchAll(MONTO)]
    .map((m) => ({ conSigno: Boolean(m[1]), valor: leerMonto(m[2]), index: m.index! }))
    .filter((m) => m.valor !== null && m.valor > 0);
  if (montos.length === 0) return null;
  const precio = montos.find((m) => m.conSigno) ?? montos[montos.length - 1];
  const descripcion_original = limpiarDescripcion(l.slice(0, precio.index));
  if (!descripcion_original || !/[a-záéíóúñ]/i.test(descripcion_original)) return null;
  return { descripcion_original, costo: precio.valor!, minimo };
}

/**
 * Lee un texto pegado (WhatsApp, mail, Excel copiado): un renglón por línea con precio.
 * Ignora saludos y notas sin precio. Si la línea no dice el mínimo, usa el de la
 * lista anterior del mismo proveedor para ese producto (o 1).
 */
export function leerTextoLista(
  texto: string,
  productos: ProductoParaAsociar[],
  minimosPrevios: Record<string, number> = {},
): RenglonLeido[] {
  const renglones: RenglonLeido[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const r = leerLinea(linea);
    if (!r) continue;
    const { producto_id, motivo } = asociarProducto(r.descripcion_original, productos);
    renglones.push({
      descripcion_original: r.descripcion_original,
      costo: r.costo,
      minimo_compra: Math.max(1, r.minimo ?? (producto_id ? minimosPrevios[producto_id] : undefined) ?? 1),
      producto_id,
      dudoso: producto_id === null,
      motivo_duda: motivo,
    });
  }
  return renglones;
}
