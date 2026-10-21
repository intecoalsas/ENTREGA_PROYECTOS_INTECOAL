import React from 'react';
import {
  LogOut,
  BookOpenText
} from 'lucide-react';
import { IntecoalLogo } from './IntecoalLogo';

export const Header = ({
  user,
  m365Config,
  onOpenLogin,
  onOpenM365,
  onLogout,
  onOpenManual,
  filingCount
}) => {
  return (
    <>
      <header className="bg-[#1E222A] text-white border-b-4 border-[#D9CF43] shadow-lg sticky top-0 z-40 print:hidden">
        <div className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <IntecoalLogo size="46px" className="shrink-0" />

            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-xl tracking-tight text-white">INTECOAL SAS</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <div className="hidden md:flex items-center space-x-2 bg-slate-800/90 border border-slate-700/90 px-3 py-1.5 rounded-xl text-xs">
              <span className={`w-2 h-2 rounded-full ${user.role === 'interventor' ? 'bg-[#D9CF43]' : 'bg-amber-400'}`} />
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-300 font-bold leading-none">
                  {user.role === 'interventor' ? 'Responsable de Revisión' : 'Contratista'}
                </span>
                {user.role === 'interventor' && (
                  <span className="text-[#D9CF43] font-extrabold text-xs leading-none mt-0.5">
                    Interventoría
                  </span>
                )}
              </div>
            </div>

            {onOpenManual && (
              <button
                type="button"
                onClick={onOpenManual}
                className="flex items-center space-x-1.5 bg-slate-800/80 hover:bg-slate-700 text-[#D9CF43] border border-slate-700 hover:border-[#D9CF43]/60 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Abrir manual de usuario"
              >
                <BookOpenText className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Manual</span>
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center space-x-1.5 bg-slate-800/80 hover:bg-red-950/60 text-gray-300 hover:text-red-300 border border-slate-700 hover:border-red-800/80 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Cerrar Sesión"
              >
                <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
};
