import { useEffect, useState, useCallback } from 'react';
import { Calendar, AlertCircle, TrendingUp, ShoppingCart, ListOrdered, Clock, Package } from 'lucide-react';
import { fetchFechasComerciales, fetchParametros, fetchStockInversion, fetchListas, fetchProveedores } from '@/lib/data';
import { calcFechaLimiteReposicion, calcFechaLimiteGrabados, getNextFechaComercial, calcPlataParada, detectarAumentos, paramMap } from '@/lib/calculations';
import { formatDate, formatARS, diasRestantes, daysUntil } from '@/lib/format';
import type { FechaComercial, Parametro, StockInversion, ListaPrecios, Proveedor } from '@/types';
import { FullSpinner, ErrorState, EmptyState } from '@/components/ui/Feedback';
import { Alert } from '@/components/ui/Alert';
import type { Route } from '@/components/Layout';

interface Props {
  onNavigate: (route: Route) => void;
}

export function InicioScreen({ onNavigate }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fechas, setFechas] = useState<FechaComercial[]>([]);
  const [params, setParams] = useState<Parametro[]>([]);
  const [stock, setStock] = useState<StockInversion[]>([]);
  const [listas, setListas] = useState<ListaPrecios[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, p, s, l, prov] = await Promise.all([
        fetchFechasComerciales(),
        fetchParametros(),
        fetchStockInversion(),
        fetchListas(),
        fetchProveedores(),
      ]);
      setFechas(f);
      setParams(p);
      setStock(s);
      setListas(l);
      setProveedores(prov);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <FullSpinner label="Cargando resumen…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const pm = paramMap(params);
  const proximaFecha = getNextFechaComercial(fechas);
  const diasEntregaProm = proveedores.length > 0
    ? Math.round(proveedores.reduce((s, p) => s + p.dias_entrega, 0) / proveedores.length)
    : 7;

  const fechaReposicion = proximaFecha
    ? calcFechaLimiteReposicion(proximaFecha.fecha, diasEntregaProm)
    : null;
  const fechaGrabados = proximaFecha
    ? calcFechaLimiteGrabados(proximaFecha.fecha, pm.dias_grabado ?? 12, pm.dias_envio ?? 3)
    : null;

  const diasParaReposicion = daysUntil(fechaReposicion);
  const diasParaGrabados = daysUntil(fechaGrabados);

  const aumentos = detectarAumentos(listas, pm.alerta_aumento ?? 5);
  const plataParada = calcPlataParada(stock, pm.dias_sin_venta_no_recomprar ?? 60);
  const productosSinVenta = stock.filter(
    (s) => s.dias_desde_ultima_venta !== null && s.dias_desde_ultima_venta > (pm.dias_sin_venta_no_recomprar ?? 60)
  );
  const productosBajoStock = stock.filter((s) => s.stock_actual <= 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium text-mate-700" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          Hola de nuevo
        </h1>
        <p className="text-sm text-mate-400 mt-0.5">Esto es lo que tenés que saber hoy.</p>
      </div>

      {/* Próxima fecha comercial */}
      {proximaFecha ? (
        <div className="card overflow-hidden">
          <div className="bg-mate-500 p-5 text-crema-50">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
              <Calendar size={14} />
              <span>Próxima fecha comercial</span>
            </div>
            <h2 className="mt-2 text-2xl font-medium" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
              {proximaFecha.nombre}
            </h2>
            <p className="mt-0.5 text-sm opacity-90">{formatDate(proximaFecha.fecha)} · {diasRestantes(proximaFecha.fecha)}</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-crema-200">
            <div className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-mate-400">
                <ShoppingCart size={12} />
                <span>Fecha límite reposición</span>
              </div>
              <p className="mt-1 text-lg font-medium text-mate-700" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
                {formatDate(fechaReposicion)}
              </p>
              <p className={`text-xs ${diasParaReposicion !== null && diasParaReposicion < 7 ? 'text-alerta-500' : 'text-mate-400'}`}>
                {diasRestantes(fechaReposicion)}
              </p>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-mate-400">
                <Clock size={12} />
                <span>Fecha límite grabados</span>
              </div>
              <p className="mt-1 text-lg font-medium text-mate-700" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
                {formatDate(fechaGrabados)}
              </p>
              <p className={`text-xs ${diasParaGrabados !== null && diasParaGrabados < 7 ? 'text-alerta-500' : 'text-mate-400'}`}>
                {diasRestantes(fechaGrabados)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState title="Sin fechas comerciales" description="Agregá fechas desde Configuración." />
      )}

      {/* Alertas */}
      {(aumentos.length > 0 || productosSinVenta.length > 0 || productosBajoStock.length > 0) && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-mate-600" style={{ fontFamily: '"Cormorant Garamond", serif' }}>Alertas</h3>

          {aumentos.length > 0 && (
            <Alert variant="warning" title={`${aumentos.length} aumento${aumentos.length > 1 ? 's' : ''} de costo detectado${aumentos.length > 1 ? 's' : ''}`}>
              <ul className="mt-1 space-y-0.5">
                {aumentos.slice(0, 3).map((a, i) => (
                  <li key={i}>
                    {a.producto_nombre}: {formatARS(a.costo_anterior)} → {formatARS(a.costo_actual)} (+{a.porcentaje}%)
                  </li>
                ))}
                {aumentos.length > 3 && <li className="opacity-70">y {aumentos.length - 3} más…</li>}
              </ul>
            </Alert>
          )}

          {productosBajoStock.length > 0 && (
            <Alert variant="info" title={`${productosBajoStock.length} producto${productosBajoStock.length > 1 ? 's' : ''} con stock bajo (≤1)`}>
              Revisá si conviene reponer antes de la próxima fecha.
            </Alert>
          )}

          {productosSinVenta.length > 0 && (
            <Alert variant="error" title={`${productosSinVenta.length} producto${productosSinVenta.length > 1 ? 's' : ''} sin ventas en más de ${pm.dias_sin_venta_no_recomprar ?? 60} días`}>
              Tienen {formatARS(plataParada)} de plata parada en stock.
            </Alert>
          )}
        </div>
      )}

      {/* Accesos rápidos */}
      <div>
        <h3 className="mb-3 text-lg font-medium text-mate-600" style={{ fontFamily: '"Cormorant Garamond", serif' }}>Accesos rápidos</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('comprar')}
            className="card flex flex-col items-start gap-2 p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mate-100 text-mate-600">
              <ShoppingCart size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-mate-700">Armar compra</p>
              <p className="text-xs text-mate-400">Definir presupuesto y objetivo</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate('listas')}
            className="card flex flex-col items-start gap-2 p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mate-100 text-mate-600">
              <ListOrdered size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-mate-700">Subir lista</p>
              <p className="text-xs text-mate-400">Cargar costos de proveedores</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate('stock')}
            className="card flex flex-col items-start gap-2 p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mate-100 text-mate-600">
              <Package size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-mate-700">Stock</p>
              <p className="text-xs text-mate-400">Ver inversión y rotación</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate('productos')}
            className="card flex flex-col items-start gap-2 p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mate-100 text-mate-600">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-mate-700">Productos</p>
              <p className="text-xs text-mate-400">Catálogo y ventas</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
