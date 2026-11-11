// Utilidades compartidas por las edge functions de Cebador.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Cliente de Supabase con el JWT de la dueña: respeta RLS, nunca usa la service_role key. */
export async function clienteDeUsuario(req: Request): Promise<SupabaseClient | null> {
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
export function clienteClaude(): Anthropic {
  return new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
}

export const MODELO = Deno.env.get('CLAUDE_MODEL') ?? 'claude-opus-5-5';

/** Devuelve el primer bloque de texto de la respuesta, o null. */
export function textoDe(msg: Anthropic.Message): string | null {
  for (const b of msg.content) if (b.type === 'text') return b.text;
  return null;
}

export function mensajeDeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'La clave de la API de Claude no es válida. Revisá el secret ANTHROPIC_API_KEY.';
  if (err instanceof Anthropic.RateLimitError) return 'La API de Claude está saturada. Probá de nuevo en un minuto.';
  if (err instanceof Anthropic.APIError) return `Error de la API de Claude (${err.status}).`;
  return err instanceof Error ? err.message : 'Error inesperado';
}
