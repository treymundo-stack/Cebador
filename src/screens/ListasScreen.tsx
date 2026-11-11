import { useEffect, useState, useCallback } from 'react';
import {
  Upload, FileText, Plus, Pencil, Trash2, Check, Archive,
  ChevronDown, ChevronRight, Link2, Unlink, ArrowLeft, Scale,
} from 'lucide-react';
import {
  fetchListas, createLista, updateLista, deleteLista,
  createItemLista, updateItemLista, deleteItemLista,
  fetchProveedores, fetchProductos, uploadListaArchivo,
} from '@/lib/data';
import { compararCostos, detectarAumentos } from '@/lib/calculations';
import { useAuth } from '@/context/AuthContext';
import { formatARS, formatDate } from '@/lib/format';
import type { ListaPrecios, ItemLista, Proveedor, Producto } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { FullSpinner, ErrorState, EmptyState } from '@/components/ui/Feedback';

type View = 'main' | 'detalle' | 'comparativa';

export function ListasScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listas, setListas] = useState<ListaPrecios[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [view, setView] = useState<View>('main');
  const [selectedLista, setSelectedLista] = useState<ListaPrecios | null>(null);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'nueva' | 'archivo' | 'texto'>('nueva');
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemLista | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Forms
  const [listaForm, setListaForm] = useState({ proveedor_id: '', fecha: new Date().toISOString().split('T')[0] });
  const [archivoFile, setArchivoFile] = useState<File | null>(null);
  const [textoPegado, setTextoPegado] = useState('');
  const [itemForm, setItemForm] = useState({ descripcion_original: '', producto_id: '', costo: 0, minimo_compra: 1 });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, p, prod] = await Promise.all([fetchListas(), fetchProveedores(), fetchProductos()]);
      setListas(l);
      setProveedores(p);
      setProductos(prod);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las listas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reloadListas = async () => {
    const l = await fetchListas();
    setListas(l);
    if (selectedLista) {
      const updated = l.find((x) => x.id === selectedLista.id);
      if (updated) setSelectedLista(updated);
    }
  };

  // === Nueva lista ===
  const openNuevaLista = () => {
    setModalMode('nueva');
    setListaForm({ proveedor_id: proveedores[0]?.id ?? '', fecha: new Date().toISOString().split('T')[0] });
    setArchivoFile(null);
    setTextoPegado('');
    setFormError(null);
    setModalOpen(true);
  };

  const openArchivoLista = () => {
    setModalMode('archivo');
    setListaForm({ proveedor_id: proveedores[0]?.id ?? '', fecha: new Date().toISOString().split('T')[0] });
    setArchivoFile(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openTextoLista = () => {
    setModalMode('texto');
    setListaForm({ proveedor_id: proveedores[0]?.id ?? '', fecha: new Date().toISOString().split('T')[0] });
    setTextoPegado('');
    setFormError(null);
    setModalOpen(true);
  };

  const saveNuevaLista = async () => {
    if (!listaForm.proveedor_id) { setFormError('Seleccioná un proveedor'); return; }
    setSaving(true);
    try {
      let archivoUrl: string | null = null;
      if (modalMode === 'archivo' && archivoFile && user) {
        archivoUrl = await uploadListaArchivo(archivoFile, user.id);
      }
      await createLista({
        proveedor_id: listaForm.proveedor_id,
        fecha: listaForm.fecha,
        archivo_url: archivoUrl,
      });

      // Si es texto pegado, crear items automáticamente
      if (modalMode === 'texto' && textoPegado.trim()) {
        const nuevaLista = await createLista({
          proveedor_id: listaForm.proveedor_id,
          fecha: listaForm.fecha,
        });
        const lineas = textoPegado.trim().split('\n').filter((l) => l.trim());
        for (const linea of lineas) {
          // Formato esperado: "descripcion, costo, minimo" o solo "descripcion"
          const parts = linea.split(',').map((s) => s.trim());
          const descripcion = parts[0];
          const costo = parseFloat(parts[1]) || 0;
          const minimo = parseInt(parts[2]) || 1;
          if (descripcion) {
            await createItemLista({
              lista_id: nuevaLista.id,
              descripcion_original: descripcion,
              costo,
              minimo_compra: minimo,
            });
          }
        }
      }

      setModalOpen(false);
      await reloadListas();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear la lista');
    } finally {
      setSaving(false);
    }
  };

  // === Items ===
  const openNewItem = () => {
    setEditingItem(null);
    setItemForm({ descripcion_original: '', producto_id: '', costo: 0, minimo_compra: 1 });
    setFormError(null);
    setItemModalOpen(true);
  };

  const openEditItem = (item: ItemLista) => {
    setEditingItem(item);
    setItemForm({
      descripcion_original: item.descripcion_original,
      producto_id: item.producto_id ?? '',
      costo: item.costo,
      minimo_compra: item.minimo_compra,
    });
    setFormError(null);
    setItemModalOpen(true);
  };

  const saveItem = async () => {
    if (!selectedLista) return;
    if (!itemForm.descripcion_original.trim()) { setFormError('La descripción es obligatoria'); return; }
    if (itemForm.costo < 0) { setFormError('El costo no puede ser negativo'); return; }
    setSaving(true);
    try {
      const payload = {
        descripcion_original: itemForm.descripcion_original.trim(),
        producto_id: itemForm.producto_id || null,
        costo: itemForm.costo,
        minimo_compra: itemForm.minimo_compra,
      };
      if (editingItem) {
        await updateItemLista(editingItem.id, payload);
      } else {
        await createItemLista({ lista_id: selectedLista.id, ...payload });
      }
      setItemModalOpen(false);
      await reloadListas();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar el renglón');
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (id: string) => {
    if (!confirm('¿Eliminar este renglón?')) return;
    try {
      await deleteItemLista(id);
      await reloadListas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const asociarProducto = async (item: ItemLista, productoId: string) => {
    try {
      await updateItemLista(item.id, { producto_id: productoId || null });
      await reloadListas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asociar');
    }
  };

  // === Estado lista ===
  const confirmarLista = async (lista: ListaPrecios) => {
    const sinAsociar = (lista.items_lista ?? []).filter((i) => !i.producto_id);
    if (sinAsociar.length > 0) {
      if (!confirm(`Hay ${sinAsociar.length} renglón(es) sin producto asociado. No se usarán en los cálculos. ¿Confirmar igual?`)) return;
    }
    try {
      await updateLista(lista.id, { estado: 'confirmada' });
      await reloadListas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar');
    }
  };

  const archivarLista = async (lista: ListaPrecios) => {
    try {
      await updateLista(lista.id, { estado: 'archivada' });
      await reloadListas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al archivar');
    }
  };

  const removeLista = async (id: string) => {
    if (!confirm('¿Eliminar esta lista y todos sus renglones?')) return;
    try {
      await deleteLista(id);
      if (selectedLista?.id === id) { setSelectedLista(null); setView('main'); }
      await reloadListas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  if (loading) return <FullSpinner label="Cargando listas…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  // === Vista detalle ===
  if (view === 'detalle' && selectedLista) {
    const items = selectedLista.items_lista ?? [];
    const sinAsociar = items.filter((i) => !i.producto_id).length;
    return (
      <div className="space-y-4">
        <button onClick={() => { setView('main'); setSelectedLista(null); }} className="btn-ghost -ml-2">
          <ArrowLeft size={16} /> Volver
        </button>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-medium text-mate-700" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
                {selectedLista.proveedor?.nombre ?? 'Lista'}
              </h2>
              <p className="text-sm text-mate-400 mt-0.5">{formatDate(selectedLista.fecha)}</p>
            </div>
            <span className={`badge-${
              selectedLista.estado === 'confirmada' ? 'confirmada' :
              selectedLista.estado === 'archivada' ? 'archivada' : 'borrador'
            }`}>{selectedLista.estado}</span>
          </div>

          {selectedLista.archivo_url && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-crema-200 px-3 py-2 text-sm text-mate-500">
              <FileText size={14} />
              <span className="truncate">Archivo subido: {selectedLista.archivo_url.split('/').pop()}</span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {selectedLista.estado === 'borrador' && (
              <button onClick={() => confirmarLista(selectedLista)} className="btn-primary text-xs">
                <Check size={14} /> Confirmar lista
              </button>
            )}
            {selectedLista.estado !== 'archivada' && (
              <button onClick={() => archivarLista(selectedLista)} className="btn-secondary text-xs">
                <Archive size={14} /> Archivar
              </button>
            )}
            <button onClick={() => removeLista(selectedLista.id)} className="btn-ghost text-xs text-alerta-500 hover:bg-alerta-50">
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        </div>

        {sinAsociar > 0 && selectedLista.estado === 'borrador' && (
          <Alert variant="warning">
            {sinAsociar} renglón(es) sin producto asociado. No se usarán en los cálculos hasta que los asocies.
          </Alert>
        )}

        {/* Renglones */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-mate-600" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
              Renglones ({items.length})
            </h3>
            {selectedLista.estado === 'borrador' && (
              <button onClick={openNewItem} className="btn-primary text-xs">
                <Plus size={14} /> Agregar
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <EmptyState title="Sin renglones" description="Agregá renglones manualmente a esta lista." />
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-mate-700 text-sm truncate">{item.descripcion_original}</p>
                      <p className="text-xs text-mate-400 mt-0.5">
                        Costo: {formatARS(item.costo)} · Mín: {item.minimo_compra} u.
                      </p>
                      {item.producto_id ? (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-positivo-600">
                          <Link2 size={12} />
                          <span>{productos.find((p) => p.id === item.producto_id)?.nombre ?? 'Producto asociado'}</span>
                        </div>
                      ) : (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-warning-600">
                          <Unlink size={12} />
                          <span>Sin asociar</span>
                        </div>
                      )}
                    </div>
                    {selectedLista.estado === 'borrador' && (
                      <div className="flex gap-1">
                        <button onClick={() => openEditItem(item)} className="rounded-lg p-1.5 text-mate-400 hover:bg-crema-200 hover:text-mate-600 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => removeItem(item.id)} className="rounded-lg p-1.5 text-mate-400 hover:bg-alerta-50 hover:text-alerta-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Asociar producto */}
                  {selectedLista.estado === 'borrador' && (
                    <div className="mt-2">
                      <select
                        value={item.producto_id ?? ''}
                        onChange={(e) => asociarProducto(item, e.target.value)}
                        className="input py-1.5 text-xs"
                      >
                        <option value="">Sin asociar…</option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal item */}
        <Modal
          open={itemModalOpen}
          onClose={() => setItemModalOpen(false)}
          title={editingItem ? 'Editar renglón' : 'Nuevo renglón'}
          size="md"
        >
          {formError && <Alert variant="error" className="mb-4">{formError}</Alert>}
          <div className="space-y-4">
            <div>
              <label className="label">Descripción original</label>
              <input
                type="text"
                value={itemForm.descripcion_original}
                onChange={(e) => setItemForm({ ...itemForm, descripcion_original: e.target.value })}
                className="input"
                placeholder="Como aparece en la lista del proveedor"
              />
            </div>
            <div>
              <label className="label">Asociar a producto</label>
              <select
                value={itemForm.producto_id}
                onChange={(e) => setItemForm({ ...itemForm, producto_id: e.target.value })}
                className="input"
              >
                <option value="">Sin asociar</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Costo unitario</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={itemForm.costo}
                  onChange={(e) => setItemForm({ ...itemForm, costo: parseFloat(e.target.value) || 0 })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Mínimo de compra</label>
                <input
                  type="number"
                  min={1}
                  value={itemForm.minimo_compra}
                  onChange={(e) => setItemForm({ ...itemForm, minimo_compra: parseInt(e.target.value) || 1 })}
                  className="input"
                />
              </div>
            </div>
            <button onClick={saveItem} disabled={saving} className="btn-primary w-full">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  // === Vista comparativa ===
  if (view === 'comparativa') {
    const comparacion = compararCostos(listas);
    const aumentos = detectarAumentos(listas, 5);
    const proveedorNombres = [...new Set(listas.filter(l => l.estado === 'confirmada' && l.proveedor).map(l => l.proveedor!.nombre))];

    return (
      <div className="space-y-4">
        <button onClick={() => setView('main')} className="btn-ghost -ml-2">
          <ArrowLeft size={16} /> Volver
        </button>

        <h2 className="text-2xl font-medium text-mate-700" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          Comparativa de costos
        </h2>

        {aumentos.length > 0 && (
          <Alert variant="warning" title={`${aumentos.length} aumento(s) detectado(s)`}>
            <ul className="mt-1 space-y-0.5">
              {aumentos.map((a, i) => (
                <li key={i}>
                  {a.proveedor_nombre}: {a.producto_nombre} subió de {formatARS(a.costo_anterior)} a {formatARS(a.costo_actual)} (+{a.porcentaje}%)
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {comparacion.length === 0 ? (
          <EmptyState title="Sin datos para comparar" description="Confirmá al menos dos listas de proveedores distintos para ver la comparativa." />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-crema-200 bg-crema-50 text-left text-xs uppercase tracking-wider text-mate-400">
                    <th className="px-3 py-2.5 font-medium">Producto</th>
                    {proveedorNombres.map((pn) => (
                      <th key={pn} className="px-3 py-2.5 text-right font-medium">{pn}</th>
                    ))}
                    <th className="px-3 py-2.5 text-right font-medium">Más barato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-crema-200">
                  {comparacion.map((c) => (
                    <tr key={c.producto_id} className="hover:bg-crema-50/50 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-mate-700">{c.producto_nombre}</td>
                      {proveedorNombres.map((pn) => {
                        const costo = c.costos.find((co) => co.proveedor_nombre === pn);
                        return (
                          <td key={pn} className="px-3 py-2.5 text-right">
                            {costo ? (
                              <span className={costo.es_minimo ? 'text-positivo-600 font-medium' : 'text-mate-600'}>
                                {formatARS(costo.costo)}
                              </span>
                            ) : '—'}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right text-positivo-600 font-medium text-xs">
                        {c.proveedor_minimo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // === Vista principal ===
  const listasBorrador = listas.filter((l) => l.estado === 'borrador');
  const listasConfirmadas = listas.filter((l) => l.estado === 'confirmada');
  const listasArchivadas = listas.filter((l) => l.estado === 'archivada');

  const renderListaCard = (lista: ListaPrecios) => {
    const items = lista.items_lista ?? [];
    const sinAsociar = items.filter((i) => !i.producto_id).length;
    return (
      <div
        key={lista.id}
        className="card cursor-pointer p-4 transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
        onClick={() => { setSelectedLista(lista); setView('detalle'); }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-mate-700 truncate">{lista.proveedor?.nombre ?? 'Sin proveedor'}</p>
            <p className="text-xs text-mate-400 mt-0.5">{formatDate(lista.fecha)} · {items.length} renglón(es)</p>
            {sinAsociar > 0 && lista.estado === 'borrador' && (
              <p className="text-xs text-warning-600 mt-0.5">{sinAsociar} sin asociar</p>
            )}
            {lista.archivo_url && (
              <p className="text-xs text-mate-400 mt-0.5 flex items-center gap-1">
                <FileText size={10} /> Con archivo
              </p>
            )}
          </div>
          <span className={`badge-${
            lista.estado === 'confirmada' ? 'confirmada' :
            lista.estado === 'archivada' ? 'archivada' : 'borrador'
          }`}>{lista.estado}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-mate-700" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
            Listas de proveedores
          </h1>
          <p className="text-sm text-mate-400 mt-0.5">Subí listas, cargá renglones y compará costos.</p>
        </div>
        <button
          onClick={() => setView('comparativa')}
          className="btn-secondary text-xs shrink-0"
          disabled={listasConfirmadas.length === 0}
        >
          <Scale size={14} /> Comparar
        </button>
      </div>

      {/* Acciones */}
      {proveedores.length === 0 ? (
        <EmptyState
          title="Sin proveedores"
          description="Agregá proveedores desde Configuración para poder crear listas."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button onClick={openNuevaLista} className="card flex items-center gap-3 p-3 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mate-100 text-mate-600">
              <Plus size={18} />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-mate-700">Lista vacía</p>
              <p className="text-xs text-mate-400">Cargar renglones a mano</p>
            </div>
          </button>
          <button onClick={openArchivoLista} className="card flex items-center gap-3 p-3 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mate-100 text-mate-600">
              <Upload size={18} />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-mate-700">Subir archivo</p>
              <p className="text-xs text-mate-400">PDF, Excel o imagen</p>
            </div>
          </button>
          <button onClick={openTextoLista} className="card flex items-center gap-3 p-3 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mate-100 text-mate-600">
              <FileText size={18} />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-mate-700">Pegar texto</p>
              <p className="text-xs text-mate-400">Descripción, costo, mínimo</p>
            </div>
          </button>
        </div>
      )}

      {/* Listas por estado */}
      {proveedores.length > 0 && (
        <>
          {listasBorrador.length > 0 && (
            <Section title="Borradores" count={listasBorrador.length}>
              {listasBorrador.map(renderListaCard)}
            </Section>
          )}
          {listasConfirmadas.length > 0 && (
            <Section title="Confirmadas" count={listasConfirmadas.length}>
              {listasConfirmadas.map(renderListaCard)}
            </Section>
          )}
          {listasArchivadas.length > 0 && (
            <Section title="Archivadas" count={listasArchivadas.length}>
              {listasArchivadas.map(renderListaCard)}
            </Section>
          )}
          {listas.length === 0 && (
            <EmptyState title="Sin listas" description="Creá tu primera lista de precios." />
          )}
        </>
      )}

      {/* Modal nueva lista */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          modalMode === 'archivo' ? 'Subir archivo de lista' :
          modalMode === 'texto' ? 'Pegar texto de lista' :
          'Nueva lista vacía'
        }
      >
        {formError && <Alert variant="error" className="mb-4">{formError}</Alert>}
        <div className="space-y-4">
          <div>
            <label className="label">Proveedor</label>
            <select
              value={listaForm.proveedor_id}
              onChange={(e) => setListaForm({ ...listaForm, proveedor_id: e.target.value })}
              className="input"
            >
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Fecha</label>
            <input
              type="date"
              value={listaForm.fecha}
              onChange={(e) => setListaForm({ ...listaForm, fecha: e.target.value })}
              className="input"
            />
          </div>

          {modalMode === 'archivo' && (
            <div>
              <label className="label">Archivo</label>
              <input
                type="file"
                accept=".pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
                onChange={(e) => setArchivoFile(e.target.files?.[0] ?? null)}
                className="input py-2"
              />
              <p className="text-xs text-mate-400 mt-1.5">
                El archivo se guarda en Storage privado. Los renglones se cargan manualmente: la lectura automática con IA quedará para una próxima etapa.
              </p>
            </div>
          )}

          {modalMode === 'texto' && (
            <div>
              <label className="label">Texto de la lista</label>
              <textarea
                value={textoPegado}
                onChange={(e) => setTextoPegado(e.target.value)}
                className="input h-32 resize-none"
                placeholder="Un renglón por línea. Formato: descripción, costo, mínimo&#10;Ej: Bombilla alpaca pico loro, 8500, 2"
              />
              <p className="text-xs text-mate-400 mt-1.5">
                Se crea un renglón por línea. Después podés asociar cada uno a un producto.
              </p>
            </div>
          )}

          <button onClick={saveNuevaLista} disabled={saving} className="btn-primary w-full">
            {saving ? 'Creando…' : 'Crear lista'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-medium text-mate-600" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
        {title} <span className="text-sm text-mate-400">({count})</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{children}</div>
    </div>
  );
}
