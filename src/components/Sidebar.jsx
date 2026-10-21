import React from 'react';
import {
  PlusCircle,
  ListFilter,
  ShieldCheck,
  ChevronRight,
  FileText,
  ReceiptText,
  CalendarDays,
  BookOpenText
} from 'lucide-react';

export const Sidebar = ({
  activeTab,
  setActiveTab,
  filingCount,
  userRole = 'interventor'
}) => {
  const allNavItems = [
    {
      id: 'nueva',
      label: 'Nueva Radicación',
      subtitle: 'Formulario por Pasos',
      icon: PlusCircle,
      badge: null,
      roles: ['contratista']
    },
    {
      id: 'lista',
      label: userRole === 'interventor' ? 'Revisión Radicaciones' : 'Mis Radicaciones',
      subtitle: userRole === 'interventor' ? 'Aprobar o Subsanar Expedientes' : 'Historial de Expedientes',
      icon: ListFilter,
      badge: filingCount,
      roles: ['interventor', 'contratista']
    },
    {
      id: 'formato437c',
      label: 'Formato 4.3.7.C',
      subtitle: 'Decl. Operación y Mantenimiento',
      icon: FileText,
      badge: null,
      roles: ['interventor']
    },
    {
      id: 'recibo',
      label: 'Recibo Técnico',
      subtitle: 'Recibo Técnico de Obra',
      icon: ReceiptText,
      badge: null,
      roles: ['interventor']
    },
    {
      id: 'calendario',
      label: 'Calendario',
      subtitle: 'Plazos de Revisión',
      icon: CalendarDays,
      badge: null,
      roles: ['interventor']
    }
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(userRole));

  return (
    <aside className="w-full md:w-64 lg:w-72 bg-[#1E222A] text-white border-r border-slate-700/80 flex flex-col justify-between shrink-0 md:h-full md:overflow-y-auto print:hidden">
      <div className="p-4 sm:p-5 space-y-6">
        <div className="px-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 block">
            MENÚ DE NAVEGACIÓN
          </span>
          <span className="text-xs font-bold text-[#D9CF43] block mt-0.5">
            Módulos Principales
          </span>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (activeTab === 'informe' && item.id === 'lista');

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all duration-200 text-left group cursor-pointer ${
                  isActive
                    ? 'bg-[#D9CF43] text-[#1E222A] font-black shadow-lg scale-[1.01]'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-gray-200 hover:text-white border border-slate-700/80 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                    isActive 
                      ? 'bg-[#1E222A] text-[#D9CF43]' 
                      : 'bg-slate-700/80 text-[#D9CF43] group-hover:bg-[#1E222A]'
                  }`}>
                    <Icon className="w-5 h-5 stroke-[2.2]" />
                  </div>

                  <div className="truncate">
                    <span className="block text-sm leading-tight font-extrabold truncate">
                      {item.label}
                    </span>
                    <span className={`block text-[10px] truncate mt-0.5 ${
                      isActive ? 'text-[#1E222A]/80 font-bold' : 'text-gray-300'
                    }`}>
                      {item.subtitle}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0 ml-2">
                  {item.badge !== null && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
                      isActive 
                        ? 'bg-[#1E222A] text-[#D9CF43]' 
                        : 'bg-slate-700 text-gray-200 border border-slate-600'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className={`w-4 h-4 transition-transform ${
                    isActive ? 'text-[#1E222A] translate-x-0.5' : 'text-gray-300 group-hover:text-gray-200'
                  }`} />
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 sm:p-5 border-t border-slate-700/80 space-y-3">
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400 font-extrabold text-xs">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>RETILAP 40150/2024</span>
          </div>
          <p className="text-[11px] text-gray-300 leading-snug">
            Sistema verificado de radicación técnica para Proyectos de Alumbrado Público.
          </p>
        </div>

        <div className="text-[10px] text-gray-300 text-center font-semibold">
          INTECOAL SAS © 2026
        </div>
      </div>
    </aside>
  );
};
