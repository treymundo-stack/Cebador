# Cebador

Asistente de compras de Impulse Space (TP3 · Grupo 6). Le dice a la dueña qué comprar, cuánto, a qué proveedor y cuándo, para un presupuesto y un objetivo que ella define.

La IA lee listas de proveedores e interpreta el pedido escrito; **los números salen siempre de reglas fijas** ([src/lib/reglas.ts](src/lib/reglas.ts), probadas en [src/lib/reglas.test.ts](src/lib/reglas.test.ts)).

## Stack

- React + Vite + Tailwind (generado con Bolt)
- Supabase: base de datos, login, Storage y RLS
- Edge functions con la API de Claude: `leer_lista` e `interpretar_pedido`

## Correr en local

```bash
npm install
cp .env.example .env   # ya trae los valores públicos del proyecto
npm run dev
```

Scripts: `npm test` (reglas de negocio), `npm run typecheck`, `npm run lint`, `npm run build`.

**App publicada:** https://treymundo-stack.github.io/Cebador/ — se actualiza sola con cada push a `main` (si los tests o el build fallan, no se publica).

## Cómo colaborar

- **Cambios chicos (textos, colores, pantallas):** en GitHub, abrir el repo y apretar la tecla `.` para editar en el navegador. Hacer commit a `main` y en un par de minutos se ve en la app publicada.
- **Cambios más grandes:** clonar el repo, `npm install`, `cp .env.example .env`, `npm run dev`. Se puede trabajar con Claude Code: [CLAUDE.md](CLAUDE.md) le explica el proyecto.
- **Cambios en la base de datos:** crear una migración nueva en `supabase/migrations/` y pedirle al dueño del proyecto de Supabase que la corra.

## Poner en marcha Supabase

1. **Migraciones.** Correr en orden los archivos de `supabase/migrations/` (SQL Editor del panel o `supabase db push`). La `003_reglas_y_correcciones` es nueva: corrige la vista `stock_inversion`, la función de datos de prueba y agrega las marcas de renglón dudoso.
2. **Clave de Claude.** En el panel de Supabase → Edge Functions → Secrets, crear `ANTHROPIC_API_KEY`. Opcional: `CLAUDE_MODEL` para usar otro modelo (por defecto `claude-opus-5-5`).
3. **Edge functions.** Cada función es un solo archivo, así que se puede subir desde el panel (Edge Functions → Deploy a new function → pegar el `index.ts`) o con la CLI:
   ```bash
   supabase functions deploy leer_lista
   supabase functions deploy interpretar_pedido
   ```
4. **Datos de prueba.** Crear una cuenta en la app y, en Configuración, tocar "Cargar datos de prueba".

La `service_role key` y la clave de Claude nunca van al código ni al repositorio.

## Reglas implementadas (PRD §7)

| Regla | Dónde |
| --- | --- |
| R1 margen, R3 clasificación, R4 plata parada, R7 fechas límite, R8/R9 compra recomendada | `src/lib/reglas.ts` |
| Costo vigente (lista confirmada más reciente de cada proveedor), R6 aumentos | `src/lib/calculations.ts` y vista `stock_inversion` |
| R2 rotación | vista `stock_inversion` |
| R5 borrador → confirmada, renglones dudosos | `ListasScreen` + `leer_lista` |
| R10 la IA no calcula ni inventa productos | `leer_lista` descarta ids que no son del catálogo; las explicaciones se redactan sobre números ya calculados |
| R11 no compra, no paga, no escribe a proveedores | no existe ninguna ruta que lo haga |

Los umbrales viven en la tabla `parametros` y se editan desde Configuración.
