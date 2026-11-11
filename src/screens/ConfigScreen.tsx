import { useEffect, useState, useCallback } from 'react';
import { Truck, Calendar, SlidersHorizontal, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  fetchProveedores, createProveedor, updateProveedor, deleteProveedor,
  fetchFechasComerciales, createFechaComercial, updateFechaComercial, deleteFechaComercial,
  fetchParametros, upsertParametro,
} from '@/lib/data';
import { formatDate } from '@/lib/format';
import type { Proveedor, FechaComercial, Parametro, Prioridad } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { FullSpinner, ErrorState, EmptyState } from '@/components/ui/Feedback';

type Tab = 'proveedores' | 'fechas' | 'parametros';

const PARAM_LABELS: Record<string, { label: string; suffix: string; desc: string }> = {
  margen_minimo: { label: 'Margen mínimo', suffix: '%', desc: 'Por debajo de este margen, revisar precio.' },
  margen_reforzar: { label: 'Margen para reforzar', suffix: '%', desc: 'Margen desde el cual un producto puede reforzarse.' },
  rotacion_reforzar_dias: { label: 'Rotación para reforzar', suffix: ' días', desc: 'Rotación máxima para considerar reforzar.' },
  dias_sin_venta_no_recomprar: { label: 'Días sin venta para no recomprar', suffix: ' días', desc: 'Productos sin ventas por más de esto no se recompran.' },
  dias_grabado: { label: 'Días de grabado', suffix: ' días', desc: 'Tiempo que tarda un grabado.' },
  dias_envio: { label: 'Días de envío', suffix: ' días', desc: 'Tiempo de envío del proveedor.' },
  tope_arriesgada: { label: 'Tope compra arriesgada', suffix: '%', desc: 'Porcentaje máximo del presupuesto para productos en alza sin historial.' },
  alerta_aumento: { label: 'Alerta de aumento', suffix: '%', desc: 'A partir de este porcentaje se alerta un aumento de costo.' },
};

export function ConfigScreen() {
  const [tab, setTab] = useState<Tab>('proveedores');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [fechas, setFechas] = useState<FechaComercial[]>([]);
  const [parametros, setParametros] = useState<Parametro[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProv, setEditingProv] = useState<Proveedor | null>(null);
  const [editingFecha, setEditingFecha] = useState<FechaComercial | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [provForm, setProvForm] = useState({ nombre: '', contacto: '', dias_entrega: 7 });
  const [fechaForm, setFechaForm] = useState<{ nombre: string; fecha: string; prioridad: Prioridad }>({ nombre: '', fecha: '', prioridad: 'media' });
  const [paramEdits, setParamEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, f, pa] = await Promise.all([
        fetchProveedores(),
        fetchFechasComerciales(),
        fetchParametros(),
      ]);
      setProveedores(p);
      setFechas(f);
      setParametros(pa);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // === Proveedores ===
  const openNewProv = () => {
    setEditingProv(null);
    setProvForm({ nombre: '', contacto: '', dias_entrega: 7 });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditProv = (p: Proveedor) => {
    setEditingProv(p);
    setProvForm({ nombre: p.nombre, contacto: p.contacto ?? '', dias_entrega: p.dias_entrega });
    setFormError(null);
    setModalOpen(true);
  };

  const saveProv = async () => {
    if (!provForm.nombre.trim()) { setFormError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editingProv) {
        await updateProveedor(editingProv.id, {
          nombre: provForm.nombre.trim(),
          contacto: provForm.contacto.trim() || null,
          dias_entrega: provForm.dias_entrega,
        });
      } else {
        await createProveedor({
          nombre: provForm.nombre.trim(),
          contacto: provForm.contacto.trim() || null,
          dias_entrega: provForm.dias_entrega,
          activo: true,
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const removeProv = async (id: string) => {
    if (!confirm('¿Eliminar este proveedor? Se borrarán también sus listas de precios.')) return;
    try {
      await deleteProveedor(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  // === Fechas ===
  const openNewFecha = () => {
    setEditingFecha(null);
    setFechaForm({ nombre: '', fecha: '', prioridad: 'media' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditFecha = (f: FechaComercial) => {
    setEditingFecha(f);
    setFechaForm({ nombre: f.nombre, fecha: f.fecha, prioridad: f.prioridad });
    setFormError(null);
    setModalOpen(true);
  };

  const saveFecha = async () => {
    if (!fechaForm.nombre.trim()) { setFormError('El nombre es obligatorio'); return; }
    if (!fechaForm.fecha) { setFormError('La fecha es obligatoria'); return; }
    setSaving(true);
    try {
      if (editingFecha) {
        await updateFechaComercial(editingFecha.id, {
          nombre: fechaForm.nombre.trim(),
          fecha: fechaForm.fecha,
          prioridad: fechaForm.prioridad,
        });
      } else {
        await createFechaComercial({
          nombre: fechaForm.nombre.trim(),
          fecha: fechaForm.fecha,
          prioridad: fechaForm.prioridad,
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const removeFecha = async (id: string) => {
    if (!confirm('¿Eliminar esta fecha comercial?')) return;
    try {
      await deleteFechaComercial(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  // === Parámetros ===
  const saveParam = async (clave: string) => {
    const val = parseFloat(paramEdits[clave]);
    if (isNaN(val)) { setFormError('Valor inválido'); return; }
    setSaving(true);
    try {
      await upsertParametro(clave, val);
      setParamEdits((prev) => { const n = { ...prev }; delete n[clave]; return n; });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar parámetro');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FullSpinner label="Cargando configuración…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium text-mate-700" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          Configuración
        </h1>
        <p className="text-sm text-mate-400 mt-0.5">Proveedores, fechas comerciales y parámetros.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-crema-200 p-1">
        {([
          { key: 'proveedores' as const, label: 'Proveedores', icon: Truck },
          { key: 'fechas' as const, label: 'Fechas', icon: Calendar },
          { key: 'parametros' as const, label: 'Parámetros', icon: SlidersHorizontal },
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

      {/* Proveedores */}
      {tab === 'proveedores' && (
        <div className="space-y-3">
          <button onClick={openNewProv} className="btn-primary w-full">
            <Plus size={16} /> Nuevo proveedor
          </button>
          {proveedores.length === 0 ? (
            <EmptyState title="Sin proveedores" description="Agregá tu primer proveedor." />
          ) : (
            proveedores.map((p) => (
              <div key={p.id} className="card flex items-start justify-between p-4">
                <div>
                  <p className="font-medium text-mate-700">{p.nombre}</p>
                  {p.contacto && <p className="text-sm text-mate-400 mt-0.5">{p.contacto}</p>}
                  <p className="text-xs text-mate-400 mt-1">
                    {p.dias_entrega} días de entrega {p.activo ? '' : '· Inactivo'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditProv(p)} className="rounded-lg p-2 text-mate-400 hover:bg-crema-200 hover:text-mate-600 transition-colors">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => removeProv(p.id)} className="rounded-lg p-2 text-mate-400 hover:bg-alerta-50 hover:text-alerta-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Fechas */}
      {tab === 'fechas' && (
        <div className="space-y-3">
          <button onClick={openNewFecha} className="btn-primary w-full">
            <Plus size={16} /> Nueva fecha
          </button>
          {fechas.length === 0 ? (
            <EmptyState title="Sin fechas" description="Agregá fechas comerciales como Navidad o Día de la Madre." />
          ) : (
            fechas.map((f) => (
              <div key={f.id} className="card flex items-start justify-between p-4">
                <div>
                  <p className="font-medium text-mate-700">{f.nombre}</p>
                  <p className="text-sm text-mate-400 mt-0.5">{formatDate(f.fecha)}</p>
                  <span className={`badge mt-1.5 ${
                    f.prioridad === 'alta' ? 'bg-alerta-100 text-alerta-600' :
                    f.prioridad === 'media' ? 'bg-warning-100 text-warning-600' :
                    'bg-crema-200 text-mate-400'
                  }`}>{f.prioridad}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditFecha(f)} className="rounded-lg p-2 text-mate-400 hover:bg-crema-200 hover:text-mate-600 transition-colors">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => removeFecha(f.id)} className="rounded-lg p-2 text-mate-400 hover:bg-alerta-50 hover:text-alerta-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Parámetros */}
      {tab === 'parametros' && (
        <div className="space-y-3">
          {parametros.length === 0 ? (
            <EmptyState title="Sin parámetros" />
          ) : (
            parametros.map((p) => {
              const meta = PARAM_LABELS[p.clave] ?? { label: p.clave, suffix: '', desc: '' };
              const editVal = paramEdits[p.clave];
              const isEditing = editVal !== undefined;
              return (
                <div key={p.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-mate-700">{meta.label}</p>
                      <p className="text-xs text-mate-400 mt-0.5">{meta.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={editVal}
                            onChange={(e) => setParamEdits((prev) => ({ ...prev, [p.clave]: e.target.value }))}
                            className="input w-24 py-1.5 text-sm"
                            step="0.1"
                          />
                          <button
                            onClick={() => saveParam(p.clave)}
                            disabled={saving}
                            className="btn-primary py-1.5 text-xs"
                          >
                            Guardar
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setParamEdits((prev) => ({ ...prev, [p.clave]: String(p.valor) }))}
                          className="text-lg font-medium text-mate-700 hover:text-mate-500"
                        >
                          {p.valor}{meta.suffix}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={tab === 'proveedores' ? (editingProv ? 'Editar proveedor' : 'Nuevo proveedor') : (editingFecha ? 'Editar fecha' : 'Nueva fecha')}
      >
        {formError && <Alert variant="error" className="mb-4">{formError}</Alert>}

        {tab === 'proveedores' && (
          <div className="space-y-4">
            <div>
              <label className="label">Nombre</label>
              <input
                type="text"
                value={provForm.nombre}
                onChange={(e) => setProvForm({ ...provForm, nombre: e.target.value })}
                className="input"
                placeholder="Proveedor A"
              />
            </div>
            <div>
              <label className="label">Contacto</label>
              <input
                type="text"
                value={provForm.contacto}
                onChange={(e) => setProvForm({ ...provForm, contacto: e.target.value })}
                className="input"
                placeholder="WhatsApp, email, Instagram…"
              />
            </div>
            <div>
              <label className="label">Días de entrega</label>
              <input
                type="number"
                min={0}
                value={provForm.dias_entrega}
                onChange={(e) => setProvForm({ ...provForm, dias_entrega: parseInt(e.target.value) || 0 })}
                className="input"
              />
            </div>
            <button onClick={saveProv} disabled={saving} className="btn-primary w-full">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}

        {tab === 'fechas' && (
          <div className="space-y-4">
            <div>
              <label className="label">Nombre</label>
              <input
                type="text"
                value={fechaForm.nombre}
                onChange={(e) => setFechaForm({ ...fechaForm, nombre: e.target.value })}
                className="input"
                placeholder="Navidad, Día de la Madre…"
              />
            </div>
            <div>
              <label className="label">Fecha</label>
              <input
                type="date"
                value={fechaForm.fecha}
                onChange={(e) => setFechaForm({ ...fechaForm, fecha: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Prioridad</label>
              <select
                value={fechaForm.prioridad}
                onChange={(e) => setFechaForm({ ...fechaForm, prioridad: e.target.value as 'alta' | 'media' | 'baja' })}
                className="input"
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <button onClick={saveFecha} disabled={saving} className="btn-primary w-full">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
