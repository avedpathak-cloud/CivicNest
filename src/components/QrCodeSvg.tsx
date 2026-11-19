import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeSvgProps {
  value: string;
  size?: number;
  label?: string;
}

export const QrCodeSvg: React.FC<QrCodeSvgProps> = ({ value, size = 148, label }) => {
  const [svgMarkup, setSvgMarkup] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toString(value, {
      type: 'svg',
      width: size,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((svg) => {
        if (active) setSvgMarkup(svg);
      })
      .catch(() => {
        if (active) setSvgMarkup('');
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  return (
    <div className="inline-flex flex-col items-center rounded-xl border border-slate-200 bg-white p-3">
      {svgMarkup ? (
        <div
          style={{ width: size, height: size }}
          aria-label={label || `QR Code for ${value}`}
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="flex items-center justify-center bg-slate-100 text-xs font-mono-num text-slate-600"
        >
          {value}
        </div>
      )}
      {label && (
        <span className="mt-2 font-mono-num text-[11px] font-semibold text-slate-800">{label}</span>
      )}
    </div>
  );
};
