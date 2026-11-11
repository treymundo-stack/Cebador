import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ShoppingCart, Plus, Minus, Trash2, Save, Check, Package,
  TrendingUp, DollarSign, Target,
} from 'lucide-react';
import {
  fetchProductos, fetchProveedores, fetchListas, fetchParametros,
  createCompra, createItemCompra, updateCompra, deleteCompra, fetchCompras,
} from '@/lib/data';
import { compararCostos, calcCartTotals, type CartItem } from '@/lib/calculations';
import { formatARS } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import type { Producto, Proveedor, ListaPrecios, Parametro, Compra } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { FullSpinner, ErrorState, EmptyState } from '@/components/ui/Feedback';

export function CompraScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [listas, setListas] = useState<ListaPrecios[]>([]);
  const [params, setParams] = useState<Parametro[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);

  // Form
  const [presupuesto, setPresupuesto] = useState(300000);
  const [objetivo, setObjetivo] = useState('');
  const [fechaObjetivo, setFechaObjetivo] = useState('');
  const [tipo, setTipo] = useState<'conservadora' | 'arriesgada'>('conservadora');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Add item modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selProducto, setSelProducto] = useState('');
  const [selProveedor, setSelProveedor] = useState('');
  const [selCantidad, setSelCantidad] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, prov, l, pa, c] = await Promise.all([
        fetchProductos(), fetchProveedores(), fetchListas(), fetchParametros(), fetchCompras(),
      ]);
      setProductos(p);
      setProveedores(prov);
      setListas(l);
      setParams(pa);
      setCompras(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Costo más bajo por producto desde listas confirmadas
  const costoPorProducto = useMemo(() => {
    const comp = compararCostos(listas);
    const map: Record<string, { costo: number; proveedor_id: string; proveedor_nombre: string; minimo: number }> = {};
    for (const c of comp) {
      // Buscar el proveedor real
      const prov = proveedores.find(p => p.nombre === c.proveedor_minimo);
      // Buscar el item para obtener mínimo de compra
      let minimo = 1;
      for (const lista of listas) {
        if (lista.estado !== 'confirmada') continue;
        const item = (lista.items_lista ?? []).find(i => i.producto_id === c.producto_id);
        if (item) { minimo = item.minimo_compra; break; }
      }
      if (prov) {
        map[c.producto_id] = { costo: c.costo_minimo, proveedor_id: prov.id, proveedor_nombre: prov.nombre, minimo };
      }
    }
    return map;
  }, [listas, proveedores]);

  const totals = useMemo(() => calcCartTotals(cart, presupuesto), [cart, presupuesto]);

  const addToCart = () => {
    if (!selProducto) { setFormError('Seleccioná un producto'); return; }
    const prod = productos.find((p) => p.id === selProducto);
    if (!prod) return;

    const costoInfo = costoPorProducto[selProducto];
    if (!costoInfo) {
      setFormError('Este producto no tiene costo vigente en listas confirmadas. Asociá el producto a una lista confirmada primero.');
      return;
    }

    const existing = cart.find((c) => c.producto_id === selProducto);
    if (existing) {
      setFormError('Ese producto ya está en el carrito. Modificá la cantidad desde el carrito.');
      return;
    }

    const newItem: CartItem = {
      producto_id: prod.id,
      producto_nombre: prod.nombre,
      proveedor_id: costoInfo.proveedor_id,
      proveedor_nombre: costoInfo.proveedor_nombre,
      cantidad: Math.max(selCantidad, costoInfo.minimo),
      costo_unitario: costoInfo.costo,
      precio_venta: prod.precio_venta,
      minimo_compra: costoInfo.minimo,
    };
    setCart([...cart, newItem]);
    setSelProducto('');
    setSelProveedor('');
    setSelCantidad(1);
    setFormError(null);
    setAddModalOpen(false);
  };

  const updateQty = (productoId: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.producto_id !== productoId) return c;
        const newQty = Math.max(c.minimo_compra, c.cantidad + delta);
        return { ...c, cantidad: newQty };
      })
    );
  };

  const setQty = (productoId: string, qty: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.producto_id !== productoId) return c;
        return { ...c, cantidad: Math.max(c.minimo_compra, qty) };
      })
    );
  };

  const removeFromCart = (productoId: string) => {
    setCart((prev) => prev.filter((c) => c.producto_id !== productoId));
  };

  const saveCompra = async () => {
    if (cart.length === 0) { setFormError('El carrito está vacío'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const compra = await createCompra({
        presupuesto,
        objetivo: objetivo.trim() || null,
        fecha_objetivo: fechaObjetivo || null,
        tipo,
      });
      for (const item of cart) {
        await createItemCompra({
          compra_id: compra.id,
          producto_id: item.producto_id,
          proveedor_id: item.proveedor_id,
          cantidad: item.cantidad,
          costo_unitario: item.costo_unitario,
          precio_venta: item.precio_venta,
          explicacion: `${item.cantidad} u. × ${formatARS(item.costo_unitario)} = ${formatARS(item.cantidad * item.costo_unitario)}`,
        });
      }
      setSaveMsg('Compra guardada correctamente.');
      setCart([]);
      await load();
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar la compra');
    } finally {
      setSaving(false);
    }
  };

  const marcarRealizada = async (id: string) => {
    try {
      await updateCompra(id, { estado: 'realizada' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const removeCompra = async (id: string) => {
    if (!confirm('¿Eliminar esta compra?')) return;
    try {
      await deleteCompra(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  if (loading) return <FullSpinner label="Cargando…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const productosConCosto = productos.filter((p) => costoPorProducto[p.id]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium text-mate-700" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          Armar compra
        </h1>
        <p className="text-sm text-mate-400 mt-0.5">Elegí productos, cantidades y proveedores. Los totales se calculan solos.</p>
      </div>

      {saveMsg && <Alert variant="success">{saveMsg}</Alert>}
      {formError && <Alert variant="error" className="mb-4">{formError}</Alert>}

      {/* Parámetros de compra */}
      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">
              <DollarSign size={11} className="inline mr-1" />Presupuesto
            </label>
            <input
              type="number"
              min={0}
              value={presupuesto}
              onChange={(e) => setPresupuesto(parseFloat(e.target.value) || 0)}
              className="input"
            />
          </div>
          <div>
            <label className="label">
              <Target size={11} className="inline mr-1" />Objetivo
            </label>
            <input
              type="text"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              className="input"
              placeholder="Llegar bien a Navidad…"
            />
          </div>
          <div>
            <label className="label">Fecha objetivo</label>
            <input
              type="date"
              value={fechaObjetivo}
              onChange={(e) => setFechaObjetivo(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="label">Tipo de compra</label>
          <div className="flex gap-1 rounded-xl bg-crema-200 p-1">
            <button
              onClick={() => setTipo('conservadora')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                tipo === 'conservadora' ? 'bg-crema-50 text-mate-700 shadow-sm' : 'text-mate-400'
              }`}
            >
              Conservadora
            </button>
            <button
              onClick={() => setTipo('arriesgada')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                tipo === 'arriesgada' ? 'bg-crema-50 text-mate-700 shadow-sm' : 'text-mate-400'
              }`}
            >
              Arriesgada
            </button>
          </div>
          <p className="text-xs text-mate-400 mt-1">
            {tipo === 'conservadora'
              ? 'Incluye productos con historial de ventas.'
              : 'Puede destinar parte del presupuesto a productos en alza sin historial.'}
          </p>
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3">
          <p className="text-xs text-mate-400">Inversión</p>
          <p className="text-lg font-medium text-mate-700 mt-0.5">{formatARS(totals.inversion)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-mate-400">Venta esperada</p>
          <p className="text-lg font-medium text-mate-700 mt-0.5">{formatARS(totals.ventaEsperada)}</p>
        </div>
        <div className="card p-3 border-positivo-100">
          <p className="text-xs text-mate-400">Ganancia esperada</p>
          <p className="text-lg font-medium text-positivo-600 mt-0.5">{formatARS(totals.ganancia)}</p>
        </div>
        <div className={`card p-3 ${totals.presupuestoRestante < 0 ? 'border-alerta-100' : ''}`}>
          <p className="text-xs text-mate-400">Presupuesto restante</p>
          <p className={`text-lg font-medium mt-0.5 ${totals.presupuestoRestante < 0 ? 'text-alerta-500' : 'text-mate-700'}`}>
            {formatARS(totals.presupuestoRestante)}
          </p>
        </div>
      </div>

      {totals.presupuestoRestante < 0 && (
        <Alert variant="error">La inversión supera el presupuesto en {formatARS(Math.abs(totals.presupuestoRestante))}. Sacá productos o reducí cantidades.</Alert>
      )}

      {/* Carrito */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-mate-600" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
            Carrito ({cart.length})
          </h3>
          <button
            onClick={() => { setSelProducto(''); setSelCantidad(1); setFormError(null); setAddModalOpen(true); }}
            className="btn-primary text-xs"
            disabled={productosConCosto.length === 0}
          >
            <Plus size={14} /> Agregar producto
          </button>
        </div>

        {cart.length === 0 ? (
          <EmptyState title="Carrito vacío" description="Agregá productos con costo vigente en listas confirmadas." />
        ) : (
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item.producto_id} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-mate-700 text-sm truncate">{item.producto_nombre}</p>
                    <p className="text-xs text-mate-400 mt-0.5">
                      {item.proveedor_nombre} · {formatARS(item.costo_unitario)}/u. · Mín: {item.minimo_compra}
                    </p>
                    <p className="text-xs text-positivo-600 mt-0.5">
                      Subtotal: {formatARS(item.cantidad * item.costo_unitario)} · Venta: {formatARS(item.cantidad * item.precio_venta)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.producto_id)}
                    className="rounded-lg p-1.5 text-mate-400 hover:bg-alerta-50 hover:text-alerta-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => updateQty(item.producto_id, -1)}
                    className="rounded-lg bg-crema-200 p-1.5 text-mate-600 hover:bg-crema-300 transition-colors"
                    disabled={item.cantidad <= item.minimo_compra}
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min={item.minimo_compra}
                    value={item.cantidad}
                    onChange={(e) => setQty(item.producto_id, parseInt(e.target.value) || item.minimo_compra)}
                    className="input w-16 py-1 text-center text-sm"
                  />
                  <button
                    onClick={() => updateQty(item.producto_id, 1)}
                    className="rounded-lg bg-crema-200 p-1.5 text-mate-600 hover:bg-crema-300 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                  <span className="ml-auto text-xs text-mate-400">unidades</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {cart.length > 0 && (
          <button onClick={saveCompra} disabled={saving || totals.presupuestoRestante < 0} className="btn-primary w-full mt-3">
            <Save size={16} /> {saving ? 'Guardando…' : 'Guardar compra'}
          </button>
        )}
      </div>

      {/* Compras guardadas */}
      {compras.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-mate-600" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
            Compras guardadas ({compras.length})
          </h3>
          {compras.map((c) => (
            <div key={c.id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-mate-700 text-sm">
                    {formatARS(c.presupuesto)} · {c.tipo}
                    <span className={`badge ml-2 ${
                      c.estado === 'realizada' ? 'bg-positivo-100 text-positivo-600' :
                      c.estado === 'descartada' ? 'bg-crema-200 text-mate-400' :
                      'bg-warning-100 text-warning-600'
                    }`}>{c.estado}</span>
                  </p>
                  <p className="text-xs text-mate-400 mt-0.5">
                    {c.objetivo || 'Sin objetivo'} · {c.items_compra?.length ?? 0} producto(s)
                  </p>
                </div>
                <div className="flex gap-1">
                  {c.estado === 'sugerida' && (
                    <button
                      onClick={() => marcarRealizada(c.id)}
                      className="rounded-lg p-1.5 text-positivo-500 hover:bg-positivo-50 transition-colors"
                      title="Marcar como realizada"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => removeCompra(c.id)}
                    className="rounded-lg p-1.5 text-mate-400 hover:bg-alerta-50 hover:text-alerta-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal agregar producto */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Agregar producto al carrito">
        {formError && <Alert variant="error" className="mb-4">{formError}</Alert>}
        {productosConCosto.length === 0 ? (
          <Alert variant="info">
            No hay productos con costo vigente. Confirmá listas de proveedores y asociá productos desde la sección Listas.
          </Alert>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">Producto</label>
              <select
                value={selProducto}
                onChange={(e) => {
                  setSelProducto(e.target.value);
                  const c = costoPorProducto[e.target.value];
                  if (c) setSelCantidad(c.minimo);
                }}
                className="input"
              >
                <option value="">Seleccionar…</option>
                {productosConCosto.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {formatARS(costoPorProducto[p.id].costo)} ({costoPorProducto[p.id].proveedor_nombre})
                  </option>
                ))}
              </select>
            </div>
            {selProducto && costoPorProducto[selProducto] && (
              <div className="rounded-lg bg-crema-200 p-3 text-sm text-mate-600">
                <p>Proveedor: <strong>{costoPorProducto[selProducto].proveedor_nombre}</strong></p>
                <p>Costo: <strong>{formatARS(costoPorProducto[selProducto].costo)}</strong>/u.</p>
                <p>Mínimo de compra: <strong>{costoPorProducto[selProducto].minimo}</strong> u.</p>
                <p>Precio de venta: <strong>{formatARS(productos.find(p => p.id === selProducto)?.precio_venta ?? 0)}</strong></p>
              </div>
            )}
            <div>
              <label className="label">Cantidad</label>
              <input
                type="number"
                min={selProducto ? costoPorProducto[selProducto]?.minimo ?? 1 : 1}
                value={selCantidad}
                onChange={(e) => setSelCantidad(parseInt(e.target.value) || 1)}
                className="input"
              />
            </div>
            <button onClick={addToCart} className="btn-primary w-full">
              <Plus size={16} /> Agregar al carrito
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
