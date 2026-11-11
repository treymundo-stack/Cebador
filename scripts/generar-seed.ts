/**
 * Genera la migración con seed_datos_ficticios() a partir de src/lib/datosFicticios.ts.
 *
 *   npm run seed:sql
 *
 * Si cambiás los datos ficticios: corré los tests (npm test), generá el SQL con este
 * script en una migración NUEVA (cambiá el nombre de archivo de abajo) y pedile al
 * dueño del proyecto de Supabase que la ejecute en el SQL Editor.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LISTAS, PARAMETROS, PRODUCTOS, PROVEEDORES, generarVentas } from '../src/lib/datosFicticios';

const ARCHIVO = 'supabase/migrations/20261112120000_004_seed_y_tope.sql';

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const vProd = (clave: string) => `v_p_${clave}`;
const fecha = (haceDias: number) => (haceDias === 0 ? 'CURRENT_DATE' : `CURRENT_DATE - ${haceDias}`);

const ventas = generarVentas();
const FECHAS_FIJAS: [string, number, number, string][] = [
  ['Navidad', 12, 25, 'alta'],
  ['Reyes', 1, 6, 'alta'],
  ['San Valentín', 2, 14, 'media'],
  ['Día del Amigo', 7, 20, 'alta'],
  ['Día del Maestro', 9, 11, 'media'],
];
const out: string[] = [];

out.push(`/*
# Cebador - Tope por producto (R8) y datos ficticios realistas

ARCHIVO GENERADO por scripts/generar-seed.ts a partir de src/lib/datosFicticios.ts.
No lo edites a mano: cambiá los datos, corré npm test y regeneralo.

1. Parámetro tope_por_producto = 25 (%) para los usuarios que ya tienen parámetros.
2. seed_datos_ficticios(): datos de un emprendimiento chico de mates (todo ficticio):
   - ${PRODUCTOS.length} productos, ${PROVEEDORES.length} proveedores, ${LISTAS.length} listas (${LISTAS.filter((l) => l.estado === 'confirmada').length} confirmadas, ${LISTAS.filter((l) => l.estado === 'borrador').length} borrador).
   - ${ventas.length} ventas en 90 días: entre 1 y 3 por día en total.
   - Con las reglas por defecto: 8 Reforzar (2 son apuestas en alza con poco historial),
     10 Mantener (uno rinde pero está en baja), 5 Revisar precio (margen < 30%),
     5 No recomprar con stock (plata parada > 0) y 1 sin costo cargado.
   Solo carga datos si el usuario todavía no tiene productos.
*/

INSERT INTO parametros (user_id, clave, valor)
SELECT DISTINCT p.user_id, 'tope_por_producto', 25
FROM parametros p
WHERE NOT EXISTS (
  SELECT 1 FROM parametros q WHERE q.user_id = p.user_id AND q.clave = 'tope_por_producto'
);

CREATE OR REPLACE FUNCTION seed_datos_ficticios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer;
  v_lista uuid;
  v_anio int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_madre date;
  v_padre date;
${PROVEEDORES.map((p) => `  v_prov_${p.clave} uuid;`).join('\n')}
${PRODUCTOS.map((p) => `  ${vProd(p.clave)} uuid;`).join('\n')}
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;

  SELECT count(*) INTO v_count FROM productos WHERE user_id = v_user_id;
  IF v_count > 0 THEN
    RETURN jsonb_build_object('status', 'skipped', 'message', 'El usuario ya tiene datos');
  END IF;

  -- Productos`);

for (const p of PRODUCTOS) {
  out.push(
    `  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)\n` +
      `  VALUES (v_user_id, ${q(p.nombre)}, ${q(p.categoria)}, ${p.precio_venta}, ${p.stock}, ${p.grabable}, ${q(p.tendencia)}, true)\n` +
      `  RETURNING id INTO ${vProd(p.clave)};`,
  );
}

out.push('\n  -- Proveedores');
for (const p of PROVEEDORES) {
  out.push(
    `  INSERT INTO proveedores (user_id, nombre, contacto, dias_entrega, activo)\n` +
      `  VALUES (v_user_id, ${q(p.nombre)}, ${q(p.contacto)}, ${p.dias_entrega}, true)\n` +
      `  RETURNING id INTO v_prov_${p.clave};`,
  );
}

out.push('\n  -- Listas de precios');
for (const l of LISTAS) {
  out.push(
    `  INSERT INTO listas_precios (user_id, proveedor_id, fecha, estado)\n` +
      `  VALUES (v_user_id, v_prov_${l.proveedor}, ${fecha(l.haceDias)}, ${q(l.estado)})\n` +
      `  RETURNING id INTO v_lista;\n` +
      `  INSERT INTO items_lista (lista_id, descripcion_original, producto_id, costo, minimo_compra) VALUES\n` +
      l.items.map((i) => `    (v_lista, ${q(i.descripcion)}, ${vProd(i.producto)}, ${i.costo}, ${i.minimo})`).join(',\n') +
      ';',
  );
}

out.push(
  `\n  -- Ventas (${ventas.length} en 90 días, entre 1 y 3 por día)\n` +
    `  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal) VALUES\n` +
    ventas
      .map((v) => `    (v_user_id, ${vProd(v.producto)}, ${fecha(v.haceDias)}, ${v.cantidad}, ${v.precio_unitario}, ${q(v.canal)})`)
      .join(',\n') +
    ';',
);

out.push(`
  -- Fechas comerciales (la próxima ocurrencia de cada una)
  v_madre := make_date(v_anio, 10, 15) + ((7 - EXTRACT(DOW FROM make_date(v_anio, 10, 15))::int) % 7);
  IF v_madre < CURRENT_DATE THEN
    v_madre := make_date(v_anio + 1, 10, 15) + ((7 - EXTRACT(DOW FROM make_date(v_anio + 1, 10, 15))::int) % 7);
  END IF;
  v_padre := make_date(v_anio, 6, 15) + ((7 - EXTRACT(DOW FROM make_date(v_anio, 6, 15))::int) % 7);
  IF v_padre < CURRENT_DATE THEN
    v_padre := make_date(v_anio + 1, 6, 15) + ((7 - EXTRACT(DOW FROM make_date(v_anio + 1, 6, 15))::int) % 7);
  END IF;
  INSERT INTO fechas_comerciales (user_id, nombre, fecha, prioridad) VALUES
${FECHAS_FIJAS.map(([n, m, d, pr]) => `    (v_user_id, ${q(n)}, CASE WHEN make_date(v_anio, ${m}, ${d}) < CURRENT_DATE THEN make_date(v_anio + 1, ${m}, ${d}) ELSE make_date(v_anio, ${m}, ${d}) END, ${q(pr)}),`).join('\n')}
    (v_user_id, 'Día de la Madre', v_madre, 'alta'),
    (v_user_id, 'Día del Padre', v_padre, 'alta');

  -- Parámetros
  INSERT INTO parametros (user_id, clave, valor) VALUES
${Object.entries(PARAMETROS)
  .map(([k, v]) => `    (v_user_id, ${q(k)}, ${v})`)
  .join(',\n')};

  RETURN jsonb_build_object(
    'status', 'ok',
    'productos', ${PRODUCTOS.length},
    'proveedores', ${PROVEEDORES.length},
    'listas', ${LISTAS.length},
    'ventas', ${ventas.length}
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION seed_datos_ficticios() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION seed_datos_ficticios() TO authenticated;
`);

const destino = resolve(process.cwd(), ARCHIVO);
writeFileSync(destino, out.join('\n'), 'utf-8');
console.log(`Escrito ${ARCHIVO} (${ventas.length} ventas, ${PRODUCTOS.length} productos)`);
