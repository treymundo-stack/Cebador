/*
# Cebador - Esquema inicial de base de datos

## Descripción
Crea las 9 tablas del PRD de Cebador (asistente de compras de Impulse Space):
productos, ventas, proveedores, listas_precios, items_lista, fechas_comerciales,
parametros, compras, items_compra. Incluye RLS en todas las tablas, grants para
el rol authenticated, la vista calculada stock_inversion y un bucket privado de
Storage para archivos de listas de precios.

## Tablas nuevas
- productos: catálogo de productos (nombre, categoría, precio, stock, grabable, tendencia, activo)
- ventas: historial de ventas (producto, fecha, cantidad, precio, canal)
- proveedores: proveedores (nombre, contacto, días entrega, activo)
- listas_precios: listas de proveedores (proveedor, fecha, archivo, estado)
- items_lista: renglones de listas (descripción original, producto asociado, costo, mínimo)
- fechas_comerciales: fechas de regalo (nombre, fecha, prioridad)
- parametros: umbrales y plazos configurables (clave, valor)
- compras: compras sugeridas/realizadas (fecha, presupuesto, objetivo, tipo, estado)
- items_compra: renglones de compra (producto, proveedor, cantidad, costo, precio, explicación)

## Vista
- stock_inversion: por cada producto activo devuelve costo vigente más bajo, proveedor,
  margen, rotación, días desde última venta y plata invertida (sin clasificación automática).

## Seguridad
- RLS activado en todas las tablas.
- Grants CRUD a authenticated (app con login, single-user).
- Políticas con auth.uid() para que la dueña solo acceda a sus propios registros.
- Bucket privado 'listas-precios' para archivos subidos.

## Notas
- Esta es una app single-user (la dueña). user_id por tabla aisla datos por usuario.
- user_id tiene DEFAULT auth.uid() para que los inserts del frontend funcionen.
- La vista stock_inversion no incluye clasificación automática (postergada a etapa IA).
- Las edge functions y la integración con Claude quedan postergadas.
*/

-- ===========================================================================
-- TABLAS BASE
-- ===========================================================================

CREATE TABLE IF NOT EXISTS productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  categoria text NOT NULL DEFAULT 'Otros',
  precio_venta numeric(12,2) NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
  stock_actual integer NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  grabable boolean NOT NULL DEFAULT false,
  tendencia text NOT NULL DEFAULT 'estable' CHECK (tendencia IN ('en_alza','estable','en_baja')),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  cantidad integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario numeric(12,2) NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0),
  canal text NOT NULL DEFAULT 'instagram' CHECK (canal IN ('instagram','tienda_nube','otro')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  contacto text,
  dias_entrega integer NOT NULL DEFAULT 7 CHECK (dias_entrega >= 0),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listas_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  proveedor_id uuid NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  archivo_url text,
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','confirmada','archivada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items_lista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id uuid NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE,
  descripcion_original text NOT NULL,
  producto_id uuid REFERENCES productos(id) ON DELETE SET NULL,
  costo numeric(12,2) NOT NULL DEFAULT 0 CHECK (costo >= 0),
  minimo_compra integer NOT NULL DEFAULT 1 CHECK (minimo_compra >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fechas_comerciales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  fecha date NOT NULL,
  prioridad text NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parametros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  clave text NOT NULL,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, clave)
);

CREATE TABLE IF NOT EXISTS compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha timestamptz NOT NULL DEFAULT now(),
  presupuesto numeric(12,2) NOT NULL DEFAULT 0 CHECK (presupuesto >= 0),
  objetivo text,
  fecha_objetivo date,
  tipo text NOT NULL DEFAULT 'conservadora' CHECK (tipo IN ('conservadora','arriesgada')),
  estado text NOT NULL DEFAULT 'sugerida' CHECK (estado IN ('sugerida','realizada','descartada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  proveedor_id uuid NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  cantidad integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  costo_unitario numeric(12,2) NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
  precio_venta numeric(12,2) NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
  explicacion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- ÍNDICES
-- ===========================================================================
CREATE INDEX IF NOT EXISTS idx_productos_user ON productos(user_id);
CREATE INDEX IF NOT EXISTS idx_ventas_producto ON ventas(producto_id);
CREATE INDEX IF NOT EXISTS idx_ventas_user_fecha ON ventas(user_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_proveedores_user ON proveedores(user_id);
CREATE INDEX IF NOT EXISTS idx_listas_proveedor ON listas_precios(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_listas_user_estado ON listas_precios(user_id, estado);
CREATE INDEX IF NOT EXISTS idx_items_lista_lista ON items_lista(lista_id);
CREATE INDEX IF NOT EXISTS idx_items_lista_producto ON items_lista(producto_id);
CREATE INDEX IF NOT EXISTS idx_fechas_user ON fechas_comerciales(user_id);
CREATE INDEX IF NOT EXISTS idx_parametros_user ON parametros(user_id);
CREATE INDEX IF NOT EXISTS idx_compras_user ON compras(user_id);
CREATE INDEX IF NOT EXISTS idx_items_compra_compra ON items_compra(compra_id);

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE listas_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_lista ENABLE ROW LEVEL SECURITY;
ALTER TABLE fechas_comerciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametros ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_compra ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- GRANTS (solo authenticated: app con login)
-- ===========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON productos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ventas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON proveedores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON listas_precios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON items_lista TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fechas_comerciales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON parametros TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON compras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON items_compra TO authenticated;

-- ===========================================================================
-- POLÍTICAS RLS (tablas con user_id directo)
-- ===========================================================================

-- productos
DROP POLICY IF EXISTS "select_own_productos" ON productos;
CREATE POLICY "select_own_productos" ON productos FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_productos" ON productos;
CREATE POLICY "insert_own_productos" ON productos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_productos" ON productos;
CREATE POLICY "update_own_productos" ON productos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_productos" ON productos;
CREATE POLICY "delete_own_productos" ON productos FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ventas
DROP POLICY IF EXISTS "select_own_ventas" ON ventas;
CREATE POLICY "select_own_ventas" ON ventas FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ventas" ON ventas;
CREATE POLICY "insert_own_ventas" ON ventas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ventas" ON ventas;
CREATE POLICY "update_own_ventas" ON ventas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ventas" ON ventas;
CREATE POLICY "delete_own_ventas" ON ventas FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- proveedores
DROP POLICY IF EXISTS "select_own_proveedores" ON proveedores;
CREATE POLICY "select_own_proveedores" ON proveedores FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_proveedores" ON proveedores;
CREATE POLICY "insert_own_proveedores" ON proveedores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_proveedores" ON proveedores;
CREATE POLICY "update_own_proveedores" ON proveedores FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_proveedores" ON proveedores;
CREATE POLICY "delete_own_proveedores" ON proveedores FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- listas_precios
DROP POLICY IF EXISTS "select_own_listas" ON listas_precios;
CREATE POLICY "select_own_listas" ON listas_precios FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_listas" ON listas_precios;
CREATE POLICY "insert_own_listas" ON listas_precios FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_listas" ON listas_precios;
CREATE POLICY "update_own_listas" ON listas_precios FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_listas" ON listas_precios;
CREATE POLICY "delete_own_listas" ON listas_precios FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- fechas_comerciales
DROP POLICY IF EXISTS "select_own_fechas" ON fechas_comerciales;
CREATE POLICY "select_own_fechas" ON fechas_comerciales FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_fechas" ON fechas_comerciales;
CREATE POLICY "insert_own_fechas" ON fechas_comerciales FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_fechas" ON fechas_comerciales;
CREATE POLICY "update_own_fechas" ON fechas_comerciales FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_fechas" ON fechas_comerciales;
CREATE POLICY "delete_own_fechas" ON fechas_comerciales FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- parametros
DROP POLICY IF EXISTS "select_own_parametros" ON parametros;
CREATE POLICY "select_own_parametros" ON parametros FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_parametros" ON parametros;
CREATE POLICY "insert_own_parametros" ON parametros FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_parametros" ON parametros;
CREATE POLICY "update_own_parametros" ON parametros FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_parametros" ON parametros;
CREATE POLICY "delete_own_parametros" ON parametros FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- compras
DROP POLICY IF EXISTS "select_own_compras" ON compras;
CREATE POLICY "select_own_compras" ON compras FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_compras" ON compras;
CREATE POLICY "insert_own_compras" ON compras FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_compras" ON compras;
CREATE POLICY "update_own_compras" ON compras FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_compras" ON compras;
CREATE POLICY "delete_own_compras" ON compras FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===========================================================================
-- POLÍTICAS RLS (tablas hijas: acceso vía join a tabla padre con user_id)
-- items_lista -> listas_precios
-- items_compra -> compras
-- ===========================================================================

-- items_lista
DROP POLICY IF EXISTS "select_own_items_lista" ON items_lista;
CREATE POLICY "select_own_items_lista" ON items_lista FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM listas_precios lp WHERE lp.id = items_lista.lista_id AND lp.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_items_lista" ON items_lista;
CREATE POLICY "insert_own_items_lista" ON items_lista FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM listas_precios lp WHERE lp.id = items_lista.lista_id AND lp.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_items_lista" ON items_lista;
CREATE POLICY "update_own_items_lista" ON items_lista FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM listas_precios lp WHERE lp.id = items_lista.lista_id AND lp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM listas_precios lp WHERE lp.id = items_lista.lista_id AND lp.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_items_lista" ON items_lista;
CREATE POLICY "delete_own_items_lista" ON items_lista FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM listas_precios lp WHERE lp.id = items_lista.lista_id AND lp.user_id = auth.uid()));

-- items_compra
DROP POLICY IF EXISTS "select_own_items_compra" ON items_compra;
CREATE POLICY "select_own_items_compra" ON items_compra FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM compras c WHERE c.id = items_compra.compra_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_items_compra" ON items_compra;
CREATE POLICY "insert_own_items_compra" ON items_compra FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM compras c WHERE c.id = items_compra.compra_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_items_compra" ON items_compra;
CREATE POLICY "update_own_items_compra" ON items_compra FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM compras c WHERE c.id = items_compra.compra_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM compras c WHERE c.id = items_compra.compra_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_items_compra" ON items_compra;
CREATE POLICY "delete_own_items_compra" ON items_compra FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM compras c WHERE c.id = items_compra.compra_id AND c.user_id = auth.uid()));

-- ===========================================================================
-- VISTA CALCULADA stock_inversion
-- Por cada producto activo: costo vigente más bajo, proveedor, margen,
-- rotación (días promedio entre ventas en últimos 90 días), días desde
-- última venta y plata invertida en stock. Sin clasificación automática.
-- ===========================================================================

CREATE OR REPLACE VIEW stock_inversion AS
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
  CASE
    WHEN p.precio_venta > 0 AND costo.costo_vigente IS NOT NULL
      THEN round(((p.precio_venta - costo.costo_vigente) / p.precio_venta * 100)::numeric, 1)
    ELSE NULL
  END AS margen,
  rot.rotacion_dias,
  rot.dias_desde_ultima_venta,
  round((p.stock_actual * COALESCE(costo.costo_vigente, 0))::numeric, 2) AS plata_invertida
FROM productos p
LEFT JOIN LATERAL (
  SELECT il.costo AS costo_vigente, il.producto_id, prov.id AS proveedor_id, prov.nombre AS proveedor_nombre
  FROM items_lista il
  JOIN listas_precios lp ON lp.id = il.lista_id
  JOIN proveedores prov ON prov.id = lp.proveedor_id
  WHERE il.producto_id = p.id
    AND lp.estado = 'confirmada'
    AND prov.user_id = p.user_id
  ORDER BY il.costo ASC
  LIMIT 1
) costo ON true
LEFT JOIN LATERAL (
  SELECT
    CASE
      WHEN count(*) = 0 THEN NULL
      WHEN count(*) = 1 THEN 90
      ELSE round((90.0 / sum(v.cantidad))::numeric, 1)
    END AS rotacion_dias,
    COALESCE(CURRENT_DATE - max(v.fecha), NULL) AS dias_desde_ultima_venta
  FROM ventas v
  WHERE v.producto_id = p.id
    AND v.fecha >= CURRENT_DATE - 90
) rot ON true
WHERE p.activo = true;

-- La vista usa security_invoker para respetar RLS de las tablas subyacentes
ALTER VIEW stock_inversion SET (security_invoker = true);

GRANT SELECT ON stock_inversion TO authenticated;

-- ===========================================================================
-- STORAGE: bucket privado para listas de precios
-- ===========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('listas-precios', 'listas-precios', false)
ON CONFLICT (id) DO NOTHING;

-- Política: solo el dueño del archivo (carpeta = user_id) puede acceder
DROP POLICY IF EXISTS "auth_access_own_listas" ON storage.objects;
CREATE POLICY "auth_access_own_listas" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'listas-precios' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "auth_insert_own_listas" ON storage.objects;
CREATE POLICY "auth_insert_own_listas" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listas-precios' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "auth_update_own_listas" ON storage.objects;
CREATE POLICY "auth_update_own_listas" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'listas-precios' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'listas-precios' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "auth_delete_own_listas" ON storage.objects;
CREATE POLICY "auth_delete_own_listas" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'listas-precios' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ===========================================================================
-- TRIGGER updated_at
-- ===========================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS productos_updated_at ON productos;
CREATE TRIGGER productos_updated_at BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS proveedores_updated_at ON proveedores;
CREATE TRIGGER proveedores_updated_at BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS listas_precios_updated_at ON listas_precios;
CREATE TRIGGER listas_precios_updated_at BEFORE UPDATE ON listas_precios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS parametros_updated_at ON parametros;
CREATE TRIGGER parametros_updated_at BEFORE UPDATE ON parametros
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS compras_updated_at ON compras;
CREATE TRIGGER compras_updated_at BEFORE UPDATE ON compras
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
