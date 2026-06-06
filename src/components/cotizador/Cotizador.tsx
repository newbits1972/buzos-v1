'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ConfigPrecios, InputsCotizador, ResultadoCotizador } from '@/types';

const CONFIG_PRECIOS_DEFAULT: ConfigPrecios = {
  precioBaseXBuzo: 15000,
  recargoPremium: 20,
  precioEstampado: 2000,
  precioBordado: 3000,
};

function calcularPrecio(inputs: InputsCotizador, config: ConfigPrecios): ResultadoCotizador {
  const { cantidad, tipotela, bordado, estampado } = inputs;

  const base = config.precioBaseXBuzo;
  const recargoPremium = tipotela === 'premium' ? Math.round(base * (config.recargoPremium / 100)) : 0;
  const costoEstampado = estampado ? config.precioEstampado : 0;
  const costoBordado = bordado ? config.precioBordado : 0;

  const precioUnitario = base + recargoPremium + costoEstampado + costoBordado;
  const precioTotal = precioUnitario * cantidad;

  return {
    precioUnitario,
    precioTotal,
    desglose: {
      base,
      recargoPremium,
      estampado: costoEstampado,
      bordado: costoBordado,
    },
  };
}

function formatearARS(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function Cotizador({ cursoId }: { cursoId: string }) {
  const [config, setConfig] = useState<ConfigPrecios>(CONFIG_PRECIOS_DEFAULT);
  const [cargandoConfig, setCargandoConfig] = useState(true);
  const [inputs, setInputs] = useState<InputsCotizador>({
    cantidad: 30,
    tipotela: 'basica',
    bordado: false,
    estampado: true,
  });

  const resultado = calcularPrecio(inputs, config);

  // Intentar cargar precios del taller asignado al curso
  useEffect(() => {
    const cargar = async () => {
      try {
        const cursoSnap = await getDoc(doc(db, 'cursos', cursoId));
        const tallerId = cursoSnap.data()?.tallerId;

        if (tallerId) {
          const tallerSnap = await getDoc(doc(db, 'talleres', tallerId));
          if (tallerSnap.exists() && tallerSnap.data().configPrecios) {
            setConfig(tallerSnap.data().configPrecios as ConfigPrecios);
          }
        }
      } catch (e) {
        // Usar config default si no hay taller asignado
      } finally {
        setCargandoConfig(false);
      }
    };
    cargar();
  }, [cursoId]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">💰 Cotizador</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--texto-secondary)' }}>
          Calculá el precio estimado de los buzos. Gratis, sin compromiso.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="card space-y-5">
          {/* Cantidad */}
          <div>
            <label className="label" htmlFor="cantidad-buzos">
              Cantidad de buzos: <span style={{ color: 'var(--dorado)' }}>{inputs.cantidad}</span>
            </label>
            <input
              id="cantidad-buzos"
              type="range"
              min={10}
              max={200}
              step={5}
              value={inputs.cantidad}
              onChange={(e) => setInputs({ ...inputs, cantidad: Number(e.target.value) })}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#C0A060' }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--texto-muted)' }}>
              <span>10</span>
              <span>200</span>
            </div>
          </div>

          {/* Tipo de tela */}
          <div>
            <label className="label">Tipo de tela</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'basica', label: 'Básica', emoji: '🧶', desc: 'Algodón estándar' },
                { value: 'premium', label: 'Premium', emoji: '⭐', desc: `+${config.recargoPremium}% precio` },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setInputs({ ...inputs, tipotela: opt.value as 'basica' | 'premium' })}
                  className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                    inputs.tipotela === opt.value
                      ? 'border-[#C0A060] bg-[rgba(192,160,96,0.1)]'
                      : 'border-[rgba(192,160,96,0.2)]'
                  }`}
                  id={`tela-${opt.value}`}
                >
                  <div className="text-xl mb-1">{opt.emoji}</div>
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className="text-xs" style={{ color: 'var(--texto-muted)' }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Extras */}
          <div>
            <label className="label">Extras</label>
            <div className="space-y-3">
              {[
                {
                  key: 'estampado' as const,
                  label: 'Estampado',
                  emoji: '🖨️',
                  desc: `+${formatearARS(config.precioEstampado)} por buzo`,
                },
                {
                  key: 'bordado' as const,
                  label: 'Bordado',
                  emoji: '🧵',
                  desc: `+${formatearARS(config.precioBordado)} por buzo`,
                },
              ].map((extra) => (
                <button
                  key={extra.key}
                  onClick={() => setInputs({ ...inputs, [extra.key]: !inputs[extra.key] })}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                    inputs[extra.key]
                      ? 'border-[#C0A060] bg-[rgba(192,160,96,0.1)]'
                      : 'border-[rgba(192,160,96,0.2)]'
                  }`}
                  id={`extra-${extra.key}`}
                >
                  <span className="text-xl">{extra.emoji}</span>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-sm">{extra.label}</div>
                    <div className="text-xs" style={{ color: 'var(--texto-muted)' }}>{extra.desc}</div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      inputs[extra.key] ? 'border-[#C0A060] bg-[#C0A060]' : 'border-gray-500'
                    }`}
                  >
                    {inputs[extra.key] && <span className="text-xs text-black font-bold">✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className="space-y-4">
          <div className="card" style={{ borderColor: 'var(--dorado)' }}>
            <h3 className="font-bold mb-4" style={{ color: 'var(--dorado)' }}>
              Resumen del precio
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--texto-secondary)' }}>Precio base</span>
                <span>{formatearARS(resultado.desglose.base)}</span>
              </div>
              {resultado.desglose.recargoPremium > 0 && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--texto-secondary)' }}>Recargo premium</span>
                  <span>+{formatearARS(resultado.desglose.recargoPremium)}</span>
                </div>
              )}
              {resultado.desglose.estampado > 0 && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--texto-secondary)' }}>Estampado</span>
                  <span>+{formatearARS(resultado.desglose.estampado)}</span>
                </div>
              )}
              {resultado.desglose.bordado > 0 && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--texto-secondary)' }}>Bordado</span>
                  <span>+{formatearARS(resultado.desglose.bordado)}</span>
                </div>
              )}
            </div>

            <div className="divider-gold" />

            <div className="flex justify-between items-end">
              <div>
                <p className="text-sm" style={{ color: 'var(--texto-secondary)' }}>
                  Precio unitario
                </p>
                <p className="text-2xl font-black text-gradient-gold">
                  {formatearARS(resultado.precioUnitario)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm" style={{ color: 'var(--texto-secondary)' }}>
                  Total ({inputs.cantidad} buzos)
                </p>
                <p className="text-xl font-bold" style={{ color: 'var(--dorado)' }}>
                  {formatearARS(resultado.precioTotal)}
                </p>
              </div>
            </div>
          </div>

          <div className="card text-sm" style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.3)' }}>
            <p style={{ color: '#3B82F6' }}>
              💡 Este es un precio estimado. El taller confirmará el precio final al recibir la ficha técnica.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
