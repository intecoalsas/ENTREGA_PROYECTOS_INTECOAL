import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Edit3,
  X
} from 'lucide-react';

const C = {
  azul: '#2563EB',
  amarillo: '#EAB308',
  rojo: '#DC2626',
  morado: '#7C3AED',
  verde: '#16A34A',
  oscuro: '#0F172A'
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const aMedianocheUTC = (d) => {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
};
const soloFecha = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
const esHabil = (d) => {
  const g = d.getUTCDay();
  return g !== 0 && g !== 6;
};
const sumarHabiles = (fecha, n) => {
  const d = aMedianocheUTC(fecha);
  let c = 0;
  while (c < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (esHabil(d)) c++;
  }
  return d;
};
const diasExactos = (desde, hasta) =>
  Math.round((aMedianocheUTC(hasta) - aMedianocheUTC(desde)) / 86400000);
const restarDias = (fecha, n) => {
  const d = aMedianocheUTC(fecha);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};
const clave = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

const fechaAprobacion = (filing) => {
  const hist = filing.historial || [];
  const ap = hist.find(h => h.estado === 'Aprobado' && h.fecha);
  if (ap) return soloFecha(ap.fecha);
  if (filing.estado === 'Aprobado') return soloFecha(filing.fechaActualizacion);
  return null;
};

export const CalendarioRevision = ({
  filings = [],
  onEvaluateFiling,
  onSelectFiling,
  userRole = 'interventor'
}) => {
  const hoy = useMemo(() => {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }, []);
  const [mesVisible, setMesVisible] = useState(() => {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() };
  });
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  const info = useMemo(() => filings.filter(Boolean).map(f => {
    const creacion = soloFecha(f.fechaRadicacion);
    if (!creacion) return null;
    const limite = sumarHabiles(creacion, 15);
    const aprob = fechaAprobacion(f);
    const restantes = diasExactos(hoy, limite);
    return {
      filing: f,
      creacion,
      limite,
      restantes,
      aprobacion: aprob,
      fecha8: restarDias(limite, 8),
      fecha4: restarDias(limite, 4)
    };
  }).filter(Boolean), [filings, hoy]);

  const eventosPorDia = useMemo(() => {
    const mapa = {};
    const push = (fecha, item) => {
      const k = clave(fecha);
      if (!mapa[k]) mapa[k] = [];
      if (!mapa[k].some(e => e.info.filing.id === item.info.filing.id && e.tipo === item.tipo)) {
        mapa[k].push(item);
      }
    };
    info.forEach(i => {
      push(i.creacion, { info: i, tipo: 'creacion' });
      if (i.aprobacion) {
        push(i.aprobacion, { info: i, tipo: 'aprobado' });
      } else {
        push(i.fecha8, { info: i, tipo: 'aviso8' });
        push(i.fecha4, { info: i, tipo: 'aviso4' });
        if (i.restantes < 0) {
          push(i.limite, { info: i, tipo: 'vencido' });
        }
      }
    });
    return mapa;
  }, [info]);

  const colorTipo = { creacion: C.azul, aviso8: C.amarillo, aviso4: C.rojo, vencido: C.morado, aprobado: C.verde };
  const etiquetaTipo = {
    creacion: 'Radicado creado',
    aviso8: 'Faltan 8 días',
    aviso4: 'Faltan 4 días o menos',
    vencido: 'Fecha límite vencida',
    aprobado: 'Aprobado'
  };

  const celdas = useMemo(() => {
    const primero = new Date(Date.UTC(mesVisible.anio, mesVisible.mes, 1));
    const desplazamiento = (primero.getUTCDay() + 6) % 7;
    const inicio = new Date(primero);
    inicio.setUTCDate(inicio.getUTCDate() - desplazamiento);
    return Array.from({ length: 42 }, (_, k) => {
      const d = new Date(inicio);
      d.setUTCDate(d.getUTCDate() + k);
      return d;
    });
  }, [mesVisible]);

  const eventosDia = diaSeleccionado ? (eventosPorDia[clave(diaSeleccionado)] || []) : [];
  const fmtCorta = (d) => d ? d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—';

  const insigniaEstado = (i) => {
    if (i.aprobacion) return { texto: `Aprobado el ${fmtCorta(i.aprobacion)}`, color: C.verde };
    if (i.restantes < 0) return { texto: `Vencido hace ${-i.restantes} días`, color: C.morado };
    if (i.restantes === 0) return { texto: 'Vence hoy', color: C.rojo };
    if (i.restantes <= 4) return { texto: `Faltan ${i.restantes} días`, color: C.rojo };
    if (i.restantes <= 8) return { texto: `Faltan ${i.restantes} días`, color: '#B45309' };
    return { texto: `Faltan ${i.restantes} días · en término`, color: C.azul };
  };

  const moverMes = (delta) => {
    setMesVisible(prev => {
      const d = new Date(prev.anio, prev.mes + delta, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() };
    });
    setDiaSeleccionado(null);
  };

  const pendientes = info.filter(i => !i.aprobacion).sort((a, b) => a.restantes - b.restantes);
  const proximos = pendientes.filter(i => i.restantes >= 0);
  const vencidos = pendientes.filter(i => i.restantes < 0);

  const fila = (i) => {
    const ins = insigniaEstado(i);
    return (
      <div key={i.filing.id} className="w-full text-left px-5 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono font-black text-xs text-gray-900">{i.filing.numeroRadicado}</span>
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-full border"
            style={{ color: '#fff', backgroundColor: ins.color, borderColor: 'transparent' }}
          >
            {ins.texto}
          </span>
        </div>
        <p className="text-[11px] text-gray-600 truncate mt-0.5">{i.filing.metadata?.nombreProyecto || ''}</p>
        <p className="text-[10px] text-gray-400">Límite: {fmtCorta(i.limite)}</p>
        <div className="flex items-center gap-2 pt-1.5">
          {userRole === 'interventor' && onEvaluateFiling && (
            <button
              type="button"
              onClick={() => onEvaluateFiling(i.filing)}
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 border border-amber-300 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" /> Evaluar
            </button>
          )}
          {onSelectFiling && (
            <button
              type="button"
              onClick={() => onSelectFiling(i.filing)}
              className="bg-[#0D0D0D] hover:bg-gray-800 text-[#D9CF43] font-bold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3 h-3" /> Informe
            </button>
          )}
        </div>
      </div>
    );
  };

  const encabezado = (titulo, color, cantidad, iconoColor) => (
    <div className="px-5 py-3.5 text-white flex items-center gap-2 shrink-0" style={{ backgroundColor: color }}>
      <AlertTriangle className="w-4 h-4" style={{ color: iconoColor }} />
      <h2 className="text-xs font-black uppercase tracking-wider">{titulo}</h2>
      <span className="ml-auto text-[10px] font-black bg-white/20 border border-white/40 rounded-full px-2 py-0.5">
        {cantidad}
      </span>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6 font-sans">
      
      <div className="bg-[#1E222A] text-white rounded-2xl p-6 shadow-xl border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
            <CalendarDays className="w-6 h-6 text-[#D9CF43]" />
          </div>
          <div>
            <span className="inline-block bg-[#D9CF43]/20 text-[#D9CF43] text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-[#D9CF43]/40">
              Plazos de revisión · 15 días hábiles
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              Calendario de Radicaciones
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button onClick={() => moverMes(-1)} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl p-2.5 transition-colors cursor-pointer" title="Mes anterior">
            <ChevronLeft className="w-4 h-4 text-[#D9CF43]" />
          </button>
          <button
            onClick={() => { const d = new Date(); setMesVisible({ anio: d.getUTCFullYear(), mes: d.getUTCMonth() }); }}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-black px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            {MESES[mesVisible.mes]} {mesVisible.anio}
          </button>
          <button onClick={() => moverMes(1)} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl p-2.5 transition-colors cursor-pointer" title="Mes siguiente">
            <ChevronRight className="w-4 h-4 text-[#D9CF43]" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 bg-[#0D0D0D] text-white text-[11px] font-black uppercase tracking-wider text-center">
            {DIAS.map(d => <div key={d} className="py-2.5">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {celdas.map((d, k) => {
              const esOtroMes = d.getUTCMonth() !== mesVisible.mes;
              const esHoy = clave(d) === clave(hoy);
              const evs = eventosPorDia[clave(d)] || [];
              const colores = [...new Set(evs.map(e => colorTipo[e.tipo]))];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDiaSeleccionado(evs.length ? d : null)}
                  className={`min-h-[64px] p-1.5 border-b border-r border-gray-100 flex flex-col items-center justify-start gap-1 transition-colors ${
                    esOtroMes ? 'bg-gray-50/60 text-gray-300' : 'bg-white text-gray-800'
                  } ${evs.length ? 'hover:bg-amber-50/60 cursor-pointer' : ''} ${esHoy ? 'ring-2 ring-inset ring-[#D9CF43]' : ''}`}
                  title={evs.length ? `${evs.length} evento(s) — clic para ver` : ''}
                >
                  <span className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-full ${esHoy ? 'bg-[#0D0D0D] text-[#D9CF43]' : ''}`}>
                    {d.getUTCDate()}
                  </span>
                  {colores.length > 0 && (
                    <span className="flex items-center justify-center gap-1 flex-wrap">
                      {colores.map(c => (
                        <span key={c} className="w-2.5 h-2.5 rounded-full border border-white shadow" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          
          <div className="flex flex-wrap items-center gap-4 px-5 py-3 bg-gray-50 border-t border-gray-200 text-[11px] font-bold text-gray-700">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C.azul }} /> Radicado</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C.amarillo }} /> Faltan ≤8 días</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C.rojo }} /> Faltan ≤4 días</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C.morado }} /> Vencido</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C.verde }} /> Aprobado</span>
          </div>
        </div>

        
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
          {encabezado('Próximos a vencer', C.oscuro, proximos.length, '#D9CF43')}
          <div className="h-[210px] overflow-y-auto overflow-x-hidden divide-y divide-gray-100">
            {proximos.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8 font-semibold">Sin radicados por vencer.</p>
            ) : proximos.map(fila)}
          </div>
          {encabezado('Vencidos', C.morado, vencidos.length, '#FFFFFF')}
          <div className="h-[210px] overflow-y-auto overflow-x-hidden divide-y divide-gray-100 border-t border-gray-200">
            {vencidos.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8 font-semibold">Sin radicados vencidos.</p>
            ) : vencidos.map(fila)}
          </div>
        </div>
      </div>

      
      {diaSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setDiaSeleccionado(null)}>
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#0D0D0D] px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="text-white font-black capitalize">
                {diaSeleccionado.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </h3>
              <button onClick={() => setDiaSeleccionado(null)} className="text-gray-300 hover:text-white transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              {eventosDia.map(({ info: i, tipo }, idx) => {
                const f = i.filing;
                const ins = insigniaEstado(i);
                const icono = i.aprobacion
                  ? <CheckCircle2 className="w-3.5 h-3.5" />
                  : i.restantes < 0
                    ? <AlertTriangle className="w-3.5 h-3.5" />
                    : <Clock className="w-3.5 h-3.5" />;
                return (
                  <div key={`${f.id}-${tipo}-${idx}`} className="border border-gray-200 rounded-xl p-4 space-y-2 bg-gray-50/50">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm text-gray-900">{f.numeroRadicado}</span>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-0.5 rounded-full text-white" style={{ backgroundColor: ins.color }}>
                        {icono}
                        {ins.texto}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-semibold">Punto del calendario: {etiquetaTipo[tipo]} · {fmtCorta(tipo === 'creacion' ? i.creacion : tipo === 'aprobado' ? i.aprobacion : tipo === 'aviso8' ? i.fecha8 : tipo === 'aviso4' ? i.fecha4 : i.limite)}</p>
                    <div className="text-xs text-gray-700 space-y-0.5">
                      <p><strong>Proyecto:</strong> {f.metadata?.nombreProyecto || '—'}</p>
                      <p><strong>Municipio:</strong> {f.metadata?.municipio || '—'} · <strong>Contratista:</strong> {f.metadata?.contratista || '—'}</p>
                      <p><strong>Estado:</strong> {f.estado} · <strong>Radicado:</strong> {fmtCorta(i.creacion)}</p>
                      <p>
                        <strong>Límite revisión:</strong> {fmtCorta(i.limite)} ·{' '}
                        <strong>{i.aprobacion ? `Aprobado el ${fmtCorta(i.aprobacion)}` : i.restantes < 0 ? `Vencido hace ${-i.restantes} día(s)` : `Faltan ${i.restantes} día(s)`}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {userRole === 'interventor' && onEvaluateFiling && f.estado !== 'Aprobado' && (
                        <button
                          onClick={() => { setDiaSeleccionado(null); onEvaluateFiling(f); }}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 border border-amber-300 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Evaluar
                        </button>
                      )}
                      {onSelectFiling && (
                        <button
                          onClick={() => { setDiaSeleccionado(null); onSelectFiling(f); }}
                          className="bg-[#0D0D0D] hover:bg-gray-800 text-[#D9CF43] font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Informe
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
