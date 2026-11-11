import { useEffect, useState, useCallback, useMemo } from 'react';
import { Package, DollarSign } from 'lucide-react';
import { fetchStockInversion, fetchParametros } from '@/lib/data';
import { paramMap } from '@/lib/calculations';
import { clasificarTodo, plataParada, umbralesDesde, CLASIFICACION_LABEL, type Clasificacion } from '@/lib/reglas';
import { formatARS, formatNumber } from '@/lib/format';
import type { StockInversion, Parametro } from '@/types';
import { FullSpinner, ErrorState, EmptyState } from '@/components/ui/Feedback';
import { ClasificacionBadge } from '@/components/ui/ClasificacionBadge';

const ORDEN_CLASES: Clasificacion[] = ['reforzar', 'mantener', 'revisar_precio', 'no_recomprar'];
const COLOR_CLASE: Record<Clasificacion, string> = {
  reforzar: 'text-positivo-600',
  mantener: 'text-mate-600',
  revisar_precio: 'text-warning-600',
  no_recomprar: 'text-alerta-500',
};

export function StockScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stock, setStock] = useState<StockInversion[]>([]);
  const [params, setParams] = useState<Parametro[]>([]);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<Clasificacion | 'todas'>('todas');
  const [sortBy, setSortBy] = useState<'clasificacion' | 'nombre' | 'margen' | 'rotacion' | 'plata' | 'dias'>('clasificacion');

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

  const u = useMemo(() => umbralesDesde(paramMap(params)), [params]);
  const clasificado = useMemo(() => clasificarTodo(stock, u), [stock, u]);

  if (loading) return <FullSpinner label="Cargando stock…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (stock.length === 0) {
    return <EmptyState title="Sin productos" description="Cargá productos desde Productos y ventas, o datos de prueba desde Configuración." />;
  }

  const parada = plataParada(stock, u);
  const totalInvertido = stock.reduce((sum, s) => sum + Number(s.plata_invertida), 0);
  const conteo = ORDEN_CLASES.map((c) => ({
    c,
    n: clasificado.filter((s) => s.clasificacion === c).length,
    plata: clasificado.filter((s) => s.clasificacion === c).reduce((sum, s) => sum + Number(s.plata_invertida), 0),
  }));

  const q = search.toLowerCase();
  const filtered = clasificado.filter(
    (s) =>
      (filtro === 'todas' || s.clasificacion === filtro) &&
      (s.nombre.toLowerCase().includes(q) || s.categoria.toLowerCase().includes(q)),
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'clasificacion':
        return ORDEN_CLASES.indexOf(a.clasificacion) - ORDEN_CLASES.indexOf(b.clasificacion) || a.nombre.localeCompare(b.nombre);
      case 'margen':
        return (b.margen ?? -999) - (a.margen ?? -999);
      case 'rotacion':
        return (a.rotacion_dias ?? 999) - (b.rotacion_dias ?? 999);
      case 'plata':
        return b.plata_invertida - a.plata_invertida;
      case 'dias':
        return (b.dias_desde_ultima_venta ?? 9999) - (a.dias_desde_ultima_venta ?? 9999);
      default:
        return a.nombre.localeCompare(b.nombre);
    }
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium text-mate-700" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          Stock como inversión
        </h1>
        <p className="text-sm text-mate-400 mt-0.5">Tu mercadería es tu capital. Mirá cómo está rindiendo.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs text-mate-400"><DollarSign size={12} /><span>Plata invertida</span></div>
          <p className="mt-1 text-xl font-medium text-mate-700">{formatARS(totalInvertido)}</p>
          <p className="text-xs text-mate-400">stock × costo vigente</p>
        </div>
        <div className="card p-4 border-alerta-100">
          <div className="flex items-center gap-1.5 text-xs text-alerta-500"><Package size={12} /><span>Plata parada</span></div>
          <p className="mt-1 text-xl font-medium text-alerta-500">{formatARS(parada)}</p>
          <p className="text-xs text-mate-400">
            {totalInvertido > 0 ? `${Math.round((parada / totalInvertido) * 100)}% del stock · ` : ''}sin ventas +{u.diasSinVentaNoRecomprar} días
          </p>
        </div>
      </div>

      {/* Productos por clasificación */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {conteo.map(({ c, n, plata }) => (
          <button
            key={c}
            onClick={() => setFiltro(filtro === c ? 'todas' : c)}
            className={`card p-3 text-left transition-all ${filtro === c ? 'ring-2 ring-mate-400' : 'hover:shadow-md'}`}
          >
            <p className={`text-xs font-medium ${COLOR_CLASE[c]}`}>{CLASIFICACION_LABEL[c]}</p>
            <p className="text-xl font-medium text-mate-700">{n}</p>
            <p className="text-xs text-mate-400">{formatARS(plata)}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Buscar producto o categoría…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1"
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="input sm:w-52">
          <option value="clasificacion">Ordenar por clasificación</option>
          <option value="nombre">Ordenar por nombre</option>
          <option value="margen">Ordenar por margen</option>
          <option value="rotacion">Ordenar por rotación</option>
          <option value="plata">Ordenar por plata invertida</option>
          <option value="dias">Ordenar por días sin venta</option>
        </select>
      </div>

      {/* Listado: tarjetas, cómodo en el celular */}
      <div className="space-y-2">
        {sorted.map((s) => (
          <div key={s.id} className="card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-mate-700 text-sm">{s.nombre}</p>
                <p className="text-xs text-mate-400">
                  {s.categoria}
                  {s.tendencia === 'en_alza' && ' · en alza'}
                  {s.tendencia === 'en_baja' && ' · en baja'}
                </p>
              </div>
              <ClasificacionBadge value={s.clasificacion} />
            </div>
            <p className="mt-1.5 text-xs text-mate-600">{s.motivo}</p>
            <dl className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-x-3 gap-y-1 text-xs">
              <Dato label="Stock" valor={String(s.stock_actual)} alerta={s.stock_actual === 0} />
              <Dato label="Costo" valor={formatARS(s.costo_vigente)} sub={s.proveedor_nombre ?? undefined} />
              <Dato
                label="Margen"
                valor={s.margen !== null ? `${formatNumber(s.margen, 1)}%` : '—'}
                alerta={s.margen !== null && s.margen < u.margenMinimo}
              />
              <Dato
                label="Rotación"
                valor={s.rotacion_dias !== null ? `${formatNumber(s.rotacion_dias, 1)} d` : '—'}
                sub={`${s.unidades_90d} u. en 90 d`}
              />
              <Dato
                label="Última venta"
                valor={s.dias_desde_ultima_venta !== null ? `hace ${s.dias_desde_ultima_venta} d` : 'nunca'}
                alerta={s.dias_desde_ultima_venta !== null && s.dias_desde_ultima_venta > u.diasSinVentaNoRecomprar}
              />
              <Dato label="Invertido" valor={formatARS(s.plata_invertida)} />
            </dl>
          </div>
        ))}
        {sorted.length === 0 && <EmptyState title="Sin resultados" />}
      </div>
    </div>
  );
}

function Dato({ label, valor, sub, alerta }: { label: string; valor: string; sub?: string; alerta?: boolean }) {
  return (
    <div>
      <dt className="text-mate-400">{label}</dt>
      <dd className={`font-medium ${alerta ? 'text-alerta-500' : 'text-mate-700'}`}>{valor}</dd>
      {sub && <dd className="text-[11px] text-mate-400 truncate">{sub}</dd>}
    </div>
  );
}
