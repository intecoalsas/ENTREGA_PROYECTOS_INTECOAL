import React, { useState } from 'react';
import { DOCUMENT_CATALOG } from '../data/documentsCatalog';
import { formatNameFromEmail } from '../lib/msalConfig';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  MinusCircle, 
  Save, 
  FileCheck, 
  ArrowLeft, 
  ExternalLink, 
  Sparkles,
  Search,
  FileText,
  PenTool,
  MessageSquare,
  Info,
  Eye,
  Download
} from 'lucide-react';
import { downloadFilingZip } from '../lib/zipExporter';
import { apiFetch, getToken } from '../lib/api';
import { IntecoalLogo } from './IntecoalLogo';
import { FirmaDigitalModal } from './FirmaDigitalModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';

export const EvaluacionRadicacion = ({
  filing,
  onSaveEvaluation,
  onViewReport,
  onBack,
  currentUser,
  userRole
}) => {
  const effectiveRole = userRole || currentUser?.role || 'interventor';
  const isRol1Revisor = effectiveRole === 'interventor';
  const isRol2Contratista = effectiveRole === 'contratista';

  const [archivosState, setArchivosState] = useState(() => {
    const existentes = new Map(
      (filing.archivos || []).map(a => [a.docId, a])
    );
    const base = DOCUMENT_CATALOG.map(doc => {
      const existing = existentes.get(doc.id);
      if (existing) return { ...existing };
      return {
        docId: doc.id,
        docCode: doc.code,
        docName: doc.name,
        fileName: '',
        fileSize: 0,
        fileType: 'application/pdf',
        uploadDate: '',
        status: 'PENDIENTE',
        folderPath: `/Documentos_Radicacion/${filing.numeroRadicado}/${doc.folderGroup}/`,
        notes: ''
      };
    });
    const catalogIds = new Set(DOCUMENT_CATALOG.map(d => d.id));
    const adicionales = (filing.archivos || [])
      .filter(a => !catalogIds.has(a.docId))
      .map(a => ({ ...a }));
    return [...base, ...adicionales];
  });

  const [estadoGeneral, setEstadoGeneral] = useState(filing.estado || 'Radicado');
  const [observacionesGenerales, setObservacionesGenerales] = useState(
    filing.observacionesGenerales || ''
  );
  const [responsableRevision, setResponsableRevision] = useState(
    filing.metadata.responsableRevision || formatNameFromEmail(currentUser?.email) || currentUser?.name || 'Responsable de Revisión'
  );
  const [firmaInterventoria, setFirmaInterventoria] = useState(
    filing.metadata.firmaInterventoria
  );
  const [firmaContratista, setFirmaContratista] = useState(
    filing.metadata.firmaContratista
  );
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [previewingDocItem, setPreviewingDocItem] = useState(null);

  const [selectedFolderGroup, setSelectedFolderGroup] = useState('TODAS');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const [lastSavedFiling, setLastSavedFiling] = useState(null);

  const totalDocs = archivosState.length || DOCUMENT_CATALOG.length;
  const cumpleCount = archivosState.filter(a => a.status === 'CUMPLE').length;
  const naCount = archivosState.filter(a => a.status === 'N/A').length;
  const conObsCount = archivosState.filter(a => a.status === 'PENDIENTE').length;
  const noCumpleCount = archivosState.filter(a => a.status === 'NO CUMPLE').length;
  
  const documentosValidos = cumpleCount + naCount;
  const porcentajeCumplimiento = Math.round((documentosValidos / totalDocs) * 100);

  const filteredArchivos = archivosState.filter(item => {
    const catalogItem = DOCUMENT_CATALOG.find(d => d.id === item.docId);
    const matchesGroup = selectedFolderGroup === 'TODAS' || catalogItem?.folderGroup === selectedFolderGroup;
    const matchesSearch = 
      item.docCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.docName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.fileName && item.fileName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesGroup && matchesSearch;
  });

  const handleItemStatusChange = (docId, newStatus) => {
    setArchivosState(prev => prev.map(item => {
      if (item.docId === docId) {
        return { ...item, status: newStatus };
      }
      return item;
    }));
  };

  const handleItemNotesChange = (docId, newNotes) => {
    setArchivosState(prev => prev.map(item => {
      if (item.docId === docId) {
        return { ...item, notes: newNotes };
      }
      return item;
    }));
  };

  const handleSubStatusChange = (docId, subId, newStatus) => {
    setArchivosState(prev => prev.map(item => {
      if (item.docId !== docId) return item;
      return {
        ...item,
        subFiles: (item.subFiles || []).map(s => s.subId === subId ? { ...s, status: newStatus } : s)
      };
    }));
  };

  const handleSubNotesChange = (docId, subId, newNotes) => {
    setArchivosState(prev => prev.map(item => {
      if (item.docId !== docId) return item;
      return {
        ...item,
        subFiles: (item.subFiles || []).map(s => s.subId === subId ? { ...s, notes: newNotes } : s)
      };
    }));
  };

  const urlConToken = (base) => {
    const tk = getToken();
    return tk ? `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(tk)}` : base;
  };

  const abrirVisor = (item, sub = null) => {
    if (sub) {
      setPreviewingDocItem({
        ...item,
        fileName: sub.fileName || sub.subName,
        fileType: sub.fileType || 'application/pdf',
        status: sub.status || 'CUMPLE',
        fileUrl: urlConToken(`/api/files/view/${filing.id}/${item.docId}?subId=${encodeURIComponent(sub.subId)}`),
        blobUrl: undefined
      });
      return;
    }
    const tieneArchivo = item.fileName && item.fileName !== 'N/A';
    let previewItem = { ...item };
    if (tieneArchivo) {
      previewItem.fileUrl = urlConToken(`/api/files/view/${filing.id}/${item.docId}`);
      previewItem.blobUrl = undefined;
    }
    setPreviewingDocItem(previewItem);
  };

  const handleSaveAvance = async () => {
    setIsSaving(true);
    setSaveSuccessMsg('');

    const updatedFiling = {
      ...filing,
      estado: 'En Revisión',
      archivos: archivosState,
      documentosOk: documentosValidos,
      porcentajeCumplimiento,
      observacionesGenerales,
      metadata: {
        ...filing.metadata,
        responsableRevision,
        firmaInterventoria,
        firmaContratista
      },
      fechaActualizacion: new Date().toISOString()
    };

    try {
      const res = await apiFetch(`/api/radicacion/${filing.id}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'En Revisión',
          observacionesGenerales,
          archivos: archivosState,
          metadata: updatedFiling.metadata,
          soloAvance: true
        })
      });

      if (res.ok) {
        setSaveSuccessMsg('Avance guardado como borrador. El expediente sigue "En Revisión" sin notificar ni cargar a SharePoint.');
      } else {
        setSaveSuccessMsg('No se pudo guardar el avance en el servidor. Se guardó localmente.');
      }
    } catch (err) {
      console.warn('Backend patch not available, using client state', err);
      setSaveSuccessMsg('Avance guardado localmente.');
    } finally {
      setIsSaving(false);
      await onSaveEvaluation(updatedFiling, { skipSync: true });
      if (typeof onBack === 'function') onBack();
    }
  };

  const handleFinalizar = async (andGenerateReport = true) => {
    const estadoFinal = estadoGeneral;

    if ((estadoFinal === 'Aprobado' || estadoFinal === 'Con Observaciones') && !firmaInterventoria) {
      setSaveErrorMsg('No se puede finalizar el informe: falta la firma digital del revisor (INTECOAL). Estampe la firma antes de guardar.');
      setSaveSuccessMsg('');
      setIsSaving(false);
      return;
    }

    setIsSaving(true);
    setSaveSuccessMsg('');
    setSaveErrorMsg('');

    const updatedFiling = {
      ...filing,
      estado: estadoFinal,
      archivos: archivosState,
      documentosOk: documentosValidos,
      porcentajeCumplimiento,
      observacionesGenerales,
      metadata: {
        ...filing.metadata,
        responsableRevision,
        firmaInterventoria,
        firmaContratista
      },
      fechaActualizacion: new Date().toISOString()
    };

    let finalizadoOk = false;
    let filingFinal = updatedFiling;

    try {
      const res = await apiFetch(`/api/radicacion/${filing.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: estadoFinal,
          observaciones: observacionesGenerales,
          archivos: archivosState,
          metadata: updatedFiling.metadata,
          usuarioEmail: currentUser?.email || filing.creadorEmail || '',
          usuarioNombre: currentUser?.name || ''
        })
      });

      if (!res.ok) {
        let detalle = '';
        try { detalle = (await res.json())?.detail || ''; } catch { detalle = ''; }
        throw new Error(detalle || `El servidor respondió ${res.status}`);
      }

      try {
        const payload = await res.json();
        if (payload?.data) filingFinal = payload.data;
      } catch { filingFinal = updatedFiling; }

      if (estadoFinal === 'Aprobado') {
        setSaveSuccessMsg(`¡Radicado ${filingFinal.numeroRadicado} APROBADO y notificado! La subida a SharePoint (carpetas + archivos) continúa en segundo plano. Si no aparece en SharePoint, use «Reintentar subida» en el Historial. Volviendo al Historial de Radicaciones…`);
      } else {
        setSaveSuccessMsg(`¡Evaluación de ${filingFinal.numeroRadicado} finalizada y notificada! (A SharePoint solo se sube al aprobar). Volviendo al Historial de Radicaciones…`);
      }
      finalizadoOk = true;
    } catch (err) {
      console.warn('No se pudo finalizar en el servidor:', err);
      setSaveErrorMsg(`No se pudo guardar en el servidor: ${err.message || err}. Intente de nuevo sin salir de esta pantalla.`);
    } finally {
      setIsSaving(false);
    }

    if (finalizadoOk) {
      setLastSavedFiling(filingFinal);
      await onSaveEvaluation(filingFinal, { skipSync: true });
      setTimeout(() => {
        if (typeof onBack === 'function') onBack();
      }, 1200);
    }
  };

  const groupNamesMap = {
    'TODAS': `Todas las Secciones (${DOCUMENT_CATALOG.length} Requisitos)`,
    'A_Tecnicos': 'Grupo A: Documentos Técnicos y Planos (A1-A8)',
    'B_Certificaciones': 'Grupo B: Certificaciones y Garantías (B8-B12)',
    'C_Contractuales': 'Grupo C: Documentación Contractual y Legal (C13-C16)',
    'D_Inventario': 'Grupo D: Dictámenes e Inventario (D19-D21)',
    'E_Otros': 'Grupo E: Otros documentos (CAUE, CANT, CVP, CEAP)'
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8 font-sans text-gray-900">
      
      
      <div className="bg-[#1E222A] text-white rounded-2xl p-6 shadow-xl border border-slate-700/80 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-[#D9CF43]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <button
              onClick={onBack}
              className="inline-flex items-center space-x-2 text-xs text-gray-300 hover:text-[#D9CF43] transition-colors font-bold mb-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a la Lista de Radicaciones</span>
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-800 rounded-xl border border-slate-700 shrink-0">
                <IntecoalLogo size="40px" />
              </div>
              <div>
                <span className="inline-flex items-center space-x-1.5 bg-[#D9CF43]/20 text-[#D9CF43] text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-[#D9CF43]/40">
                  <Sparkles className="w-3 h-3" />
                  <span>MÓDULO DE EVALUACIÓN DE INTERVENTORÍA</span>
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
                  Revisión Técnica y Calificación de Expediente
                </h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            <button
              type="button"
              onClick={() => downloadFilingZip(filing)}
              className="bg-[#D9CF43] hover:bg-[#c4ba3c] text-[#1E222A] font-black text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
              title="Descargar paquete ZIP con la carpeta del proyecto y PDFs para subir a SharePoint"
            >
              <Download className="w-4 h-4 text-[#1E222A]" />
              <span>📦 Descargar ZIP del Expediente</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSignatureModal(true)}
              className={`border font-black text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer ${
                firmaInterventoria
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
              }`}
              title="Crear, editar o eliminar firma de Interventoría"
            >
              <PenTool className="w-4 h-4 text-[#D9CF43]" />
              <span>
                {firmaInterventoria ? 'Firma Revisor Estampada' : 'Firmar Digitalmente'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveAvance()}
              disabled={isSaving}
              className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-[#D9CF43]" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Avance'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleFinalizar(true)}
              disabled={isSaving}
              className="bg-[#D9CF43] hover:bg-[#c4ba3c] text-[#1E222A] font-black text-xs px-5 py-2.5 rounded-xl shadow-lg transition-all flex items-center space-x-2 cursor-pointer scale-[1.02] hover:scale-[1.04]"
            >
              <FileCheck className="w-4 h-4 text-[#1E222A]" />
              <span>Generar Informe Recibido a Conformidad</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-700/80 text-xs">
          <div>
            <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block">Radicado N°</span>
            <span className="font-mono font-black text-[#D9CF43] text-sm block">{filing.numeroRadicado}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block">Radicado</span>
            <span className="font-bold text-gray-200 block truncate">{filing.numeroRadicado} - {filing.metadata.nombreProyecto}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block">Contratista</span>
            <span className="font-bold text-gray-200 block truncate">{filing.metadata.contratista}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block">Municipio</span>
            <span className="font-bold text-gray-200 block">{filing.metadata.municipio}</span>
          </div>
        </div>
      </div>

      {saveErrorMsg && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-sm">
          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{saveErrorMsg}</span>
        </div>
      )}

      {saveSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button
            onClick={() => onViewReport(lastSavedFiling || filing)}
            className="underline text-emerald-900 font-black hover:text-emerald-700 text-xs"
          >
            Ver Informe Oficial →
          </button>
        </div>
      )}

      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-md flex flex-col justify-between space-y-4">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
              PORCENTAJE DE CUMPLIMIENTO GLOBAL
            </span>
            <div className="flex items-baseline space-x-3 mt-2">
              <span className={`text-4xl font-black ${porcentajeCumplimiento === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {porcentajeCumplimiento}%
              </span>
              <span className="text-xs font-bold text-gray-500">
                ({documentosValidos} de {totalDocs} Requisitos Válidos)
              </span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3 mt-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  porcentajeCumplimiento === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${porcentajeCumplimiento}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-2 text-center text-[11px] font-extrabold border-t border-gray-100">
            <div className="bg-emerald-50 text-emerald-800 p-2 rounded-xl border border-emerald-200">
              <span className="block text-base font-black">{cumpleCount}</span>
              <span className="text-[9px] uppercase">Cumple</span>
            </div>
            <div className="bg-amber-50 text-amber-800 p-2 rounded-xl border border-amber-200">
              <span className="block text-base font-black">{conObsCount}</span>
              <span className="text-[9px] uppercase">Pendiente</span>
            </div>
            <div className="bg-red-50 text-red-800 p-2 rounded-xl border border-red-200">
              <span className="block text-base font-black">{noCumpleCount}</span>
              <span className="text-[9px] uppercase">No Cumple</span>
            </div>
            <div className="bg-gray-100 text-gray-700 p-2 rounded-xl border border-gray-200">
              <span className="block text-base font-black">{naCount}</span>
              <span className="text-[9px] uppercase">N/A</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-200 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
            <div>
              <h3 className="font-extrabold text-gray-900 text-sm">
                Dictamen General de la Interventoría
              </h3>
              <p className="text-xs text-gray-500">
                Defina el estado global del trámite y agregue observaciones del revisor.
              </p>
            </div>

            <div className="shrink-0">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Estado del Tramite
              </label>
              <select
                value={estadoGeneral}
                onChange={(e) => setEstadoGeneral(e.target.value)}
                className="bg-slate-900 text-[#D9CF43] font-black text-xs px-3.5 py-2 rounded-xl border border-slate-700 focus:ring-2 focus:ring-[#D9CF43] cursor-pointer"
              >
                <option value="Aprobado">Aprobado (Recibido a Conformidad)</option>
                <option value="En Revisión">En Revisión</option>
                <option value="Con Observaciones">Con Observaciones</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Responsable de Revisión
              </label>
              <input
                type="text"
                value={responsableRevision}
                onChange={(e) => setResponsableRevision(e.target.value)}
                placeholder="Nombre del revisor INTECOAL SAS"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:ring-2 focus:ring-[#D9CF43]"
              />

              
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-700 text-[11px]">Firma Digital Revisor (INTECOAL):</span>
                  {isRol1Revisor ? (
                    firmaInterventoria ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Firmado
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-300">
                        Pendiente
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] bg-gray-200 text-gray-700 font-bold px-2 py-0.5 rounded">
                      🔒 Exclusivo del Revisor
                    </span>
                  )}
                </div>

                {firmaInterventoria ? (
                  <div className="space-y-1.5 bg-white p-2 rounded-lg border border-slate-200">
                    <img
                      src={firmaInterventoria.dataUrl}
                      alt="Firma Interventoria"
                      className="max-h-14 mx-auto object-contain"
                    />
                    {firmaInterventoria.tarjetaProfesional && (
                      <p className="text-[9px] font-bold text-slate-800 text-center">
                        T.P.: {firmaInterventoria.tarjetaProfesional}
                      </p>
                    )}
                    {isRol1Revisor && (
                      <div className="flex items-center justify-center gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setShowSignatureModal(true)}
                          className="bg-slate-900 hover:bg-slate-800 text-[#D9CF43] font-bold text-[10px] px-2.5 py-1 rounded shadow cursor-pointer transition-all"
                        >
                          Editar / Cambiar Firma
                        </button>
                        <button
                          type="button"
                          onClick={() => setFirmaInterventoria(undefined)}
                          className="text-rose-600 hover:text-rose-800 text-[10px] font-bold underline"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {isRol1Revisor ? (
                      <button
                        type="button"
                        onClick={() => setShowSignatureModal(true)}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-[#D9CF43] font-extrabold text-xs py-2 px-3 rounded-lg shadow transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>Estampar / Subir Firma Digital</span>
                      </button>
                    ) : (
                      <p className="text-[10px] text-gray-500 italic text-center">
                        Solo el Responsable de Revisión puede firmar este dictamen.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Observaciones Generales de la Revisión
              </label>
              <textarea
                value={observacionesGenerales}
                onChange={(e) => setObservacionesGenerales(e.target.value)}
                placeholder="Escriba comentarios generales del concepto técnico, hallazgos o recomendaciones..."
                rows={5}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-[#D9CF43]"
              />
            </div>
          </div>
        </div>
      </div>

      
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-slate-900 text-white space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#D9CF43] block">
                LISTA DE CHEQUEO DE DOCUMENTACIÓN TÉCNICA
              </span>
              <h2 className="text-lg font-black text-white mt-0.5">
                Evaluación Item por Item ({DOCUMENT_CATALOG.length} Requisitos RETILAP / RETIE)
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
            <div className="md:col-span-8 flex flex-wrap gap-1.5">
              {[
                { id: 'TODAS', label: `Todos (${DOCUMENT_CATALOG.length})` },
                { id: 'A_Tecnicos', label: 'A. Técnicos' },
                { id: 'B_Certificaciones', label: 'B. Certificaciones' },
                { id: 'C_Contractuales', label: 'C. Contractuales' },
                { id: 'D_Inventario', label: 'D. Inventario' },
                { id: 'E_Otros', label: 'E. Otros' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedFolderGroup(tab.id)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer ${
                    selectedFolderGroup === tab.id
                      ? 'bg-[#D9CF43] text-[#1E222A] shadow-md'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por código, nombre o nota..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-medium text-white placeholder-gray-400 focus:ring-2 focus:ring-[#D9CF43]"
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-100 px-6 py-2.5 border-b border-gray-200 text-xs font-extrabold text-gray-700 flex items-center justify-between">
          <span>{groupNamesMap[selectedFolderGroup] || selectedFolderGroup}</span>
          <span className="text-gray-500 font-semibold">{filteredArchivos.length} items visibles</span>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredArchivos.map((item) => {
            const catalogDef = DOCUMENT_CATALOG.find(d => d.id === item.docId);

            return (
              <div 
                key={item.docId} 
                className={`p-5 transition-colors ${
                  item.status === 'CUMPLE' 
                    ? 'bg-white hover:bg-emerald-50/20' 
                    : item.status === 'NO CUMPLE'
                    ? 'bg-red-50/40 hover:bg-red-50/60'
                    : item.status === 'N/A'
                    ? 'bg-gray-50/60'
                    : 'bg-amber-50/30 hover:bg-amber-50/50'
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  <div className="lg:col-span-5 space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="bg-[#1E222A] text-[#D9CF43] font-mono text-xs font-black px-2 py-0.5 rounded border border-slate-800">
                        {item.docCode}
                      </span>
                      {catalogDef?.required && (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                          Obligatorio RETILAP
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-extrabold text-gray-900 leading-snug">
                      {item.docName}
                    </h4>

                    {catalogDef?.description && (
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {catalogDef.description}
                      </p>
                    )}

                    <div className="pt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      {item.fileName ? (
                        <button
                          type="button"
                          onClick={() => abrirVisor(item)}
                          className="inline-flex items-center space-x-1.5 text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-emerald-400 transition-all cursor-pointer shadow-sm group"
                          title="Haz clic para abrir el Visor e inspeccionar este PDF / Documento"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-700 group-hover:scale-110 transition-transform shrink-0" />
                          <span className="truncate max-w-[200px] sm:max-w-[260px]">{item.fileName}</span>
                          <span className="bg-emerald-800 text-white text-[9px] px-1.5 py-0.2 rounded font-black ml-1">
                            VER PDF
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => abrirVisor(item)}
                          className="inline-flex items-center space-x-1 text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-amber-300 transition-all cursor-pointer"
                          title="Ver detalles de este requisito"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>{(item.subFiles || []).some(s => s.fileName) ? 'Ver sub-archivos abajo' : 'Sin archivo adjunto'}</span>
                        </button>
                      )}
                      {(item.subFiles || []).filter(sf => sf.fileName).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 w-full pt-1">
                          {(item.subFiles || []).filter(sf => sf.fileName).map((sf, k) => (
                            <button
                              key={sf.subId || k}
                              type="button"
                              onClick={() => abrirVisor(item, sf)}
                              className="inline-flex items-center space-x-1.5 text-sky-900 bg-sky-100 hover:bg-sky-200 px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-sky-400 transition-all cursor-pointer shadow-sm"
                              title={`Ver ${sf.subName || sf.fileName}`}
                            >
                              <Eye className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                              <span className="truncate max-w-[200px] sm:max-w-[260px]">
                                {sf.subCode ? `${sf.subCode} · ` : ''}{sf.subName || sf.fileName}
                              </span>
                              <span className="bg-sky-800 text-white text-[9px] px-1.5 py-0.2 rounded font-black ml-1">
                                VER
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      
                      {(item.subFiles || []).filter(sf => sf.fileName).length > 0 && (
                        <div className="w-full mt-2 pt-2 border-t border-dashed border-gray-300 space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">
                            Evaluar sub-archivos ({(item.subFiles || []).filter(sf => sf.fileName).length})
                          </span>
                          {(item.subFiles || []).filter(sf => sf.fileName).map((sf) => (
                            <div key={`ev-${sf.subId}`} className="bg-white border border-gray-200 rounded-xl p-2.5 grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">
                              <div className="lg:col-span-4 min-w-0">
                                <span className="text-[11px] font-extrabold text-gray-800 break-words">
                                  {sf.subCode ? `${sf.subCode} · ` : ''}{sf.subName || sf.fileName}
                                </span>
                              </div>
                              <div className="lg:col-span-3 flex items-center gap-1 flex-wrap">
                                {[
                                  { v: 'CUMPLE', txt: 'Cumple', cls: sf.status === 'CUMPLE' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-emerald-800 border-gray-300' },
                                  { v: 'PENDIENTE', txt: 'Pendiente', cls: sf.status === 'PENDIENTE' || !sf.status ? 'bg-amber-500 text-slate-950 border-amber-600' : 'bg-white text-amber-800 border-gray-300' },
                                  { v: 'NO CUMPLE', txt: 'No cumple', cls: sf.status === 'NO CUMPLE' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-red-800 border-gray-300' }
                                ].map(o => (
                                  <button
                                    key={o.v}
                                    type="button"
                                    onClick={() => handleSubStatusChange(item.docId, sf.subId, o.v)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${o.cls}`}
                                  >
                                    {o.txt}
                                  </button>
                                ))}
                              </div>
                              <div className="lg:col-span-5 relative">
                                <MessageSquare className="w-3 h-3 text-gray-400 absolute left-2.5 top-2.5" />
                                <textarea
                                  value={sf.notes || ''}
                                  onChange={(e) => handleSubNotesChange(item.docId, sf.subId, e.target.value)}
                                  placeholder="Observación del revisor…"
                                  rows={1}
                                  className="w-full pl-8 pr-2 py-1.5 bg-white border border-gray-300 rounded-lg text-[11px] text-gray-900 focus:ring-2 focus:ring-[#D9CF43] placeholder-gray-400"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-3 space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">
                      Estado de Verificación
                    </label>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleItemStatusChange(item.docId, 'CUMPLE')}
                        className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 border transition-all cursor-pointer ${
                          item.status === 'CUMPLE'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400'
                            : 'bg-white hover:bg-emerald-50 text-emerald-800 border-gray-300'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Cumple</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleItemStatusChange(item.docId, 'PENDIENTE')}
                        className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 border transition-all cursor-pointer ${
                          item.status === 'PENDIENTE'
                            ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-400'
                            : 'bg-white hover:bg-amber-50 text-amber-800 border-gray-300'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Pendiente</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleItemStatusChange(item.docId, 'NO CUMPLE')}
                        className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 border transition-all cursor-pointer ${
                          item.status === 'NO CUMPLE'
                            ? 'bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-400'
                            : 'bg-white hover:bg-red-50 text-red-800 border-gray-300'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>No Cumple</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleItemStatusChange(item.docId, 'N/A')}
                        className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 border transition-all cursor-pointer ${
                          item.status === 'N/A'
                            ? 'bg-slate-700 text-white border-slate-800 shadow-md ring-2 ring-slate-400'
                            : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
                        }`}
                      >
                        <MinusCircle className="w-3.5 h-3.5" />
                        <span>N/A</span>
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-4 space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block flex items-center justify-between">
                      <span>Observación del Revisor</span>
                      {item.notes && <span className="text-emerald-700 font-bold">Con nota</span>}
                    </label>

                    <div className="relative">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                      <textarea
                        value={item.notes || ''}
                        onChange={(e) => handleItemNotesChange(item.docId, e.target.value)}
                        placeholder="Escriba comentarios u observaciones específicas para este documento..."
                        rows={2}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-[#D9CF43] placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
          <div className="flex items-center space-x-2 text-xs text-gray-300 font-medium">
            <Info className="w-4 h-4 text-[#D9CF43]" />
            <span>
              Use los botones de arriba ("Guardar Avance" o "Generar Informe") para guardar el borrador o finalizar la evaluación y notificar al contratista (a SharePoint solo se sube al aprobar).
            </span>
          </div>
        </div>
      </div>

      {showSignatureModal && (
        <FirmaDigitalModal
          role="interventoria"
          defaultName={currentUser?.name || responsableRevision || 'Responsable de Revisión'}
          defaultRole="Responsable de Revisión (INTECOAL SAS)"
          initialSignature={firmaInterventoria}
          onSaveSignature={(sig) => {
            setFirmaInterventoria(sig);
            setResponsableRevision(sig.nombreSignatario);
          }}
          onRemoveSignature={() => {
            setFirmaInterventoria(undefined);
          }}
          onClose={() => setShowSignatureModal(false)}
        />
      )}

      {previewingDocItem && (
        <DocumentPreviewModal
          docItem={previewingDocItem}
          filing={filing}
          onClose={() => setPreviewingDocItem(null)}
        />
      )}
    </div>
  );
};
