import React, { useState } from 'react';
import {
  BookOpenText, AlertTriangle, Info, HelpCircle,
  Wrench, ChevronRight, ChevronDown, LifeBuoy, X
} from 'lucide-react';
import {
  MANUAL_META, MANUAL_COMUN, MANUAL_CONTRATISTA, MANUAL_REVISOR, MANUAL_SOPORTE
} from '../data/manuales';

const Bloque = ({ tipo, children }) => {
  if (tipo === 'alerta') {
    return (
      <div className="flex items-start gap-2 bg-red-50 border-l-4 border-red-500 px-3.5 py-2.5 rounded-r-xl text-xs text-red-900 my-2">
        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
        <div><strong>Cuidado: </strong>{children}</div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 bg-sky-50 border-l-4 border-sky-500 px-3.5 py-2.5 rounded-r-xl text-xs text-sky-900 my-2">
      <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
      <div><strong>Ojo: </strong>{children}</div>
    </div>
  );
};

export const ManualUsuario = ({ userRole = 'contratista', onClose }) => {
  const esRevisor = userRole === 'interventor';
  const manual = esRevisor ? MANUAL_REVISOR : MANUAL_CONTRATISTA;
  const nombreRol = esRevisor ? 'Responsable de Revisión' : 'Contratista';
  const [seccion, setSeccion] = useState('portada');
  const [preguntaAbierta, setPreguntaAbierta] = useState(null);

  const ir = (id) => {
    setSeccion(id);
    setPreguntaAbierta(null);
    try {
      document.querySelector(`#man-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {  }
  };

  const indice = [
    ['portada', 'Portada'],
    ['objetivo', 'Para qué sirve'],
    ['requisitos', 'Qué necesita'],
    ['glosario', 'Palabras usadas aquí'],
    ['interfaz', 'Conozca la pantalla'],
    ...manual.procedimientos.map((p, i) => [`proc-${i}`, `${i + 1}. ${p.titulo}`]),
    ['faq', 'Preguntas y respuestas'],
    ['problemas', 'Si algo sale mal'],
    ['soporte', 'Ayuda y contacto'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60" onClick={onClose}>
      <div
        className="bg-[#F2F2F2] w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @media print {
            @page { size: letter portrait; margin: 2cm; }
            header, aside, nav, .print\\:hidden { display: none !important; }
          }
        `}</style>

        
        <div className="flex items-center justify-between gap-3 bg-white px-4 sm:px-5 py-3 border-b border-gray-200 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-[#1E222A] rounded-xl shrink-0">
              <BookOpenText className="w-5 h-5 text-[#D9CF43]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-gray-900 text-sm sm:text-base truncate">Manual — {nombreRol}</h2>
              <p className="text-[11px] text-gray-500 font-semibold truncate">{MANUAL_META.producto} · v{MANUAL_META.version}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onClose} className="p-2 rounded-xl text-gray-500 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer" title="Cerrar manual">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 sm:p-5 flex-1 min-h-0 overflow-hidden">
          
          <nav className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-3.5 h-fit shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Índice</p>
            <ul className="space-y-1 max-h-[40vh] lg:max-h-none overflow-y-auto">
              {indice.map(([id, label]) => (
                <li key={id}>
                  <button
                    onClick={() => ir(id)}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${seccion === id ? 'bg-[#1E222A] text-[#D9CF43] font-black' : 'text-gray-700 hover:bg-gray-100 font-semibold'}`}
                  >
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          
          <article className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-md p-5 sm:p-7 space-y-6 text-sm text-gray-800 leading-relaxed overflow-y-auto min-h-0">
            <section id="man-portada" className="text-center border-b-2 border-[#1E222A] pb-5">
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">INTECOAL S.A.S.</p>
              <h3 className="text-xl font-black text-gray-900 mt-1">{MANUAL_META.titulo}</h3>
              <p className="font-bold text-gray-700">{MANUAL_META.producto}</p>
              <div className="inline-block mt-3 text-xs bg-gray-100 border border-gray-200 rounded-xl px-4 py-2 space-y-0.5">
                <p><strong>Versión:</strong> {MANUAL_META.version}</p>
                <p><strong>Este manual es para:</strong> {nombreRol}</p>
              </div>
            </section>

            <section id="man-objetivo">
              <h4 className="font-black text-gray-900 mb-1.5">Para qué sirve</h4>
              {MANUAL_COMUN.objetivo.map((t, i) => <p key={i} className="mb-1">{t}</p>)}
            </section>

            <section id="man-requisitos">
              <h4 className="font-black text-gray-900 mb-1.5">Qué necesita</h4>
              <ul className="list-disc pl-5 space-y-1">{MANUAL_COMUN.requisitos.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </section>

            <section id="man-glosario">
              <h4 className="font-black text-gray-900 mb-1.5">Palabras usadas aquí</h4>
              <dl className="space-y-1.5">
                {MANUAL_COMUN.glosario.map(([t, d]) => (
                  <div key={t} className="text-xs"><dt className="inline font-black">{t}: </dt><dd className="inline">{d}</dd></div>
                ))}
              </dl>
            </section>

          <section id="man-interfaz">
              <h4 className="font-black text-gray-900 mb-1.5">Conozca la pantalla</h4>
              <ul className="space-y-1.5">
                {MANUAL_COMUN.interfaz.map(([t, d]) => (
                  <li key={t} className="text-xs"><strong>{t}: </strong>{d}</li>
                ))}
              </ul>
            </section>

            {manual.procedimientos.map((p, i) => (
              <section key={i} id={`man-proc-${i}`}>
                <h4 className="font-black text-gray-900 mb-1.5">{i + 1}. {p.titulo}</h4>
                <ol className="list-decimal pl-5 space-y-1">{p.pasos.map((t, j) => <li key={j}>{t}</li>)}</ol>
                {p.nota && <Bloque>{p.nota}</Bloque>}
                {p.alerta && <Bloque tipo="alerta">{p.alerta}</Bloque>}
              </section>
            ))}

            <section id="man-faq">
              <h4 className="font-black text-gray-900 mb-2 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#BFBA6B]" /> Preguntas y respuestas
              </h4>
              <p className="text-xs text-gray-500 mb-2">Pulse cada pregunta para ver su respuesta.</p>
              <div className="space-y-2">
                {manual.faq.map(([q, a], i) => {
                  const abierta = preguntaAbierta === i;
                  return (
                    <div key={q} className={`border rounded-xl overflow-hidden ${abierta ? 'border-[#1E222A]' : 'border-gray-200'}`}>
                      <button
                        onClick={() => setPreguntaAbierta(abierta ? null : i)}
                        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer text-left"
                      >
                        <span className="font-black text-xs text-gray-900">{q}</span>
                        {abierta
                          ? <ChevronDown className="w-4 h-4 text-gray-600 shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                      </button>
                      {abierta && (
                        <div className="px-3.5 py-2.5 bg-white border-t border-gray-200 text-xs text-gray-700">
                          <strong className="text-emerald-800">Solución: </strong>{a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section id="man-problemas">
              <h4 className="font-black text-gray-900 mb-2 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-[#BFBA6B]" /> Si algo sale mal
              </h4>
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#1E222A] text-white">
                      <th className="px-3 py-2">Lo que le sale</th>
                      <th className="px-3 py-2">Qué hacer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {manual.problemas.map(([s, sol]) => (
                      <tr key={s}>
                        <td className="px-3 py-2 font-mono font-bold">{s}</td>
                        <td className="px-3 py-2">{sol}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="man-soporte">
              <h4 className="font-black text-gray-900 mb-1.5 flex items-center gap-1.5">
                <LifeBuoy className="w-4 h-4 text-[#BFBA6B]" /> Ayuda y contacto
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                {MANUAL_SOPORTE.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
};
