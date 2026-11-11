// interpretar_pedido: dos usos, ambos sin tocar números (R10).
//  - accion "interpretar": convierte el pedido en texto libre ("tengo 300 lucas y quiero
//    llegar bien a Navidad") en presupuesto, objetivo, fecha y tipo de compra.
//  - accion "explicar": redacta una línea por producto de una compra YA calculada por el sistema.
import { z } from 'npm:zod@4.1.12';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@1.8.0/helpers/zod';
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


const Pedido = z.object({
  presupuesto: z.number().nullable().describe('Monto en pesos argentinos; null si no lo dice'),
  objetivo: z.string().describe('El objetivo en pocas palabras, por ejemplo "Llegar bien a Navidad"'),
  fecha_objetivo: z.string().nullable().describe('Fecha objetivo YYYY-MM-DD; null si no se puede deducir'),
  tipo: z.enum(['conservadora', 'arriesgada']).nullable().describe('Solo si el pedido lo deja claro'),
});

const Explicaciones = z.object({
  explicaciones: z.array(z.object({ producto_id: z.string(), texto: z.string() })),
});

interface ItemParaExplicar {
  producto_id: string;
  nombre: string;
  cantidad: number;
  clasificacion: string;
  margen: number;
  stock_actual: number;
  demanda_esperada: number;
  apuesta: boolean;
  explicacion: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = await clienteDeUsuario(req);
    if (!supabase) return json({ error: 'No autorizado' }, 401);
    const body = await req.json();
    const claude = clienteClaude();

    if (body.accion === 'interpretar') {
      const texto = String(body.texto ?? '').trim();
      if (!texto) return json({ error: 'El pedido está vacío' }, 400);
      const hoy = String(body.hoy ?? new Date().toISOString().slice(0, 10));
      const { data: fechas } = await supabase.from('fechas_comerciales').select('nombre, fecha').order('fecha');
      const calendario = (fechas ?? []).map((f) => `${f.nombre}: ${f.fecha}`).join('\n');

      const r = await claude.messages.create({
        model: MODELO,
        max_tokens: 2000,
        output_config: { effort: 'low', format: zodOutputFormat(Pedido) },
        system:
          'Interpretás pedidos de compra de mercadería de una emprendedora argentina. ' +
          'Montos en pesos: "300 lucas", "300k", "$300.000" y "300 mil" son 300000. ' +
          'Si nombra una fecha comercial, usá la próxima ocurrencia del calendario. ' +
          '"Segura" o "sin riesgo" es conservadora; "apostar", "probar novedades" o "tendencias" es arriesgada. ' +
          'No inventes datos que el pedido no dice.',
        messages: [{ role: 'user', content: `Hoy es ${hoy}.\nCalendario:\n${calendario}\n\nPedido: ${texto}` }],
      });
      const t = textoDe(r);
      const pedido = Pedido.safeParse(t ? JSON.parse(t) : null);
      if (!pedido.success) return json({ error: 'No pude interpretar el pedido. Usá el formulario.' }, 422);
      const p = pedido.data;
      return json({
        presupuesto: p.presupuesto !== null && p.presupuesto > 0 ? Math.round(p.presupuesto) : null,
        objetivo: p.objetivo,
        fecha_objetivo: p.fecha_objetivo && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha_objetivo) ? p.fecha_objetivo : null,
        tipo: p.tipo,
      });
    }

    if (body.accion === 'explicar') {
      const items = (body.items ?? []) as ItemParaExplicar[];
      if (items.length === 0) return json({ explicaciones: [] });
      const r = await claude.messages.create({
        model: MODELO,
        max_tokens: 8000,
        output_config: { effort: 'low', format: zodOutputFormat(Explicaciones) },
        system:
          'Redactás, para la dueña de un emprendimiento de mates, UNA línea corta (máximo 25 palabras) que explique ' +
          'por qué conviene comprar cada producto. Hablá en español rioplatense, de "vos". ' +
          'Usá solo los datos que te pasan: no cambies cantidades, márgenes ni montos, y no agregues cifras nuevas. ' +
          'Formato argentino: montos con signo $ y punto de miles ($ 75.000) y decimales con coma (4,5 días; 36,1%).',
        messages: [
          {
            role: 'user',
            content: `Objetivo de la compra: ${body.objetivo ?? 'reponer stock'}\nProductos:\n${JSON.stringify(items, null, 1)}`,
          },
        ],
      });
      const t = textoDe(r);
      const exp = Explicaciones.safeParse(t ? JSON.parse(t) : null);
      if (!exp.success) return json({ error: 'No se pudieron redactar las explicaciones' }, 422);
      const ids = new Set(items.map((i) => i.producto_id));
      return json({ explicaciones: exp.data.explicaciones.filter((e) => ids.has(e.producto_id)) });
    }

    return json({ error: 'Acción desconocida' }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: mensajeDeError(err) }, 500);
  }
});
