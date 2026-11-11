import { useEffect, useState, useCallback } from 'react';
import { Package, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { fetchStockInversion, fetchParametros } from '@/lib/data';
import { calcPlataParada, paramMap } from '@/lib/calculations';
import { formatARS, formatNumber } from '@/lib/format';
import type { StockInversion, Parametro } from '@/types';
import { FullSpinner, ErrorState, EmptyState } from '@/components/ui/Feedback';

export function StockScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stock, setStock] = useState<StockInversion[]>([]);
  const [params, setParams] = useState<Parametro[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'nombre' | 'margen' | 'rotacion' | 'plata' | 'dias'>('nombre');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([fetchStockInversion(), fetchParametros()]);
      setStock(s);
      setParams(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el stock');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <FullSpinner label="Cargando stock…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const pm = paramMap(params);
  const plataParada = calcPlataParada(stock, pm.dias_sin_venta_no_recomprar ?? 60);
  const plataTotalInvertida = stock.reduce((sum, s) => sum + s.plata_invertida, 0);
  const sinRotacion = stock.filter((s) => s.rotacion_dias === null).length;
  const conMargenBajo = stock.filter((s) => s.margen !== null && s.margen < (pm.margen_minimo ?? 30)).length;

  const filtered = stock.filter((s) =>
    s.nombre.toLowerCase().includes(search.toLowerCase()) ||
    s.categoria.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'margen':
        return (b.margen ?? -999) - (a.margen ?? -999);
      case 'rotacion':
        return (a.rotacion_dias ?? 999) - (b.rotacion_dias ?? 999);
      case 'plata':
        return b.plata_invertida - a.plata_invertida;
      case 'dias':
        return (b.dias_desde_ultima_venta ?? -1) - (a.dias_desde_ultima_venta ?? -1);
      default:
        return a.nombre.localeCompare(b.nombre);
    }
  });

  if (stock.length === 0) {
    return <EmptyState title="Sin productos" description="Cargá productos desde la sección Productos y Ventas." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium text-mate-700" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          Stock como inversión
        </h1>
        <p className="text-sm text-mate-400 mt-0.5">Tu mercadería es tu capital. Mirá cómo está rindiendo.</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs text-mate-400">
            <DollarSign size={12} />
            <span>Plata invertida</span>
          </div>
          <p className="mt-1 text-xl font-medium text-mate-700">{formatARS(plataTotalInvertida)}</p>
        </div>
        <div className="card p-4 border-alerta-100">
          <div className="flex items-center gap-1.5 text-xs text-alerta-500">
            <Package size={12} />
            <span>Plata parada</span>
          </div>
          <p className="mt-1 text-xl font-medium text-alerta-500">{formatARS(plataParada)}</p>
          <p className="text-xs text-mate-400">Sin ventas +{pm.dias_sin_venta_no_recomprar ?? 60} días</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs text-mate-400">
            <TrendingUp size={12} />
            <span>Sin rotación</span>
          </div>
          <p className="mt-1 text-xl font-medium text-mate-700">{sinRotacion}</p>
          <p className="text-xs text-mate-400">productos sin ventas en 90 días</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs text-mate-400">
            <Clock size={12} />
            <span>Margen bajo</span>
          </div>
          <p className="mt-1 text-xl font-medium text-mate-700">{conMargenBajo}</p>
          <p className="text-xs text-mate-400">debajo del {pm.margen_minimo ?? 30}%</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Buscar producto o categoría…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="input sm:w-48"
        >
          <option value="nombre">Ordenar por nombre</option>
          <option value="margen">Ordenar por margen</option>
          <option value="rotacion">Ordenar por rotación</option>
          <option value="plata">Ordenar por plata invertida</option>
          <option value="dias">Ordenar por días sin venta</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-crema-200 bg-crema-50 text-left text-xs uppercase tracking-wider text-mate-400">
                <th className="px-3 py-2.5 font-medium">Producto</th>
                <th className="px-3 py-2.5 text-center font-medium">Stock</th>
                <th className="px-3 py-2.5 text-right font-medium">Venta</th>
                <th className="px-3 py-2.5 text-right font-medium">Costo</th>
                <th className="px-3 py-2.5 text-right font-medium">Margen</th>
                <th className="px-3 py-2.5 text-right font-medium">Rot.</th>
                <th className="px-3 py-2.5 text-right font-medium">Días</th>
                <th className="px-3 py-2.5 text-right font-medium">Invertido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-crema-200">
              {sorted.map((s) => (
                <tr key={s.id} className="hover:bg-crema-50/50 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-mate-700">{s.nombre}</div>
                    <div className="text-xs text-mate-400">{s.categoria}</div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={s.stock_actual === 0 ? 'text-alerta-500 font-medium' : s.stock_actual <= 1 ? 'text-warning-600' : 'text-mate-700'}>
                      {s.stock_actual}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-mate-700">{formatARS(s.precio_venta)}</td>
                  <td className="px-3 py-2.5 text-right text-mate-600">{formatARS(s.costo_vigente)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {s.margen !== null ? (
                      <span className={s.margen < (pm.margen_minimo ?? 30) ? 'text-alerta-500 font-medium' : s.margen >= (pm.margen_reforzar ?? 40) ? 'text-positivo-500 font-medium' : 'text-mate-700'}>
                        {formatNumber(s.margen, 1)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-mate-600">
                    {s.rotacion_dias !== null ? `${s.rotacion_dias}d` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {s.dias_desde_ultima_venta !== null ? (
                      <span className={s.dias_desde_ultima_venta > (pm.dias_sin_venta_no_recomprar ?? 60) ? 'text-alerta-500 font-medium' : 'text-mate-600'}>
                        {s.dias_desde_ultima_venta}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-mate-700">{formatARS(s.plata_invertida)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
