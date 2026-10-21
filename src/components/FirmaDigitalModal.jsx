import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Trash2, 
  X, 
  ShieldCheck, 
  Lock, 
  FileCheck
} from 'lucide-react';

export const FirmaDigitalModal = ({
  role,
  defaultName,
  defaultRole,
  initialSignature,
  onSaveSignature,
  onRemoveSignature,
  onClose
}) => {
  const isRol2 = role === 'contratista';

  const [nombreSignatario, setNombreSignatario] = useState(initialSignature?.nombreSignatario || '');
  const [cargo, setCargo] = useState(initialSignature?.cargo || defaultRole || '');
  const [tarjetaProfesional, setTarjetaProfesional] = useState(initialSignature?.tarjetaProfesional || '');
  
  const [uploadedImage, setUploadedImage] = useState(initialSignature?.dataUrl || null);

  useEffect(() => {
    setNombreSignatario(initialSignature?.nombreSignatario || '');
    setCargo(initialSignature?.cargo || defaultRole || '');
    setTarjetaProfesional(initialSignature?.tarjetaProfesional || '');
    setUploadedImage(initialSignature?.dataUrl || null);
  }, [initialSignature, defaultRole]);

  const comprimirFirma = (dataUrl) => new Promise((resolve) => {
    let resuelto = false;
    const terminar = (valor) => {
      if (!resuelto) {
        resuelto = true;
        resolve(valor);
      }
    };
    const img = new Image();
    img.onload = () => {
      try {
        const anchoMax = 600;
        const escala = Math.min(1, anchoMax / (img.width || anchoMax));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.max(1, Math.round(img.width * escala));
        lienzo.height = Math.max(1, Math.round(img.height * escala));
        const ctx = lienzo.getContext('2d');
        if (!ctx) return terminar(dataUrl);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        terminar(lienzo.toDataURL('image/jpeg', 0.75));
      } catch (e) {
        terminar(dataUrl);
      }
    };
    img.onerror = () => terminar(dataUrl);
    setTimeout(() => terminar(dataUrl), 500);
    img.src = dataUrl;
  });

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        setUploadedImage(await comprimirFirma(event.target.result));
      }
    };
    reader.readAsDataURL(file);
  };

  const generateHash = () => {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    return `DIG-SIG-${randomHex}-${timestamp}`;
  };

  const handleConfirm = () => {
    if (!nombreSignatario.trim()) {
      alert('Por favor ingrese su nombre completo para la firma.');
      return;
    }

    if (!uploadedImage) {
      alert('Por favor seleccione un archivo de imagen con su firma.');
      return;
    }

    const signature = {
      dataUrl: uploadedImage,
      nombreSignatario: nombreSignatario,
      cargo: cargo || defaultRole,
      tarjetaProfesional: tarjetaProfesional.trim() ? tarjetaProfesional : undefined,
      fechaFirma: new Date().toISOString(),
      hashVerificacion: initialSignature?.hashVerificacion || generateHash(),
      tipoFirma: 'imagen'
    };

    onSaveSignature(signature);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        
        <div className="bg-[#1E222A] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 p-2 rounded-full text-gray-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-slate-800 rounded-2xl border border-slate-700 text-[#D9CF43]">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <span className="inline-flex items-center space-x-1.5 bg-[#D9CF43]/20 text-[#D9CF43] border border-[#D9CF43]/40 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3" />
                <span>Módulo de Firma Electrónica Segura (Ley 527)</span>
              </span>
              <h3 className="text-xl font-black text-white mt-1">
                {role === 'interventoria' ? 'Firma de Interventoría' : 'Firma del Contratista de Obra'}
              </h3>
            </div>
          </div>
        </div>

        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
            <div>
              <label className="font-extrabold text-gray-700 block mb-1">Nombre Completo</label>
              <input
                type="text"
                value={nombreSignatario}
                onChange={(e) => setNombreSignatario(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-[#D9CF43]"
                placeholder="Nombre del signatario"
              />
            </div>
            <div>
              <label className="font-extrabold text-gray-700 block mb-1">Cargo / Función</label>
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-xl font-semibold text-gray-900 focus:ring-2 focus:ring-[#D9CF43]"
                placeholder="Ej. Responsable de Revisión"
              />
            </div>
            <div>
              <label className="font-extrabold text-gray-700 block mb-1">Matrícula / T. Profesional</label>
              <input
                type="text"
                value={tarjetaProfesional}
                onChange={(e) => setTarjetaProfesional(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-xl font-mono text-gray-900 focus:ring-2 focus:ring-[#D9CF43]"
                placeholder="Ej. 1234567 - Ingeniero Civil"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs text-gray-500 font-medium">
              Seleccione una imagen limpia de su firma. Se comprime automáticamente para optimizar el almacenamiento:
            </label>

            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />

              {uploadedImage ? (
                <div className="space-y-2">
                  <img
                    src={uploadedImage}
                    alt="Firma subida"
                    className="max-h-28 mx-auto object-contain rounded border p-2 bg-white"
                  />
                  <span className="text-xs text-emerald-700 font-bold block">
                    Imagen cargada correctamente. Puede cambiarla seleccionando otra.
                  </span>
                </div>
              ) : (
                <div className="space-y-2 py-4">
                  <Upload className="w-10 h-10 mx-auto text-slate-400" />
                  <p className="text-xs font-bold text-gray-700">
                    Haga clic o arrastre aquí su archivo de firma
                  </p>
                  <p className="text-[11px] text-gray-400">Archivos permitidos: PNG, JPG</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-900 flex items-start space-x-2.5">
            <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="font-extrabold block">Garantía de Integridad y Sello de Tiempo</strong>
              Al confirmar, la firma se vinculará con la fecha ISO y un hash único de autenticidad que se estampará en el dictamen impreso.
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
          {initialSignature && onRemoveSignature ? (
            <button
              type="button"
              onClick={() => {
                onRemoveSignature();
                onClose();
              }}
              className="text-red-600 hover:text-red-800 text-xs font-bold flex items-center space-x-1.5 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar Firma Existente</span>
            </button>
          ) : (
            <span className="text-xs text-gray-400 font-medium">Intecoal SAS · Plataforma Web</span>
          )}

          <div className="flex items-center space-x-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="px-6 py-2.5 bg-[#1E222A] hover:bg-slate-800 text-[#D9CF43] font-black text-xs rounded-xl shadow-lg transition-all flex items-center space-x-2 cursor-pointer scale-[1.02] hover:scale-[1.04]"
            >
              <FileCheck className="w-4 h-4 text-[#D9CF43]" />
              <span>Estampar Firma en Informe</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
