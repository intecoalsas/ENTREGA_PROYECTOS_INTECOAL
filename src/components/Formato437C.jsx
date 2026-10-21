import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronDown, Edit3, X, Save, Upload, Printer, CheckCircle2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { apiFetch } from '../lib/api';
import { MembreteRecibo, FranjaCorporativa } from './MembreteCorporativo';

const F = ({ value }) => (
  <span className={`inline-block px-1 min-w-[60px] text-center ${!value ? 'border-b border-slate-800' : ''}`}>
    {value || ''}
  </span>
);

const FE = ({ value, onChange }) => (
  <input
    type="text"
    value={value || ''}
    onChange={(e) => onChange(e.target.value)}
    className={`inline-block px-1 min-w-[60px] text-center bg-transparent border-0 border-b border-[#D9CF43] focus:border-slate-800 outline-none text-[12px] font-semibold text-slate-900 transition-colors ${!value ? 'border-b border-[#D9CF43]' : 'border-b border-slate-800'}`}
  />
);

const SignatureBlock = ({ groupName, signatureImage }) => (
  <div className="mt-10 w-full flex flex-col items-center">
    <span className="uppercase font-bold text-[11px] text-slate-500">Firma</span>
    {signatureImage ? (
      <div className="mt-4 flex flex-col items-center">
        <img src={signatureImage} alt="Firma" className="max-h-20 object-contain" />
        {groupName && (
          <p className="text-center text-[11px] mt-2 font-bold uppercase">{groupName}</p>
        )}
      </div>
    ) : (
      <>
        <div className="bg-slate-900 h-px w-72 mt-8" />
        <div className="text-center text-[11px] mt-1">
          <p className="font-bold uppercase">{groupName || '_______________'}</p>
        </div>
      </>
    )}
  </div>
);

const EMPTY = {
  declaracionNumero: '',
  municipio: '',
  ciudad: '',
  nombreOperador: '',
  cedulaOperador: '',
  lugarExpedicionOperador: '',
  profesionOperador: '',
  matriculaOperador: '',
  consejoOperador: '',
  alcanceSistema: '',
  direccionObra: '',
  departamento: '',
  dictamenNumero: '',
  organismoInspeccion: '',
  propietario: '',
  tipoIdentPropietario: '',
  numIdentPropietario: '',
  resolucionNumero: '',
  fechaResolucion: '',
  diaFirma: '',
  mesFirma: '',
  anioFirma: '',
  notifDireccion: '',
  notifTelefono: '',
  notifCorreo: '',
  firmaImagen: ''
};

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const fechaHoy = () => {
  const hoy = new Date();
  return {
    diaFirma: String(hoy.getDate()),
    mesFirma: MESES[hoy.getMonth()],
    anioFirma: String(hoy.getFullYear())
  };
};

const datosIniciales = (filing) => {
  const m = filing?.metadata || {};
  const saved = m.formato437c || {};
  const subido = (filing?.formatos || []).some(f =>
    (f.nombre || '').toLowerCase().includes('formato 4.3.7 c')
  );
  if (subido) return { ...EMPTY, ...saved };
  const base = { ...EMPTY, ...saved };
  if (!base.declaracionNumero) base.declaracionNumero = filing?.numeroRadicado || '';
  if (!base.municipio) base.municipio = m.municipio || '';
  if (!base.ciudad) base.ciudad = m.municipio || '';
  return { ...base, ...fechaHoy() };
};

export const Formato437C = ({ filing, allFilings, onSelectFiling, onBack, onUpdateFiling }) => {
  const m = filing?.metadata || {};
  const yaSubido = (filing?.formatos || []).some(f =>
    f.nombre?.toLowerCase().includes('formato 4.3.7 c')
  );
  const [data, setData] = useState(() => datosIniciales(filing));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentFilingId, setCurrentFilingId] = useState(filing?.id);
  const [showUploadedMsg, setShowUploadedMsg] = useState(false);
  const formatRef = useRef(null);

  useEffect(() => {
    if (filing?.id && filing.id !== currentFilingId) {
      setData(datosIniciales(filing));
      setEditing(false);
      setCurrentFilingId(filing?.id);
      setShowUploadedMsg(false);
    }
  }, [filing?.id, currentFilingId]);

  useEffect(() => {
    if (yaSubido && !editing) {
      setShowUploadedMsg(true);
      const t = setTimeout(() => setShowUploadedMsg(false), 4000);
      return () => clearTimeout(t);
    }
  }, [yaSubido, editing]);

  const set = (key, val) => setData(prev => ({ ...prev, [key]: val }));

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        set('firmaImagen', event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!filing || !onUpdateFiling) return;
    setSaving(true);
    try {
      const updatedFiling = {
        ...filing,
        metadata: {
          ...filing.metadata,
          formato437c: data,
        },
      };
      await onUpdateFiling(updatedFiling);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleUpload = async () => {
    if (!formatRef.current || !filing) return;
    setUploading(true);

    const origGetCS = window.CSSStyleDeclaration.prototype.getPropertyValue;
    try {
      window.CSSStyleDeclaration.prototype.getPropertyValue = function (prop) {
        const val = origGetCS.call(this, prop);
        if (typeof val === 'string' && val.includes('oklch')) {
          if (prop.includes('color') || prop.includes('background')) {
            return '#000000';
          }
        }
        return val;
      };

      const dataUrl = await toPng(formatRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        filter: (node) => {
          if (node.classList && (node.classList.contains('sidebar') || node.classList.contains('topbar'))) return false;
          return true;
        }
      });

      window.CSSStyleDeclaration.prototype.getPropertyValue = origGetCS;

      const pdf = new jsPDF('p', 'mm', 'letter');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const imgWidth = img.width;
      const imgHeight = img.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;

      pdf.addImage(dataUrl, 'PNG', imgX, 0, imgWidth * ratio, imgHeight * ratio);

      const nombreRadicado = filing.numeroRadicado || 'SIN_RADICADO';
      const fileName = `formato 4.3.7 C ${nombreRadicado}.pdf`;
      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      const formData = new FormData();
      formData.append('nombre', fileName);
      formData.append('archivo', pdfFile);

      const resp = await apiFetch(`/api/radicacion/${filing.id}/formato`, {
        method: 'POST',
        body: formData
      });

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.detail || 'Error al subir el archivo');
      }

      const result = await resp.json();
      if (onUpdateFiling && result.data) {
        onUpdateFiling(result.data);
      }

      alert(`Formato guardado y subiéndose a SharePoint como "${fileName}" (suelto en la carpeta del radicado)`);
    } catch (err) {
      console.error('Error al generar/subir PDF:', err);
      alert('Error al subir el formato: ' + err.message);
    } finally {
      window.CSSStyleDeclaration.prototype.getPropertyValue = origGetCS;
      setUploading(false);
    }
  };

  const V = (key) => (editing
    ? <FE value={data[key]} onChange={(v) => set(key, v)} />
    : <F value={data[key]} />
  );

  const V2 = (k1, k2) => {
    const v1 = data[k1] || '';
    const v2 = data[k2] || '';
    const display = `${v1}${v1 && v2 ? ' ' : ''}${v2}`;
    return editing
      ? <span className="inline-flex items-center gap-0.5"><FE value={v1} onChange={(v) => set(k1, v)} /><FE value={v2} onChange={(v) => set(k2, v)} /></span>
      : <F value={display} />;
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 print:p-0 print:m-0 print:max-w-none" style={{ fontFamily: "'Arial Narrow', Arial, sans-serif" }}>
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0; }
          table.fc-repeat { border-collapse: collapse !important; width: 100% !important; height: auto !important; }
          thead.fc-head { display: table-header-group !important; }
          tfoot.fc-foot { display: table-footer-group !important; }
          thead.fc-head tr, tfoot.fc-foot tr { break-inside: avoid !important; page-break-inside: avoid !important; }
          .print-canvas, .print-canvas * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      
      <div className="flex flex-col lg:flex-row flex-wrap items-start lg:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-2xl shadow-lg border border-gray-200 print:hidden">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-700 hover:text-black font-extrabold text-xs uppercase tracking-wider bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-gray-800" />
            <span>Volver</span>
          </button>

          
          <div className="relative min-w-0 max-w-[280px] sm:max-w-[340px] flex-1">
            <select
              value={filing?.id || ''}
              onChange={(e) => {
                const f = allFilings?.find(x => x.id === e.target.value);
                if (f && onSelectFiling) onSelectFiling(f);
              }}
              className="appearance-none bg-slate-900 text-[#D9CF43] text-xs font-black px-4 py-2.5 pr-9 rounded-xl border border-slate-700 cursor-pointer focus:ring-2 focus:ring-[#D9CF43] focus:outline-none w-full overflow-hidden text-ellipsis whitespace-nowrap"
            >
              <option value="" disabled>Seleccionar radicado...</option>
              {allFilings?.map(f => (
                <option key={f.id} value={f.id}>
                  {f.numeroRadicado} — {f.metadata?.nombreProyecto || 'Sin nombre'}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#D9CF43] absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {yaSubido && showUploadedMsg && (
            <div className="bg-green-50 border border-green-300 text-green-800 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Este formato ya fue subido a la carpeta. No se puede editar.</span>
            </div>
          )}
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center space-x-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border border-gray-300 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Cancelar</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center space-x-1.5 bg-[#D9CF43] hover:bg-[#c4ba3c] text-[#0D0D0D] font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Guardando...' : 'Guardar'}</span>
              </button>
            </>
          ) : (
            <>
              {!yaSubido && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center space-x-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border border-amber-300 transition-all cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Editar</span>
                </button>
              )}
              <button
                onClick={handleUpload}
                disabled={uploading || yaSubido}
                className={`flex items-center space-x-1.5 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                  yaSubido
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : 'bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>{yaSubido ? 'Ya Subido' : uploading ? 'Subiendo...' : 'Subir'}</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center space-x-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border border-gray-300 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>
            </>
          )}
        </div>
      </div>

      
      <div
        ref={formatRef}
        className="print-canvas bg-white print:shadow-none print:border-none print:rounded-none print:w-full text-slate-900"
        style={{ fontFamily: "'Arial Narrow', Arial, sans-serif" }}
      >
      <table className="fc-repeat" style={{ width: '100%', borderCollapse: 'collapse', height: '1000px' }}>
        <thead className="fc-head">
          <tr><td style={{ padding: 0 }}>
        
        <MembreteRecibo municipio={data.municipio || filing?.metadata?.municipio || ''} />
          </td></tr>
        </thead>
        <tbody>
          <tr><td style={{ padding: 0, verticalAlign: 'top' }}>
          
          <div style={{ maxWidth: '1000px', margin: '0 auto', paddingLeft: '40px', paddingRight: '40px', boxSizing: 'border-box' }}>
          <div className="space-y-6">
        
        <div className="text-center pb-3 space-y-1">
          <p className="text-sm font-bold tracking-wide">REPÚBLICA DE COLOMBIA</p>
          <p className="text-sm font-bold tracking-wide">MINISTERIO DE MINAS Y ENERGÍA</p>
        </div>

        
        <div className="text-center space-y-1.5">
          <h2 className="text-[13px] font-black uppercase leading-snug">
            DECLARACIÓN DE CUMPLIMIENTO DE OPERACIÓN Y MANTENIMIENTO DE INSTALACIONES DE SISTEMAS DE ILUMINACIÓN BAJO EL REGLAMENTO TÉCNICO DE ILUMINACIÓN Y ALUMBRADO PÚBLICO – RETILAP.
          </h2>
          <p className="text-xs font-bold mt-1">
            DECLARACIÓN No.{' '}
            {V('declaracionNumero')}
          </p>
        </div>

        <p className="text-[9px] text-center text-slate-400 italic">
          Formato 4.3.7.c. Declaración de cumplimiento de operación y mantenimiento de instalaciones de sistemas de iluminación.
        </p>

        
        <div className="space-y-4 text-[16px] leading-relaxed">
          <p className="text-justify">
            Yo {V('nombreOperador')}, identificado(a) con la cedula de ciudadanía No.{' '}
            {V('cedulaOperador')} de {V('lugarExpedicionOperador')} en el ejercicio de mi profesión
            como {V('profesionOperador')} y titular de la matricula profesional No.{' '}
            {V('matriculaOperador')}, expedida por el Consejo {V('consejoOperador')},
            declaro bajo gravedad que, la instalación del(os) sistema(s) de iluminación con alcance{' '}
            {V('alcanceSistema')} ubicado(s) en la dirección {V('direccionObra')} del
            municipio {V('municipio')} del departamento {V('departamento')}, con
            dictamen de inspección No. {V('dictamenNumero')} expedido por el organismo de inspección{' '}
            {V('organismoInspeccion')}, del cual figura como propietario {V('propietario')}{' '}
            con tipo y número de identificación{' '}
            {V2('tipoIdentPropietario', 'numIdentPropietario')},
            mantiene el cumplimiento del RETILAP en cuanto a que la instalación del sistema de iluminación no presente
            riesgos para la salud visual de los usuarios, verificando que los niveles de iluminación medidos en la
            inspección previa no han disminuido en más de un 20 % al momento de la verificación de la instalación de
            iluminación por medio de las mediciones correspondiente de acuerdo a la Resolución No.{' '}
            {V('resolucionNumero')} de fecha {V('fechaResolucion')}, teniendo en
            cuenta los manuales de operación y mantenimiento de la instalación.
          </p>

          <p className="text-justify">
            Así mismo, declaro que la instalación del sistema de iluminación NO presenta un riesgo para la salud visual de
            los usuarios, de acuerdo con lo establecido en el RETILAP.
          </p>

          <p>
            La presente declaración se firma el día {V('diaFirma')} del mes{' '}
            {V('mesFirma')} del año {V('anioFirma')} en la ciudad de{' '}
            {V('ciudad')}.
          </p>
        </div>

        
        <div>
          <p className="text-[11px] font-black uppercase">Información de notificación del encargado de la operación o mantenimiento:</p>
          <p className="leading-relaxed mt-1.5">
            <span className="font-bold">Dirección: </span>
            {V('notifDireccion')}
          </p>
          <p className="leading-relaxed mt-1.5">
            <span className="font-bold">Teléfono: </span>
            {V('notifTelefono')}
          </p>
          <p className="leading-relaxed mt-1.5">
            <span className="font-bold">Correo electrónico: </span>
            {V('notifCorreo')}
          </p>
        </div>

        
        <div className="text-[16px] space-y-1">
          <p className="font-bold uppercase">Anexos:</p>
          <p className="text-justify">
            - Certificado de formación académica en materia de iluminación, según los requisitos generales para las
            personas que intervienen en las instalaciones establecidos en el Libro 4 del RETILAP.
          </p>
        </div>

        
        {editing ? (
          <div className="space-y-2 print:hidden">
            <label className="block text-xs font-bold text-gray-700 uppercase">Subir Firma (PNG/JPG)</label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleSignatureUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              {data.firmaImagen ? (
                <img src={data.firmaImagen} alt="Firma" className="max-h-16 mx-auto object-contain" />
              ) : (
                <p className="text-xs text-gray-500">Haga clic para subir imagen de firma</p>
              )}
            </div>
          </div>
        ) : (
          <SignatureBlock groupName={data.nombreOperador || ''} signatureImage={data.firmaImagen || ''} />
        )}
          </div>
          </div>
          </td></tr>
        </tbody>
        <tfoot className="fc-foot">
          <tr><td style={{ padding: 0 }}>
            
            <FranjaCorporativa />
          </td></tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
};
