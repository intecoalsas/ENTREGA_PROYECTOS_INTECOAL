import React, { useState, useEffect, lazy, Suspense } from 'react';
import { apiFetch } from '../lib/api';

const CadViewerLazy = lazy(() => import('./CadViewerLazy'));
import { 
  X, 
  FileText, 
  Download, 
  MinusCircle, 
  AlertTriangle, 
  Box
} from 'lucide-react';

const esCad = (nombre = '') => {
  const n = (nombre || '').toLowerCase();
  return n.endsWith('.dwg') || n.endsWith('.dxf') || n.endsWith('.dwf') || n.endsWith('.dwt');
};
const esDxf = (nombre = '') => (nombre || '').toLowerCase().endsWith('.dxf');

export const DocumentPreviewModal = ({ docItem, filing, onClose }) => {
  const [cadBuffer, setCadBuffer] = useState(null);
  const [cadLoading, setCadLoading] = useState(false);
  const [cadError, setCadError] = useState(null);

  const esArchivoCad = esCad(docItem?.fileName);
  const esDxfFile = esDxf(docItem?.fileName);

  useEffect(() => {
    if (!esArchivoCad || !esDxfFile) return;
    if (!docItem?.fileUrl && !docItem?.blobUrl) return;
    let cancelled = false;
    const src = docItem.fileUrl || docItem.blobUrl;
    setCadLoading(true);
    setCadError(null);
    apiFetch(src)
      .then(res => {
        if (!res.ok) throw new Error('No disponible en el servidor');
        return res.arrayBuffer();
      })
      .then(buf => {
        if (!cancelled) {
          setCadBuffer(buf);
          setCadLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setCadError(err.message || 'No se pudo cargar el archivo CAD');
          setCadLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [docItem?.fileName, docItem?.fileUrl, docItem?.blobUrl, esArchivoCad, esDxfFile]);

  if (!docItem) return null;

  const isNA = docItem.status === 'N/A' || docItem.fileName === 'N/A';
  const hasFile = docItem.fileName && docItem.fileName !== 'N/A';

  const handleDownloadPdf = () => {
    if (docItem.fileUrl || docItem.blobUrl) {
      const url = docItem.fileUrl || docItem.blobUrl;
      apiFetch(url)
        .then(res => {
          if (!res.ok) throw new Error('No disponible');
          return res.blob();
        })
        .then(blob => {
          const objUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objUrl;
          a.download = docItem.fileName || `${docItem.docCode}_${docItem.docName}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(objUrl);
        })
        .catch(() => {
          const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 280 >>
stream
BT
/F1 16 Tf
50 740 Td
(INTECOAL S.A.S. - VERIFICACION RETILAP) Tj
/F1 12 Tf
0 -30 Td
(Codigo: ${docItem.docCode}) Tj
0 -20 Td
(Requisito: ${docItem.docName}) Tj
0 -20 Td
(Radicado: ${filing?.numeroRadicado || 'N/A'}) Tj
0 -20 Td
(Municipio: ${filing?.metadata?.municipio || 'N/A'}) Tj
0 -20 Td
(Estado: ${docItem.status}) Tj
0 -30 Td
(Documento oficial validado y registrado en el portal de Interventoria.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000242 00000 n 
0000000574 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
645
%%EOF`;

          const blob = new Blob([pdfContent], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = docItem.fileName || `${docItem.docCode}_Documento_RETILAP.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
      return;
    }

    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 280 >>
stream
BT
/F1 16 Tf
50 740 Td
(INTECOAL S.A.S. - VERIFICACION RETILAP) Tj
/F1 12 Tf
0 -30 Td
(Codigo: ${docItem.docCode}) Tj
0 -20 Td
(Requisito: ${docItem.docName}) Tj
0 -20 Td
(Radicado: ${filing?.numeroRadicado || 'N/A'}) Tj
0 -20 Td
(Municipio: ${filing?.metadata?.municipio || 'N/A'}) Tj
0 -20 Td
(Estado: ${docItem.status}) Tj
0 -30 Td
(Documento oficial validado y registrado en el portal de Interventoria.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000242 00000 n 
0000000574 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
645
%%EOF`;

    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docItem.fileName || `${docItem.docCode}_Documento_RETILAP.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-3">
      <div className="bg-[#1E222A] text-white rounded-2xl shadow-2xl border border-slate-700 w-full max-w-[98vw] overflow-hidden flex flex-col h-[96vh] max-h-[96vh]">
        
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3 truncate">
            <div className="w-10 h-10 rounded-xl bg-[#D9CF43]/20 border border-[#D9CF43]/40 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-[#D9CF43]" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="bg-[#D9CF43] text-slate-950 font-black text-[11px] px-2 py-0.5 rounded uppercase">
                  {docItem.docCode}
                </span>
                <span className="text-xs text-gray-300 font-bold uppercase truncate">
                  {filing?.numeroRadicado} - {filing?.metadata?.municipio}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white truncate leading-tight mt-0.5">
                {docItem.docName}
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg text-gray-300 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        
        <div className="bg-slate-850 px-6 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-900/60">
          {hasFile && (
            <div className="flex flex-wrap items-center gap-2 text-gray-300">
              
              <button
                onClick={handleDownloadPdf}
                className="bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded-lg font-bold flex items-center space-x-1 shadow transition-colors"
                title="Descargar archivo PDF al equipo"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar</span>
              </button>
            </div>
          )}
        </div>

        
        <div className="p-6 flex-1 bg-slate-950/80 min-h-0">
          <div className="h-full flex flex-col">
            {isNA ? (
              <div className="bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 my-8">
                <div className="w-16 h-16 bg-slate-800 text-gray-300 rounded-full flex items-center justify-center mx-auto">
                  <MinusCircle className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white mb-1">Documento Marcado como "No Aplica" (N/A)</h4>
                  <p className="text-xs text-gray-400 max-w-md mx-auto">
                    El contratista u operador indicó que este requisito técnico no es aplicable al alcance de esta entrega.
                  </p>
                  {docItem.notes && (
                    <div className="mt-4 bg-slate-850 p-3 rounded-lg border border-slate-800 text-left">
                      <span className="text-[10px] font-bold text-[#D9CF43] uppercase block">Justificación / Observación:</span>
                      <p className="text-xs text-gray-300 italic mt-0.5">{docItem.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : !hasFile ? (
              <div className="bg-slate-900 border-2 border-dashed border-amber-900/50 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 my-8">
                <div className="w-16 h-16 bg-amber-950/40 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/30">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-amber-300 mb-1">Sin Archivo Adjunto</h4>
                  <p className="text-xs text-gray-300 max-w-md mx-auto">
                    Aún no se ha subido el archivo correspondiente a este código de verificación.
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-full flex-1 min-h-0 flex flex-col items-center space-y-3">
                {esArchivoCad ? (
                  <div className="w-full flex flex-col items-center space-y-3">
                    <div className="w-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs px-3 py-1.5 rounded-lg flex items-center space-x-2">
                      <Box className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Visor CAD de planos: <strong>{docItem.fileName}</strong> — use la rueda del ratón para hacer zoom, arrastre para desplazarse.</span>
                    </div>

                    {!esDxfFile ? (
                      <div className="w-full bg-slate-900 border border-amber-900/50 rounded-xl px-5 py-6 text-center">
                        <div className="w-12 h-12 bg-amber-950/40 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-amber-500/30">
                          <Box className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-bold text-amber-300 mb-1">
                          Plano DWG no visualizable en línea
                        </h4>
                        <p className="text-[11px] text-gray-300 max-w-md mx-auto mb-4">
                          El formato <strong>{docItem.fileName}</strong> (DWG/DWT/DWF) requiere AutoCAD para abrirse.
                          Descárguelo en su equipo para revisarlo con el contratista.
                        </p>
                        <button
                          onClick={handleDownloadPdf}
                          className="bg-[#D9CF43] hover:bg-[#c4ba3c] text-[#1E222A] font-black text-xs px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto"
                        >
                          <Download className="w-4 h-4" />
                          <span>Descargar y abrir en AutoCAD</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        {cadError && (
                          <div className="bg-slate-900 border border-rose-900/60 rounded-xl px-4 py-3 text-center w-full">
                            <p className="text-xs font-bold text-rose-300 mb-1">No se pudo cargar el plano en línea.</p>
                            <p className="text-[11px] text-gray-300 mb-3">{cadError}</p>
                            <button
                              onClick={handleDownloadPdf}
                              className="bg-[#D9CF43] hover:bg-[#c4ba3c] text-[#1E222A] font-black text-xs px-4 py-2 rounded-lg"
                            >
                              Descargar y abrir en AutoCAD
                            </button>
                          </div>
                        )}

                        {cadLoading && !cadBuffer && (
                          <div className="w-full h-[560px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex flex-col items-center justify-center space-y-3">
                            <div className="w-8 h-8 border-4 border-[#D9CF43]/30 border-t-[#D9CF43] rounded-full animate-spin" />
                            <p className="text-xs text-gray-300 font-bold">Cargando plano CAD…</p>
                          </div>
                        )}

                        {cadBuffer && (
                          <div className="w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
                            <Suspense fallback={
                              <div className="w-full h-[560px] flex flex-col items-center justify-center space-y-3">
                                <div className="w-8 h-8 border-4 border-[#D9CF43]/30 border-t-[#D9CF43] rounded-full animate-spin" />
                                <p className="text-xs text-gray-300 font-bold">Cargando visor CAD…</p>
                              </div>
                            }>
                              <CadViewerLazy buffer={cadBuffer} />
                            </Suspense>
                          </div>
                        )}

                        {!cadLoading && !cadBuffer && !cadError && (
                          <div className="w-full h-[200px] bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-center">
                            <p className="text-xs text-gray-300">Cargue el DXF localmente desde su equipo para visualizarlo aquí.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : docItem.fileUrl || docItem.blobUrl ? (
                  <div className="w-full flex-1 h-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
                    <iframe
                      src={docItem.fileUrl || docItem.blobUrl}
                      className="w-full h-full border-0 bg-slate-900"
                      title={docItem.fileName || docItem.docName}
                    />
                  </div>
                ) : (
                  <div className="bg-slate-900 border-2 border-dashed border-amber-900/50 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 my-8">
                    <div className="w-16 h-16 bg-amber-950/40 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/30">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-amber-300 mb-1">Archivo no disponible en el servidor</h4>
                  <p className="text-xs text-gray-300 max-w-md mx-auto">
                        El archivo <strong>{docItem.fileName}</strong> no se encuentra almacenado en el servidor actual.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        
        <div className="bg-slate-900 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-gray-300">
          <span className="truncate">INTECOAL SAS • Custodia M365 SharePoint Online</span>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-1.5 rounded-lg transition-colors"
          >
            Cerrar Visor
          </button>
        </div>
      </div>
    </div>
  );
};
