import React, { useState } from 'react';
import { IntecoalLogo } from './IntecoalLogo';
import { loginM365User } from '../lib/msalConfig';
import { 
  ShieldCheck, 
  PenTool, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  Cloud,
  ArrowRight
} from 'lucide-react';

export const LoginForm = ({ onLoginSuccess, externalError }) => {
  const [activeRole, setActiveRole] = useState('creador');
  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAyuda, setShowAyuda] = useState(false);

  const displayError = errorMsg || externalError;

  const handleM365Login = async () => {
    setErrorMsg(null);

    const roleToUse = activeRole === 'revisor' ? 'interventor' : 'contratista';

    setIsLoading(true);

    try {
      const userSession = await loginM365User(roleToUse, null, null, null, 'select_account');
      if (userSession?.isRedirecting) {
        return;
      }
      setIsLoading(false);
      onLoginSuccess(userSession, 'lista');
    } catch (err) {
      setIsLoading(false);
      setErrorMsg('Error de autenticación con Microsoft 365 MSAL: ' + (err.message || 'Verifique las políticas de su Tenant Azure AD o intente nuevamente.'));
    }
  };

  return (
    <div className="w-full flex items-center justify-center font-sans">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        
        
        <div className="bg-[#1E222A] text-white px-5 py-4 border-b-4 border-[#D9CF43] relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-[#D9CF43]/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <IntecoalLogo size="56px" showText={false} />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-[#D9CF43] text-[#1E222A] px-2 py-0.5 rounded">
                    INTECOAL SAS
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight mt-1">
                  Portal de Autenticación M365
                </h1>
                <p className="text-xs text-gray-300 mt-0.5">
                  Sistema de Radicación Técnica de Alumbrado Público (RETILAP)
                </p>
              </div>
            </div>

            <div className="hidden sm:block text-right">
              <span className="inline-flex items-center space-x-1.5 text-xs text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>RETILAP 2026</span>
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-gray-500 block">
              1. Seleccione su Perfil de Acceso:
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveRole('revisor');
                  setErrorMsg(null);
                }}
                className={`p-4 rounded-xl border-2 text-left transition-all flex items-start space-x-3 cursor-pointer ${
                  activeRole === 'revisor'
                    ? 'border-[#D9CF43] bg-[#D9CF43]/10 ring-2 ring-[#D9CF43]/30 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 bg-gray-50/50 hover:bg-gray-100/50 text-gray-600'
                }`}
              >
                <div className={`p-2.5 rounded-lg shrink-0 ${
                  activeRole === 'revisor' ? 'bg-[#1E222A] text-[#D9CF43]' : 'bg-gray-200 text-gray-700'
                }`}>
                  <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-extrabold text-sm text-gray-900">Responsable de Revisión</span>
                    <span className="text-[10px] font-black uppercase bg-[#1E222A] text-[#D9CF43] px-1.5 py-0.5 rounded">
                      INTECOAL
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">
                    Acceso para revisar expedientes, evaluar listas de chequeo y emitir actas técnicas.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveRole('creador');
                  setErrorMsg(null);
                }}
                className={`p-4 rounded-xl border-2 text-left transition-all flex items-start space-x-3 cursor-pointer ${
                  activeRole === 'creador'
                    ? 'border-[#D9CF43] bg-[#D9CF43]/10 ring-2 ring-[#D9CF43]/30 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 bg-gray-50/50 hover:bg-gray-100/50 text-gray-600'
                }`}
              >
                <div className={`p-2.5 rounded-lg shrink-0 ${
                  activeRole === 'creador' ? 'bg-[#1E222A] text-[#D9CF43]' : 'bg-gray-200 text-gray-700'
                }`}>
                  <PenTool className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-extrabold text-sm text-gray-900">Contratista</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">
                    Acceso para erradicar nuevos proyectos y cargar documentación técnica.
                  </p>
                </div>
              </button>
            </div>
          </div>

          
          <div className="bg-gradient-to-r from-blue-900/10 via-sky-800/10 to-indigo-900/10 border-2 border-blue-500/30 rounded-2xl p-4 space-y-3 relative overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-5">
                <div className="w-10 h-10 bg-white rounded-xl shadow-md border border-gray-200 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" viewBox="0 0 23 23" fill="none">
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H1z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H1z"/>
                  </svg>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-sm text-gray-900">
                      Iniciar Sesión con Microsoft 365
                    </span>
                    <span className="bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                      MSAL SSO
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Acceso corporativo seguro mediante Microsoft 365 / Azure AD.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleM365Login}
                disabled={isLoading}
                className="w-full sm:w-auto px-5 py-3 bg-[#0078D4] hover:bg-[#005A9E] active:bg-[#004578] text-white font-black text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer active:scale-[0.98]"
              >
                {isLoading ? (
                  <span>Procesando M365...</span>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>INICIAR SESIÓN M365</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </>
                )}
              </button>
            </div>
          </div>

          {displayError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl text-xs text-red-700 space-y-2 animate-fadeIn">
              <div className="flex items-start space-x-2.5">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Notificación de Autenticación:</span>
                  <span>{displayError}</span>
                </div>
              </div>
            </div>
          )}

          
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowAyuda(true)}
              className="flex items-center space-x-1.5 text-xs font-extrabold text-[#0D0D0D] bg-[#D9CF43]/20 hover:bg-[#D9CF43]/40 border border-[#D9CF43] px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              <span>¿Qué necesito para entrar?</span>
            </button>
          </div>

          {showAyuda && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowAyuda(false)}>
              <div
                className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-[#1E222A] px-5 py-4 flex items-center justify-between shrink-0">
                  <h3 className="text-white font-black text-sm">Para entrar necesita</h3>
                  <button
                    type="button"
                    onClick={() => setShowAyuda(false)}
                    className="text-gray-300 hover:text-white transition-colors cursor-pointer text-xl leading-none px-1"
                    title="Cerrar"
                  >
                    ×
                  </button>
                </div>
                <div className="p-5 space-y-4 overflow-y-auto text-xs text-gray-700 leading-relaxed">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-1.5">
                    <p className="font-black text-gray-900 text-sm">Si es Contratista</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Su correo personal o de empresa.</li>
                      <li>Si es Gmail, regístrelo gratis como cuenta Microsoft una sola vez.</li>
                      <li>Elija el perfil Contratista e ingrese con su clave de Microsoft.</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-1.5">
                    <p className="font-black text-gray-900 text-sm">Si es Responsable de Revisión</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Obligatorio: su correo de la empresa <strong>@intecoalsas.com</strong>.</li>
                      <li>Elija el perfil Responsable de Revisión e ingrese con su clave.</li>
                    </ul>
                  </div>
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-xl">
                    <strong>Ojo con el correo: </strong>
                    todo lo que usted suba se guarda con ese correo. Si otro día entra con un correo distinto, sus radicados no le van a aparecer. Entre siempre con el mismo.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-500 gap-2">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Conexión habilitada para Microsoft 365 (cuentas personales y profesionales)</span>
            </div>
            <div className="flex items-center space-x-1">
              <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
              <span>Soporte Técnico: interventoria@intecoal.com.co</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

