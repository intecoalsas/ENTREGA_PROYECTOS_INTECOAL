import React, { useState } from 'react';
import { DOCUMENT_CATALOG } from '../data/documentsCatalog';
import {
  Search,
  FileCheck2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Plus,
  Edit3,
  Pencil,
  X,
  FileText,
  ReceiptText
} from 'lucide-react';

export const RadicacionesList = ({
  filings,
  allFilings,
  ultimoGlobal,
  onSelectFiling,
  onEvaluateFiling,
  onEditFiling,
  onDeleteFiling,
  onNewFiling,
  onFormatoC,
  onReciboTecnico,
  onRetrySync,
  syncingId,
  userRole = 'interventor',
  currentUser
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMunicipio, setSelectedMunicipio] = useState('TODOS');
  const [selectedEstado, setSelectedEstado] = useState('TODOS');
  const [selectedTipo, setSelectedTipo] = useState('TODOS');

  const baseGlobal = (allFilings && allFilings.length ? allFilings : filings) || [];
  const ultimoCalculado = [...baseGlobal]
    .filter(f => f && f.numeroRadicado)
    .sort((a, b) => (b.numeroRadicado || '').localeCompare(a.numeroRadicado || ''))[0];
  const ultimoId = ultimoGlobal?.id || ultimoCalculado?.id || null;

  const filtered = filings.filter(f => {
    if (!f) return false;
    const meta = f.metadata || {};
    const matchesSearch =
      (f.numeroRadicado || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (meta.nombreProyecto || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (meta.contratista || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (meta.municipio || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMuni = selectedMunicipio === 'TODOS' || meta.municipio === selectedMunicipio;
    const matchesEstado = selectedEstado === 'TODOS' || f.estado === selectedEstado;
    const matchesTipo = selectedTipo === 'TODOS' || meta.tipoEntrega === selectedTipo;

    return matchesSearch && matchesMuni && matchesEstado && matchesTipo;
  });

  const totalCount = filings.length;
  const aprobadasCount = filings.filter(f => f.estado === 'Aprobado').length;
  const enRevisionCount = filings.filter(f => f.estado === 'En Revisión').length;
  const conObsCount = filings.filter(f => f.estado === 'Con Observaciones').length;
  const pendientesCount = filings.filter(f => f.estado === 'Radicado').length;

  const municipiosList = Array.from(new Set(filings.map(f => f?.metadata?.municipio).filter(Boolean)));

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 font-sans">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
              Total
            </span>
            <span className="text-3xl font-black text-gray-900 mt-1 block">
              {totalCount}
            </span>
            <span className="text-xs text-gray-400 mt-1 block">Radicaciones</span>
          </div>
          <div className="bg-gray-100 p-3 rounded-lg text-[#0D0D0D]">
            <FileCheck2 className="w-6 h-6 text-[#D9CF43]" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
              Aprobados
            </span>
            <span className="text-3xl font-black text-emerald-600 mt-1 block">
              {aprobadasCount}
            </span>
            <span className="text-xs text-emerald-700 mt-1 block font-semibold">Recibidos a Conformidad</span>
          </div>
          <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
              En Revisión
            </span>
            <span className="text-3xl font-black text-violet-600 mt-1 block">
              {enRevisionCount}
            </span>
            <span className="text-xs text-violet-700 mt-1 block font-semibold">En Proceso</span>
          </div>
          <div className="bg-violet-50 p-3 rounded-lg text-violet-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
              Con Observaciones
            </span>
            <span className="text-3xl font-black text-amber-600 mt-1 block">
              {conObsCount}
            </span>
            <span className="text-xs text-amber-700 mt-1 block font-semibold">Requiere Revisión</span>
          </div>
          <div className="bg-amber-50 p-3 rounded-lg text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
              Pendientes
            </span>
            <span className="text-3xl font-black text-gray-500 mt-1 block">
              {pendientesCount}
            </span>
            <span className="text-xs text-gray-500 mt-1 block font-semibold">Sin Evaluar</span>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-gray-400">
            <FileCheck2 className="w-6 h-6" />
          </div>
        </div>

      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50/50 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-gray-900">
                Historial de Radicaciones Documentadas
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Consulte el estado y la lista de chequeo de cada entrega de proyecto.
              </p>
            </div>

            {userRole === 'contratista' && (
              <button
                onClick={onNewFiling}
                className="bg-[#1E222A] hover:bg-slate-800 text-[#D9CF43] font-black text-xs px-4 py-2.5 rounded-lg shadow transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
                title="Radicar nuevo expediente de alumbrado público"
              >
                <Plus className="w-4 h-4 text-[#D9CF43]" />
                <span>NUEVA RADICACIÓN</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por radicado, proyecto, contratista..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-900 focus:ring-2 focus:ring-[#D9CF43]"
              />
            </div>

            <div>
              <select
                value={selectedMunicipio}
                onChange={(e) => setSelectedMunicipio(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-[#D9CF43]"
              >
                <option value="TODOS">Todos los Municipios</option>
                {municipiosList.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedEstado}
                onChange={(e) => setSelectedEstado(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-[#D9CF43]"
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="Radicado">Radicado</option>
                <option value="En Revisión">En Revisión</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Con Observaciones">Con Observaciones</option>
              </select>
            </div>

            <div>
              <select
                value={selectedTipo}
                onChange={(e) => setSelectedTipo(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-[#D9CF43]"
              >
                <option value="TODOS">Todos los Tipos de Entrega</option>
                <option value="Inicio">Inicio</option>
                <option value="Subsanación">Subsanación</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0D0D0D] text-white text-xs font-extrabold uppercase tracking-wider">
                <th className="py-3 px-4">N° Radicado</th>
                <th className="py-3 px-4">Proyecto</th>
                <th className="py-3 px-4">Municipio</th>
                <th className="py-3 px-4">Contratista</th>
                <th className="py-3 px-4 text-center">Tipo</th>
                <th className="py-3 px-4 text-center">Documentos OK</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Fecha</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="font-bold">No se encontraron radicaciones con los filtros seleccionados.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((filing) => {
                  let badgeBg = 'bg-blue-100 text-blue-800 border-blue-300';
                  if (filing.estado === 'En Revisión') badgeBg = 'bg-violet-100 text-violet-800 border-violet-300';
                  if (filing.estado === 'Aprobado') badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                  if (filing.estado === 'Con Observaciones') badgeBg = 'bg-amber-100 text-amber-800 border-amber-300';

                  return (
                    <tr key={filing.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3 px-4 font-black text-gray-900 whitespace-nowrap">
                        <span className="bg-gray-100 text-[#0D0D0D] px-2 py-1 rounded border border-gray-300 font-mono text-xs">
                          {filing.numeroRadicado}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-gray-800">
                        {filing.metadata?.nombreProyecto || '—'}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-700">
                        {filing.metadata?.municipio || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-gray-800 max-w-[200px]">
                        <div className="truncate font-bold">{filing.metadata?.contratista || '—'}</div>
                        {filing.metadata?.nitContratista && (
                          <div className="text-[10px] text-gray-500 font-mono font-normal">NIT: {filing.metadata.nitContratista}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-xs font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                          {filing.metadata?.tipoEntrega || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="font-black text-xs text-gray-900">
                          {filing.documentosOk} / {filing.totalDocumentos || DOCUMENT_CATALOG.length}
                        </div>
                        <div className="w-16 bg-gray-200 rounded-full h-1.5 mx-auto mt-1">
                          <div 
                            className={`h-1.5 rounded-full ${filing.porcentajeCumplimiento === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${filing.porcentajeCumplimiento}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${badgeBg}`}>
                            {filing.estado}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            filing.estado === 'Aprobado' && filing.m365Synced
                              ? 'bg-emerald-100 text-emerald-800'
                              : filing.estado === 'Aprobado'
                              ? 'bg-amber-100 text-amber-800'
                              : filing.estado === 'En Revisión'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {filing.estado === 'Aprobado'
                              ? (filing.m365Synced ? 'Cargado en SharePoint' : 'Pendiente de subida')
                              : filing.estado === 'En Revisión' ? 'En Revisión' : 'Pendiente de Aprobación'}
                          </span>
                          {userRole === 'interventor' && filing.estado === 'Aprobado' && !filing.m365Synced && onRetrySync && (
                            <button
                              onClick={() => onRetrySync(filing)}
                              disabled={syncingId === filing.id}
                              className="bg-sky-100 hover:bg-sky-200 disabled:opacity-50 text-sky-900 font-bold text-[10px] px-2 py-0.5 rounded border border-sky-300 transition-colors cursor-pointer"
                              title="Subir ahora a SharePoint (muestra el motivo si falla)"
                            >
                              {syncingId === filing.id ? 'Subiendo…' : 'Reintentar subida'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                        {new Date(filing.fechaRadicacion).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          {userRole === 'interventor' && onEvaluateFiling && filing.estado !== 'Aprobado' && (
                            <button
                              onClick={() => onEvaluateFiling(filing)}
                              className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-xs px-2.5 py-1.5 rounded flex items-center space-x-1 transition-colors border border-amber-300 shadow-sm"
                              title="Realizar / Editar Evaluación de Interventoría"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-800" />
                              <span>Evaluar</span>
                            </button>
                          )}

                          {userRole === 'interventor' && onFormatoC && filing.estado === 'Aprobado' && (
                            <button
                              onClick={() => onFormatoC(filing)}
                              className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-extrabold text-xs px-2.5 py-1.5 rounded flex items-center space-x-1 transition-colors border border-purple-300 shadow-sm"
                              title="Ver Formato 4.3.7.C"
                            >
                              <FileText className="w-3.5 h-3.5 text-purple-800" />
                              <span>Formato C</span>
                            </button>
                          )}

                          <button
                            onClick={() => onSelectFiling(filing)}
                            className="bg-[#0D0D0D] hover:bg-gray-800 text-[#D9CF43] font-bold text-xs px-2.5 py-1.5 rounded flex items-center space-x-1 transition-colors shadow-sm"
                            title="Ver Informe de Recibido a Conformidad"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Informe</span>
                          </button>

                          {userRole === 'contratista' && onEditFiling && filing.estado === 'Con Observaciones' && (
                            <button
                              onClick={() => onEditFiling(filing)}
                              className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs px-2.5 py-1.5 rounded flex items-center space-x-1 transition-colors border border-amber-300 shadow-sm"
                              title="Editar este radicado para subsanar las observaciones"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                          )}

                          {userRole === 'contratista' && onDeleteFiling && ultimoId && ultimoId === filing.id && (filing.creadorEmail || filing.metadata?.creadorEmail) === currentUser?.email && filing.estado !== 'Aprobado' && (
                            <button
                              onClick={() => onDeleteFiling(filing)}
                              className="bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs px-2.5 py-1.5 rounded flex items-center space-x-1 transition-colors border border-red-200 shadow-sm"
                              title="Eliminar este radicado"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Eliminar</span>
                            </button>
                          )}

                          {userRole === 'interventor' && onReciboTecnico && filing.estado === 'Aprobado' && (
                            <button
                              onClick={() => onReciboTecnico(filing)}
                              className="bg-teal-100 hover:bg-teal-200 text-teal-900 font-bold text-xs px-2.5 py-1.5 rounded flex items-center space-x-1 transition-colors border border-teal-300 shadow-sm"
                              title="Ver Recibo Técnico del radicado"
                            >
                              <ReceiptText className="w-3.5 h-3.5" />
                              <span>Recibo Técnico</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
