# Cebador — guía para asistentes de código

App del TP3 (Grupo 6): asistente de compras para Impulse Space. El PRD está resumido en el README; la fuente de verdad de las reglas es `src/lib/reglas.ts`.

## Comandos

- `npm install` y `cp .env.example .env` (los valores son públicos) para correr con `npm run dev`
- Antes de subir cambios: `npm test`, `npm run typecheck`, `npm run lint`

## Cómo se publica

Cada push a `main` corre `.github/workflows/pages.yml`: tests + build, y publica en https://treymundo-stack.github.io/Cebador/. Si los tests o el build fallan, no se publica y queda la versión anterior.

## Reglas del proyecto

- La UI está en español rioplatense (de "vos") y pensada primero para celular.
- Los números (márgenes, cantidades, totales, clasificación) los calculan las funciones de `src/lib/reglas.ts` y `src/lib/calculations.ts`. Si cambiás una regla, actualizá `src/lib/reglas.test.ts`.
- La IA (edge functions en `supabase/functions/`) solo lee listas, interpreta pedidos y redacta explicaciones; nunca calcula ni inventa productos.
- Nunca borrar listas ni ventas: se archivan. La app no compra, no paga ni les escribe a proveedores.
- Los datos de prueba salen de `src/lib/datosFicticios.ts` (con tests). Si los cambiás, generá una migración nueva con `npm run seed:sql` (cambiá el nombre de archivo en `scripts/generar-seed.ts`).
- Montos con `formatARS` y decimales con `formatNumber`/`decimal` de `src/lib/format.ts` (punto de miles, coma decimal). Nunca `toFixed` ni `${numero}` suelto en textos.
- Los cambios de base de datos van como migración nueva en `supabase/migrations/` y los aplica el dueño del proyecto de Supabase desde el SQL Editor. No modificar migraciones ya aplicadas.
- Nunca poner en el código la `service_role key` ni la clave de la API de Claude.
- Colores y tipografía: paleta `crema` / `mate` / `positivo` / `alerta` / `warning` de `tailwind.config.js`, títulos en Cormorant Garamond. Íconos de `lucide-react`.
