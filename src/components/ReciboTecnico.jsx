import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Pencil,
  Save,
  Upload,
  Printer,
  CheckCircle2,
  ChevronDown,
  X
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { apiFetch } from '../lib/api';
import { MembreteRecibo, FranjaCorporativa, FIRMA_NOMBRE_JEFE, FIRMA_CARGO_JEFE } from './MembreteCorporativo';
import { FIRMA_JEFE } from '../lib/imagenesMembrete';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const fechaModelo = () => {
  const hoy = new Date();
  return `${MESES[hoy.getMonth()]} ${hoy.getDate()} de ${hoy.getFullYear()}.`;
};


export const ReciboTecnico = ({
  filings = [],
  filing,
  onSelectFiling,
  onBack,
  onUpdateFiling,
  currentUser
}) => {
  const canvasRef = useRef(null);
  const meta = filing?.metadata || {};
  const saved = meta.reciboTecnico || {};
  const yaSubido = (filing?.formatos || []).some(f =>
    (f.nombre || '').toLowerCase().includes('recibo t')
  );

  const [asunto, setAsunto] = useState(() => saved.asunto ?? '');
  const [cuerpo, setCuerpo] = useState(() => saved.cuerpo ?? '');
  const [titulo, setTitulo] = useState(() => saved.titulo ?? '');
  const [senor, setSenor] = useState(() => saved.senor ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (yaSubido) setEditing(false);
  }, [yaSubido]);

  if (!filing) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-4">
        <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-200 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-gray-500">Radicado:</span>
          <div className="relative flex-1">
            <select
              value=""
              onChange={(e) => {
                const f = filings.find(x => x.id === e.target.value);
                if (f && onSelectFiling) onSelectFiling(f);
              }}
              className="appearance-none w-full bg-slate-900 text-[#D9CF43] font-black text-xs pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-700 focus:ring-2 focus:ring-[#D9CF43] cursor-pointer"
            >
              <option value="">Seleccione un radicado…</option>
              {filings.map(f => (
                <option key={f.id} value={f.id}>
                  {f.numeroRadicado} — {(f.metadata?.nombreProyecto || '').slice(0, 40)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#D9CF43] absolute right-2.5 top-3 pointer-events-none" />
          </div>
        </div>
        <p className="text-sm font-bold text-gray-600 text-center">Seleccione un radicado para ver su Recibo Técnico.</p>
      </div>
    );
  }

  const municipio = meta.municipio || 'Andalucía';
  const proyecto = meta.nombreProyecto || 'Parque Principal Vicente H. Cruz';
  const tituloAuto = `RECIBO TÉCNICO PROYECTO DE ILUMINACIÓN ${proyecto.toUpperCase()} DEL MUNICIPIO DE ${municipio.toUpperCase()}.`;
  const senorAuto = meta.responsable || meta.contratista || 'Elbert Lopez';
  const tituloVer = titulo || tituloAuto;
  const senorVer = senor || senorAuto;
  const fechaTexto = `${municipio}, ${saved.fechaCongelada || fechaModelo()}`;
  const cuerpoParrafos = (cuerpo || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  const handleCancel = () => {
    setAsunto(saved.asunto ?? '');
    setCuerpo(saved.cuerpo ?? '');
    setTitulo(saved.titulo ?? '');
    setSenor(saved.senor ?? '');
    setEditing(false);
  };

  const handleSave = async () => {
    if (yaSubido) {
      setEditing(false);
      return;
    }    if (!onUpdateFiling) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onUpdateFiling({
        ...filing,
        metadata: {
          ...filing.metadata,
          reciboTecnico: {
            asunto,
            cuerpo,
            titulo: titulo || undefined,
            senor: senor || undefined,
            fechaCongelada: saved.fechaCongelada || undefined,
            fechaActualizacion: new Date().toISOString(),
            actualizadoPor: currentUser?.email || ''
          }
        },
        fechaActualizacion: new Date().toISOString()
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleUpload = async () => {
    if (!canvasRef.current || !filing) return;
    setUploading(true);
    const fechaAlSubir = saved.fechaCongelada || fechaModelo();
    const origGetCS = window.CSSStyleDeclaration.prototype.getPropertyValue;
    try {
      window.CSSStyleDeclaration.prototype.getPropertyValue = function (prop) {
        const val = origGetCS.call(this, prop);
        if (typeof val === 'string' && val.includes('oklch')) {
          if (prop.includes('color') || prop.includes('background')) return '#000000';
        }
        return val;
      };

      const dataUrl = await toPng(canvasRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      window.CSSStyleDeclaration.prototype.getPropertyValue = origGetCS;

      const pdf = new jsPDF('p', 'mm', 'letter');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const ratio = Math.min(pdfWidth / img.width, pdfHeight / img.height);
      const imgWidth = img.width * ratio;
      const imgHeight = img.height * ratio;
      pdf.addImage(dataUrl, 'PNG', (pdfWidth - imgWidth) / 2, 0, imgWidth, imgHeight);

      const fileName = `Recibo Tecnico ${filing.numeroRadicado || 'SIN_RADICADO'}.pdf`;
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
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || 'Error al subir el archivo');
      }
      const result = await resp.json();
      const conFechaCongelada = {
        ...result.data,
        metadata: {
          ...result.data.metadata,
          reciboTecnico: {
            ...(result.data.metadata?.reciboTecnico || {}),
            asunto,
            cuerpo,
            titulo: titulo || undefined,
            senor: senor || undefined,
            fechaCongelada: fechaAlSubir,
            fechaActualizacion: new Date().toISOString(),
            actualizadoPor: currentUser?.email || ''
          }
        }
      };
      if (onUpdateFiling) {
        await onUpdateFiling(conFechaCongelada);
      }
      alert(`Recibo Técnico subido a SharePoint como "${fileName}" (suelto en la carpeta del radicado)`);
    } catch (err) {
      console.error('Error al subir Recibo Técnico:', err);
      alert('Error al subir el Recibo Técnico: ' + err.message);
    } finally {
      window.CSSStyleDeclaration.prototype.getPropertyValue = origGetCS;
      setUploading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 print:p-0 print:m-0 print:max-w-none" style={{ fontFamily: "'Arial Narrow', Arial, sans-serif" }}>
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0; }
          header, aside, nav, .print\\:hidden { display: none !important; }
          html, body, #root, main, div, section, article {
            overflow: visible !important; height: auto !important;
            background-color: #ffffff !important; color: #000000 !important;
          }
          .print-canvas { margin: 0 !important; padding: 0 !important; width: 100% !important; border: none !important; box-shadow: none !important; }
          table.rt-repeat { border-collapse: collapse !important; width: 100% !important; height: auto !important; }
          thead.rt-head { display: table-header-group !important; }
          tfoot.rt-foot { display: table-footer-group !important; }
          thead.rt-head tr, tfoot.rt-foot tr { break-inside: avoid !important; page-break-inside: avoid !important; }
          .print-canvas, .print-canvas * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3 bg-white p-4 rounded-2xl shadow-lg border border-gray-200 print:hidden">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-gray-700 hover:text-black font-extrabold text-xs uppercase tracking-wider bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-gray-800" />
              <span>Volver</span>
            </button>
          )}
          <div className="relative">
            <select
              value={filing.id}
              onChange={(e) => {
                const f = filings.find(x => x.id === e.target.value);
                if (f && onSelectFiling) onSelectFiling(f);
              }}
              className="appearance-none bg-slate-900 text-[#D9CF43] font-black text-xs pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-700 focus:ring-2 focus:ring-[#D9CF43] cursor-pointer max-w-[260px] truncate"
              title="Seleccionar radicado"
            >
              {filings.map(f => (
                <option key={f.id} value={f.id}>
                  {f.numeroRadicado} — {(f.metadata?.nombreProyecto || '').slice(0, 40)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#D9CF43] absolute right-2.5 top-3 pointer-events-none" />
          </div>
          {yaSubido && !editing && (
            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-1 rounded">
              <CheckCircle2 className="w-3 h-3" />
              <span>SUBIDO</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={handleCancel}
                className="flex items-center space-x-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border border-gray-300 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Cancelar</span>
              </button>
              {!yaSubido && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-[#D9CF43] font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Guardando…' : 'Guardar'}</span>
                </button>
              )}
            </>
          ) : (
            <>
          {!yaSubido && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center space-x-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border border-amber-300 transition-all cursor-pointer"
            >
              <Pencil className="w-4 h-4 text-amber-800" />
              <span>Editar</span>
            </button>
          )}
          {yaSubido && (
            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-3 py-2 rounded-xl">
              Documento subido: bloqueado contra ediciones
            </span>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 bg-white hover:bg-gray-100 text-slate-900 font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border border-gray-300 transition-all cursor-pointer"
            title="Imprimir el Recibo Técnico"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center space-x-1.5 bg-[#D9CF43] hover:bg-[#c4ba3c] disabled:opacity-50 text-[#1E222A] font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            title="Generar PDF y subirlo a SharePoint (suelto en la carpeta del radicado)"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Subiendo…' : 'Subir'}</span>
          </button>
            </>
          )}
        </div>
      </div>

      
      <div
        ref={canvasRef}
        className="print-canvas bg-white shadow-2xl rounded-2xl border border-gray-200 text-black"
        style={{ fontFamily: "'Arial Narrow', Arial, sans-serif" }}
      >
      <table className="rt-repeat" style={{ width: '100%', borderCollapse: 'collapse', height: '1000px' }}>
        <thead className="rt-head">
          <tr><td style={{ padding: 0 }}>
            
            <MembreteRecibo municipio={municipio} />
          </td></tr>
        </thead>
        <tbody>
          <tr><td style={{ padding: 0, verticalAlign: 'top' }}>

        
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingLeft: '40px', paddingRight: '40px', boxSizing: 'border-box' }}>
        
        <div className="pt-4" style={{ fontSize: '16px', lineHeight: 1.35, color: '#000000' }}>
          <p>{fechaTexto}</p>
          <br />
          <br />
          {!editing ? (
            <p className="text-center font-bold">{tituloVer}</p>
          ) : (
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1">Título</label>
              <textarea
                value={tituloVer}
                onChange={(e) => setTitulo(e.target.value)}
                rows={2}
                className="w-full px-1 py-1 bg-transparent border-0 border-b border-slate-800 outline-none focus:border-[#4E3629] text-center font-bold"
                style={{ fontSize: '16px' }}
              />
            </div>
          )}
          <br />
          <br />
          <p>Señor:</p>
          {!editing ? (
            <p className="font-bold">{senorVer}</p>
          ) : (
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1">Señor (destinatario)</label>
              <input
                value={senorVer}
                onChange={(e) => setSenor(e.target.value)}
                className="w-full px-1 py-1 bg-transparent border-0 border-b border-slate-800 outline-none focus:border-[#4E3629] font-bold"
                style={{ fontSize: '16px' }}
              />
            </div>
          )}
          <p className="font-bold">Constructor</p>
          <br />
          <p className="text-justify">
            <span className="font-bold">Asunto: </span>
            {!editing ? (
              <span>{asunto}</span>
            ) : (
              <textarea
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                rows={2}
                className="w-full mt-1 px-1 py-1 bg-transparent border-0 border-b border-slate-800 outline-none focus:border-[#4E3629]"
                style={{ fontSize: '16px' }}
              />
            )}
          </p>
          <br />
          {!editing ? (
            cuerpoParrafos.map((p, i) => (
              <p key={i} className="text-justify" style={{ marginBottom: '1em' }}>{p}</p>
            ))
          ) : (
            <textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={14}
              placeholder="CUERPO...."
              className="w-full px-1 py-1 bg-transparent border-0 border-b border-slate-800 outline-none focus:border-[#4E3629]"
              style={{ fontSize: '16px', lineHeight: 1.4 }}
            />
          )}
          <br />
          <p style={{ fontSize: '19px' }}>Atentamente,</p>
          <br />
          
          <div style={{ minHeight: '70px' }} className="flex items-end">
            <img
              src={FIRMA_JEFE}
              alt="Firma Jefe"
              style={{ maxHeight: '70px', objectFit: 'contain' }}
            />
          </div>
          <p className="font-bold" style={{ fontSize: '19px' }}>{FIRMA_NOMBRE_JEFE}</p>
          <p style={{ fontSize: '19px' }}>{FIRMA_CARGO_JEFE}</p>
        </div>
        </div>
          </td></tr>
        </tbody>
        <tfoot className="rt-foot">
          <tr><td style={{ padding: 0 }}>
            
            <FranjaCorporativa />
          </td></tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
};
