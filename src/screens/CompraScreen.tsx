import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus, Minus, Trash2, Save, Check, X, DollarSign, Target, Sparkles, Wand2, ShieldCheck, Flame, CalendarDays,
} from 'lucide-react';
import {
  fetchStockInversion, fetchParametros, fetchCompras, fetchFechasComerciales,
  createCompra, createItemsCompra, updateCompra, interpretarPedido, explicarCompra,
} from '@/lib/data';
import { calcCartTotals, getNextFechaComercial, paramMap, type CartItem } from '@/lib/calculations';
import {
  clasificarTodo, recomendarCompra, umbralesDesde, hoyIso, CLASIFICACION_LABEL,
  type Clasificacion, type CompraRecomendada, type StockClasificado,
} from '@/lib/reglas';
import { formatARS, formatDateShort } from '@/lib/format';
import type { Compra, FechaComercial, Parametro, StockInversion, TipoCompra } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { ClasificacionBadge } from '@/components/ui/ClasificacionBadge';
import { FullSpinner, ErrorState, EmptyState, Spinner } from '@/components/ui/Feedback';

interface ItemCarrito extends CartItem {
  clasificacion: Clasificacion;
  apuesta: boolean;
  explicacion: string;
}

const tituloStyle = { fontFamily: '"Cormorant Garamond", serif' };

export function CompraScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stock, setStock] = useState<StockInversion[]>([]);
  const [params, setParams] = useState<Parametro[]>([]);
  const [fechas, setFechas] = useState<FechaComercial[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);

  // Pedido
  const [pedidoTexto, setPedidoTexto] = useState('');
  const [interpretando, setInterpretando] = useState(false);
  const [presupuesto, setPresupuesto] = useState(300000);
  const [objetivo, setObjetivo] = useState('');
  const [fechaObjetivo, setFechaObjetivo] = useState('');
  const [tipo, setTipo] = useState<TipoCompra>('conservadora');

  // Resultado
  const [recomendacion, setRecomendacion] = useState<CompraRecomendada | null>(null);
  const [cart, setCart] = useState<ItemCarrito[]>([]);
  const [redactando, setRedactando] = useState(false);

  // UI
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selProducto, setSelProducto] = useState('');
  const [selCantidad, setSelCantidad] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, pa, c, f] = await Promise.all([
        fetchStockInversion(), fetchParametros(), fetchCompras(), fetchFechasComerciales(),
      ]);
      setStock(s);
      setParams(pa);
      setCompras(c);
      setFechas(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const umbrales = useMemo(() => umbralesDesde(paramMap(params)), [params]);
  const clasificado = useMemo<StockClasificado[]>(() => clasificarTodo(stock, umbrales), [stock, umbrales]);
  const proximasFechas = useMemo(() => {
    const hoy = hoyIso();
    return fechas.filter((f) => f.fecha >= hoy).slice(0, 4);
  }, [fechas]);

  // Fecha objetivo por defecto: la próxima fecha comercial
  useEffect(() => {
    if (!fechaObjetivo && fechas.length > 0) {
      const prox = getNextFechaComercial(fechas);
      if (prox) {
        setFechaObjetivo(prox.fecha);
        setObjetivo((o) => o || `Llegar bien a ${prox.nombre}`);
      }
    }
  }, [fechas, fechaObjetivo]);

  const totals = useMemo(() => calcCartTotals(cart, presupuesto), [cart, presupuesto]);

  // ------------------------------------------------------------------
  // Pedido en texto libre → formulario (IA). Los números los pone ella.
  // ------------------------------------------------------------------
  const interpretar = async () => {
    if (!pedidoTexto.trim()) return;
    setInterpretando(true);
    setFormError(null);
    try {
      const p = await interpretarPedido(pedidoTexto.trim(), hoyIso());
      if (p.presupuesto) setPresupuesto(p.presupuesto);
      if (p.objetivo) setObjetivo(p.objetivo);
      if (p.fecha_objetivo) setFechaObjetivo(p.fecha_objetivo);
      if (p.tipo) setTipo(p.tipo);
      const faltan = [!p.presupuesto && 'presupuesto', !p.fecha_objetivo && 'fecha'].filter(Boolean);
      setAviso(faltan.length ? `No entendí ${faltan.join(' ni ')}: completalo abajo.` : 'Listo. Revisá los datos y armá la compra.');
    } catch (err) {
      setFormError(`No pude interpretar el pedido (${err instanceof Error ? err.message : 'error'}). Completá el formulario.`);
    } finally {
      setInterpretando(false);
    }
  };

  // ------------------------------------------------------------------
  // Armar compra (R8 / R9): la calcula el sistema; la IA solo redacta.
  // ------------------------------------------------------------------
  const calcular = (t: TipoCompra) =>
    recomendarCompra(clasificado, { presupuesto, tipo: t, fechaObjetivo: fechaObjetivo || null }, umbrales);

  const aplicar = (rec: CompraRecomendada) => {
    setRecomendacion(rec);
    setCart(
      rec.items.map((i) => ({
        producto_id: i.producto_id,
        producto_nombre: i.producto_nombre,
        proveedor_id: i.proveedor_id,
        proveedor_nombre: i.proveedor_nombre,
        cantidad: i.cantidad,
        costo_unitario: i.costo_unitario,
        precio_venta: i.precio_venta,
        minimo_compra: i.minimo_compra,
        clasificacion: i.clasificacion,
        apuesta: i.apuesta,
        explicacion: i.explicacion,
      })),
    );
  };

  const redactar = async (rec: CompraRecomendada) => {
    if (rec.items.length === 0) return;
    setRedactando(true);
    try {
      const textos = await explicarCompra(
        rec.items.map((i) => ({
          producto_id: i.producto_id,
          nombre: i.producto_nombre,
          cantidad: i.cantidad,
          clasificacion: CLASIFICACION_LABEL[i.clasificacion],
          margen: Math.round(i.margen),
          stock_actual: i.stock_actual,
          demanda_esperada: i.demanda_esperada,
          apuesta: i.apuesta,
          explicacion: i.explicacion,
        })),
        objetivo || 'Reponer stock',
      );
      setCart((prev) => prev.map((c) => (textos[c.producto_id] ? { ...c, explicacion: textos[c.producto_id] } : c)));
    } catch {
      // Si la IA no responde, quedan las explicaciones calculadas por reglas.
    } finally {
      setRedactando(false);
    }
  };

  const armarCompra = (t: TipoCompra = tipo) => {
    setFormError(null);
    setSaveMsg(null);
    if (presupuesto <= 0) { setFormError('Poné un presupuesto mayor a cero.'); return; }
    const rec = calcular(t);
    aplicar(rec);
    if (rec.items.length === 0) {
      setAviso('Con estos datos no hay nada para reponer: el stock alcanza o no hay productos con costo vigente.');
    } else {
      setAviso(null);
      redactar(rec);
    }
  };

  const cambiarTipo = (t: TipoCompra) => {
    setTipo(t);
    if (recomendacion) armarCompra(t);
  };

  // ------------------------------------------------------------------
  // Simulador (H7)
  // ------------------------------------------------------------------
  const setQty = (productoId: string, qty: number) =>
    setCart((prev) => prev.map((c) => (c.producto_id === productoId ? { ...c, cantidad: Math.max(c.minimo_compra, qty) } : c)));

  const removeFromCart = (productoId: string) => setCart((prev) => prev.filter((c) => c.producto_id !== productoId));

  const candidatosManuales = clasificado.filter(
    (s) => s.costo_vigente !== null && s.proveedor_id && !cart.some((c) => c.producto_id === s.id),
  );

  const addToCart = () => {
    const s = clasificado.find((p) => p.id === selProducto);
    if (!s || s.costo_vigente === null || !s.proveedor_id) { setFormError('Seleccioná un producto con costo vigente'); return; }
    const minimo = Math.max(1, s.minimo_compra ?? 1);
    setCart((prev) => [
      ...prev,
      {
        producto_id: s.id,
        producto_nombre: s.nombre,
        proveedor_id: s.proveedor_id!,
        proveedor_nombre: s.proveedor_nombre ?? '',
        cantidad: Math.max(selCantidad, minimo),
        costo_unitario: s.costo_vigente!,
        precio_venta: s.precio_venta,
        minimo_compra: minimo,
        clasificacion: s.clasificacion,
        apuesta: false,
        explicacion: `Agregado a mano. ${s.motivo}`,
      },
    ]);
    setSelProducto('');
    setSelCantidad(1);
    setFormError(null);
    setAddModalOpen(false);
  };

  // ------------------------------------------------------------------
  // Guardar (compras guardadas)
  // ------------------------------------------------------------------
  const saveCompra = async () => {
    if (cart.length === 0) { setFormError('El carrito está vacío'); return; }
    if (totals.presupuestoRestante < 0) { setFormError('La compra supera el presupuesto.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const compra = await createCompra({
        presupuesto,
        objetivo: objetivo.trim() || null,
        fecha_objetivo: fechaObjetivo || null,
        tipo,
      });
      await createItemsCompra(
        cart.map((i) => ({
          compra_id: compra.id,
          producto_id: i.producto_id,
          proveedor_id: i.proveedor_id,
          cantidad: i.cantidad,
          costo_unitario: i.costo_unitario,
          precio_venta: i.precio_venta,
          explicacion: i.explicacion,
        })),
      );
      setSaveMsg('Compra guardada. Cuando la hagas, marcala como realizada.');
      setCart([]);
      setRecomendacion(null);
      setCompras(await fetchCompras());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar la compra');
    } finally {
      setSaving(false);
    }
  };

  const cambiarEstado = async (id: string, estado: 'realizada' | 'descartada') => {
    try {
      await updateCompra(id, { estado });
      setCompras(await fetchCompras());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  if (loading) return <FullSpinner label="Cargando…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const porProveedor = cart.reduce<Record<string, number>>((acc, i) => {
    acc[i.proveedor_nombre] = (acc[i.proveedor_nombre] ?? 0) + i.cantidad * i.costo_unitario;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium text-mate-700" style={tituloStyle}>Armar compra</h1>
        <p className="text-sm text-mate-400 mt-0.5">Decime cuánta plata tenés y para cuándo. Yo te armo la compra y vos la ajustás.</p>
      </div>

      {saveMsg && <Alert variant="success">{saveMsg}</Alert>}
      {formError && <Alert variant="error">{formError}</Alert>}

      {/* Pedido en texto libre */}
      <div className="card p-4 space-y-3">
        <label className="label flex items-center gap-1"><Sparkles size={11} /> Pedido en tus palabras</label>
        <textarea
          value={pedidoTexto}
          onChange={(e) => setPedidoTexto(e.target.value)}
          rows={2}
          className="input resize-none"
          placeholder="Tengo $300.000 y quiero llegar bien a Navidad, sin arriesgar mucho"
        />
        <button onClick={interpretar} disabled={interpretando || !pedidoTexto.trim()} className="btn-secondary w-full sm:w-auto">
          {interpretando ? <Spinner size={14} /> : <Wand2 size={14} />}
          {interpretando ? 'Interpretando…' : 'Completar el formulario'}
        </button>
        {aviso && <p className="text-xs text-mate-500">{aviso}</p>}
      </div>

      {/* Formulario */}
      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label"><DollarSign size={11} className="inline mr-1" />Presupuesto</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={presupuesto}
              onChange={(e) => setPresupuesto(parseFloat(e.target.value) || 0)}
              className="input"
            />
          </div>
          <div>
            <label className="label"><Target size={11} className="inline mr-1" />Objetivo</label>
            <input type="text" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className="input" placeholder="Llegar bien a Navidad…" />
          </div>
          <div>
            <label className="label"><CalendarDays size={11} className="inline mr-1" />Fecha objetivo</label>
            <input type="date" value={fechaObjetivo} onChange={(e) => setFechaObjetivo(e.target.value)} className="input" />
          </div>
        </div>

        {proximasFechas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {proximasFechas.map((f) => (
              <button
                key={f.id}
                onClick={() => { setFechaObjetivo(f.fecha); setObjetivo(`Llegar bien a ${f.nombre}`); }}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  fechaObjetivo === f.fecha ? 'border-mate-500 bg-mate-500 text-crema-50' : 'border-crema-300 text-mate-500 hover:bg-crema-200'
                }`}
              >
                {f.nombre} · {formatDateShort(f.fecha)}
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="label">Tipo de compra</label>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-crema-200 p-1">
            {([
              ['conservadora', 'Conservadora', ShieldCheck],
              ['arriesgada', 'Arriesgada', Flame],
            ] as const).map(([valor, label, Icon]) => (
              <button
                key={valor}
                onClick={() => cambiarTipo(valor)}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
                  tipo === valor ? 'bg-crema-50 text-mate-700 shadow-sm' : 'text-mate-400'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-mate-400 mt-1">
            {tipo === 'conservadora'
              ? 'Solo productos con historial de ventas.'
              : `Puede destinar hasta el ${umbrales.topeArriesgada}% del presupuesto a productos en alza con poco historial.`}
          </p>
        </div>

        <button onClick={() => armarCompra()} className="btn-primary w-full">
          <Sparkles size={16} /> {recomendacion ? 'Volver a armar la compra' : 'Armar compra'}
        </button>
      </div>

      {/* Totales (se recalculan al instante) */}
      {(recomendacion || cart.length > 0) && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Total label="Inversión" valor={formatARS(totals.inversion)} />
            <Total label="Venta esperada" valor={formatARS(totals.ventaEsperada)} />
            <Total label="Ganancia esperada" valor={formatARS(totals.ganancia)} tono="positivo" />
            <Total
              label="Presupuesto restante"
              valor={formatARS(totals.presupuestoRestante)}
              tono={totals.presupuestoRestante < 0 ? 'alerta' : undefined}
            />
          </div>

          {totals.presupuestoRestante < 0 && (
            <Alert variant="error">
              La compra supera el presupuesto en {formatARS(Math.abs(totals.presupuestoRestante))}. Sacá productos o bajá cantidades.
            </Alert>
          )}
          {recomendacion && recomendacion.sinPresupuesto.length > 0 && (
            <Alert variant="info" title="No entraron en el presupuesto">
              {recomendacion.sinPresupuesto.slice(0, 6).join(', ')}
              {recomendacion.sinPresupuesto.length > 6 && ` y ${recomendacion.sinPresupuesto.length - 6} más`}.
            </Alert>
          )}
          {Object.keys(porProveedor).length > 1 && (
            <p className="text-xs text-mate-400">
              Por proveedor: {Object.entries(porProveedor).map(([p, m]) => `${p} ${formatARS(m)}`).join(' · ')}
            </p>
          )}
        </>
      )}

      {/* Carrito */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-mate-600 flex items-center gap-2" style={tituloStyle}>
            Carrito ({cart.length})
            {redactando && <span className="flex items-center gap-1 text-xs font-sans text-mate-400"><Spinner size={12} /> redactando explicaciones…</span>}
          </h3>
          <button
            onClick={() => { setSelProducto(''); setSelCantidad(1); setFormError(null); setAddModalOpen(true); }}
            className="btn-secondary text-xs"
          >
            <Plus size={14} /> Agregar
          </button>
        </div>

        {cart.length === 0 ? (
          <EmptyState
            title={recomendacion ? 'Nada para comprar' : 'Todavía no armaste la compra'}
            description={recomendacion ? 'Probá con otra fecha, más presupuesto o la compra arriesgada.' : 'Completá el presupuesto y tocá "Armar compra".'}
          />
        ) : (
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item.producto_id} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-medium text-mate-700 text-sm">{item.producto_nombre}</p>
                      <ClasificacionBadge value={item.clasificacion} />
                      {item.apuesta && <span className="badge bg-warning-100 text-warning-600"><Flame size={10} className="mr-0.5" />Apuesta</span>}
                    </div>
                    <p className="text-xs text-mate-400 mt-0.5">
                      {item.proveedor_nombre} · {formatARS(item.costo_unitario)}/u. · vende a {formatARS(item.precio_venta)}
                      {item.minimo_compra > 1 && ` · mín. ${item.minimo_compra}`}
                    </p>
                    <p className="text-xs text-mate-600 mt-1.5 leading-snug">{item.explicacion}</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.producto_id)}
                    className="rounded-lg p-1.5 text-mate-400 hover:bg-alerta-50 hover:text-alerta-500 transition-colors"
                    aria-label="Sacar del carrito"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setQty(item.producto_id, item.cantidad - 1)}
                    className="rounded-lg bg-crema-200 p-1.5 text-mate-600 hover:bg-crema-300 transition-colors disabled:opacity-40"
                    disabled={item.cantidad <= item.minimo_compra}
                    aria-label="Restar"
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
                    onClick={() => setQty(item.producto_id, item.cantidad + 1)}
                    className="rounded-lg bg-crema-200 p-1.5 text-mate-600 hover:bg-crema-300 transition-colors"
                    aria-label="Sumar"
                  >
                    <Plus size={14} />
                  </button>
                  <span className="ml-auto text-right text-xs">
                    <span className="text-mate-700 font-medium">{formatARS(item.cantidad * item.costo_unitario)}</span>
                    <span className="block text-positivo-600">+{formatARS(item.cantidad * (item.precio_venta - item.costo_unitario))}</span>
                  </span>
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
        <p className="text-xs text-mate-400 text-center">Cebador no compra ni paga: la compra la hacés vos con tus proveedores.</p>
      </div>

      {/* Compras guardadas */}
      {compras.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-mate-600" style={tituloStyle}>Compras guardadas ({compras.length})</h3>
          {compras.map((c) => {
            const items = c.items_compra ?? [];
            const inversion = items.reduce((s, i) => s + i.cantidad * i.costo_unitario, 0);
            const ganancia = items.reduce((s, i) => s + i.cantidad * (i.precio_venta - i.costo_unitario), 0);
            return (
              <details key={c.id} className="card p-3 group">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-mate-700 text-sm">
                      {c.objetivo || 'Sin objetivo'}
                      <span className={`badge ml-2 ${
                        c.estado === 'realizada' ? 'bg-positivo-100 text-positivo-600' :
                        c.estado === 'descartada' ? 'bg-crema-200 text-mate-400' :
                        'bg-warning-100 text-warning-600'
                      }`}>{c.estado}</span>
                    </p>
                    <p className="text-xs text-mate-400 mt-0.5">
                      {formatDateShort(c.fecha.slice(0, 10))} · {c.tipo} · {items.length} producto(s) · {formatARS(inversion)} de {formatARS(c.presupuesto)} · ganancia {formatARS(ganancia)}
                    </p>
                  </div>
                  {c.estado === 'sugerida' && (
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.preventDefault(); cambiarEstado(c.id, 'realizada'); }}
                        className="rounded-lg p-1.5 text-positivo-500 hover:bg-positivo-50 transition-colors"
                        title="Marcar como realizada"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); cambiarEstado(c.id, 'descartada'); }}
                        className="rounded-lg p-1.5 text-mate-400 hover:bg-crema-200 transition-colors"
                        title="Descartar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </summary>
                <ul className="mt-3 space-y-1 border-t border-crema-200 pt-2 text-xs text-mate-600">
                  {items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2">
                      <span>{i.cantidad} × {i.producto?.nombre ?? 'Producto'} <span className="text-mate-400">({i.proveedor?.nombre})</span></span>
                      <span className="shrink-0">{formatARS(i.cantidad * i.costo_unitario)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}

      {/* Modal agregar producto */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Agregar producto">
        {candidatosManuales.length === 0 ? (
          <Alert variant="info">No hay más productos con costo vigente. Confirmá listas de proveedores desde la sección Listas.</Alert>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">Producto</label>
              <select
                value={selProducto}
                onChange={(e) => {
                  setSelProducto(e.target.value);
                  const s = clasificado.find((p) => p.id === e.target.value);
                  setSelCantidad(Math.max(1, s?.minimo_compra ?? 1));
                }}
                className="input"
              >
                <option value="">Seleccionar…</option>
                {candidatosManuales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {formatARS(p.costo_vigente)} ({CLASIFICACION_LABEL[p.clasificacion]})
                  </option>
                ))}
              </select>
            </div>
            {selProducto && (() => {
              const s = clasificado.find((p) => p.id === selProducto)!;
              return (
                <div className="rounded-lg bg-crema-200 p-3 text-sm text-mate-600 space-y-0.5">
                  <p>Proveedor más barato: <strong>{s.proveedor_nombre}</strong> a {formatARS(s.costo_vigente)}/u.</p>
                  <p>Clasificación: <strong>{CLASIFICACION_LABEL[s.clasificacion]}</strong> — {s.motivo}</p>
                  {s.clasificacion === 'no_recomprar' && <p className="text-alerta-600">Ojo: este producto no se vende hace tiempo.</p>}
                </div>
              );
            })()}
            <div>
              <label className="label">Cantidad</label>
              <input type="number" min={1} value={selCantidad} onChange={(e) => setSelCantidad(parseInt(e.target.value) || 1)} className="input" />
            </div>
            <button onClick={addToCart} className="btn-primary w-full"><Plus size={16} /> Agregar al carrito</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Total({ label, valor, tono }: { label: string; valor: string; tono?: 'positivo' | 'alerta' }) {
  return (
    <div className={`card p-3 ${tono === 'alerta' ? 'border-alerta-100' : ''}`}>
      <p className="text-xs text-mate-400">{label}</p>
      <p className={`text-lg font-medium mt-0.5 ${tono === 'positivo' ? 'text-positivo-600' : tono === 'alerta' ? 'text-alerta-500' : 'text-mate-700'}`}>
        {valor}
      </p>
    </div>
  );
}
