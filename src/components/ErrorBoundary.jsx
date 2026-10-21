import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-slate-900 border-2 border-rose-500 rounded-xl max-w-xl mx-auto my-8 text-white text-center font-sans space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold">Ocurrió un inconveniente visual al cargar el módulo</h2>
          <p className="text-xs text-gray-300">
            {this.state.error?.message || 'Error inesperado de renderizado'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
              className="bg-[#D9CF43] hover:bg-[#c2b938] text-slate-950 font-black text-xs px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recargar Vista</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
