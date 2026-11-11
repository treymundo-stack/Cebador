import { useEffect, useState, useCallback, FormEvent } from 'react';
import {
  Plus, Pencil, Archive, Tag, ShoppingBag, FileUp,
} from 'lucide-react';
import {
  fetchProductos, createProducto, updateProducto,
  fetchVentas, createVenta,
} from '@/lib/data';
import { formatARS, formatDateShort } from '@/lib/format';
import { hoyIso } from '@/lib/reglas';
import type { Canal, Producto, Tendencia, Venta } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { FullSpinner, ErrorState, EmptyState } from '@/components/ui/Feedback';

type Tab = 'catalogo' | 'ventas' | 'importar';

const CATEGORIAS = ['Mates', 'Bombillas', 'Materas', 'Yerberas', 'Kits', 'Termos', 'Otros'];

export function ProductosScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('catalogo');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);

  // Modals
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Producto | null>(null);
  const [ventaModalOpen, setVentaModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ ok: number; errors: string[] } | null>(null);

  // Forms
  const [prodForm, setProdForm] = useState({
    nombre: '', categoria: 'Mates', precio_venta: 0, stock_actual: 0,
    grabable: false, tendencia: 'estable' as Tendencia,
  });
  const [ventaForm, setVentaForm] = useState({
    producto_id: '', fecha: hoyIso(),
    cantidad: 1, precio_unitario: 0, canal: 'instagram' as Canal,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, v] = await Promise.all([fetchProductos(), fetchVentas()]);
      setProductos(p);
      setVentas(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // === Producto CRUD ===
  const openNewProd = () => {
    setEditingProd(null);
    setProdForm({ nombre: '', categoria: 'Mates', precio_venta: 0, stock_actual: 0, grabable: false, tendencia: 'estable' });
    setFormError(null);
    setProdModalOpen(true);
  };

  const openEditProd = (p: Producto) => {
    setEditingProd(p);
    setProdForm({
      nombre: p.nombre, categoria: p.categoria, precio_venta: p.precio_venta,
      stock_actual: p.stock_actual, grabable: p.grabable, tendencia: p.tendencia,
    });
    setFormError(null);
    setProdModalOpen(true);
  };

  const saveProd = async () => {
    if (!prodForm.nombre.trim()) { setFormError('El nombre es obligatorio'); return; }
    if (prodForm.precio_venta < 0) { setFormError('El precio no puede ser negativo'); return; }
    setSaving(true);
    try {
      if (editingProd) {
        await updateProducto(editingProd.id, {
          nombre: prodForm.nombre.trim(),
          categoria: prodForm.categoria,
          precio_venta: prodForm.precio_venta,
          stock_actual: prodForm.stock_actual,
          grabable: prodForm.grabable,
          tendencia: prodForm.tendencia,
        });
      } else {
        await createProducto({
          nombre: prodForm.nombre.trim(),
          categoria: prodForm.categoria,
          precio_venta: prodForm.precio_venta,
          stock_actual: prodForm.stock_actual,
          grabable: prodForm.grabable,
          tendencia: prodForm.tendencia,
        });
      }
      setProdModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Dar de baja (activo = false): no se borra, así se conserva su historial de ventas.
  const removeProd = async (id: string) => {
    if (!confirm('¿Dar de baja este producto? Deja de aparecer, pero se conservan sus ventas.')) return;
    try {
      await updateProducto(id, { activo: false });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  // === Ventas ===
  const openNewVenta = () => {
    setVentaForm({
      producto_id: productos[0]?.id ?? '',
      fecha: hoyIso(),
      cantidad: 1,
      precio_unitario: productos[0]?.precio_venta ?? 0,
      canal: 'instagram',
    });
    setFormError(null);
    setVentaModalOpen(true);
  };

  const onProductoVentaChange = (pid: string) => {
    const prod = productos.find((p) => p.id === pid);
    setVentaForm((prev) => ({ ...prev, producto_id: pid, precio_unitario: prod?.precio_venta ?? 0 }));
  };

  const saveVenta = async () => {
    if (!ventaForm.producto_id) { setFormError('Seleccioná un producto'); return; }
    if (ventaForm.cantidad < 1) { setFormError('La cantidad debe ser mayor a 0'); return; }
    setSaving(true);
    try {
      await createVenta({
        producto_id: ventaForm.producto_id,
        fecha: ventaForm.fecha,
        cantidad: ventaForm.cantidad,
        precio_unitario: ventaForm.precio_unitario,
        canal: ventaForm.canal,
      });
      setVentaModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al registrar la venta');
    } finally {
      setSaving(false);
    }
  };

  // === CSV Import ===
  const handleCsvImport = async (e: FormEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setImportResult(null);
    setFormError(null);

    if (!file.name.endsWith('.csv')) {
      setFormError('El archivo debe ser CSV.');
      return;
    }

    try {
      const text = await file.text();
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length === 0) { setFormError('El archivo está vacío'); return; }

      // Detectar header
      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes('nombre') || firstLine.includes('producto') || firstLine.includes('fecha');
      const dataLines = hasHeader ? lines.slice(1) : lines;
      const errors: string[] = [];
      let ok = 0;

      for (let i = 0; i < dataLines.length; i++) {
        const cols = dataLines[i].split(',').map((c) => c.trim());
        const lineNum = i + (hasHeader ? 2 : 1);

        // Detectar tipo: producto o venta
        // Producto: nombre, categoria, precio_venta, stock_actual, grabable, tendencia
        // Venta: producto_nombre, fecha, cantidad, precio_unitario, canal
        if (cols.length >= 4 && !isNaN(parseFloat(cols[2])) && cols[0].toLowerCase() !== 'fecha') {
          // Intentar como producto
          const nombre = cols[0];
          const categoria = cols[1] || 'Otros';
          const precio = parseFloat(cols[2]);
          const stock = parseInt(cols[3]) || 0;
          if (!nombre || isNaN(precio)) {
            errors.push(`Línea ${lineNum}: datos inválidos`);
            continue;
          }
          const grabable = cols[4]?.toLowerCase() === 'true' || cols[4] === '1' || cols[4]?.toLowerCase() === 'si';
          const tendencia = (cols[5] as 'en_alza' | 'estable' | 'en_baja') || 'estable';
          try {
            await createProducto({
              nombre,
              categoria: CATEGORIAS.includes(categoria) ? categoria : 'Otros',
              precio_venta: precio,
              stock_actual: stock,
              grabable,
              tendencia: ['en_alza', 'estable', 'en_baja'].includes(tendencia) ? tendencia : 'estable',
            });
            ok++;
          } catch {
            errors.push(`Línea ${lineNum}: no se pudo guardar "${nombre}"`);
          }
        } else if (cols.length >= 3) {
          // Intentar como venta
          const prodNombre = cols[0];
          const fecha = cols[1];
          const cantidad = parseInt(cols[2]) || 1;
          const precio = parseFloat(cols[3]) || 0;
          const canal = (cols[4] as 'instagram' | 'tienda_nube' | 'otro') || 'instagram';

          const prod = productos.find((p) => p.nombre.toLowerCase() === prodNombre.toLowerCase());
          if (!prod) {
            errors.push(`Línea ${lineNum}: producto "${prodNombre}" no encontrado`);
            continue;
          }
          if (!fecha) {
            errors.push(`Línea ${lineNum}: falta fecha`);
            continue;
          }
          try {
            await createVenta({
              producto_id: prod.id,
              fecha,
              cantidad,
              precio_unitario: precio,
              canal: ['instagram', 'tienda_nube', 'otro'].includes(canal) ? canal : 'otro',
            });
            ok++;
          } catch {
            errors.push(`Línea ${lineNum}: no se pudo guardar la venta`);
          }
        } else {
          errors.push(`Línea ${lineNum}: formato no reconocido`);
        }
      }

      setImportResult({ ok, errors });
      if (ok > 0) await load();
    } catch {
      setFormError('No se pudo leer el archivo');
    }
  };

  if (loading) return <FullSpinner label="Cargando…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const productoNombre = (id: string) => productos.find((p) => p.id === id)?.nombre ?? '—';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium text-mate-700" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          Productos y ventas
        </h1>
        <p className="text-sm text-mate-400 mt-0.5">Catálogo, historial de ventas e importación.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-crema-200 p-1">
        {([
          { key: 'catalogo' as const, label: 'Catálogo', icon: Tag },
          { key: 'ventas' as const, label: 'Ventas', icon: ShoppingBag },
          { key: 'importar' as const, label: 'Importar', icon: FileUp },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
              tab === t.key ? 'bg-crema-50 text-mate-700 shadow-sm' : 'text-mate-400'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Catálogo */}
      {tab === 'catalogo' && (
        <div className="space-y-3">
          <button onClick={openNewProd} className="btn-primary w-full">
            <Plus size={16} /> Nuevo producto
          </button>
          {productos.length === 0 ? (
            <EmptyState title="Sin productos" description="Agregá tu primer producto al catálogo." />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-crema-200 bg-crema-50 text-left text-xs uppercase tracking-wider text-mate-400">
                      <th className="px-3 py-2.5 font-medium">Producto</th>
                      <th className="px-3 py-2.5 text-right font-medium">Precio</th>
                      <th className="px-3 py-2.5 text-center font-medium">Stock</th>
                      <th className="px-3 py-2.5 text-center font-medium">Grab.</th>
                      <th className="px-3 py-2.5 text-center font-medium">Tend.</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-crema-200">
                    {productos.map((p) => (
                      <tr key={p.id} className="hover:bg-crema-50/50 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-mate-700">{p.nombre}</div>
                          <div className="text-xs text-mate-400">{p.categoria}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-mate-700">{formatARS(p.precio_venta)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={p.stock_actual === 0 ? 'text-alerta-500 font-medium' : p.stock_actual <= 1 ? 'text-warning-600' : 'text-mate-700'}>
                            {p.stock_actual}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-mate-400">{p.grabable ? 'Sí' : '—'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs ${
                            p.tendencia === 'en_alza' ? 'text-positivo-600' :
                            p.tendencia === 'en_baja' ? 'text-alerta-500' : 'text-mate-400'
                          }`}>{p.tendencia.replace('_', ' ')}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => openEditProd(p)} className="rounded-lg p-1.5 text-mate-400 hover:bg-crema-200 hover:text-mate-600 transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => removeProd(p.id)} title="Dar de baja" className="rounded-lg p-1.5 text-mate-400 hover:bg-alerta-50 hover:text-alerta-500 transition-colors">
                              <Archive size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ventas */}
      {tab === 'ventas' && (
        <div className="space-y-3">
          <button onClick={openNewVenta} className="btn-primary w-full" disabled={productos.length === 0}>
            <Plus size={16} /> Registrar venta
          </button>
          {ventas.length === 0 ? (
            <EmptyState title="Sin ventas" description="Registrá tu primera venta o importá desde CSV." />
          ) : (
            <>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-crema-200 bg-crema-50 text-left text-xs uppercase tracking-wider text-mate-400">
                        <th className="px-3 py-2.5 font-medium">Fecha</th>
                        <th className="px-3 py-2.5 font-medium">Producto</th>
                        <th className="px-3 py-2.5 text-center font-medium">Cant.</th>
                        <th className="px-3 py-2.5 text-right font-medium">Precio</th>
                        <th className="px-3 py-2.5 text-center font-medium">Canal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-crema-200">
                      {ventas.slice(0, 50).map((v) => (
                        <tr key={v.id} className="hover:bg-crema-50/50 transition-colors">
                          <td className="px-3 py-2.5 text-mate-600">{formatDateShort(v.fecha)}</td>
                          <td className="px-3 py-2.5 font-medium text-mate-700">{v.producto?.nombre ?? productoNombre(v.producto_id)}</td>
                          <td className="px-3 py-2.5 text-center text-mate-600">{v.cantidad}</td>
                          <td className="px-3 py-2.5 text-right text-mate-600">{formatARS(v.precio_unitario)}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-mate-400">{v.canal.replace('_', ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {ventas.length > 50 && (
                <p className="text-center text-xs text-mate-400">Mostrando las 50 ventas más recientes de {ventas.length} totales.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Importar CSV */}
      {tab === 'importar' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-lg font-medium text-mate-700 mb-2" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
              Importar productos o ventas desde CSV
            </h3>
            <p className="text-sm text-mate-400 mb-4">
              El archivo debe tener una fila por producto o venta, separado por comas.
            </p>

            <div className="space-y-3 text-xs text-mate-500">
              <div>
                <p className="font-medium text-mate-700 mb-1">Formato productos:</p>
                <code className="block rounded-lg bg-crema-200 p-2">
                  nombre, categoria, precio_venta, stock_actual, grabable, tendencia<br />
                  Mate Imperial, Mates, 55000, 2, false, estable
                </code>
              </div>
              <div>
                <p className="font-medium text-mate-700 mb-1">Formato ventas:</p>
                <code className="block rounded-lg bg-crema-200 p-2">
                  producto_nombre, fecha, cantidad, precio_unitario, canal<br />
                  Mate Imperial, 2026-01-15, 1, 55000, instagram
                </code>
              </div>
              <p className="text-mate-400">El sistema detecta automáticamente si cada fila es un producto o una venta.</p>
            </div>

            <div className="mt-4">
              <label className="label">Seleccionar archivo CSV</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvImport}
                className="input py-2"
              />
            </div>
          </div>

          {formError && <Alert variant="error">{formError}</Alert>}

          {importResult && (
            <Alert variant={importResult.errors.length > 0 ? 'warning' : 'success'} title={`${importResult.ok} registro(s) importado(s)`}>
              {importResult.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {importResult.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {importResult.errors.length > 10 && <li className="opacity-70">y {importResult.errors.length - 10} error(es) más…</li>}
                </ul>
              )}
            </Alert>
          )}
        </div>
      )}

      {/* Modal producto */}
      <Modal
        open={prodModalOpen}
        onClose={() => setProdModalOpen(false)}
        title={editingProd ? 'Editar producto' : 'Nuevo producto'}
        size="lg"
      >
        {formError && <Alert variant="error" className="mb-4">{formError}</Alert>}
        <div className="space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input
              type="text"
              value={prodForm.nombre}
              onChange={(e) => setProdForm({ ...prodForm, nombre: e.target.value })}
              className="input"
              placeholder="Mate Imperial Calabaza Premium"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoría</label>
              <select
                value={prodForm.categoria}
                onChange={(e) => setProdForm({ ...prodForm, categoria: e.target.value })}
                className="input"
              >
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tendencia</label>
              <select
                value={prodForm.tendencia}
                onChange={(e) => setProdForm({ ...prodForm, tendencia: e.target.value as 'en_alza' | 'estable' | 'en_baja' })}
                className="input"
              >
                <option value="estable">Estable</option>
                <option value="en_alza">En alza</option>
                <option value="en_baja">En baja</option>
              </select>
            </div>
            <div>
              <label className="label">Precio de venta</label>
              <input
                type="number"
                min={0}
                value={prodForm.precio_venta}
                onChange={(e) => setProdForm({ ...prodForm, precio_venta: parseFloat(e.target.value) || 0 })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Stock actual</label>
              <input
                type="number"
                min={0}
                value={prodForm.stock_actual}
                onChange={(e) => setProdForm({ ...prodForm, stock_actual: parseInt(e.target.value) || 0 })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-mate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={prodForm.grabable}
                onChange={(e) => setProdForm({ ...prodForm, grabable: e.target.checked })}
                className="rounded border-crema-300 text-mate-500 focus:ring-mate-200"
              />
              Grabable (admite grabado)
            </label>
          </div>
          <button onClick={saveProd} disabled={saving} className="btn-primary w-full">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </Modal>

      {/* Modal venta */}
      <Modal
        open={ventaModalOpen}
        onClose={() => setVentaModalOpen(false)}
        title="Registrar venta"
      >
        {formError && <Alert variant="error" className="mb-4">{formError}</Alert>}
        <div className="space-y-4">
          <div>
            <label className="label">Producto</label>
            <select
              value={ventaForm.producto_id}
              onChange={(e) => onProductoVentaChange(e.target.value)}
              className="input"
            >
              {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha</label>
              <input
                type="date"
                value={ventaForm.fecha}
                onChange={(e) => setVentaForm({ ...ventaForm, fecha: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Cantidad</label>
              <input
                type="number"
                min={1}
                value={ventaForm.cantidad}
                onChange={(e) => setVentaForm({ ...ventaForm, cantidad: parseInt(e.target.value) || 1 })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Precio unitario</label>
              <input
                type="number"
                min={0}
                value={ventaForm.precio_unitario}
                onChange={(e) => setVentaForm({ ...ventaForm, precio_unitario: parseFloat(e.target.value) || 0 })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Canal</label>
              <select
                value={ventaForm.canal}
                onChange={(e) => setVentaForm({ ...ventaForm, canal: e.target.value as 'instagram' | 'tienda_nube' | 'otro' })}
                className="input"
              >
                <option value="instagram">Instagram</option>
                <option value="tienda_nube">Tienda Nube</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          <button onClick={saveVenta} disabled={saving} className="btn-primary w-full">
            {saving ? 'Guardando…' : 'Registrar venta'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
