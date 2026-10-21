import React from 'react';
import {
  LOGO_MEMBRETE,
  ICONO_DIRECCION,
  ICONO_CORREO,
  ICONO_TELEFONO
} from '../lib/imagenesMembrete';


const printExact = {
  WebkitPrintColorAdjust: 'exact',
  printColorAdjust: 'exact'
};

export const FIRMA_NOMBRE_JEFE = 'VICTOR JAIME CASTAÑO ACOSTA';
export const FIRMA_CARGO_JEFE = 'Director de Interventoría.';

const datosPorMunicipio = (municipio) => {
  const m = (municipio || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (m.includes('villavicencio')) {
    return {
      direccion: 'Carrera. 33a #15-49 Conjunto Residencial El Oasis – Casa 23',
      ciudad: 'Villavicencio - Meta',
      telefono: '310 355 6449'
    };
  }
  return {
    direccion: 'Calle 41ª #24-38 Barrio Príncipe, Tuluá – Valle del Cauca',
    ciudad: '',
    telefono: '224 8763'
  };
};
const correoPorMunicipio = (municipio) => {
  const m = (municipio || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (m.includes('tulua')) return 'tulua@intecoalsas.com';
  if (m.includes('andalucia')) return 'andalucia@intecoalsas.com';
  if (m.includes('san pedro')) return 'sanpedro@intecoalsas.com';
  if (m.includes('calima')) return 'calima@intecoalsas.com';
  if (m.includes('villavicencio')) return 'villavicencio@intecoalsas.com';
  return 'andalucia@intecoalsas.com';
};

export const MembreteRecibo = ({ municipio }) => {
  const datos = datosPorMunicipio(municipio);
  return (
  <div className="pb-2" style={printExact}>
    <div className="flex items-center justify-start gap-4">
      <div className="flex flex-col items-start">
        <img
          src={LOGO_MEMBRETE}
          alt="INTECOAL S.A.S. Interventoría Alumbrado Público"
          style={{ width: '111px', height: '80px', objectFit: 'contain' }}
        />
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#000000', paddingLeft: '22px' }}>NIT: 901.582.227-1</span>
      </div>
      <div className="text-left space-y-1 pt-1" style={{ fontSize: '11px', color: '#595959' }}>
        <div className="flex items-center justify-start" style={{ gap: '4px' }}>
          <img src={ICONO_DIRECCION} alt="" style={{ width: '13px', height: '13px' }} />
          <span>{datos.direccion}</span>
        </div>
        {datos.ciudad && (
          <div className="font-bold" style={{ color: '#000000', paddingLeft: '17px' }}>{datos.ciudad}</div>
        )}
        <div className="flex items-center justify-start" style={{ gap: '4px' }}>
          <img src={ICONO_CORREO} alt="" style={{ width: '13px', height: '13px' }} />
          <span>{correoPorMunicipio(municipio)}</span>
        </div>
        <div className="flex items-center justify-start" style={{ gap: '4px' }}>
          <img src={ICONO_TELEFONO} alt="" style={{ width: '13px', height: '13px' }} />
          <span>{datos.telefono}</span>
        </div>
      </div>
    </div>
    
    <hr style={{ border: 'none', height: '3px', backgroundColor: '#4E3629', margin: '20px 0', width: '100%', ...printExact }} />
  </div>
  );
};

export const FranjaCorporativa = () => (
  <footer style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'sans-serif', marginTop: '60px', paddingBottom: '50px', ...printExact }}>

    
    <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%' }}>

      
      <div style={{
        width: '35%',
        height: '44px',
        background: 'linear-gradient(to bottom, #4E3629 50%, #D9CF43 50%)',
        clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)',
        flexShrink: 0,
        ...printExact
      }}></div>

      
      <div style={{
        width: '65%',
        display: 'flex',
        flexDirection: 'column',
        marginLeft: '-4.5%',
        marginBottom: '0px'
      }}>

        
        <span style={{
          fontSize: '13px',
          color: '#4E3629',
          marginBottom: '4px',
          paddingLeft: '25px',
          fontWeight: 600,
          letterSpacing: '0.3px'
        }}>www.Intecoalsas.com</span>

        
        <div style={{ width: '100%', height: '3px', backgroundColor: '#4E3629', ...printExact }}></div>

      </div>
    </div>
  </footer>
);
