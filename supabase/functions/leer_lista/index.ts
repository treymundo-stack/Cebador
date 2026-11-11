// leer_lista: lee una lista de precios (PDF, Excel, imagen o texto) con Claude y
// devuelve un BORRADOR de renglones. No guarda nada: la dueña revisa y confirma (R5).
import { z } from 'npm:zod@4.1.12';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@1.8.0/helpers/zod';
import * as XLSX from 'npm:xlsx@0.18.5';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';

// --- Utilidades comunes (copiadas en cada función para poder desplegarlas desde el panel) ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Cliente de Supabase con el JWT de la dueña: respeta RLS, nunca usa la service_role key. */
async function clienteDeUsuario(req: Request): Promise<SupabaseClient | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return supabase;
}

/** La clave de Claude vive en los Secrets de Supabase (ANTHROPIC_API_KEY), nunca en el código. */
function clienteClaude(): Anthropic {
  return new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
}

const MODELO = Deno.env.get('CLAUDE_MODEL') ?? 'claude-opus-5-5';

/** Devuelve el primer bloque de texto de la respuesta, o null. */
function textoDe(msg: Anthropic.Message): string | null {
  for (const b of msg.content) if (b.type === 'text') return b.text;
  return null;
}

function mensajeDeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'La clave de la API de Claude no es válida. Revisá el secret ANTHROPIC_API_KEY.';
  if (err instanceof Anthropic.RateLimitError) return 'La API de Claude está saturada. Probá de nuevo en un minuto.';
  if (err instanceof Anthropic.APIError) return `Error de la API de Claude (${err.status}).`;
  return err instanceof Error ? err.message : 'Error inesperado';
}


const Renglon = z.object({
  descripcion_original: z.string().describe('El texto del producto tal como figura en la lista'),
  costo: z.number().describe('Costo unitario en pesos argentinos, sin separadores de miles'),
  minimo_compra: z.number().int().describe('Mínimo de unidades por pedido; 1 si la lista no lo dice'),
  producto_id: z.string().nullable().describe('id del producto propio que corresponde, o null si no hay uno claro'),
  dudoso: z.boolean().describe('true si el precio, el mínimo o la asociación no se leyeron con seguridad'),
  motivo_duda: z.string().nullable().describe('Por qué es dudoso, en pocas palabras; null si no lo es'),
});
const Borrador = z.object({ renglones: z.array(Renglon) });

const SYSTEM = `Sos el lector de listas de precios de Cebador, el asistente de compras de Impulse Space (mates y accesorios, Argentina).
Te pasan la lista de precios de un proveedor y el catálogo propio de la dueña.
Extraé un renglón por cada producto con precio. Reglas:
- Copiá la descripción tal como aparece. No inventes productos ni precios.
- Los montos están en pesos argentinos: "$3.900" o "3.900,00" es 3900. Si hay precio mayorista y minorista, usá el mayorista (es el costo de compra).
- Si la lista indica un mínimo (por ejemplo "x3", "mín. 6", "caja de 12"), ponelo en minimo_compra; si no, 1.
- Asociá cada renglón al producto propio que sea claramente el mismo (mismo tipo, material y tamaño). Si dudás, producto_id = null.
- Marcá dudoso = true cuando el precio sea ilegible o ambiguo, o cuando la asociación sea una suposición.
- Ignorá encabezados, totales, condiciones de pago y datos de contacto.`;

const IMAGENES: Record<string, 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = await clienteDeUsuario(req);
    if (!supabase) return json({ error: 'No autorizado' }, 401);

    const { archivo_path, texto } = (await req.json()) as { archivo_path?: string; texto?: string };
    if (!archivo_path && !texto?.trim()) return json({ error: 'Falta el archivo o el texto de la lista' }, 400);

    const { data: productos, error: errProd } = await supabase
      .from('productos')
      .select('id, nombre, categoria')
      .eq('activo', true);
    if (errProd) throw errProd;

    const contenido: Anthropic.ContentBlockParam[] = [];
    if (archivo_path) {
      const { data: blob, error } = await supabase.storage.from('listas-precios').download(archivo_path);
      if (error || !blob) return json({ error: 'No se pudo leer el archivo subido' }, 400);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const ext = archivo_path.split('.').pop()?.toLowerCase() ?? '';
      if (ext === 'pdf') {
        contenido.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: encodeBase64(bytes) },
        });
      } else if (IMAGENES[ext]) {
        contenido.push({
          type: 'image',
          source: { type: 'base64', media_type: IMAGENES[ext], data: encodeBase64(bytes) },
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const libro = XLSX.read(bytes, { type: 'array' });
        const hojas = libro.SheetNames.map((n: string) => `### Hoja ${n}\n${XLSX.utils.sheet_to_csv(libro.Sheets[n])}`);
        contenido.push({ type: 'text', text: `Lista de precios (Excel convertido a CSV):\n${hojas.join('\n\n')}` });
      } else {
        contenido.push({ type: 'text', text: `Lista de precios:\n${new TextDecoder().decode(bytes)}` });
      }
    }
    if (texto?.trim()) contenido.push({ type: 'text', text: `Lista de precios (texto pegado):\n${texto}` });

    const catalogo = (productos ?? []).map((p) => `${p.id} | ${p.nombre} | ${p.categoria}`).join('\n');
    contenido.push({
      type: 'text',
      text: `Catálogo propio (id | nombre | categoría):\n${catalogo}\n\nDevolvé el borrador de renglones.`,
    });

    const respuesta = await clienteClaude()
      .messages.stream({
        model: MODELO,
        max_tokens: 32000,
        system: SYSTEM,
        output_config: { effort: 'low', format: zodOutputFormat(Borrador) },
        messages: [{ role: 'user', content: contenido }],
      })
      .finalMessage();

    if (respuesta.stop_reason === 'refusal') return json({ error: 'Claude no pudo procesar esta lista.' }, 422);
    if (respuesta.stop_reason === 'max_tokens') return json({ error: 'La lista es demasiado larga. Partila en partes.' }, 422);

    const texto_respuesta = textoDe(respuesta);
    const borrador = Borrador.safeParse(texto_respuesta ? JSON.parse(texto_respuesta) : null);
    if (!borrador.success) return json({ error: 'La respuesta de la IA no tuvo el formato esperado.' }, 502);

    // R10: la IA nunca inventa un producto. Un id que no es del catálogo se descarta y se marca dudoso.
    const ids = new Set((productos ?? []).map((p) => p.id));
    const renglones = borrador.data.renglones
      .filter((r) => r.descripcion_original.trim() && r.costo >= 0)
      .map((r) => {
        const idValido = r.producto_id && ids.has(r.producto_id) ? r.producto_id : null;
        const perdioId = Boolean(r.producto_id) && !idValido;
        return {
          descripcion_original: r.descripcion_original.trim(),
          costo: Math.round(r.costo * 100) / 100,
          minimo_compra: Math.max(1, Math.round(r.minimo_compra || 1)),
          producto_id: idValido,
          dudoso: r.dudoso || perdioId,
          motivo_duda: perdioId ? 'Asociación no válida' : r.motivo_duda,
        };
      });

    return json({ renglones });
  } catch (err) {
    console.error(err);
    return json({ error: mensajeDeError(err) }, 500);
  }
});
