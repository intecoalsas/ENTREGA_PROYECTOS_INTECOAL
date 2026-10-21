import React, { useRef, useState } from 'react';
import { DOCUMENT_CATALOG } from '../data/documentsCatalog';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileCheck2,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  Check,
  Edit3,
  PenTool,
  Printer,
  Zap,
  Cpu,
  FileText,
  Award,
  CheckCheck,
  Hash
} from 'lucide-react';
import { MembreteRecibo, FranjaCorporativa, FIRMA_NOMBRE_JEFE, FIRMA_CARGO_JEFE } from './MembreteCorporativo';
import { FIRMA_JEFE } from '../lib/imagenesMembrete';
import { FirmaDigitalModal } from './FirmaDigitalModal';

export const InformeRecibidoConformidad = ({ 
  filing, 
  onBack, 
  onEditEvaluation,
  onFormatoC,
  onUpdateFiling,
  currentUser,
  userRole
}) => {
  const printRef = useRef(null);
  const [signingRole, setSigningRole] = useState(null);

  const effectiveRole = userRole || currentUser?.role || 'interventor';
  const isRol1Revisor = effectiveRole === 'interventor'; 
  const isRol2Contratista = effectiveRole === 'contratista'; 

  const [techParams, setTechParams] = useState(() => ({
    dpcp: filing.metadata.dpcp || '1.85 W/m²',
    eficiencia: filing.metadata.eficiencia || '142 lm/W',
    factorPotencia: filing.metadata.factorPotencia || '0.97',
    thd: filing.metadata.thd || '6.2%',
    gradoProteccion: filing.metadata.gradoProteccion || 'IP66 / IK09',
    dps: filing.metadata.dps || '10 kV / 10 kA (IEC 61643-11)',
    vidaUtil: filing.metadata.vidaUtil || '100,000 h (L90/B10)',
    normaAplicable: 'Resolución 40150 de 2024 (RETILAP) & Res. 90708 (RETIE)'
  }));

  const [isEditingTech, setIsEditingTech] = useState(false);

  const handleSaveSignature = (role, signature) => {
    const updatedMetadata = { ...filing.metadata };
    if (role === 'interventoria') {
      updatedMetadata.firmaInterventoria = signature;
      updatedMetadata.responsableRevision = signature.nombreSignatario;
    } else {
      updatedMetadata.firmaContratista = signature;
      updatedMetadata.responsable = signature.nombreSignatario;
    }

    const updatedFiling = {
      ...filing,
      metadata: updatedMetadata,
      fechaActualizacion: new Date().toISOString()
    };

    if (onUpdateFiling) {
      onUpdateFiling(updatedFiling);
    }
  };

  const handleRemoveSignature = (role) => {
    const updatedMetadata = { ...filing.metadata };
    if (role === 'interventoria') {
      delete updatedMetadata.firmaInterventoria;
    } else {
      delete updatedMetadata.firmaContratista;
    }

    const updatedFiling = {
      ...filing,
      metadata: updatedMetadata,
      fechaActualizacion: new Date().toISOString()
    };

    if (onUpdateFiling) {
      onUpdateFiling(updatedFiling);
    }
  };

  const handleSaveTechParams = () => {
    setIsEditingTech(false);
    const updatedFiling = {
      ...filing,
      metadata: {
        ...filing.metadata,
        ...techParams
      }
    };
    if (onUpdateFiling) {
      onUpdateFiling(updatedFiling);
    }
  };

  const archivos = filing.archivos || [];
  const cumpleCount = archivos.filter(a => a.status === 'CUMPLE').length;
  const pendienteCount = archivos.filter(a => a.status === 'PENDIENTE').length;
  const noCumpleCount = archivos.filter(a => a.status === 'NO CUMPLE').length;
  const naCount = archivos.filter(a => a.status === 'N/A').length;
  const aplicablesCount = DOCUMENT_CATALOG.length - naCount;

  const isApproved = (cumpleCount + naCount) === DOCUMENT_CATALOG.length && noCumpleCount === 0;

  const categories = [
    {
      id: 'diseno',
      code: 'A',
      title: 'A. DOCUMENTOS TÉCNICOS DE DISEÑO Y CÁLCULOS FOTOMÉTRICOS/ELÉCTRICOS',
      subtitle: 'Diseños fotométricos IES, memorias de cálculo, planos as-built y licencias',
      retilapRef: 'Capítulo 4 - Sección 400 a 415 (Diseño de Alumbrado Público)',
      docs: DOCUMENT_CATALOG.filter(d => d.category === 'diseno')
    },
    {
      id: 'luminarias',
      code: 'B',
      title: 'B. LUMINARIAS, MATERIALES Y ENSAYOS DE LABORATORIO CERTIFICADOS',
      subtitle: 'Certificados de conformidad RETILAP, fotometrías IES, IP66, IK08 y ensayos',
      retilapRef: 'Capítulo 3 - Sección 300 (Requisitos de Productos y Componentes)',
      docs: DOCUMENT_CATALOG.filter(d => d.category === 'luminarias')
    },
    {
      id: 'constructor',
      code: 'C',
      title: 'C. DOCUMENTACIÓN DEL CONSTRUCTOR, MATRÍCULAS Y SEGUROS',
      subtitle: 'Matrículas CONALTEL/COPNIA, RETIE, memorias de montaje y plan de calidad',
      retilapRef: 'Capítulo 5 - Sección 500 (Demostración de la Conformidad)',
      docs: DOCUMENT_CATALOG.filter(d => d.category === 'constructor')
    },
    {
      id: 'dictamenes',
      code: 'D',
      title: 'D. DICTÁMENES DE INSPECCIÓN, PRUEBAS EN CAMPO Y PERMISOS AMBIENTALES',
      subtitle: 'Dictamen de inspección de tercera parte, mediciones luxométricas y permisos',
      retilapRef: 'Capítulo 6 - Sección 600 (Inspección, Pruebas y Certificación Final)',
      docs: DOCUMENT_CATALOG.filter(d => d.category === 'dictamenes')
    },
    {
      id: 'otros',
      code: 'E',
      title: 'E. OTROS DOCUMENTOS',
      subtitle: 'CAUE, cantidades, certificado de vía pública y circuitos exclusivos de AP',
      retilapRef: 'Documentos complementarios del proyecto',
      docs: DOCUMENT_CATALOG.filter(d => d.category === 'otros')
    }
  ];

  const getDocStatus = (docId) => {
    const item = archivos.find(a => a.docId === docId);
    return item ? item.status : 'PENDIENTE';
  };

  const getDocNotes = (docId) => {
    const item = archivos.find(a => a.docId === docId);
    return item && item.notes ? item.notes : null;
  };

  const getDocFileName = (docId) => {
    const item = archivos.find(a => a.docId === docId);
    return item && item.fileName ? item.fileName : null;
  };

  const formattedDate = new Date(filing.fechaRadicacion || Date.now()).toLocaleDateString('es-CO', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const handlePrint = () => {
    window.print();
  };

  const verificationUrl = `${window.location.origin}/verificar?radicado=${encodeURIComponent(filing.numeroRadicado)}`;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6" style={{ fontFamily: "'Arial Narrow', Arial, sans-serif" }}>
      
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 2.54cm;
          }
          header, aside, nav, .print\\:hidden {
            display: none !important;
          }
          html, body, #root, main, div, section, article {
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 12px !important;
          }
          .print-canvas {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            font-family: 'Arial Narrow', Arial, sans-serif !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
          }
          .print-canvas > * + * {
            margin-top: 0.8rem !important;
          }
          .page-break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          h1, h2, h3, h4 {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }
          .print-border-clean {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            border-radius: 4px !important;
          }
          .print-bg-slate {
            background-color: #f8fafc !important;
          }
          table {
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }
          .print-justify {
            text-align: justify !important;
          }
        }
      `}</style>

      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3 bg-white p-4 rounded-2xl shadow-lg border border-gray-200 print:hidden">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-700 hover:text-black font-extrabold text-xs uppercase tracking-wider bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-xl transition-all cursor-pointer self-start sm:self-auto"
        >
          <ArrowLeft className="w-4 h-4 text-gray-800" />
          <span>Volver al Listado</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-mono bg-slate-900 text-[#D9CF43] px-3.5 py-2 rounded-xl font-black border border-slate-700 shadow-inner">
            {filing.numeroRadicado}
          </span>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 bg-white hover:bg-gray-100 text-slate-900 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border border-gray-300 transition-all cursor-pointer shadow-sm"
            title="Imprimir el Informe de Recibido a Conformidad"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>

          <button
            onClick={() => setSigningRole(isRol2Contratista ? 'contratista' : 'interventoria')}
            className="flex items-center space-x-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border border-emerald-300 transition-all cursor-pointer shadow-sm"
            title={isRol2Contratista ? "Gestionar Firma Digital del Contratista" : "Gestionar Firma Digital de Interventoría"}
          >
            <PenTool className="w-4 h-4 text-emerald-800" />
            <span>
              {isRol2Contratista
                ? (filing.metadata.firmaContratista ? 'Firma Contratista' : 'Firmar Digitalmente')
                : (filing.metadata.firmaInterventoria ? 'Firma Revisor' : 'Firmar Digitalmente')
              }
            </span>
          </button>

          {isRol1Revisor && onEditEvaluation && filing.estado !== 'Aprobado' && (
            <button
              onClick={() => onEditEvaluation(filing)}
              className="flex items-center space-x-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border border-amber-300 transition-all cursor-pointer"
              title="Realizar o Modificar la Evaluación del Expediente"
            >
              <Edit3 className="w-4 h-4 text-amber-800" />
              <span>Modificar Evaluación</span>
            </button>
          )}

          {isRol1Revisor && onFormatoC && filing.estado === 'Aprobado' && (
            <button
              onClick={() => onFormatoC(filing)}
              className="flex items-center space-x-1.5 bg-purple-100 hover:bg-purple-200 text-purple-950 font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl border border-purple-300 transition-all cursor-pointer"
              title="Ver Formato 4.3.7.C del Radicado"
            >
              <FileText className="w-4 h-4 text-purple-800" />
              <span>Formato C</span>
            </button>
          )}
        </div>
      </div>

      
      <div 
        ref={printRef}
        className="print-canvas bg-white p-6 sm:p-10 shadow-2xl rounded-2xl border border-gray-200 text-slate-900 font-sans space-y-7 print:shadow-none print:border-none print:rounded-none"
      >
        
        <MembreteRecibo municipio={filing.metadata?.municipio} />

        
        <div className="space-y-4 page-break-avoid">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 font-medium bg-slate-50 p-3.5 rounded-xl border border-slate-200 print-border-clean">
            <div className="space-y-1">
              <div><strong className="text-slate-900">CIUDAD Y FECHA:</strong> Villavicencio (Meta), {formattedDate}</div>
              <div><strong className="text-slate-900">OFICIO N°:</strong> INT-AP-2026-{filing.numeroRadicado}</div>
              <div><strong className="text-slate-900">DESTINATARIO:</strong> Empresa de Tecnología y Servicios ALBORADA E.I.C.E.</div>
              <div><strong className="text-slate-900">ATENCIÓN:</strong> Dirección Técnica / Supervisión de Alumbrado Público</div>
            </div>

            <div className="space-y-1">
              <div><strong className="text-slate-900">CONTRATISTA DE OBRA:</strong> {filing.metadata.contratista} {filing.metadata.nitContratista ? `(NIT: ${filing.metadata.nitContratista})` : ''}</div>
              <div><strong className="text-slate-900">PROYECTO:</strong> {filing.metadata.nombreProyecto}</div>
              <div><strong className="text-slate-900">N° RADICADO:</strong> {filing.numeroRadicado}</div>
              <div><strong className="text-slate-900">TIPO DE RADICACIÓN:</strong> {filing.metadata.tipoEntrega || 'Entrega Inicial de Proyecto'}</div>
            </div>
          </div>

          <div className="pt-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
              SISTEMA INTEGRAL DE INTERVENTORÍA Y AUDITORÍA RETILAP / RETIE
            </span>
            <h1 className="text-lg sm:text-xl font-black uppercase text-slate-900 tracking-tight mt-1 leading-snug">
              INFORME DE RECIBIDO A CONFORMIDAD Y DICTAMEN TÉCNICO DE INTERVENTORÍA
            </h1>
            <p className="text-xs text-slate-800 mt-1 font-medium leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200 print-border-clean">
              <strong className="text-slate-900 uppercase font-black">ASUNTO:</strong> Evaluación técnica, fotométrica, eléctrica y documental para la certificación de recibido a conformidad del expediente de Alumbrado Público conforme a la Resolución 40150 de 2024 del Ministerio de Minas y Energía (RETILAP) y RETIE (Res. 90708).
            </p>
          </div>
        </div>

        
        <div className="space-y-3 page-break-avoid">
          <div className="flex items-center space-x-2 border-b-2 border-slate-900 pb-1.5">
            <ShieldCheck className="w-4 h-4 text-slate-900" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              MATRIZ RESUMEN DE EVALUACIÓN Y CONFORMIDAD RETILAP
            </h2>
          </div>

          <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 space-y-3 print-border-clean">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  PORCENTAJE GENERAL DE CONFORMIDAD REGULATORIA
                </span>
                <div className="text-2xl font-black text-slate-900 flex items-baseline space-x-2 mt-0.5">
                  <span>{filing.porcentajeCumplimiento}%</span>
                  <span className="text-xs font-bold text-slate-600">DOCUMENTACIÓN VÁLIDA</span>
                </div>
              </div>

              <div className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-center border ${
                isApproved 
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-950' 
                  : 'bg-amber-100 border-amber-400 text-amber-950'
              }`}>
                {isApproved ? (
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>DICTAMEN: APROBADO A CONFORMIDAD</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0" />
                    <span>DICTAMEN: CON OBSERVACIONES PENDIENTES</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-center">
              <div className="bg-white border border-slate-200 rounded-lg p-2">
                <span className="text-lg font-black block text-slate-900">{DOCUMENT_CATALOG.length}</span>
                <span className="text-[9px] font-bold text-slate-500 uppercase">REQUISITOS TOTALES</span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                <span className="text-lg font-black block text-emerald-800">{cumpleCount}</span>
                <span className="text-[9px] font-bold text-emerald-800 uppercase flex items-center justify-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>CUMPLE</span>
                </span>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                <span className="text-lg font-black block text-amber-800">{pendienteCount}</span>
                <span className="text-[9px] font-bold text-amber-800 uppercase flex items-center justify-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>PENDIENTES</span>
                </span>
              </div>

              <div className="bg-slate-100 border border-slate-200 rounded-lg p-2">
                <span className="text-lg font-black block text-slate-700">{naCount}</span>
                <span className="text-[9px] font-bold text-slate-600 uppercase">NO APLICA</span>
              </div>
            </div>
          </div>
        </div>

        
        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b-2 border-slate-900 pb-1.5">
            <FileCheck2 className="w-4 h-4 text-slate-900" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              AUDITORÍA DOCUMENTAL Y CHECKLIST EXHAUSTIVO ({DOCUMENT_CATALOG.length} REQUISITOS NORMATIVOS)
            </h2>
          </div>

          <div className="space-y-4">
            {categories.map((cat) => {
              const catCumple = cat.docs.filter(d => getDocStatus(d.id) === 'CUMPLE').length;
              const catTotal = cat.docs.length;

              return (
                <div key={cat.id} className="border border-slate-300 rounded-xl overflow-hidden page-break-avoid print-border-clean">
                  <div className="bg-slate-900 text-white px-3.5 py-2 flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <h3 className="text-xs font-black uppercase tracking-wider text-white">
                        {cat.title}
                      </h3>
                      <p className="text-[10px] text-slate-300">{cat.retilapRef}</p>
                    </div>

                    <div className="text-[10px] font-mono font-bold bg-[#D9CF43] text-slate-900 px-2.5 py-0.5 rounded shrink-0">
                      Válidos: {catCumple} / {catTotal}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200 bg-white">
                    {cat.docs.map(doc => {
                      const st = getDocStatus(doc.id);
                      const notes = getDocNotes(doc.id);
                      const fileName = getDocFileName(doc.id);

                      return (
                        <div key={doc.id} className="p-3 text-xs space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-start space-x-2">
                                <span className="text-[10px] font-bold font-mono text-slate-900 bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded shrink-0">
                                  {doc.code}
                                </span>
                                <div>
                                  <h4 className="font-bold text-slate-900 leading-snug">
                                    {doc.name}
                                  </h4>
                                  <p className="text-[11px] text-slate-500">{doc.description}</p>
                                </div>
                              </div>

                              {fileName && (
                                <div className="pl-8 text-[10px] font-mono text-slate-600 flex items-center space-x-1">
                                  <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span>Archivo Aportado: <strong>{fileName}</strong></span>
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 self-start">
                              {st === 'CUMPLE' && (
                                <span className="inline-flex items-center space-x-1 bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-0.5 rounded">
                                  <Check className="w-3 h-3" />
                                  <span>CUMPLE</span>
                                </span>
                              )}
                              {st === 'PENDIENTE' && (
                                <span className="inline-flex items-center space-x-1 bg-amber-600 text-white font-bold text-[10px] px-2.5 py-0.5 rounded">
                                  <Clock className="w-3 h-3" />
                                  <span>PENDIENTE</span>
                                </span>
                              )}
                              {st === 'NO CUMPLE' && (
                                <span className="inline-flex items-center space-x-1 bg-red-700 text-white font-bold text-[10px] px-2.5 py-0.5 rounded">
                                  <XCircle className="w-3 h-3" />
                                  <span>NO CUMPLE</span>
                                </span>
                              )}
                              {st === 'N/A' && (
                                <span className="inline-flex items-center space-x-1 bg-slate-400 text-white font-bold text-[10px] px-2 py-0.5 rounded">
                                  <span>N/A</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {notes && notes !== '—' && (
                            <div className="ml-8 bg-slate-50 p-2 rounded border border-slate-200 text-[11px] text-slate-700 mt-1">
                              <strong className="text-slate-900">Anotación de Interventoría:</strong> {notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        
        {filing.elementosEntregados && filing.elementosEntregados.length > 0 && (
          <div className="space-y-3 page-break-avoid">
            <div className="flex items-center space-x-2 border-b-2 border-slate-900 pb-1.5">
              <Layers className="w-4 h-4 text-slate-900" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                INVENTARIO FÍSICO DE MATERIALES Y EQUIPOS ENTREGADOS EN CAMPO
              </h2>
            </div>

            <div className="border border-slate-300 rounded-xl overflow-hidden print-border-clean">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-900 font-black uppercase text-[10px] border-b border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3">Ítem</th>
                    <th className="py-2.5 px-3">Elemento / Equipo de Alumbrado</th>
                    <th className="py-2.5 px-3">Especificación Técnica Certificada</th>
                    <th className="py-2.5 px-3 text-right">Cantidad</th>
                    <th className="py-2.5 px-3 text-center">Estado RETILAP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filing.elementosEntregados.map((elem, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold text-slate-500">#{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{elem.elemento}</td>
                      <td className="py-2 px-3 text-slate-600">{elem.especificacion || 'Según ficha técnica aprobada'}</td>
                      <td className="py-2 px-3 font-mono font-black text-right text-slate-900">{elem.cantidad}</td>
                      <td className="py-2 px-3 text-center"><span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">VERIFICADO</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        
        <div className="space-y-2 page-break-avoid">
          <div className="flex items-center space-x-2 border-b-2 border-slate-900 pb-1.5">
            <Award className="w-4 h-4 text-slate-900" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              CONCEPTO TÉCNICO DE INTERVENTORÍA Y DICTAMEN DE CONFORMIDAD
            </h2>
          </div>

          <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 text-xs text-slate-800 font-medium leading-relaxed space-y-2 print-border-clean print-justify">
            <p className="font-semibold text-slate-900">
              {filing.observacionesGenerales || 'En calidad de Interventoría Técnica Especializada INTECOAL S.A.S., previa revisión minuciosa del expediente digital radicado, se emite el presente dictamen técnico de conformidad.'}
            </p>
            <p className="text-[11px] text-slate-600">
              El contratista emisor declara bajo la gravedad del juramento que la información técnica y los planos as-built aportados corresponden a la obra físicamente instalada. Toda modificación futura o ampliación deberá contar con la previa autorización de la Interventoría.
            </p>
          </div>
        </div>

        
        <div className="pt-6 space-y-6 page-break-avoid">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            <FirmaLimpia
              firma={filing.metadata.firmaInterventoria}
              nombre={filing.metadata.firmaInterventoria?.nombreSignatario || filing.metadata.responsableRevision || 'Responsable de Revisión'}
              cargo={filing.metadata.firmaInterventoria?.cargo || 'Responsable de Revisión'}
            />
            <FirmaLimpia
              firma={filing.metadata.firmaContratista}
              nombre={filing.metadata.firmaContratista?.nombreSignatario || filing.metadata.responsable}
              cargo={filing.metadata.firmaContratista?.cargo || 'Representante Técnico Contratista'}
            />
            <FirmaLimpia
              firma={{ dataUrl: FIRMA_JEFE }}
              nombre={FIRMA_NOMBRE_JEFE}
              cargo={FIRMA_CARGO_JEFE}
            />
          </div>
        </div>

        
        <FranjaCorporativa />
      </div>

      {signingRole && (
        <FirmaDigitalModal
          role={signingRole}
          defaultName={
            signingRole === 'interventoria'
              ? (currentUser?.role === 'interventor' ? currentUser?.name : filing.metadata.responsableRevision) || filing.metadata.responsableRevision || 'Responsable de Revisión'
              : (currentUser?.role === 'contratista' ? currentUser?.name : filing.metadata.responsable) || filing.metadata.responsable || 'Director de Obra'
          }
          defaultRole={
            signingRole === 'interventoria'
              ? 'Responsable de Revisión (INTECOAL S.A.S.)'
              : 'Representante Técnico Contratista'
          }
          initialSignature={
            signingRole === 'interventoria'
              ? filing.metadata.firmaInterventoria
              : filing.metadata.firmaContratista
          }
          onSaveSignature={(sig) => handleSaveSignature(signingRole, sig)}
          onRemoveSignature={() => handleRemoveSignature(signingRole)}
          onClose={() => setSigningRole(null)}
        />
      )}
    </div>
  );
};

const FirmaLimpia = ({ firma, nombre, cargo }) => (
  <div className="text-center space-y-1">
    <div className="min-h-[85px] flex items-center justify-center">
      {firma?.dataUrl ? (
        <img src={firma.dataUrl} alt="Firma" className="max-h-20 object-contain" />
      ) : (
        <span>&nbsp;</span>
      )}
    </div>
    <p className="font-extrabold text-slate-900 text-xs">{nombre}</p>
    <p className="text-[10px] font-bold text-slate-500 uppercase">{cargo}</p>
    {firma?.tarjetaProfesional && (
      <p className="text-[10px] font-bold text-slate-800">T.P.: {firma.tarjetaProfesional}</p>
    )}
  </div>
);
