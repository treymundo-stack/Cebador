/*
# Cebador - Reglas de negocio y correcciones

1. items_lista.dudoso / motivo_duda: la IA marca los renglones que leyó con duda (PRD §13).
2. Vista stock_inversion:
   - El costo vigente sale SOLO de la lista confirmada más reciente de cada proveedor
     (antes tomaba el mínimo de todas las listas confirmadas, incluidas las viejas).
   - Agrega minimo_compra del proveedor más barato, ventas_90d y unidades_90d.
   - dias_desde_ultima_venta se calcula sobre todo el historial (antes solo 90 días,
     y un producto sin ventas en 90 días quedaba fuera de "No recomprar").
   La clasificación (R3) se calcula en src/lib/reglas.ts con los umbrales de `parametros`.
3. seed_datos_ficticios(): corrige el INSERT de proveedores (RETURNING de 2 filas en
   2 variables fallaba) y agrega el parámetro dias_venta_previa (R7).
*/

ALTER TABLE items_lista ADD COLUMN IF NOT EXISTS dudoso boolean NOT NULL DEFAULT false;
ALTER TABLE items_lista ADD COLUMN IF NOT EXISTS motivo_duda text;

DROP VIEW IF EXISTS stock_inversion;

CREATE VIEW stock_inversion WITH (security_invoker = true) AS
WITH listas_vigentes AS (
  SELECT DISTINCT ON (lp.proveedor_id) lp.id, lp.proveedor_id
  FROM listas_precios lp
  WHERE lp.estado = 'confirmada'
  ORDER BY lp.proveedor_id, lp.fecha DESC, lp.created_at DESC
)
SELECT
  p.id,
  p.user_id,
  p.nombre,
  p.categoria,
  p.precio_venta,
  p.stock_actual,
  p.grabable,
  p.tendencia,
  costo.costo_vigente,
  costo.proveedor_id,
  costo.proveedor_nombre,
  costo.minimo_compra,
  CASE
    WHEN p.precio_venta > 0 AND costo.costo_vigente IS NOT NULL
      THEN round(((p.precio_venta - costo.costo_vigente) / p.precio_venta * 100)::numeric, 1)
    ELSE NULL
  END AS margen,
  rot.rotacion_dias,
  rot.ventas_90d,
  rot.unidades_90d,
  ult.dias_desde_ultima_venta,
  round((p.stock_actual * COALESCE(costo.costo_vigente, 0))::numeric, 2) AS plata_invertida
FROM productos p
LEFT JOIN LATERAL (
  SELECT il.costo AS costo_vigente, il.minimo_compra, prov.id AS proveedor_id, prov.nombre AS proveedor_nombre
  FROM items_lista il
  JOIN listas_vigentes lv ON lv.id = il.lista_id
  JOIN proveedores prov ON prov.id = lv.proveedor_id
  WHERE il.producto_id = p.id
    AND prov.activo = true
    AND prov.user_id = p.user_id
  ORDER BY il.costo ASC
  LIMIT 1
) costo ON true
LEFT JOIN LATERAL (
  SELECT
    count(*)::int AS ventas_90d,
    COALESCE(sum(v.cantidad), 0)::int AS unidades_90d,
    CASE WHEN COALESCE(sum(v.cantidad), 0) > 0
      THEN round((90.0 / sum(v.cantidad))::numeric, 1)
    END AS rotacion_dias
  FROM ventas v
  WHERE v.producto_id = p.id
    AND v.fecha >= CURRENT_DATE - 90
) rot ON true
LEFT JOIN LATERAL (
  SELECT (CURRENT_DATE - max(v.fecha))::int AS dias_desde_ultima_venta
  FROM ventas v
  WHERE v.producto_id = p.id
) ult ON true
WHERE p.activo = true;

GRANT SELECT ON stock_inversion TO authenticated;

CREATE OR REPLACE FUNCTION seed_datos_ficticios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_producto_ids uuid[];
  v_prov_a_id uuid;
  v_prov_b_id uuid;
  v_lista_a_conf uuid;
  v_lista_a_borr uuid;
  v_lista_b_conf uuid;
  v_lista_b_borr uuid;
  v_count integer;
  v_fecha_base date := CURRENT_DATE - 90;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;

  -- Verificar si ya tiene productos
  SELECT count(*) INTO v_count FROM productos WHERE user_id = v_user_id;
  IF v_count > 0 THEN
    RETURN jsonb_build_object('status', 'skipped', 'message', 'El usuario ya tiene datos');
  END IF;

  -- =========================================================
  -- 30 PRODUCTOS (mates y accesorios)
  -- =========================================================
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo) VALUES
    (v_user_id, 'Mate Imperial Calabaza Premium', 'Mates', 95000, 2, true, 'en_alza', true),
    (v_user_id, 'Mate Imperial Forrado en Cuero', 'Mates', 72000, 1, true, 'estable', true),
    (v_user_id, 'Mate Imperial Chico', 'Mates', 55000, 3, false, 'estable', true),
    (v_user_id, 'Mate Camionero Algarrobo', 'Mates', 38000, 4, true, 'en_alza', true),
    (v_user_id, 'Mate Camionero Quebracho', 'Mates', 35000, 2, true, 'estable', true),
    (v_user_id, 'Mate Camionero Palo Santo', 'Mates', 42000, 0, true, 'en_alza', true),
    (v_user_id, 'Mate Torpedo Calabaza Natural', 'Mates', 28000, 3, false, 'estable', true),
    (v_user_id, 'Mate Torpedo Forrado Cuero', 'Mates', 32000, 1, false, 'estable', true),
    (v_user_id, 'Mate Torpedo Cerámica Negra', 'Mates', 25000, 5, false, 'en_baja', true),
    (v_user_id, 'Mate Golondrina Algarrobo', 'Mates', 22000, 2, false, 'estable', true),
    (v_user_id, 'Mate Golondrina Calabaza', 'Mates', 18000, 4, false, 'estable', true),
    (v_user_id, 'Mate Acero Inoxidable', 'Mates', 30000, 1, false, 'estable', true),
    (v_user_id, 'Bombilla Alpaca Pico de Loro', 'Bombillas', 15000, 5, false, 'estable', true),
    (v_user_id, 'Bombilla Acero Inoxidable Recta', 'Bombillas', 8000, 6, false, 'en_alza', true),
    (v_user_id, 'Bombilla Acero Pico de Loro', 'Bombillas', 12000, 3, false, 'estable', true),
    (v_user_id, 'Bombilla Alpaca Floral Grabada', 'Bombillas', 20000, 1, true, 'en_alza', true),
    (v_user_id, 'Bombilla Bronce Antigua', 'Bombillas', 28000, 0, false, 'estable', true),
    (v_user_id, 'Matera Cuero Trenzado Grande', 'Materas', 65000, 1, false, 'estable', true),
    (v_user_id, 'Matera Cuero Simple', 'Materas', 45000, 2, false, 'estable', true),
    (v_user_id, 'Matera Lona Impermeable', 'Materas', 30000, 3, false, 'en_alza', true),
    (v_user_id, 'Matera Madera Algarrobo', 'Materas', 52000, 1, false, 'estable', true),
    (v_user_id, 'Matera Cuero con Termo', 'Materas', 85000, 0, false, 'estable', true),
    (v_user_id, 'Yerbera Cuero Trenzado', 'Yerberas', 18000, 4, false, 'estable', true),
    (v_user_id, 'Yerbera Lona Impermeable', 'Yerberas', 12000, 5, false, 'en_alza', true),
    (v_user_id, 'Yerbera Madera Algarrobo', 'Yerberas', 22000, 2, false, 'estable', true),
    (v_user_id, 'Yerbera Cuero Simple', 'Yerberas', 15000, 3, false, 'estable', true),
    (v_user_id, 'Kit Mate Completo Imperial', 'Kits', 120000, 1, false, 'en_alza', true),
    (v_user_id, 'Kit Mate Camionero Premium', 'Kits', 78000, 2, false, 'estable', true),
    (v_user_id, 'Termo Acero 1L Mateador', 'Termos', 55000, 3, false, 'estable', true),
    (v_user_id, 'Termo Acero 500ml Compacto', 'Termos', 35000, 0, false, 'en_alza', true);

  -- Recoger ids de productos en orden de inserción
  -- Orden explícito: todos los productos tienen el mismo created_at (misma transacción),
  -- así que ordenar por created_at, nombre desordenaba los índices.
  SELECT array_agg(p.id ORDER BY n.ord) INTO v_producto_ids
  FROM unnest(ARRAY[
    'Mate Imperial Calabaza Premium',
    'Mate Imperial Forrado en Cuero',
    'Mate Imperial Chico',
    'Mate Camionero Algarrobo',
    'Mate Camionero Quebracho',
    'Mate Camionero Palo Santo',
    'Mate Torpedo Calabaza Natural',
    'Mate Torpedo Forrado Cuero',
    'Mate Torpedo Cerámica Negra',
    'Mate Golondrina Algarrobo',
    'Mate Golondrina Calabaza',
    'Mate Acero Inoxidable',
    'Bombilla Alpaca Pico de Loro',
    'Bombilla Acero Inoxidable Recta',
    'Bombilla Acero Pico de Loro',
    'Bombilla Alpaca Floral Grabada',
    'Bombilla Bronce Antigua',
    'Matera Cuero Trenzado Grande',
    'Matera Cuero Simple',
    'Matera Lona Impermeable',
    'Matera Madera Algarrobo',
    'Matera Cuero con Termo',
    'Yerbera Cuero Trenzado',
    'Yerbera Lona Impermeable',
    'Yerbera Madera Algarrobo',
    'Yerbera Cuero Simple',
    'Kit Mate Completo Imperial',
    'Kit Mate Camionero Premium',
    'Termo Acero 1L Mateador',
    'Termo Acero 500ml Compacto'
  ]) WITH ORDINALITY AS n(nombre, ord)
  JOIN productos p ON p.nombre = n.nombre AND p.user_id = v_user_id;

  -- =========================================================
  -- 2 PROVEEDORES
  -- =========================================================
  INSERT INTO proveedores (user_id, nombre, contacto, dias_entrega, activo)
  VALUES (v_user_id, 'Proveedor A', 'WhatsApp 11-5555-1111', 7, true)
  RETURNING id INTO v_prov_a_id;

  INSERT INTO proveedores (user_id, nombre, contacto, dias_entrega, activo)
  VALUES (v_user_id, 'Proveedor B', 'Instagram @proveedor_b', 5, true)
  RETURNING id INTO v_prov_b_id;

  -- =========================================================
  -- LISTAS DE PRECIOS (2 por proveedor: 1 confirmada + 1 borrador)
  -- =========================================================
  -- Proveedor A: lista confirmada (hace 20 días)
  INSERT INTO listas_precios (user_id, proveedor_id, fecha, estado)
  VALUES (v_user_id, v_prov_a_id, CURRENT_DATE - 20, 'confirmada')
  RETURNING id INTO v_lista_a_conf;

  -- Proveedor A: lista borrador (hoy)
  INSERT INTO listas_precios (user_id, proveedor_id, fecha, estado)
  VALUES (v_user_id, v_prov_a_id, CURRENT_DATE, 'borrador')
  RETURNING id INTO v_lista_a_borr;

  -- Proveedor B: lista confirmada (hace 15 días)
  INSERT INTO listas_precios (user_id, proveedor_id, fecha, estado)
  VALUES (v_user_id, v_prov_b_id, CURRENT_DATE - 15, 'confirmada')
  RETURNING id INTO v_lista_b_conf;

  -- Proveedor B: lista borrador (hoy)
  INSERT INTO listas_precios (user_id, proveedor_id, fecha, estado)
  VALUES (v_user_id, v_prov_b_id, CURRENT_DATE, 'borrador')
  RETURNING id INTO v_lista_b_borr;

  -- =========================================================
  -- ITEMS DE LISTAS (con costos diferentes por proveedor)
  -- Proveedor A es más caro en general, Proveedor B más barato en algunos.
  -- =========================================================

  -- Proveedor A - lista confirmada (20 productos con costo)
  -- Costo base aprox 60-70% del precio de venta para margen 30-40%
  INSERT INTO items_lista (lista_id, descripcion_original, producto_id, costo, minimo_compra) VALUES
    (v_lista_a_conf, 'Mate Imperial Calabaza Premium', v_producto_ids[1], 57000, 1),
    (v_lista_a_conf, 'Mate Imperial Forrado Cuero', v_producto_ids[2], 46000, 1),
    (v_lista_a_conf, 'Mate Imperial Chico', v_producto_ids[3], 36000, 1),
    (v_lista_a_conf, 'Mate Camionero Algarrobo', v_producto_ids[4], 22000, 2),
    (v_lista_a_conf, 'Mate Camionero Quebracho', v_producto_ids[5], 21000, 2),
    (v_lista_a_conf, 'Mate Camionero Palo Santo', v_producto_ids[6], 26000, 1),
    (v_lista_a_conf, 'Mate Torpedo Calabaza Natural', v_producto_ids[7], 16000, 2),
    (v_lista_a_conf, 'Mate Torpedo Forrado Cuero', v_producto_ids[8], 19000, 1),
    (v_lista_a_conf, 'Mate Torpedo Cerámica Negra', v_producto_ids[9], 14000, 2),
    (v_lista_a_conf, 'Mate Golondrina Algarrobo', v_producto_ids[10], 12000, 2),
    (v_lista_a_conf, 'Mate Golondrina Calabaza', v_producto_ids[11], 10000, 3),
    (v_lista_a_conf, 'Mate Acero Inoxidable', v_producto_ids[12], 18000, 1),
    (v_lista_a_conf, 'Bombilla Alpaca Pico Loro', v_producto_ids[13], 8500, 2),
    (v_lista_a_conf, 'Bombilla Acero Recta', v_producto_ids[14], 4500, 3),
    (v_lista_a_conf, 'Bombilla Acero Pico Loro', v_producto_ids[15], 7000, 2),
    (v_lista_a_conf, 'Bombilla Alpaca Floral Grabada', v_producto_ids[16], 12000, 1),
    (v_lista_a_conf, 'Matera Cuero Trenzado Grande', v_producto_ids[18], 38000, 1),
    (v_lista_a_conf, 'Matera Cuero Simple', v_producto_ids[19], 27000, 1),
    (v_lista_a_conf, 'Yerbera Cuero Trenzado', v_producto_ids[23], 10000, 2),
    (v_lista_a_conf, 'Yerbera Lona Impermeable', v_producto_ids[24], 7000, 3);

  -- Proveedor A - lista borrador (5 renglones, con un aumento notable)
  -- La bombilla alpaca pico de loro subió de $8.500 a $10.000 (17.6% aumento)
  INSERT INTO items_lista (lista_id, descripcion_original, producto_id, costo, minimo_compra) VALUES
    (v_lista_a_borr, 'Mate Imperial Calabaza Premium', v_producto_ids[1], 60000, 1),
    (v_lista_a_borr, 'Mate Camionero Algarrobo', v_producto_ids[4], 24000, 2),
    (v_lista_a_borr, 'Bombilla Alpaca Pico Loro', v_producto_ids[13], 10000, 2),
    (v_lista_a_borr, 'Yerbera Cuero Trenzado', v_producto_ids[23], 11000, 2),
    (v_lista_a_borr, 'Matera Cuero Simple', v_producto_ids[19], 29000, 1);

  -- Proveedor B - lista confirmada (20 productos, más barato en algunos)
  INSERT INTO items_lista (lista_id, descripcion_original, producto_id, costo, minimo_compra) VALUES
    (v_lista_b_conf, 'Mate Imperial Calabaza', v_producto_ids[1], 53000, 1),
    (v_lista_b_conf, 'Mate Imperial Forrado', v_producto_ids[2], 42000, 1),
    (v_lista_b_conf, 'Mate Imperial Chico', v_producto_ids[3], 33000, 1),
    (v_lista_b_conf, 'Mate Camionero Algarrobo', v_producto_ids[4], 19000, 2),
    (v_lista_b_conf, 'Mate Camionero Quebracho', v_producto_ids[5], 18000, 2),
    (v_lista_b_conf, 'Mate Torpedo Calabaza Natural', v_producto_ids[7], 14000, 2),
    (v_lista_b_conf, 'Mate Torpedo Forrado Cuero', v_producto_ids[8], 17000, 1),
    (v_lista_b_conf, 'Mate Torpedo Cerámica Negra', v_producto_ids[9], 12000, 2),
    (v_lista_b_conf, 'Mate Golondrina Algarrobo', v_producto_ids[10], 10000, 2),
    (v_lista_b_conf, 'Mate Golondrina Calabaza', v_producto_ids[11], 8500, 3),
    (v_lista_b_conf, 'Mate Acero Inoxidable', v_producto_ids[12], 16000, 1),
    (v_lista_b_conf, 'Bombilla Alpaca Pico Loro', v_producto_ids[13], 7800, 2),
    (v_lista_b_conf, 'Bombilla Acero Recta', v_producto_ids[14], 4200, 3),
    (v_lista_b_conf, 'Bombilla Acero Pico Loro', v_producto_ids[15], 6500, 2),
    (v_lista_b_conf, 'Bombilla Alpaca Floral Grabada', v_producto_ids[16], 11000, 1),
    (v_lista_b_conf, 'Matera Cuero Trenzado Grande', v_producto_ids[18], 35000, 1),
    (v_lista_b_conf, 'Matera Cuero Simple', v_producto_ids[19], 25000, 1),
    (v_lista_b_conf, 'Matera Lona Impermeable', v_producto_ids[20], 17000, 2),
    (v_lista_b_conf, 'Yerbera Cuero Trenzado', v_producto_ids[23], 9000, 2),
    (v_lista_b_conf, 'Yerbera Lona Impermeable', v_producto_ids[24], 6500, 3),
    (v_lista_b_conf, 'Termo 500ml Compacto', v_producto_ids[30], 19000, 1);

  -- Proveedor B - lista borrador (5 renglones)
  INSERT INTO items_lista (lista_id, descripcion_original, producto_id, costo, minimo_compra) VALUES
    (v_lista_b_borr, 'Mate Camionero Algarrobo', v_producto_ids[4], 19500, 2),
    (v_lista_b_borr, 'Bombilla Acero Recta', v_producto_ids[14], 4400, 3),
    (v_lista_b_borr, 'Matera Lona Impermeable', v_producto_ids[20], 17500, 2),
    (v_lista_b_borr, 'Yerbera Lona Impermeable', v_producto_ids[24], 6800, 3),
    (v_lista_b_borr, 'Termo Acero 1L Mateador', v_producto_ids[29], 32000, 1);

  -- =========================================================
  -- VENTAS FICTICIAS (90 días)
  -- Productos con buena rotación, algunos sin ventas en más de 60 días
  -- =========================================================
  -- Productos 1-12: rotación frecuente (cada 3-10 días)
  -- Producto 17 (Bombilla Bronce) y 22 (Matera Cuero con Termo): sin ventas en 65+ días
  -- Producto 28 (Kit Camionero): sin ventas en 61+ días

  -- Generar ventas distribuidas en 90 días para productos de alta rotación
  -- Producto 1: venta cada ~4 días (22 ventas en 90 días)
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[1], v_fecha_base + (i * 4), 1, 95000, 'instagram'
  FROM generate_series(0, 22) AS i;

  -- Producto 2: cada ~6 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[2], v_fecha_base + (i * 6), 1, 72000,
    CASE WHEN i % 3 = 0 THEN 'tienda_nube' ELSE 'instagram' END
  FROM generate_series(0, 15) AS i;

  -- Producto 3: cada ~7 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[3], v_fecha_base + (i * 7), 1, 55000, 'instagram'
  FROM generate_series(0, 12) AS i;

  -- Producto 4: cada ~3 días (alta rotación)
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[4], v_fecha_base + (i * 3), 1, 38000,
    CASE WHEN i % 4 = 0 THEN 'tienda_nube' ELSE 'instagram' END
  FROM generate_series(0, 30) AS i;

  -- Producto 5: cada ~5 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[5], v_fecha_base + (i * 5), 1, 35000, 'instagram'
  FROM generate_series(0, 18) AS i;

  -- Producto 6: cada ~8 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[6], v_fecha_base + (i * 8), 1, 42000, 'instagram'
  FROM generate_series(0, 11) AS i;

  -- Producto 7: cada ~6 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[7], v_fecha_base + (i * 6), 1, 28000, 'instagram'
  FROM generate_series(0, 15) AS i;

  -- Producto 8: cada ~9 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[8], v_fecha_base + (i * 9), 1, 32000, 'instagram'
  FROM generate_series(0, 10) AS i;

  -- Producto 9: cada ~12 días (lento)
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[9], v_fecha_base + (i * 12), 1, 25000, 'tienda_nube'
  FROM generate_series(0, 7) AS i;

  -- Producto 10: cada ~5 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[10], v_fecha_base + (i * 5), 1, 22000, 'instagram'
  FROM generate_series(0, 18) AS i;

  -- Producto 11: cada ~8 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[11], v_fecha_base + (i * 8), 1, 18000, 'instagram'
  FROM generate_series(0, 11) AS i;

  -- Producto 12: cada ~10 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[12], v_fecha_base + (i * 10), 1, 30000, 'instagram'
  FROM generate_series(0, 9) AS i;

  -- Producto 13: cada ~4 días (bombillas, alta rotación)
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[13], v_fecha_base + (i * 4), 1, 15000, 'instagram'
  FROM generate_series(0, 22) AS i;

  -- Producto 14: cada ~3 días (la más vendida)
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[14], v_fecha_base + (i * 3), 2, 8000,
    CASE WHEN i % 5 = 0 THEN 'tienda_nube' ELSE 'instagram' END
  FROM generate_series(0, 30) AS i;

  -- Producto 15: cada ~7 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[15], v_fecha_base + (i * 7), 1, 12000, 'instagram'
  FROM generate_series(0, 12) AS i;

  -- Producto 16: cada ~9 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[16], v_fecha_base + (i * 9), 1, 20000, 'instagram'
  FROM generate_series(0, 10) AS i;

  -- Producto 17: sin ventas en 68 días (solo vendió al inicio del período)
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal) VALUES
    (v_user_id, v_producto_ids[17], v_fecha_base + 2, 1, 28000, 'instagram'),
    (v_user_id, v_producto_ids[17], v_fecha_base + 15, 1, 28000, 'instagram'),
    (v_user_id, v_producto_ids[17], v_fecha_base + 22, 1, 28000, 'otro');

  -- Producto 18: cada ~10 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[18], v_fecha_base + (i * 10), 1, 65000, 'instagram'
  FROM generate_series(0, 9) AS i;

  -- Producto 19: cada ~7 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[19], v_fecha_base + (i * 7), 1, 45000, 'instagram'
  FROM generate_series(0, 12) AS i;

  -- Producto 20: cada ~6 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[20], v_fecha_base + (i * 6), 1, 30000, 'instagram'
  FROM generate_series(0, 15) AS i;

  -- Producto 21: cada ~14 días (lento)
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[21], v_fecha_base + (i * 14), 1, 52000, 'instagram'
  FROM generate_series(0, 6) AS i;

  -- Producto 22: sin ventas en 70 días (solo 2 ventas al inicio)
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal) VALUES
    (v_user_id, v_producto_ids[22], v_fecha_base + 5, 1, 85000, 'instagram'),
    (v_user_id, v_producto_ids[22], v_fecha_base + 18, 1, 85000, 'otro');

  -- Producto 23: cada ~5 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[23], v_fecha_base + (i * 5), 1, 18000, 'instagram'
  FROM generate_series(0, 18) AS i;

  -- Producto 24: cada ~4 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[24], v_fecha_base + (i * 4), 1, 12000, 'instagram'
  FROM generate_series(0, 22) AS i;

  -- Producto 25: cada ~11 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[25], v_fecha_base + (i * 11), 1, 22000, 'instagram'
  FROM generate_series(0, 8) AS i;

  -- Producto 26: cada ~9 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[26], v_fecha_base + (i * 9), 1, 15000, 'instagram'
  FROM generate_series(0, 10) AS i;

  -- Producto 27: cada ~6 días (kit premium)
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[27], v_fecha_base + (i * 6), 1, 120000, 'instagram'
  FROM generate_series(0, 15) AS i;

  -- Producto 28: sin ventas en 62 días (solo 1 venta al inicio)
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal) VALUES
    (v_user_id, v_producto_ids[28], v_fecha_base + 10, 1, 78000, 'instagram'),
    (v_user_id, v_producto_ids[28], v_fecha_base + 25, 1, 78000, 'otro');

  -- Producto 29: cada ~8 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[29], v_fecha_base + (i * 8), 1, 55000, 'instagram'
  FROM generate_series(0, 11) AS i;

  -- Producto 30: sin ventas todavía y tendencia en alza (sirve para probar la compra arriesgada, R9)

  -- =========================================================
  -- FECHAS COMERCIALES ARGENTINAS
  -- =========================================================
  INSERT INTO fechas_comerciales (user_id, nombre, fecha, prioridad) VALUES
    (v_user_id, 'Navidad', make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 12, 25), 'alta'),
    (v_user_id, 'Reyes', make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + CASE WHEN CURRENT_DATE > make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 6) THEN 1 ELSE 0 END, 1, 6), 'alta'),
    (v_user_id, 'San Valentín', make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + CASE WHEN CURRENT_DATE > make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 2, 14) THEN 1 ELSE 0 END, 2, 14), 'media'),
    (v_user_id, 'Día de la Madre', (
      SELECT d FROM (
        SELECT make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 10, 15) + ((14 - EXTRACT(DOW FROM make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 10, 15))::int + 21) % 7) AS d
      ) s
    ), 'alta'),
    (v_user_id, 'Día del Padre', (
      SELECT d FROM (
        SELECT make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 6, 15) + ((14 - EXTRACT(DOW FROM make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 6, 15))::int + 21) % 7) AS d
      ) s
    ), 'alta'),
    (v_user_id, 'Día del Amigo', make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + CASE WHEN CURRENT_DATE > make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 7, 20) THEN 1 ELSE 0 END, 7, 20), 'alta'),
    (v_user_id, 'Día del Maestro', make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + CASE WHEN CURRENT_DATE > make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 9, 11) THEN 1 ELSE 0 END, 9, 11), 'media');

  -- =========================================================
  -- PARÁMETROS INICIALES
  -- =========================================================
  INSERT INTO parametros (user_id, clave, valor) VALUES
    (v_user_id, 'margen_minimo', 30),
    (v_user_id, 'margen_reforzar', 40),
    (v_user_id, 'rotacion_reforzar_dias', 15),
    (v_user_id, 'dias_sin_venta_no_recomprar', 60),
    (v_user_id, 'dias_grabado', 12),
    (v_user_id, 'dias_envio', 3),
    (v_user_id, 'tope_arriesgada', 30),
    (v_user_id, 'alerta_aumento', 5),
    (v_user_id, 'dias_venta_previa', 21);

  RETURN jsonb_build_object(
    'status', 'ok',
    'productos', 30,
    'proveedores', 2,
    'listas', 4,
    'fechas_comerciales', 7,
    'parametros', 8
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION seed_datos_ficticios() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION seed_datos_ficticios() TO authenticated;
