/*
# Cebador - Tope por producto (R8) y datos ficticios realistas

ARCHIVO GENERADO por scripts/generar-seed.ts a partir de src/lib/datosFicticios.ts.
No lo edites a mano: cambiá los datos, corré npm test y regeneralo.

1. Parámetro tope_por_producto = 25 (%) para los usuarios que ya tienen parámetros.
2. seed_datos_ficticios(): datos de un emprendimiento chico de mates (todo ficticio):
   - 29 productos, 2 proveedores, 3 listas (2 confirmadas, 1 borrador).
   - 159 ventas en 90 días: entre 1 y 3 por día en total.
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
  v_prov_A uuid;
  v_prov_B uuid;
  v_p_camionero_alg uuid;
  v_p_imperial_premium uuid;
  v_p_bombilla_recta uuid;
  v_p_bombilla_alpaca uuid;
  v_p_golondrina_alg uuid;
  v_p_yerbera_lona uuid;
  v_p_termo_500 uuid;
  v_p_mate_pintado uuid;
  v_p_imperial_forrado uuid;
  v_p_quebracho uuid;
  v_p_torpedo_forrado uuid;
  v_p_bombilla_pico_acero uuid;
  v_p_matera_simple uuid;
  v_p_matera_lona uuid;
  v_p_yerbera_trenzado uuid;
  v_p_termo_1l uuid;
  v_p_mate_acero uuid;
  v_p_yerbera_madera uuid;
  v_p_torpedo_ceramica uuid;
  v_p_matera_trenzada uuid;
  v_p_bombilla_floral uuid;
  v_p_golondrina_cal uuid;
  v_p_kit_imperial uuid;
  v_p_bombilla_bronce uuid;
  v_p_matera_termo uuid;
  v_p_imperial_chico uuid;
  v_p_yerbera_simple uuid;
  v_p_matera_madera uuid;
  v_p_set_regalo uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuario autenticado';
  END IF;

  SELECT count(*) INTO v_count FROM productos WHERE user_id = v_user_id;
  IF v_count > 0 THEN
    RETURN jsonb_build_object('status', 'skipped', 'message', 'El usuario ya tiene datos');
  END IF;

  -- Productos
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Mate Camionero Algarrobo', 'Mates', 38000, 2, true, 'estable', true)
  RETURNING id INTO v_p_camionero_alg;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Mate Imperial Calabaza Premium', 'Mates', 95000, 1, true, 'estable', true)
  RETURNING id INTO v_p_imperial_premium;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Bombilla Acero Inoxidable Recta', 'Bombillas', 8000, 3, false, 'estable', true)
  RETURNING id INTO v_p_bombilla_recta;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Bombilla Alpaca Pico de Loro', 'Bombillas', 15000, 2, false, 'estable', true)
  RETURNING id INTO v_p_bombilla_alpaca;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Mate Golondrina Algarrobo', 'Mates', 22000, 1, false, 'estable', true)
  RETURNING id INTO v_p_golondrina_alg;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Yerbera Lona Impermeable', 'Yerberas', 12000, 2, false, 'estable', true)
  RETURNING id INTO v_p_yerbera_lona;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Termo Acero 500ml Compacto', 'Termos', 35000, 0, false, 'en_alza', true)
  RETURNING id INTO v_p_termo_500;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Mate Calabaza Pintado a Mano', 'Mates', 40000, 1, false, 'en_alza', true)
  RETURNING id INTO v_p_mate_pintado;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Mate Imperial Forrado en Cuero', 'Mates', 72000, 1, true, 'estable', true)
  RETURNING id INTO v_p_imperial_forrado;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Mate Camionero Quebracho', 'Mates', 35000, 2, true, 'estable', true)
  RETURNING id INTO v_p_quebracho;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Mate Torpedo Forrado Cuero', 'Mates', 32000, 1, false, 'estable', true)
  RETURNING id INTO v_p_torpedo_forrado;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Bombilla Acero Pico de Loro', 'Bombillas', 12000, 3, false, 'estable', true)
  RETURNING id INTO v_p_bombilla_pico_acero;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Matera Cuero Simple', 'Materas', 45000, 1, false, 'estable', true)
  RETURNING id INTO v_p_matera_simple;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Matera Lona Impermeable', 'Materas', 30000, 2, false, 'estable', true)
  RETURNING id INTO v_p_matera_lona;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Yerbera Cuero Trenzado', 'Yerberas', 18000, 2, false, 'estable', true)
  RETURNING id INTO v_p_yerbera_trenzado;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Termo Acero 1L Mateador', 'Termos', 55000, 2, false, 'estable', true)
  RETURNING id INTO v_p_termo_1l;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Mate Acero Inoxidable', 'Mates', 30000, 2, false, 'en_baja', true)
  RETURNING id INTO v_p_mate_acero;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Yerbera Madera Algarrobo', 'Yerberas', 22000, 1, false, 'estable', true)
  RETURNING id INTO v_p_yerbera_madera;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Mate Torpedo Cerámica Negra', 'Mates', 25000, 3, false, 'estable', true)
  RETURNING id INTO v_p_torpedo_ceramica;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Matera Cuero Trenzado Grande', 'Materas', 65000, 1, false, 'estable', true)
  RETURNING id INTO v_p_matera_trenzada;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Bombilla Alpaca Floral Grabada', 'Bombillas', 20000, 2, true, 'estable', true)
  RETURNING id INTO v_p_bombilla_floral;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Mate Golondrina Calabaza', 'Mates', 18000, 2, false, 'estable', true)
  RETURNING id INTO v_p_golondrina_cal;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Kit Mate Completo Imperial', 'Kits', 120000, 1, false, 'estable', true)
  RETURNING id INTO v_p_kit_imperial;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Bombilla Bronce Antigua', 'Bombillas', 28000, 3, false, 'estable', true)
  RETURNING id INTO v_p_bombilla_bronce;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Matera Cuero con Termo', 'Materas', 85000, 1, false, 'estable', true)
  RETURNING id INTO v_p_matera_termo;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Mate Imperial Chico', 'Mates', 55000, 2, false, 'estable', true)
  RETURNING id INTO v_p_imperial_chico;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Yerbera Cuero Simple', 'Yerberas', 15000, 3, false, 'estable', true)
  RETURNING id INTO v_p_yerbera_simple;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Matera Madera Algarrobo', 'Materas', 52000, 2, false, 'estable', true)
  RETURNING id INTO v_p_matera_madera;
  INSERT INTO productos (user_id, nombre, categoria, precio_venta, stock_actual, grabable, tendencia, activo)
  VALUES (v_user_id, 'Set Matero de Regalo', 'Kits', 60000, 2, false, 'estable', true)
  RETURNING id INTO v_p_set_regalo;

  -- Proveedores
  INSERT INTO proveedores (user_id, nombre, contacto, dias_entrega, activo)
  VALUES (v_user_id, 'Proveedor A', 'WhatsApp 11-0000-0001 (ficticio)', 7, true)
  RETURNING id INTO v_prov_A;
  INSERT INTO proveedores (user_id, nombre, contacto, dias_entrega, activo)
  VALUES (v_user_id, 'Proveedor B', 'Instagram @proveedor_b_ficticio', 5, true)
  RETURNING id INTO v_prov_B;

  -- Listas de precios
  INSERT INTO listas_precios (user_id, proveedor_id, fecha, estado)
  VALUES (v_user_id, v_prov_A, CURRENT_DATE - 20, 'confirmada')
  RETURNING id INTO v_lista;
  INSERT INTO items_lista (lista_id, descripcion_original, producto_id, costo, minimo_compra) VALUES
    (v_lista, 'Imperial calabaza premium virola alpaca', v_p_imperial_premium, 57000, 1),
    (v_lista, 'Camionero algarrobo', v_p_camionero_alg, 22000, 2),
    (v_lista, 'Bombilla inox recta', v_p_bombilla_recta, 4500, 3),
    (v_lista, 'Bombilla alpaca pico loro', v_p_bombilla_alpaca, 8500, 2),
    (v_lista, 'Golondrina algarrobo', v_p_golondrina_alg, 12000, 2),
    (v_lista, 'Yerbera lona', v_p_yerbera_lona, 7000, 3),
    (v_lista, 'Camionero quebracho', v_p_quebracho, 24000, 2),
    (v_lista, 'Torpedo forrado cuero', v_p_torpedo_forrado, 19000, 1),
    (v_lista, 'Termo acero 1 litro', v_p_termo_1l, 36000, 1),
    (v_lista, 'Yerbera madera algarrobo', v_p_yerbera_madera, 14500, 2),
    (v_lista, 'Kit imperial completo', v_p_kit_imperial, 88000, 1),
    (v_lista, 'Mate calabaza pintado a mano', v_p_mate_pintado, 22000, 2),
    (v_lista, 'Bombilla bronce antigua', v_p_bombilla_bronce, 15000, 2),
    (v_lista, 'Matera cuero c/ termo', v_p_matera_termo, 50000, 1),
    (v_lista, 'Matera madera algarrobo', v_p_matera_madera, 30000, 1);
  INSERT INTO listas_precios (user_id, proveedor_id, fecha, estado)
  VALUES (v_user_id, v_prov_B, CURRENT_DATE - 15, 'confirmada')
  RETURNING id INTO v_lista;
  INSERT INTO items_lista (lista_id, descripcion_original, producto_id, costo, minimo_compra) VALUES
    (v_lista, 'Mate camionero algarrobo', v_p_camionero_alg, 19000, 2),
    (v_lista, 'Mate imperial calabaza', v_p_imperial_premium, 53000, 1),
    (v_lista, 'Bombilla acero inox recta', v_p_bombilla_recta, 4200, 3),
    (v_lista, 'Bombilla alpaca pico de loro', v_p_bombilla_alpaca, 7800, 2),
    (v_lista, 'Golondrina algarrobo', v_p_golondrina_alg, 10000, 2),
    (v_lista, 'Yerbera lona impermeable', v_p_yerbera_lona, 6500, 3),
    (v_lista, 'Mate imperial forrado cuero', v_p_imperial_forrado, 46000, 1),
    (v_lista, 'Mate camionero quebracho', v_p_quebracho, 23000, 2),
    (v_lista, 'Bombilla acero pico de loro', v_p_bombilla_pico_acero, 7800, 2),
    (v_lista, 'Matera cuero simple', v_p_matera_simple, 28000, 1),
    (v_lista, 'Matera lona impermeable', v_p_matera_lona, 19000, 2),
    (v_lista, 'Yerbera cuero trenzado', v_p_yerbera_trenzado, 11500, 2),
    (v_lista, 'Mate acero inoxidable', v_p_mate_acero, 16000, 1),
    (v_lista, 'Mate torpedo cerámica negra', v_p_torpedo_ceramica, 19000, 2),
    (v_lista, 'Matera trenzada grande', v_p_matera_trenzada, 48000, 1),
    (v_lista, 'Bombilla alpaca floral grabada', v_p_bombilla_floral, 15000, 1),
    (v_lista, 'Golondrina calabaza', v_p_golondrina_cal, 13500, 3),
    (v_lista, 'Mate imperial chico', v_p_imperial_chico, 33000, 1),
    (v_lista, 'Yerbera cuero simple', v_p_yerbera_simple, 8500, 2),
    (v_lista, 'Termo acero 500ml', v_p_termo_500, 19000, 1);
  INSERT INTO listas_precios (user_id, proveedor_id, fecha, estado)
  VALUES (v_user_id, v_prov_A, CURRENT_DATE, 'borrador')
  RETURNING id INTO v_lista;
  INSERT INTO items_lista (lista_id, descripcion_original, producto_id, costo, minimo_compra) VALUES
    (v_lista, 'Imperial calabaza premium virola alpaca', v_p_imperial_premium, 60000, 1),
    (v_lista, 'Camionero algarrobo', v_p_camionero_alg, 24000, 2),
    (v_lista, 'Bombilla alpaca pico loro', v_p_bombilla_alpaca, 10000, 2);

  -- Ventas (159 en 90 días, entre 1 y 3 por día)
  INSERT INTO ventas (user_id, producto_id, fecha, cantidad, precio_unitario, canal) VALUES
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 89, 1, 38000, 'tienda_nube'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 89, 2, 8000, 'instagram'),
    (v_user_id, v_p_bombilla_alpaca, CURRENT_DATE - 89, 1, 15000, 'instagram'),
    (v_user_id, v_p_golondrina_alg, CURRENT_DATE - 88, 1, 22000, 'instagram'),
    (v_user_id, v_p_yerbera_lona, CURRENT_DATE - 88, 1, 12000, 'tienda_nube'),
    (v_user_id, v_p_mate_acero, CURRENT_DATE - 87, 1, 30000, 'instagram'),
    (v_user_id, v_p_imperial_premium, CURRENT_DATE - 87, 1, 95000, 'instagram'),
    (v_user_id, v_p_quebracho, CURRENT_DATE - 86, 1, 35000, 'instagram'),
    (v_user_id, v_p_bombilla_pico_acero, CURRENT_DATE - 86, 1, 12000, 'tienda_nube'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 86, 1, 38000, 'otro'),
    (v_user_id, v_p_imperial_chico, CURRENT_DATE - 85, 1, 55000, 'instagram'),
    (v_user_id, v_p_imperial_forrado, CURRENT_DATE - 84, 1, 72000, 'instagram'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 83, 1, 8000, 'instagram'),
    (v_user_id, v_p_matera_lona, CURRENT_DATE - 82, 1, 30000, 'tienda_nube'),
    (v_user_id, v_p_yerbera_trenzado, CURRENT_DATE - 81, 1, 18000, 'instagram'),
    (v_user_id, v_p_matera_madera, CURRENT_DATE - 80, 1, 52000, 'instagram'),
    (v_user_id, v_p_torpedo_ceramica, CURRENT_DATE - 80, 1, 25000, 'instagram'),
    (v_user_id, v_p_golondrina_cal, CURRENT_DATE - 79, 1, 18000, 'instagram'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 79, 1, 38000, 'tienda_nube'),
    (v_user_id, v_p_bombilla_alpaca, CURRENT_DATE - 78, 1, 15000, 'instagram'),
    (v_user_id, v_p_torpedo_forrado, CURRENT_DATE - 78, 1, 32000, 'otro'),
    (v_user_id, v_p_matera_simple, CURRENT_DATE - 77, 1, 45000, 'instagram'),
    (v_user_id, v_p_termo_1l, CURRENT_DATE - 77, 1, 55000, 'tienda_nube'),
    (v_user_id, v_p_bombilla_floral, CURRENT_DATE - 77, 1, 20000, 'instagram'),
    (v_user_id, v_p_golondrina_alg, CURRENT_DATE - 76, 1, 22000, 'instagram'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 76, 1, 8000, 'instagram'),
    (v_user_id, v_p_bombilla_bronce, CURRENT_DATE - 75, 1, 28000, 'instagram'),
    (v_user_id, v_p_yerbera_lona, CURRENT_DATE - 74, 1, 12000, 'tienda_nube'),
    (v_user_id, v_p_mate_acero, CURRENT_DATE - 74, 1, 30000, 'instagram'),
    (v_user_id, v_p_yerbera_madera, CURRENT_DATE - 74, 1, 22000, 'instagram'),
    (v_user_id, v_p_matera_trenzada, CURRENT_DATE - 73, 1, 65000, 'otro'),
    (v_user_id, v_p_kit_imperial, CURRENT_DATE - 73, 1, 120000, 'tienda_nube'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 72, 1, 38000, 'instagram'),
    (v_user_id, v_p_imperial_premium, CURRENT_DATE - 71, 1, 95000, 'instagram'),
    (v_user_id, v_p_quebracho, CURRENT_DATE - 71, 1, 35000, 'instagram'),
    (v_user_id, v_p_bombilla_alpaca, CURRENT_DATE - 71, 1, 15000, 'tienda_nube'),
    (v_user_id, v_p_matera_termo, CURRENT_DATE - 70, 1, 85000, 'instagram'),
    (v_user_id, v_p_bombilla_pico_acero, CURRENT_DATE - 70, 1, 12000, 'instagram'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 69, 2, 8000, 'instagram'),
    (v_user_id, v_p_imperial_chico, CURRENT_DATE - 68, 1, 55000, 'instagram'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 67, 1, 38000, 'instagram'),
    (v_user_id, v_p_golondrina_alg, CURRENT_DATE - 67, 1, 22000, 'tienda_nube'),
    (v_user_id, v_p_imperial_forrado, CURRENT_DATE - 66, 1, 72000, 'instagram'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 66, 1, 38000, 'instagram'),
    (v_user_id, v_p_yerbera_lona, CURRENT_DATE - 65, 1, 12000, 'instagram'),
    (v_user_id, v_p_yerbera_simple, CURRENT_DATE - 64, 1, 15000, 'instagram'),
    (v_user_id, v_p_mate_acero, CURRENT_DATE - 63, 1, 30000, 'tienda_nube'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 62, 1, 8000, 'instagram'),
    (v_user_id, v_p_bombilla_alpaca, CURRENT_DATE - 62, 1, 15000, 'instagram'),
    (v_user_id, v_p_matera_lona, CURRENT_DATE - 61, 1, 30000, 'instagram'),
    (v_user_id, v_p_yerbera_trenzado, CURRENT_DATE - 61, 1, 18000, 'tienda_nube'),
    (v_user_id, v_p_torpedo_ceramica, CURRENT_DATE - 61, 1, 25000, 'otro'),
    (v_user_id, v_p_golondrina_cal, CURRENT_DATE - 60, 1, 18000, 'instagram'),
    (v_user_id, v_p_imperial_premium, CURRENT_DATE - 59, 1, 95000, 'instagram'),
    (v_user_id, v_p_quebracho, CURRENT_DATE - 59, 1, 35000, 'tienda_nube'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 58, 1, 38000, 'instagram'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 57, 1, 8000, 'instagram'),
    (v_user_id, v_p_golondrina_alg, CURRENT_DATE - 57, 1, 22000, 'instagram'),
    (v_user_id, v_p_bombilla_pico_acero, CURRENT_DATE - 56, 1, 12000, 'tienda_nube'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 56, 1, 38000, 'instagram'),
    (v_user_id, v_p_bombilla_alpaca, CURRENT_DATE - 55, 1, 15000, 'otro'),
    (v_user_id, v_p_torpedo_forrado, CURRENT_DATE - 55, 1, 32000, 'instagram'),
    (v_user_id, v_p_matera_simple, CURRENT_DATE - 55, 1, 45000, 'tienda_nube'),
    (v_user_id, v_p_termo_1l, CURRENT_DATE - 54, 1, 55000, 'instagram'),
    (v_user_id, v_p_bombilla_floral, CURRENT_DATE - 54, 1, 20000, 'instagram'),
    (v_user_id, v_p_yerbera_lona, CURRENT_DATE - 54, 1, 12000, 'instagram'),
    (v_user_id, v_p_mate_acero, CURRENT_DATE - 53, 1, 30000, 'tienda_nube'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 52, 2, 8000, 'instagram'),
    (v_user_id, v_p_imperial_forrado, CURRENT_DATE - 51, 1, 72000, 'instagram'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 50, 1, 38000, 'otro'),
    (v_user_id, v_p_imperial_premium, CURRENT_DATE - 50, 1, 95000, 'tienda_nube'),
    (v_user_id, v_p_quebracho, CURRENT_DATE - 50, 1, 35000, 'instagram'),
    (v_user_id, v_p_golondrina_alg, CURRENT_DATE - 49, 1, 22000, 'instagram'),
    (v_user_id, v_p_bombilla_alpaca, CURRENT_DATE - 49, 1, 15000, 'instagram'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 48, 1, 8000, 'tienda_nube'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 48, 1, 38000, 'instagram'),
    (v_user_id, v_p_yerbera_lona, CURRENT_DATE - 48, 1, 12000, 'instagram'),
    (v_user_id, v_p_bombilla_pico_acero, CURRENT_DATE - 47, 1, 12000, 'instagram'),
    (v_user_id, v_p_matera_lona, CURRENT_DATE - 47, 1, 30000, 'tienda_nube'),
    (v_user_id, v_p_yerbera_trenzado, CURRENT_DATE - 46, 1, 18000, 'instagram'),
    (v_user_id, v_p_mate_acero, CURRENT_DATE - 45, 1, 30000, 'instagram'),
    (v_user_id, v_p_yerbera_madera, CURRENT_DATE - 45, 1, 22000, 'instagram'),
    (v_user_id, v_p_torpedo_ceramica, CURRENT_DATE - 44, 1, 25000, 'tienda_nube'),
    (v_user_id, v_p_matera_trenzada, CURRENT_DATE - 44, 1, 65000, 'instagram'),
    (v_user_id, v_p_golondrina_cal, CURRENT_DATE - 43, 1, 18000, 'instagram'),
    (v_user_id, v_p_kit_imperial, CURRENT_DATE - 42, 1, 120000, 'instagram'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 42, 1, 38000, 'tienda_nube'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 41, 1, 8000, 'otro'),
    (v_user_id, v_p_set_regalo, CURRENT_DATE - 40, 1, 60000, 'instagram'),
    (v_user_id, v_p_bombilla_alpaca, CURRENT_DATE - 40, 1, 15000, 'instagram'),
    (v_user_id, v_p_golondrina_alg, CURRENT_DATE - 39, 1, 22000, 'instagram'),
    (v_user_id, v_p_imperial_premium, CURRENT_DATE - 39, 1, 95000, 'tienda_nube'),
    (v_user_id, v_p_quebracho, CURRENT_DATE - 39, 1, 35000, 'instagram'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 38, 1, 38000, 'instagram'),
    (v_user_id, v_p_imperial_forrado, CURRENT_DATE - 38, 1, 72000, 'instagram'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 37, 2, 8000, 'tienda_nube'),
    (v_user_id, v_p_yerbera_lona, CURRENT_DATE - 37, 1, 12000, 'instagram'),
    (v_user_id, v_p_mate_acero, CURRENT_DATE - 37, 1, 30000, 'otro'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 36, 1, 38000, 'instagram'),
    (v_user_id, v_p_bombilla_alpaca, CURRENT_DATE - 36, 1, 15000, 'tienda_nube'),
    (v_user_id, v_p_torpedo_forrado, CURRENT_DATE - 35, 1, 32000, 'instagram'),
    (v_user_id, v_p_matera_simple, CURRENT_DATE - 35, 1, 45000, 'instagram'),
    (v_user_id, v_p_termo_1l, CURRENT_DATE - 34, 1, 55000, 'instagram'),
    (v_user_id, v_p_bombilla_floral, CURRENT_DATE - 34, 1, 20000, 'tienda_nube'),
    (v_user_id, v_p_bombilla_pico_acero, CURRENT_DATE - 34, 1, 12000, 'instagram'),
    (v_user_id, v_p_golondrina_alg, CURRENT_DATE - 33, 1, 22000, 'instagram'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 33, 1, 8000, 'otro'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 32, 1, 38000, 'tienda_nube'),
    (v_user_id, v_p_imperial_premium, CURRENT_DATE - 31, 1, 95000, 'instagram'),
    (v_user_id, v_p_quebracho, CURRENT_DATE - 31, 1, 35000, 'instagram'),
    (v_user_id, v_p_matera_lona, CURRENT_DATE - 31, 1, 30000, 'instagram'),
    (v_user_id, v_p_yerbera_trenzado, CURRENT_DATE - 30, 1, 18000, 'tienda_nube'),
    (v_user_id, v_p_torpedo_ceramica, CURRENT_DATE - 30, 1, 25000, 'instagram'),
    (v_user_id, v_p_golondrina_cal, CURRENT_DATE - 29, 1, 18000, 'instagram'),
    (v_user_id, v_p_bombilla_alpaca, CURRENT_DATE - 28, 1, 15000, 'instagram'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 28, 1, 8000, 'tienda_nube'),
    (v_user_id, v_p_yerbera_lona, CURRENT_DATE - 27, 1, 12000, 'instagram'),
    (v_user_id, v_p_mate_acero, CURRENT_DATE - 26, 1, 30000, 'instagram'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 25, 1, 38000, 'instagram'),
    (v_user_id, v_p_golondrina_alg, CURRENT_DATE - 25, 1, 22000, 'tienda_nube'),
    (v_user_id, v_p_imperial_forrado, CURRENT_DATE - 24, 1, 72000, 'instagram'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 23, 1, 38000, 'instagram'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 22, 2, 8000, 'instagram'),
    (v_user_id, v_p_bombilla_pico_acero, CURRENT_DATE - 22, 1, 12000, 'tienda_nube'),
    (v_user_id, v_p_bombilla_alpaca, CURRENT_DATE - 22, 1, 15000, 'otro'),
    (v_user_id, v_p_imperial_premium, CURRENT_DATE - 21, 1, 95000, 'instagram'),
    (v_user_id, v_p_quebracho, CURRENT_DATE - 20, 1, 35000, 'instagram'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 20, 1, 38000, 'tienda_nube'),
    (v_user_id, v_p_yerbera_lona, CURRENT_DATE - 19, 1, 12000, 'instagram'),
    (v_user_id, v_p_mate_acero, CURRENT_DATE - 18, 1, 30000, 'instagram'),
    (v_user_id, v_p_yerbera_madera, CURRENT_DATE - 17, 1, 22000, 'instagram'),
    (v_user_id, v_p_matera_trenzada, CURRENT_DATE - 17, 1, 65000, 'tienda_nube'),
    (v_user_id, v_p_kit_imperial, CURRENT_DATE - 17, 1, 120000, 'instagram'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 16, 1, 8000, 'otro'),
    (v_user_id, v_p_golondrina_alg, CURRENT_DATE - 15, 1, 22000, 'instagram'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 14, 1, 38000, 'tienda_nube'),
    (v_user_id, v_p_bombilla_alpaca, CURRENT_DATE - 13, 1, 15000, 'instagram'),
    (v_user_id, v_p_torpedo_forrado, CURRENT_DATE - 13, 1, 32000, 'instagram'),
    (v_user_id, v_p_mate_pintado, CURRENT_DATE - 12, 1, 40000, 'instagram'),
    (v_user_id, v_p_matera_simple, CURRENT_DATE - 11, 1, 45000, 'instagram'),
    (v_user_id, v_p_termo_1l, CURRENT_DATE - 11, 1, 55000, 'tienda_nube'),
    (v_user_id, v_p_bombilla_floral, CURRENT_DATE - 11, 1, 20000, 'instagram'),
    (v_user_id, v_p_matera_lona, CURRENT_DATE - 10, 1, 30000, 'instagram'),
    (v_user_id, v_p_yerbera_trenzado, CURRENT_DATE - 10, 1, 18000, 'otro'),
    (v_user_id, v_p_torpedo_ceramica, CURRENT_DATE - 9, 1, 25000, 'tienda_nube'),
    (v_user_id, v_p_golondrina_cal, CURRENT_DATE - 8, 1, 18000, 'instagram'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE - 8, 1, 8000, 'instagram'),
    (v_user_id, v_p_imperial_forrado, CURRENT_DATE - 8, 1, 72000, 'instagram'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE - 7, 1, 38000, 'tienda_nube'),
    (v_user_id, v_p_bombilla_pico_acero, CURRENT_DATE - 7, 1, 12000, 'instagram'),
    (v_user_id, v_p_imperial_premium, CURRENT_DATE - 6, 1, 95000, 'instagram'),
    (v_user_id, v_p_set_regalo, CURRENT_DATE - 5, 1, 60000, 'instagram'),
    (v_user_id, v_p_quebracho, CURRENT_DATE - 4, 1, 35000, 'instagram'),
    (v_user_id, v_p_yerbera_lona, CURRENT_DATE - 3, 1, 12000, 'tienda_nube'),
    (v_user_id, v_p_mate_acero, CURRENT_DATE - 3, 1, 30000, 'instagram'),
    (v_user_id, v_p_golondrina_alg, CURRENT_DATE - 2, 1, 22000, 'instagram'),
    (v_user_id, v_p_bombilla_alpaca, CURRENT_DATE - 1, 1, 15000, 'instagram'),
    (v_user_id, v_p_bombilla_recta, CURRENT_DATE, 2, 8000, 'tienda_nube'),
    (v_user_id, v_p_camionero_alg, CURRENT_DATE, 1, 38000, 'instagram');

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
    (v_user_id, 'Navidad', CASE WHEN make_date(v_anio, 12, 25) < CURRENT_DATE THEN make_date(v_anio + 1, 12, 25) ELSE make_date(v_anio, 12, 25) END, 'alta'),
    (v_user_id, 'Reyes', CASE WHEN make_date(v_anio, 1, 6) < CURRENT_DATE THEN make_date(v_anio + 1, 1, 6) ELSE make_date(v_anio, 1, 6) END, 'alta'),
    (v_user_id, 'San Valentín', CASE WHEN make_date(v_anio, 2, 14) < CURRENT_DATE THEN make_date(v_anio + 1, 2, 14) ELSE make_date(v_anio, 2, 14) END, 'media'),
    (v_user_id, 'Día del Amigo', CASE WHEN make_date(v_anio, 7, 20) < CURRENT_DATE THEN make_date(v_anio + 1, 7, 20) ELSE make_date(v_anio, 7, 20) END, 'alta'),
    (v_user_id, 'Día del Maestro', CASE WHEN make_date(v_anio, 9, 11) < CURRENT_DATE THEN make_date(v_anio + 1, 9, 11) ELSE make_date(v_anio, 9, 11) END, 'media'),
    (v_user_id, 'Día de la Madre', v_madre, 'alta'),
    (v_user_id, 'Día del Padre', v_padre, 'alta');

  -- Parámetros
  INSERT INTO parametros (user_id, clave, valor) VALUES
    (v_user_id, 'margen_minimo', 30),
    (v_user_id, 'margen_reforzar', 40),
    (v_user_id, 'rotacion_reforzar_dias', 15),
    (v_user_id, 'dias_sin_venta_no_recomprar', 60),
    (v_user_id, 'dias_grabado', 12),
    (v_user_id, 'dias_envio', 3),
    (v_user_id, 'dias_venta_previa', 21),
    (v_user_id, 'tope_arriesgada', 30),
    (v_user_id, 'tope_por_producto', 25),
    (v_user_id, 'alerta_aumento', 5);

  RETURN jsonb_build_object(
    'status', 'ok',
    'productos', 29,
    'proveedores', 2,
    'listas', 3,
    'ventas', 159
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION seed_datos_ficticios() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION seed_datos_ficticios() TO authenticated;
