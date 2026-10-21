import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatNameFromEmail } from '../lib/msalConfig';
import { DOCUMENT_CATALOG } from '../data/documentsCatalog';
import { 
  FileUp, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Building2, 
  User, 
  Mail, 
  MapPin, 
  Hash, 
  FolderDown,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  FileText,
  PenTool,
  ShieldCheck,
  Edit3,
  MessageSquare
} from 'lucide-react';
import { FirmaDigitalModal } from './FirmaDigitalModal';
import { apiFetch } from '../lib/api';

export const RadicacionForm = ({ onSuccess, onCancel, currentUser, filingToEdit }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(1);

  const [selectedFiles, setSelectedFiles] = useState({});
  const [selectedSubFiles, setSelectedSubFiles] = useState({});
  const [extraSubFiles, setExtraSubFiles] = useState({});
  const [naDocs, setNaDocs] = useState(
    filingToEdit
      ? (filingToEdit.archivos || [])
          .filter(a => a.status === 'N/A')
          .map(a => a.docId)
      : []
  );
  const [archivosPrevios, setArchivosPrevios] = useState(
    filingToEdit
      ? Object.fromEntries(
          (filingToEdit.archivos || [])
            .filter(a => a.status === 'CUMPLE' || a.status === 'N/A')
            .map(a => [a.docId, a])
        )
      : {}
  );

  const obsGenerales = filingToEdit?.observacionesGenerales || '';
  const docsConNota = filingToEdit
    ? (filingToEdit.archivos || []).filter(a => a.notes && a.status !== 'CUMPLE' && a.status !== 'N/A')
    : [];
  const subsConNota = filingToEdit
    ? (filingToEdit.archivos || []).flatMap(a =>
        (a.subFiles || [])
          .filter(s => s.notes && s.status !== 'CUMPLE' && s.status !== 'N/A')
          .map(s => ({ ...s, docCode: a.docCode, docName: a.docName }))
      )
    : [];
  const hayObs = Boolean(obsGenerales) || docsConNota.length > 0 || subsConNota.length > 0;
  const veredictoPrevio = (docId) => (filingToEdit ? archivosPrevios[docId]?.status : null) || null;
  const bloqueadoPorRevision = (docId) => filingToEdit && ['CUMPLE', 'N/A'].includes(veredictoPrevio(docId));
  const subPrevio = (docId, subId) =>
    filingToEdit?.archivos?.find(a => a.docId === docId)?.subFiles?.find(s => s.subId === subId) || null;
  const subBloqueado = (docId, subId) => {
    const p = subPrevio(docId, subId);
    return filingToEdit && p && ['CUMPLE', 'N/A'].includes(p.status);
  };
  const [activeCategory, setActiveCategory] = useState('todos');

  const [metadata, setMetadata] = useState(
    filingToEdit
      ? {
          nombreProyecto: filingToEdit.metadata?.nombreProyecto || '',
          municipio: filingToEdit.metadata?.municipio || '',
          contratista: filingToEdit.metadata?.contratista || '',
          nitContratista: filingToEdit.metadata?.nitContratista || '',
          responsableRevision: filingToEdit.metadata?.responsableRevision || '',
          responsable: filingToEdit.metadata?.responsable || '',
          correoResponsable: filingToEdit.metadata?.correoResponsable || currentUser?.email || '',
          tipoEntrega: filingToEdit.metadata?.tipoEntrega || '',
          fechaEntrega: filingToEdit.metadata?.fechaEntrega || '',
          observaciones: filingToEdit.observacionesGenerales || ''
        }
      : {
          nombreProyecto: '',
          municipio: '',
          contratista: '',
          nitContratista: '',
          responsableRevision: '',
          responsable: '',
          correoResponsable: currentUser?.email || '',
          tipoEntrega: '',
          fechaEntrega: '',
          observaciones: ''
        }
  );

  const [elementos, setElementos] = useState(
    filingToEdit && filingToEdit.elementosEntregados?.length
      ? filingToEdit.elementosEntregados
      : [{ id: 1, elemento: '', cantidad: 0, especificacion: '' }]
  );

  const [firmaContratista, setFirmaContratista] = useState(
    filingToEdit?.metadata?.firmaContratista || null
  );
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mensajeEnvio, setMensajeEnvio] = useState(null);

  const [categoria, setCategoria] = useState(
    filingToEdit?.metadata?.categoria || ''
  );

  useEffect(() => {
    if (categoria === 'B' || categoria === 'C') {
      setNaDocs(prev => prev.filter(id => id !== 20));
    }
  }, [categoria]);

  const [customDocs, setCustomDocs] = useState([]);
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [newDoc, setNewDoc] = useState({ code: '', name: '', category: 'diseno', description: '' });

  const steps = [
    { 
      number: 1, 
      id: 'archivos', 
      title: 'Paso 1: Carga de Archivos', 
      subtitle: 'Pliego técnico y 25 documentos RETILAP',
      icon: FileUp
    },
    { 
      number: 2, 
      id: 'contratista', 
      title: 'Paso 2: Datos de Contratista', 
      subtitle: 'Metadatos del contrato e inventario físico',
      icon: Building2
    },
    { 
      number: 3, 
      id: 'firma', 
      title: 'Paso 3: Firma Digital', 
      subtitle: 'Declaración de conformidad y radicación',
      icon: PenTool
    }
  ];

  const goToStep = (newStep) => {
    if (newStep < 1 || newStep > 3) return;
    setDirection(newStep > currentStep ? 1 : -1);
    setCurrentStep(newStep);
  };

  const handleMetaChange = (e) => {
    setMetadata({ ...metadata, [e.target.name]: e.target.value });
  };

  const handleAddElement = () => {
    const newId = elementos.length > 0 ? Math.max(...elementos.map(e => e.id)) + 1 : 1;
    setElementos([...elementos, { id: newId, elemento: '', cantidad: 1, especificacion: '' }]);
  };

  const handleRemoveElement = (id) => {
    setElementos(elementos.filter(e => e.id !== id));
  };

  const handleElementChange = (id, field, value) => {
    setElementos(elementos.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleFileChange = (docId, e) => {
    if (e.target.files && e.target.files[0]) {
      if (filingToEdit && archivosPrevios[docId]?.status && ['CUMPLE', 'N/A'].includes(archivosPrevios[docId].status)) return;
      const file = e.target.files[0];
      setSelectedFiles(prev => ({ ...prev, [docId]: file }));
      setNaDocs(prev => prev.filter(id => id !== docId));
      setArchivosPrevios(prev => { const n = { ...prev }; delete n[docId]; return n; });
    }
  };

  const handleSubFileChange = (docId, subId, e) => {
    if (e.target.files && e.target.files[0]) {
      const prevSub = filingToEdit?.archivos?.find(a => a.docId === docId)?.subFiles?.find(s => s.subId === subId);
      if (prevSub && ['CUMPLE', 'N/A'].includes(prevSub.status)) return;
      const file = e.target.files[0];
      setSelectedSubFiles(prev => ({
        ...prev,
        [docId]: { ...(prev[docId] || {}), [subId]: file }
      }));
    }
  };

  const handleAddExtraSubFile = (docId, e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setExtraSubFiles(prev => ({
        ...prev,
        [docId]: [...(prev[docId] || []), file]
      }));
    }
    e.target.value = '';
  };

  const handleRemoveExtraSubFile = (docId, index) => {
    setExtraSubFiles(prev => ({
      ...prev,
      [docId]: (prev[docId] || []).filter((_, i) => i !== index)
    }));
  };

  const handleToggleNA = (docId) => {
    if (filingToEdit && archivosPrevios[docId]?.status && ['CUMPLE', 'N/A'].includes(archivosPrevios[docId].status)) return;
    if (naDocs.includes(docId)) {
      setNaDocs(naDocs.filter(id => id !== docId));
      if (filingToEdit) {
        const prev = archivosPrevios[docId];
        if (prev) {
          setArchivosPrevios({ ...archivosPrevios, [docId]: { ...prev, status: 'CUMPLE' } });
        }
      }
    } else {
      setNaDocs([...naDocs, docId]);
      const updatedFiles = { ...selectedFiles };
      delete updatedFiles[docId];
      setSelectedFiles(updatedFiles);
      setArchivosPrevios(prev => { const n = { ...prev }; delete n[docId]; return n; });
    }
  };

  const handleAddCustomDoc = () => {
    if (!newDoc.code.trim() || !newDoc.name.trim()) {
      alert('Debe ingresar el código y nombre del documento.');
      return;
    }
    const allDocs = [...DOCUMENT_CATALOG, ...customDocs];
    if (allDocs.some(d => d.code.toUpperCase() === newDoc.code.trim().toUpperCase())) {
      alert(`El código "${newDoc.code.trim()}" ya existe. Use uno diferente.`);
      return;
    }
    const catLabels = { diseno: 'Documentos de Diseño', luminarias: 'Luminarias y Materiales', constructor: 'Documentos del Constructor', dictamenes: 'Dictámenes y Permisos' };
    const id = 100 + customDocs.length;
    setCustomDocs([...customDocs, {
      id,
      code: newDoc.code.trim().toUpperCase(),
      name: newDoc.name.trim(),
      category: newDoc.category,
      categoryName: catLabels[newDoc.category] || 'Documento Adicional',
      required: false,
      folderGroup: 'F_Documentos_Adicionales',
      description: newDoc.description.trim() || 'Documento adicional agregado manualmente.',
      esManual: true
    }]);
    setNewDoc({ code: '', name: '', category: 'diseno', description: '' });
    setShowAddDocModal(false);
  };

  const handleRemoveCustomDoc = (docId) => {
    setCustomDocs(customDocs.filter(d => d.id !== docId));
    const updatedFiles = { ...selectedFiles };
    delete updatedFiles[docId];
    setSelectedFiles(updatedFiles);
    setNaDocs(naDocs.filter(id => id !== docId));
    setArchivosPrevios(prev => { const n = { ...prev }; delete n[docId]; return n; });
  };

  const allDocs = [...DOCUMENT_CATALOG, ...customDocs];
  const totalDocs = allDocs.length;
  const previosCount = Object.keys(archivosPrevios).length;
  const attachedCount = Object.keys(selectedFiles).length;
  const naCount = naDocs.length;
  const totalCompleted = attachedCount + naCount + previosCount;
  const percentage = Math.round((totalCompleted / totalDocs) * 100);

  const missingMandatory = allDocs.filter(d => {
    if (!d.required) return false;
    if (d.requiredIfCategoriaBc && categoria !== 'B' && categoria !== 'C') return false;
    if (d.hasSubFiles) return false;
    return !selectedFiles[d.id] && !naDocs.includes(d.id) && !archivosPrevios[d.id];
  });

  const pendientesSubsanar = filingToEdit
    ? allDocs.filter(d => {
        const prev = (filingToEdit.archivos || []).find(a => a.docId === d.id);
        if (!prev) return false;
        const observado = prev.status === 'NO CUMPLE' || (prev.status === 'PENDIENTE' && prev.notes);
        if (!observado) return false;
        if (d.hasSubFiles) {
          const nuevos = selectedSubFiles[d.id] && Object.keys(selectedSubFiles[d.id] || {}).length > 0;
          return !nuevos && !naDocs.includes(d.id);
        }
        return !selectedFiles[d.id] && !naDocs.includes(d.id) && !archivosPrevios[d.id];
      })
    : [];

  const irAlMensaje = () => {
    setTimeout(() => {
      try {
        document.querySelector('#envio-msg')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {  }
    }, 80);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!filingToEdit && !firmaContratista) {
      alert('La firma digital del contratista es obligatoria para crear el radicado. Estampe su firma antes de continuar.');
      return;
    }

    if (missingMandatory.length > 0 && !filingToEdit) {
      if (!confirm(`Atención: Hay ${missingMandatory.length} documentos obligatorios pendientes de carga. ¿Desea continuar radicando con observaciones de interventoría?`)) {
        return;
      }
    }

    if (filingToEdit && pendientesSubsanar.length > 0) {
      if (!confirm(`Aún falta por corregir lo observado en: ${pendientesSubsanar.map(d => d.code).join(', ')}. ¿Enviar de todos modos la subsanación?`)) {
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const userEmail = (currentUser?.email || metadata.correoResponsable || '').toLowerCase().trim();

      if (filingToEdit) {
        const archivos = (filingToEdit.archivos || []).map(a => ({ ...a }));
        const fallos = [];
        setMensajeEnvio({ tipo: 'info', texto: `Enviando subsanación del radicado ${filingToEdit.numeroRadicado}… no cierre esta ventana.` });
        irAlMensaje();
        const verError = async (resp, que) => {
          if (resp.ok) return null;
          const d = await resp.json().catch(() => null);
          return `${que}: ${d?.detail || `HTTP ${resp.status}`}`;
        };

        for (const [docIdStr, file] of Object.entries(selectedFiles)) {
          const docId = parseInt(docIdStr, 10);
          const fd = new FormData();
          fd.append('docId', String(docId));
          fd.append('archivo', file);
          const up = await apiFetch(`/api/radicacion/${filingToEdit.id}/archivo`, {
            method: 'POST',
            body: fd
          });
          const err = await verError(up, `documento ${docIdStr}`);
          if (err) {
            fallos.push(err);
            continue;
          }
          const upJson = await up.json().catch(() => null);
          const updated = upJson?.data?.archivos || archivos;
          updated.forEach(a => {
            if (a.docId === docId) {
              const existing = archivos.find(x => x.docId === docId);
              if (existing) Object.assign(existing, a);
            }
          });
        }

        for (const [docIdStr, files] of Object.entries(extraSubFiles)) {
          const docId = parseInt(docIdStr, 10);
          for (let i = 0; i < files.length; i++) {
            const fd = new FormData();
            fd.append('docId', String(docId));
            fd.append('archivo', files[i]);
            fd.append('subFileName', `Anexo ${i + 1} - ${files[i].name}`);
            const rSub = await apiFetch(`/api/radicacion/${filingToEdit.id}/archivo`, {
              method: 'POST',
              body: fd
            });
            const err = await verError(rSub, `anexo ${i + 1} de ${docIdStr}`);
            if (err) fallos.push(err);
          }
        }

        for (const [docIdStr, subs] of Object.entries(selectedSubFiles)) {
          const docId = parseInt(docIdStr, 10);
          const docDef = allDocs.find(d => d.id === docId);
          for (const [subId, file] of Object.entries(subs || {})) {
            if (!file) continue;
            const sfDef = docDef?.subFiles?.find(s => s.subId === subId);
            const fd = new FormData();
            fd.append('docId', String(docId));
            fd.append('archivo', file);
            fd.append('subFileName', sfDef?.subName || file.name);
            fd.append('subId', subId);
            fd.append('subCode', sfDef?.subCode || subId);
            const rSlot = await apiFetch(`/api/radicacion/${filingToEdit.id}/archivo`, {
              method: 'POST',
              body: fd
            });
            const err = await verError(rSlot, `sub-archivo ${subId}`);
            if (err) fallos.push(err);
          }
        }

        if (fallos.length > 0) {
          throw new Error(`No se pudieron subir: ${fallos.join(' | ')}. Corríjalos e intente de nuevo.`);
        }

        setMensajeEnvio({ tipo: 'info', texto: `Archivos subidos. Guardando datos del radicado ${filingToEdit.numeroRadicado}…` });

        Object.entries(selectedFiles).forEach(([docIdStr]) => {
          const docId = parseInt(docIdStr, 10);
          const found = archivos.find(a => a.docId === docId);
          if (found) found.status = 'CUMPLE';
        });
        Object.keys(selectedSubFiles).forEach((docIdStr) => {
          const docId = parseInt(docIdStr, 10);
          const found = archivos.find(a => a.docId === docId);
          if (found && found.status !== 'N/A') found.status = 'CUMPLE';
        });
        naDocs.forEach(docId => {
          const found = archivos.find(a => a.docId === docId);
          if (found) found.status = 'N/A';
        });

        const metadataWithSignature = {
          ...metadata,
          creadorEmail: userEmail,
          creadorName: currentUser?.name || metadata.responsable,
          correoResponsable: metadata.correoResponsable || userEmail,
          categoria: categoria || '',
          firmaContratista: firmaContratista || undefined
        };
        const metaRes = await apiFetch(`/api/radicacion/${filingToEdit.id}/metadata`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metadata: metadataWithSignature,
            archivos,
            elementosEntregados: elementos
          })
        });

        const estadoRes = await apiFetch(`/api/radicacion/${filingToEdit.id}/estado`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estado: 'En Revisión',
            observaciones: '',
            usuarioEmail: userEmail,
            usuarioNombre: currentUser?.name || ''
          })
        });

        if (!metaRes.ok) {
          const d = await metaRes.json().catch(() => null);
          throw new Error(d?.detail || 'No se pudieron guardar los datos del radicado.');
        }
        if (!estadoRes.ok) {
          const d = await estadoRes.json().catch(() => null);
          throw new Error(d?.detail || 'No se pudo reenviar a revisión.');
        }
        setMensajeEnvio({ tipo: 'info', texto: `Reenviando ${filingToEdit.numeroRadicado} a revisión…` });

        const res = await apiFetch(`/api/radicacion/${filingToEdit.id}`);
        const result = await res.json();
        if (res.ok && result.data) {
          setMensajeEnvio({
            tipo: 'ok',
            texto: `¡Cambios del radicado ${result.data.numeroRadicado} enviados correctamente! Quedó En Revisión para nueva evaluación. Abriendo el informe…`
          });
          irAlMensaje();
          await new Promise(r => setTimeout(r, 2200));
          onSuccess(result.data);
        } else {
          setMensajeEnvio({ tipo: 'error', texto: 'No se pudo confirmar el guardado en el servidor. Revise su conexión e intente de nuevo.' });
          irAlMensaje();
        }
        return;
      }

      const formData = new FormData();
      const metadataWithSignature = {
        ...metadata,
        creadorEmail: userEmail,
        creadorName: currentUser?.name || metadata.responsable,
        correoResponsable: metadata.correoResponsable || userEmail,
        categoria: categoria || '',
        firmaContratista: firmaContratista || undefined
      };
      formData.append('metadatos', JSON.stringify(metadataWithSignature));
      formData.append('elementos', JSON.stringify(elementos));
      formData.append('naDocs', JSON.stringify(naDocs));

      const docsAdicionales = customDocs.map(doc => ({
        docId: doc.id,
        docCode: doc.code,
        docName: doc.name,
        category: doc.category,
        description: doc.description,
        esManual: true
      }));
      formData.append('docsAdicionales', JSON.stringify(docsAdicionales));

      Object.entries(selectedFiles).forEach(([docId, file]) => {
        const docDef = allDocs.find(d => d.id === parseInt(docId, 10));
        const fieldName = docDef?.esManual ? `archivo_custom_${docId}` : docDef ? `archivo_${docDef.code}` : `archivo_${docId}`;
        formData.append(fieldName, file);
      });

      Object.entries(selectedSubFiles).forEach(([docIdStr, subs]) => {
        const docId = parseInt(docIdStr, 10);
        const docDef = allDocs.find(d => d.id === docId);
        Object.entries(subs || {}).forEach(([subId, file]) => {
          if (!file) return;
          const sfDef = docDef?.subFiles?.find(s => s.subId === subId);
          formData.append(`subFile_${docId}_${subId}`, file);
          formData.append(`subFileMeta_${docId}_${subId}`, JSON.stringify({
            docId,
            subId,
            subCode: sfDef?.subCode || subId,
            subName: sfDef?.subName || file.name
          }));
        });
      });

      Object.entries(extraSubFiles).forEach(([docId, files]) => {
        files.forEach((file, idx) => {
          formData.append(`extraSub_${docId}_${idx}`, file);
          formData.append(`extraSubMeta_${docId}_${idx}`, JSON.stringify({ docId: parseInt(docId, 10), subFileName: `Anexo ${idx + 1} - ${file.name}` }));
        });
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);
      let response;
      try {
        response = await apiFetch('/api/radicacion/nueva', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr?.name === 'AbortError') {
          alert('La subida tardó demasiado y se interrumpió (3 min). Intente con archivos más livianos o verifique su conexión e intente de nuevo.');
        } else {
          alert('No se pudo conectar con el servidor (backend apagado o Render en arranque). Verifique que el backend esté corriendo en http://localhost:8000 o espere 1 minuto si es el servidor en la nube y reintente.');
        }
        return;
      }
      clearTimeout(timeoutId);

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (response.ok && result?.data) {
        onSuccess(result.data);
      } else {
        const detalle = result?.detail || result?.error || result?.mensaje;
        if (response.status === 400 && detalle) {
          alert(`No se pudo radicar: ${typeof detalle === 'string' ? detalle : JSON.stringify(detalle)}`);
        } else if (response.status === 409 && detalle) {
          alert(`${typeof detalle === 'string' ? detalle : JSON.stringify(detalle)} Intente de nuevo.`);
        } else if (response.status >= 500) {
          alert(`El servidor falló al guardar (error 500)${detalle ? `: ${typeof detalle === 'string' ? detalle : JSON.stringify(detalle)}` : ''}. Si es el servidor en la nube, puede estar arrancando: espere 1 minuto y reintente. Si persiste, revise los logs del backend.`);
        } else if (detalle) {
          alert(`No se pudo radicar: ${typeof detalle === 'string' ? detalle : JSON.stringify(detalle)}`);
        } else {
          alert(`No se pudo radicar (HTTP ${response.status}). Verifique su conexión e intente de nuevo.`);
        }
      }
    } catch (err) {
      console.error('Error enviando formulario:', err);
      if (filingToEdit) {
        setMensajeEnvio({ tipo: 'error', texto: `No se pudo enviar la actualización: ${err?.message || err}. Se quedó en esta pantalla sin perder lo digitado.` });
        irAlMensaje();
      } else {
        alert(`Error al guardar la radicación: ${err?.message || err}. Verifique que el backend esté corriendo e intente de nuevo.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: 'todos', label: `Todos (${allDocs.length})` },
    { id: 'diseno', label: `1. Diseño (${allDocs.filter(d => d.category === 'diseno').length})` },
    { id: 'luminarias', label: `2. Luminarias (${allDocs.filter(d => d.category === 'luminarias').length})` },
    { id: 'constructor', label: `3. Constructor (${allDocs.filter(d => d.category === 'constructor').length})` },
    { id: 'dictamenes', label: `4. Dictámenes (${allDocs.filter(d => d.category === 'dictamenes').length})` },
    { id: 'otros', label: `5. Otros (${allDocs.filter(d => d.category === 'otros').length})` }
  ];

  const filteredDocs = activeCategory === 'todos' 
    ? allDocs 
    : allDocs.filter(d => d.category === activeCategory);

  const stepVariants = {
    enter: (dir) => ({
      x: dir > 0 ? 150 : -150,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.3, ease: 'easeOut' }
    },
    exit: (dir) => ({
      x: dir < 0 ? 150 : -150,
      opacity: 0,
      transition: { duration: 0.2, ease: 'easeIn' }
    })
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
            <span className="bg-[#1E222A] text-[#D9CF43] px-2.5 py-0.5 rounded font-black">INTECOAL SAS</span>
            <span>· Portal de Radicación Digital</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1E222A] tracking-tight">
            {filingToEdit 
              ? 'Subsanar Observaciones del Expediente'
              : 'Asistente de Radicación de Expediente Técnico'}
          </h1>
          {filingToEdit && (
            <p className="text-xs text-amber-700 font-semibold mt-0.5">
              Edición del radicado {filingToEdit.numeroRadicado} - mantiene el mismo número. Corrija los documentos señalados y vuelva a enviar para revisión.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="self-start md:self-auto px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-extrabold transition-all border border-gray-300"
        >
          Cancelar / Volver a la Lista
        </button>
      </div>

      <div className="bg-[#1E222A] text-white rounded-2xl p-6 shadow-xl mb-8 border-b-4 border-[#D9CF43] relative overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            <div className="hidden md:block absolute top-6 left-12 right-12 h-1 bg-slate-700 z-0">
              <div 
                className="h-full bg-[#D9CF43] transition-all duration-500" 
                style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
              />
            </div>

            {steps.map((st) => {
              const StepIcon = st.icon;
              const isActive = currentStep === st.number;
              const isDone = st.number < currentStep;

              return (
                <button
                  key={st.number}
                  type="button"
                  onClick={() => goToStep(st.number)}
                  className={`relative z-10 flex md:flex-col items-center text-left md:text-center p-3.5 rounded-xl transition-all ${
                    isActive 
                      ? 'bg-[#D9CF43]/15 border border-[#D9CF43]/50 shadow-lg scale-[1.02]' 
                      : isDone
                      ? 'bg-slate-800/80 hover:bg-slate-800 text-gray-200 border border-slate-700'
                      : 'bg-slate-900/40 text-gray-300 border border-transparent'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mb-0 md:mb-2 mr-3 md:mr-0 font-black text-sm transition-all ${
                    isActive 
                      ? 'bg-[#D9CF43] text-[#1E222A] shadow-md shadow-[#D9CF43]/20 ring-4 ring-[#D9CF43]/20' 
                      : isDone 
                      ? 'bg-[#BFBA6B] text-[#1E222A]' 
                      : 'bg-slate-700 text-gray-300'
                  }`}>
                    {isDone ? <Check className="w-6 h-6 stroke-[3]" /> : <StepIcon className="w-5 h-5" />}
                  </div>

                  <div>
                    <span className={`text-[11px] font-black uppercase tracking-wider block ${
                      isActive ? 'text-[#D9CF43]' : isDone ? 'text-[#BFBA6B]' : 'text-gray-300'
                    }`}>
                      {st.title}
                    </span>
                    <span className={`text-xs font-semibold block mt-0.5 ${
                      isActive ? 'text-white' : 'text-gray-300'
                    }`}>
                      {st.subtitle}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {mensajeEnvio && (
          <div id="envio-msg" className={`mb-4 px-4 py-3 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-sm ${
            mensajeEnvio.tipo === 'ok'
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
              : mensajeEnvio.tipo === 'info'
              ? 'bg-sky-50 border border-sky-300 text-sky-800'
              : 'bg-red-50 border border-red-300 text-red-800'
          }`}>
            {mensajeEnvio.tipo === 'ok'
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              : mensajeEnvio.tipo === 'info'
              ? <span className="w-5 h-5 border-[3px] border-sky-500 border-t-transparent rounded-full animate-spin shrink-0" />
              : <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />}
            <span>{mensajeEnvio.texto}</span>
          </div>
        )}
        <div className="bg-[#F8F9FA] rounded-2xl shadow-xl border border-[#BFBFBF] p-6 sm:p-8 min-h-[500px] flex flex-col justify-between relative">
          
          <div className="overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="w-full"
              >
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#BFBFBF]/60 pb-4 gap-2">
                      <div>
                        <span className="text-xs font-black text-[#0D0D0D] bg-[#D9CF43] px-2.5 py-1 rounded uppercase tracking-wider">
                          PASO 1 DE 3
                        </span>
                        <h2 className="text-xl font-black text-[#0D0D0D] tracking-tight mt-1.5">
                          Expediente Técnico del Proyecto
                        </h2>
                      </div>

                      <div className="flex items-center space-x-2 bg-white px-3.5 py-1.5 rounded-xl border border-gray-300 shadow-sm shrink-0">
                        <span className="text-xs font-bold text-gray-600">Archivos:</span>
                        <span className="text-sm font-black text-[#0D0D0D]">{totalCompleted} / {totalDocs}</span>
                        <span className="text-xs font-extrabold text-[#0D0D0D] bg-[#D9CF43] px-2 py-0.5 rounded">
                          {percentage}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h3 className="text-sm font-black text-[#0D0D0D] uppercase tracking-wide flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#BFBA6B]" />
                          Lista de Verificación Documental
                        </h3>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex flex-wrap gap-1 bg-white p-1 rounded-xl border border-gray-300">
                            {categories.map(cat => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActiveCategory(cat.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                                  activeCategory === cat.id
                                    ? 'bg-[#0D0D0D] text-[#D9CF43] shadow-md'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                }`}
                              >
                                {cat.label}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAddDocModal(true)}
                            className="inline-flex items-center space-x-1.5 bg-[#0D0D0D] hover:bg-gray-800 text-[#D9CF43] font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agregar Documento</span>
                          </button>
                        </div>
                      </div>

                      {(filingToEdit ? pendientesSubsanar.length > 0 : missingMandatory.length > 0) && (
                        <div className="bg-amber-50 border-l-4 border-amber-500 p-3.5 rounded-r-xl flex items-start space-x-3 text-xs text-amber-900 shadow-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-black uppercase">
                              {filingToEdit ? 'Por corregir según interventoría: ' : 'Obligatorios pendientes: '}
                            </span>
                            <span>{(filingToEdit ? pendientesSubsanar : missingMandatory).map(d => d.code).join(', ')}</span>
                          </div>
                        </div>
                      )}

                      {filingToEdit && hayObs && (
                        <div className="bg-sky-50 border-l-4 border-sky-600 p-4 rounded-r-xl text-xs text-sky-950 shadow-sm space-y-2">
                          <div className="flex items-center space-x-2">
                            <MessageSquare className="w-4 h-4 text-sky-700 shrink-0" />
                            <span className="font-black uppercase tracking-wide">Observaciones de la interventoría — corrija lo indicado</span>
                          </div>
                          {obsGenerales && (
                            <p className="bg-white border border-sky-200 rounded-lg px-3 py-2 leading-relaxed">{obsGenerales}</p>
                          )}
                          {docsConNota.length > 0 && (
                            <ul className="space-y-1.5">
                              {docsConNota.map(a => (
                                <li key={a.docId} className="bg-white border border-sky-200 rounded-lg px-3 py-2">
                                  <span className="font-black">{a.docCode} · {a.docName} </span>
                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${a.status === 'NO CUMPLE' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {a.status}
                                  </span>
                                  <span className="block mt-0.5 text-sky-900">{a.notes}</span>
                                  {a.fileName && <span className="block text-[11px] text-gray-500">Archivo actual: {a.fileName} → vuelva a subirlo corregido.</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                          {subsConNota.length > 0 && (
                            <ul className="space-y-1.5">
                              {subsConNota.map(s => (
                                <li key={s.subId} className="bg-white border border-sky-200 rounded-lg px-3 py-2">
                                  <span className="font-black">{s.docCode} · {s.subCode ? `${s.subCode} · ` : ''}{s.subName || s.fileName} </span>
                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${s.status === 'NO CUMPLE' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {s.status || 'PENDIENTE'}
                                  </span>
                                  <span className="block mt-0.5 text-sky-900">{s.notes}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <p className="text-[11px] text-sky-800 font-semibold">Los documentos marcados como Cumple o N/A quedaron verificados y no se pueden modificar: solo corrija los Pendientes o No cumple.</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-3">
                        {filteredDocs.map((doc) => {
                          const file = selectedFiles[doc.id];
                          const isNA = naDocs.includes(doc.id);
                          const previo = archivosPrevios[doc.id];
                          const bloqueado = bloqueadoPorRevision(doc.id);

                          let cardBorder = 'border-gray-200 bg-white';
                          let statusBadge = (
                            <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-lg border border-amber-300 flex items-center space-x-1">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              <span>PENDIENTE</span>
                            </span>
                          );

                          if (file) {
                            cardBorder = 'border-emerald-300 bg-emerald-50/50';
                            statusBadge = (
                              <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>NUEVO</span>
                              </span>
                            );
                          } else if (previo) {
                            cardBorder = 'border-emerald-200 bg-emerald-50/40';
                            statusBadge = (
                              <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>CARGADO</span>
                              </span>
                            );
                          } else if (isNA) {
                            cardBorder = 'border-gray-300 bg-gray-100';
                            statusBadge = (
                              <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-gray-300">
                                N/A
                              </span>
                            );
                          }

                          return (
                            <div
                              key={doc.id}
                              className={`border rounded-xl p-3.5 transition-all duration-200 hover:shadow-md ${cardBorder}`}
                            >
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                <div className="flex items-start space-x-3 max-w-xl">
                                  <div className="bg-[#0D0D0D] text-[#D9CF43] font-black text-xs px-2.5 py-1 rounded shrink-0 mt-0.5 shadow-sm">
                                    #{doc.id} {doc.code}
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <h4 className="font-extrabold text-[#0D0D0D] text-sm">
                                        {doc.name}
                                      </h4>
                                      {doc.requiredIfCategoriaBc && (categoria !== 'B' && categoria !== 'C') ? (
                                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                                          SI APLICA
                                        </span>
                                      ) : doc.required ? (
                                        <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">
                                          OBLIGATORIO
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                                          SI APLICA
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-600 mt-0.5">
                                      {doc.description}
                                    </p>
                                    {previo?.notes && (
                                      <div className="mt-1.5 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5 text-[11px] text-sky-900">
                                        <span className="font-black">Observación del revisor: </span>
                                        {previo.notes}
                                        {previo.status !== 'CUMPLE' && previo.status !== 'N/A' && (
                                          <span className="block text-sky-700">Vuelva a subir este documento corregido.</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                  {bloqueado && previo ? (
                                    <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center space-x-1">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>VERIFICADO</span>
                                    </span>
                                  ) : (
                                    <>{statusBadge}</>
                                  )}

                                  {doc.esManual && !bloqueado && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCustomDoc(doc.id)}
                                      className="text-red-500 hover:text-red-700 p-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-all"
                                      title="Eliminar documento adicional"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {(!doc.required ||
                                    (doc.requiredIfCategoriaBc && categoria !== 'B' && categoria !== 'C')) && !bloqueado && (
                                    <label className="flex items-center space-x-1.5 text-xs font-bold text-gray-700 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 shadow-sm">
                                      <input
                                        type="checkbox"
                                        checked={isNA}
                                        onChange={() => handleToggleNA(doc.id)}
                                        className="rounded border-gray-300 text-[#0D0D0D] focus:ring-[#D9CF43]"
                                      />
                                      <span>N/A</span>
                                    </label>
                                  )}

                                  {!bloqueado && !isNA && !doc.hasSubFiles && !(doc.id === 20 && !categoria) && (
                                    <label className="cursor-pointer bg-[#0D0D0D] hover:bg-gray-800 text-[#D9CF43] text-xs font-bold px-3.5 py-1.5 rounded-lg shadow transition-all flex items-center space-x-1.5 active:scale-95">
                                      <FolderDown className="w-3.5 h-3.5 text-[#D9CF43]" />
                                      <span>{file ? 'Cambiar' : 'Adjuntar'}</span>
                                      <input
                                        type="file"
                                        accept=".pdf,.dwg,.dxf,.jpeg,.jpg,.png,.tiff,.tif,.bmp,.gif"
                                        onChange={(e) => handleFileChange(doc.id, e)}
                                        className="hidden"
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>

                              {file && !doc.hasSubFiles && (
                                <div className="mt-2.5 pt-2 border-t border-emerald-200/80 space-y-2">
                                  <div className="flex items-center justify-between text-xs text-emerald-950 bg-emerald-100/60 px-3 py-1.5 rounded-lg">
                                    <div className="flex items-center space-x-2 truncate">
                                      <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                                      <span className="font-bold truncate">{file.name}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedFiles = { ...selectedFiles };
                                        delete updatedFiles[doc.id];
                                        setSelectedFiles(updatedFiles);
                                      }}
                                      className="text-red-500 hover:text-red-700 font-bold ml-2 p-0.5 rounded hover:bg-red-50"
                                      title="Quitar archivo"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <label className="cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-amber-300 transition-all flex items-center space-x-1 active:scale-95">
                                      <Plus className="w-3 h-3" />
                                      <span>Agregar anexo</span>
                                      <input
                                        type="file"
                                        accept=".pdf,.dwg,.dxf,.jpeg,.jpg,.png,.tiff,.tif,.bmp,.gif"
                                        onChange={(e) => handleAddExtraSubFile(doc.id, e)}
                                        className="hidden"
                                      />
                                    </label>
                                    {(extraSubFiles[doc.id] || []).length > 0 && (
                                      <span className="text-[10px] text-amber-700 font-semibold">
                                        {extraSubFiles[doc.id].length} anexo(s) adicional(es)
                                      </span>
                                    )}
                                  </div>

                                  {(extraSubFiles[doc.id] || []).length > 0 && (
                                    <div className="space-y-1">
                                      {extraSubFiles[doc.id].map((sf, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-[11px] bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                                          <div className="flex items-center space-x-2 truncate min-w-0">
                                            <Check className="w-3 h-3 text-amber-600 shrink-0" />
                                            <span className="font-semibold text-amber-900 truncate">Anexo {idx + 1}: {sf.name}</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveExtraSubFile(doc.id, idx)}
                                            className="text-red-400 hover:text-red-600 ml-2 p-0.5 rounded hover:bg-red-50 shrink-0"
                                            title="Quitar anexo"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {doc.hasSubFiles && doc.subFiles && !isNA && (
                                <div className="mt-3 pt-3 border-t border-dashed border-gray-300 space-y-2">
                                  <span className="text-[10px] font-black uppercase text-gray-600 tracking-wider">
                                    Sub-archivos requeridos ({doc.subFiles.length}):
                                  </span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {doc.subFiles.map((sf) => {
                                      const subFile = selectedSubFiles[doc.id]?.[sf.subId];
                                      const prevSubFile = filingToEdit?.archivos?.find(a => a.docId === doc.id)?.subFiles?.find(s => s.subId === sf.subId);
                                      const ranuraBloqueada = subBloqueado(doc.id, sf.subId);
                                      return (
                                        <div key={sf.subId} className="space-y-1">
                                        <div className={`flex items-center justify-between p-2 rounded-lg border text-xs ${subFile || prevSubFile?.fileName ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                                          <div className="flex items-center space-x-2 truncate min-w-0">
                                            {subFile || prevSubFile?.fileName ? (
                                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                            ) : (
                                              <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                                            )}
                                            <span className="truncate font-semibold text-gray-700">{sf.subName}</span>
                                            {ranuraBloqueada && prevSubFile && (
                                              <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300 shrink-0">VERIFICADO</span>
                                            )}
                                            {!ranuraBloqueada && prevSubFile?.status && prevSubFile.status !== 'CUMPLE' && (
                                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${prevSubFile.status === 'NO CUMPLE' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                                {prevSubFile.status}
                                              </span>
                                            )}
                                          </div>
                                          {!ranuraBloqueada ? (
                                          <label className="cursor-pointer text-[#D9CF43] bg-[#0D0D0D] hover:bg-gray-800 text-[10px] font-bold px-2 py-1 rounded shrink-0 ml-2">
                                            {subFile ? 'Cambiar' : 'Adjuntar'}
                                            <input
                                              type="file"
                                              accept=".pdf,.dwg,.dxf,.jpeg,.jpg,.png,.tiff,.tif,.bmp,.gif"
                                              onChange={(e) => handleSubFileChange(doc.id, sf.subId, e)}
                                              className="hidden"
                                            />
                                          </label>
                                          ) : null}
                                        </div>
                                        {prevSubFile?.notes && (
                                          <div className="bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5 text-[11px] text-sky-900">
                                            <span className="font-black">Revisor: </span>{prevSubFile.notes}
                                          </div>
                                        )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {doc.id === 20 && !isNA && (
                                <div className="mt-3 pt-3 border-t border-dashed border-gray-300">
                                  <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-gray-700 uppercase">
                                      Categoría del Proyecto *
                                    </label>
                                    <select
                                      name="categoria"
                                      value={categoria}
                                      onChange={(e) => setCategoria(e.target.value)}
                                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#D9CF43]"
                                    >
                                      <option value="">Seleccione la categoría</option>
                                      <option value="A">Categoría A (≤ 25 luminarias)</option>
                                      <option value="B">Categoría B (26 a 75 luminarias)</option>
                                      <option value="C">Categoría C (76 luminarias en adelante)</option>
                                    </select>
                                    <p className="text-[11px] text-gray-500">
                                      {categoria === 'A'
                                        ? 'Para Categoría A este documento es opcional (sí aplica).'
                                        : 'Para Categorías B o C este documento es obligatorio.'}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-[#BFBFBF]/60 pb-4">
                      <div>
                        <span className="text-xs font-black text-[#0D0D0D] bg-[#D9CF43] px-2.5 py-1 rounded uppercase tracking-wider">
                          PASO 2 DE 3
                        </span>
                        <h2 className="text-xl font-black text-[#0D0D0D] tracking-tight mt-1.5">
                          Información del Contratista e Inventario Físico
                        </h2>
                      </div>
                      <span className="text-xs font-semibold text-gray-500 hidden sm:inline-block bg-white px-3 py-1.5 rounded-lg border border-gray-300">
                        Metadatos del Contrato
                      </span>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-gray-300 shadow-sm space-y-4">
                      <h3 className="text-xs font-black uppercase text-[#0D0D0D] tracking-wider border-b border-gray-200 pb-2">
                        1. Metadatos del Contrato de Obra
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">
                            Nombre Completo del Proyecto / Obra *
                          </label>
                          <input
                            type="text"
                            name="nombreProyecto"
                            required
                            value={metadata.nombreProyecto}
                            onChange={handleMetaChange}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#D9CF43]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">
                            Municipio *
                          </label>
                          <div className="relative">
                            <MapPin className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                            <select
                              name="municipio"
                              value={metadata.municipio}
                              onChange={handleMetaChange}
                              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#D9CF43]"
                            >
                              <option value="TULUÁ">TULUÁ</option>
                              <option value="ANDALUCÍA">ANDALUCÍA</option>
                              <option value="SAN PEDRO">SAN PEDRO</option>
                              <option value="CALIMA">CALIMA</option>
                              <option value="VILLAVICENCIO">VILLAVICENCIO</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">
                            Empresa Contratista *
                          </label>
                          <input
                            type="text"
                            name="contratista"
                            required
                            value={metadata.contratista}
                            onChange={handleMetaChange}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#D9CF43]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">
                            NIT del Contratista *
                          </label>
                          <input
                            type="text"
                            name="nitContratista"
                            required
                            value={metadata.nitContratista}
                            onChange={handleMetaChange}
                            placeholder="Ej: 891903664-1"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#D9CF43]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">
                            Responsable de Revisión - Interventoría / Contratista *
                          </label>
                          <div className="relative">
                            <User className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                            <input
                              type="text"
                              name="responsable"
                              required
                              value={metadata.responsable}
                              onChange={handleMetaChange}
                              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#D9CF43]"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">
                            Correo de Contacto *
                          </label>
                          <div className="relative">
                            <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                            <input
                              type="email"
                              name="correoResponsable"
                              required
                              value={metadata.correoResponsable}
                              onChange={handleMetaChange}
                              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#D9CF43]"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">
                            Tipo de Entrega *
                          </label>
                          <select
                            name="tipoEntrega"
                            value={metadata.tipoEntrega}
                            onChange={handleMetaChange}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#D9CF43]"
                          >
                            <option value="Inicio">Inicio</option>
                            <option value="Subsanación">Subsanación</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-gray-300 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                        <h3 className="text-xs font-black uppercase text-[#0D0D0D] tracking-wider">
                          2. Inventario Físico de Luminarias y Componentes
                        </h3>
                        <button
                          type="button"
                          onClick={handleAddElement}
                          className="inline-flex items-center space-x-1.5 bg-[#0D0D0D] hover:bg-gray-800 text-[#D9CF43] font-extrabold text-xs px-3 py-1.5 rounded-lg transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Agregar Ítem</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto border border-gray-200 rounded-xl">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#0D0D0D] text-[#D9CF43] text-xs font-extrabold uppercase">
                              <th className="py-2.5 px-3 w-10 text-center">#</th>
                              <th className="py-2.5 px-3 w-1/3">Componente Físico</th>
                              <th className="py-2.5 px-3 w-24 text-center">Cantidad</th>
                              <th className="py-2.5 px-3">Especificación Técnica</th>
                              <th className="py-2.5 px-3 w-10 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 text-xs">
                            {elementos.map((elem, idx) => (
                              <tr key={elem.id} className="hover:bg-gray-50">
                                <td className="py-2 px-3 text-center font-bold text-gray-400">{idx + 1}</td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={elem.elemento}
                                    onChange={(e) => handleElementChange(elem.id, 'elemento', e.target.value)}
                                    className="w-full px-2.5 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    min="1"
                                    value={elem.cantidad}
                                    onChange={(e) => handleElementChange(elem.id, 'cantidad', parseInt(e.target.value, 10) || 1)}
                                    className="w-full text-center px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={elem.especificacion}
                                    onChange={(e) => handleElementChange(elem.id, 'especificacion', e.target.value)}
                                    className="w-full px-2.5 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs"
                                  />
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveElement(elem.id)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                      </div>
                    )}

                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-[#BFBFBF]/60 pb-4">
                      <div>
                        <span className="text-xs font-black text-[#0D0D0D] bg-[#D9CF43] px-2.5 py-1 rounded uppercase tracking-wider">
                          PASO 3 DE 3
                        </span>
                        <h2 className="text-xl font-black text-[#0D0D0D] tracking-tight mt-1.5">
                          Firma Digital & Declaración de Radicación
                        </h2>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-300">
                        Paso Final
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-5 rounded-2xl border border-gray-300 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                          <span className="text-xs font-black uppercase text-gray-600">Resumen del Expediente</span>
                          <span className="text-xs font-bold text-[#0D0D0D] bg-[#D9CF43] px-2 py-0.5 rounded">
                            {metadata.numeroRadicado || 'Se asigna al crear'}
                          </span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <p><strong className="text-gray-600">Proyecto:</strong> <span className="font-bold text-[#0D0D0D]">{metadata.nombreProyecto}</span></p>
                          <p><strong className="text-gray-600">Municipio:</strong> {metadata.municipio}</p>
                          <p><strong className="text-gray-600">Contratista:</strong> {metadata.contratista} ({metadata.nitContratista})</p>
                          <p><strong className="text-gray-600">Responsable:</strong> {metadata.responsable}</p>
                        </div>
                      </div>

                      <div className="bg-[#0D0D0D] text-white p-5 rounded-2xl border border-gray-800 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
                            <span className="text-xs font-black uppercase text-[#D9CF43]">Estado de Verificación</span>
                            <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                              {percentage}% RETILAP
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-gray-900 p-2 rounded-xl">
                              <span className="text-lg font-black text-emerald-400">{attachedCount}</span>
                              <p className="text-[10px] text-gray-300 font-bold uppercase">Archivos</p>
                            </div>
                            <div className="bg-gray-900 p-2 rounded-xl">
                              <span className="text-lg font-black text-gray-300">{naCount}</span>
                              <p className="text-[10px] text-gray-300 font-bold uppercase">N/A</p>
                            </div>
                            <div className="bg-gray-900 p-2 rounded-xl">
                              <span className="text-lg font-black text-amber-400">{totalDocs - totalCompleted}</span>
                              <p className="text-[10px] text-gray-300 font-bold uppercase">Pendientes</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 text-[11px] text-gray-300 border-t border-gray-800 pt-2 flex items-center justify-between">
                          <span>Ítems Físicos: <strong className="text-white">{elementos.length}</strong></span>
                          <span>Carga en SharePoint: <strong className="text-[#D9CF43]">al aprobar el radicado</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-gray-300 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                        <h3 className="text-xs font-black uppercase text-[#0D0D0D] tracking-wider flex items-center gap-2">
                          <PenTool className="w-4 h-4 text-[#BFBA6B]" />
                          Firma Digital del Contratista
                        </h3>
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          Ley 527 de 1999
                        </span>
                      </div>

                      {firmaContratista ? (
                        <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white rounded-lg border border-emerald-200 shadow-sm">
                              {firmaContratista.dataUrl ? (
                                <img
                                  src={firmaContratista.dataUrl}
                                  alt="Firma del Contratista"
                                  className="h-12 max-w-[140px] object-contain"
                                />
                              ) : (
                                <PenTool className="w-6 h-6 text-emerald-600" />
                              )}
                            </div>
                            <div>
                              <span className="text-xs font-black text-emerald-950 block">
                                {firmaContratista.nombreSignatario || metadata.responsable}
                              </span>
                              <span className="text-[11px] text-emerald-800 font-semibold block">
                                {firmaContratista.cargo || 'Representante Técnico Contratista'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setShowSignatureModal(true)}
                              className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Modificar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFirmaContratista(null)}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="flex items-center space-x-3 text-xs text-gray-600">
                            <PenTool className="w-5 h-5 text-gray-400 shrink-0" />
                            <div>
                              <p className="font-bold text-gray-800">Estampar Firma Digital en el Expediente</p>
                              <p className="text-[11px] text-gray-500">Puede trazarla con el mouse/touch, cargar una imagen PNG o generarla tipográficamente.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowSignatureModal(true)}
                            className="px-4 py-2 bg-[#1E222A] hover:bg-slate-800 text-[#D9CF43] font-bold text-xs rounded-xl shadow transition-all shrink-0 flex items-center space-x-1.5"
                          >
                            <PenTool className="w-4 h-4" />
                            <span>Crear / Subir Firma</span>
                          </button>
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-8 pt-6 border-t border-[#BFBFBF]/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              disabled={currentStep === 1}
              onClick={() => goToStep(currentStep - 1)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold text-xs bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>

            <div className="flex items-center space-x-2">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => goToStep(s)}
                  className={`h-2.5 rounded-full transition-all ${
                    currentStep === s
                      ? 'w-8 bg-[#D9CF43]'
                      : s < currentStep
                      ? 'w-2.5 bg-[#0D0D0D]'
                      : 'w-2.5 bg-gray-300'
                  }`}
                  title={`Paso ${s}`}
                />
              ))}
              <span className="text-xs font-black text-gray-500 ml-2">
                Paso {currentStep} de 3
              </span>
            </div>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => goToStep(currentStep + 1)}
                className="w-full sm:w-auto px-7 py-3 rounded-xl font-black text-xs bg-[#D9CF43] hover:bg-amber-400 text-[#0D0D0D] transition-all shadow-lg flex items-center justify-center space-x-2 active:scale-95 uppercase tracking-wider"
              >
                <span>Siguiente Paso</span>
                <ChevronRight className="w-4 h-4 text-[#0D0D0D]" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3 rounded-xl font-black text-xs bg-[#D9CF43] hover:bg-amber-400 text-[#0D0D0D] transition-all shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50 active:scale-95 uppercase tracking-wider"
              >
                <FileUp className="w-4 h-4 text-[#0D0D0D]" />
                <span>{isSubmitting ? (filingToEdit ? 'Guardando...' : 'Radicando...') : (filingToEdit ? 'GUARDAR Y ENVIAR A REVISIÓN' : 'RADICAR DOCUMENTACIÓN')}</span>
              </button>
            )}
          </div>
        </div>
      </form>

      {showAddDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-[#0D0D0D]">Agregar Documento Adicional</h3>
              <button type="button" onClick={() => setShowAddDocModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">Código del Documento *</label>
                <input
                  type="text"
                  maxLength={10}
                  value={newDoc.code}
                  onChange={(e) => setNewDoc({ ...newDoc, code: e.target.value })}
                  placeholder="Ej: X1, ADD-01"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#D9CF43]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">Nombre del Documento *</label>
                <input
                  type="text"
                  value={newDoc.name}
                  onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
                  placeholder="Ej: Certificado de calibration"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#D9CF43]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">Categoría</label>
                <select
                  value={newDoc.category}
                  onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#D9CF43]"
                >
                  <option value="diseno">Documentos de Diseño</option>
                  <option value="luminarias">Luminarias y Materiales</option>
                  <option value="constructor">Documentos del Constructor</option>
                  <option value="dictamenes">Dictámenes y Permisos</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">Descripción (opcional)</label>
                <textarea
                  rows={2}
                  value={newDoc.description}
                  onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })}
                  placeholder="Breve descripción del documento"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#D9CF43]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddDocModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddCustomDoc}
                className="px-5 py-2 bg-[#0D0D0D] hover:bg-gray-800 text-[#D9CF43] text-xs font-black rounded-xl shadow transition-all"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignatureModal && (
        <FirmaDigitalModal
          role="contratista"
          defaultName={metadata.responsable || currentUser?.name || 'Director de Obra'}
          defaultRole="Representante Técnico Contratista"
          initialSignature={firmaContratista}
          onSaveSignature={(sig) => setFirmaContratista(sig)}
          onRemoveSignature={() => setFirmaContratista(null)}
          onClose={() => setShowSignatureModal(false)}
        />
      )}
    </div>
  );
};
