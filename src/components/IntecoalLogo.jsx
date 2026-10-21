import React from 'react';

export const IntecoalLogo = ({ 
  className = "w-10 h-10", 
  size,
  showText = false 
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div 
        className="relative overflow-hidden rounded-xl shadow-md shrink-0 select-none bg-[#E2DF2B] border border-amber-300/30"
        style={size ? { width: size, height: size } : undefined}
      >
        <svg 
          viewBox="0 0 400 400" 
          className="w-full h-full object-contain"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="400" height="400" fill="#E2DF2B" />
          <polygon points="196,38 10,312 390,312" fill="#FFFFFF" />
          <polygon points="196,38 25,300 375,300" fill="url(#beamGrad)" opacity="0.95" />

          <polygon points="196,12 226,48 196,62 166,48" fill="#222222" />
          <polygon points="196,18 220,48 196,56 172,48" fill="#444444" />

          <path id="archTextPath" d="M 30 338 Q 196 308 362 338" fill="none" />
          <text fill="#0A0A0A" fontSize="33" fontWeight="900" fontFamily="sans-serif" letterSpacing="1">
            <textPath href="#archTextPath" startOffset="50%" textAnchor="middle">
              INTECOAL SAS
            </textPath>
          </text>

          <defs>
            <linearGradient id="beamGrad" x1="196" y1="38" x2="196" y2="300" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#F5F5EC" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className="font-black text-lg tracking-tight leading-none text-white">INTECOAL SAS</span>
          <span className="text-[10px] text-[#D9CF43] font-extrabold tracking-wider mt-0.5 uppercase">
            Interventoría Alumbrado Público
          </span>
        </div>
      )}
    </div>
  );
};
