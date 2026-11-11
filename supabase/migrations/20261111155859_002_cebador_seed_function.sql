/*
# Cebador - Función de siembra de datos ficticios

## Descripción
Crea una función SQL `seed_datos_ficticios()` que inserta todos los datos de prueba
del PRD para el usuario autenticado actual: 30 productos de mates y accesorios,
2 proveedores con 2 listas cada uno (una confirmada y una borrador), 90 días de
historial de ventas ficticio, fechas comerciales argentinas y parámetros iniciales.

## Detalle
- 30 productos: mates imperiales, camioneros, torpedos, bombillas, materas, yerberas.
  Precios $5.000-$95.000, stock 0-5, distintas tendencias.
- Proveedor A y Proveedor B, con costos diferentes para comparar.
- Cada proveedor con una lista confirmada y una en borrador.
- 90 días de ventas ficticias con distintas frecuencias.
- Algunos productos sin ventas en más de 60 días (para clasificar No recomprar).
- Fechas comerciales: Navidad, Reyes, San Valentín, Día Madre, Día Padre,
  Día del Amigo, Día del Maestro.
- Parámetros: margen_minimo=30, margen_reforzar=40, rotacion_reforzar_dias=15,
  dias_sin_venta_no_recomprar=60, dias_grabado=12, dias_envio=3,
  tope_arriesgada=30, alerta_aumento=5.

## Seguridad
- La función es SECURITY DEFINER para poder insertar con el user_id del caller.
- Verifica que hay un usuario autenticado (auth.uid()).
- Solo inserta si el usuario no tiene datos previos (idempotente).
- REVOKE EXECUTE FROM PUBLIC, anon; GRANT TO authenticated.
*/

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
    (v_user_id, 'Termo Acero 500ml Compacto', 'Termos', 35000, 4, false, 'estable', true);

  -- Recoger ids de productos en orden de inserción
  SELECT array_agg(id ORDER BY created_at, nombre) INTO v_producto_ids
  FROM productos WHERE user_id = v_user_id;

  -- =========================================================
  -- 2 PROVEEDORES
  -- =========================================================
  INSERT INTO proveedores (user_id, nombre, contacto, dias_entrega, activo) VALUES
    (v_user_id, 'Proveedor A', 'WhatsApp 11-5555-1111 / proveedora@gmail.com', 7, true),
    (v_user_id, 'Proveedor B', 'Instagram @proveedor_b / Tel 2392-445566', 5, true)
  RETURNING id INTO v_prov_a_id, v_prov_b_id;

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
    (v_lista_b_conf, 'Yerbera Lona Impermeable', v_producto_ids[24], 6500, 3);

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

  -- Producto 30: cada ~7 días
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal)
  SELECT v_user_id, v_producto_ids[30], v_fecha_base + (i * 7), 1, 35000, 'instagram'
  FROM generate_series(0, 12) AS i;

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
    (v_user_id, 'alerta_aumento', 5);

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
