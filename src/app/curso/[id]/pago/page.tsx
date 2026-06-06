'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

export default function PagoPage() {
  const params = useParams();
  const router = useRouter();
  const { user, usuario } = useAuth();
  const cursoId = params.id as string;

  const [procesando, setProcesando] = useState(false);

  const iniciarPago = async () => {
    if (!user) return;
    setProcesando(true);
    try {
      const response = await fetch('/api/pago/crear-preferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursoId, uid: user.uid }),
      });

      const data = await response.json();
      if (data.init_point) {
        // Redirigir al checkout de MercadoPago
        window.location.href = data.init_point;
      } else {
        throw new Error('No se pudo crear la preferencia de pago');
      }
    } catch (e) {
      toast.error('Error al iniciar el pago. Intentá de nuevo.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div
        className="fixed inset-0 opacity-20"
        style={{
          background: 'radial-gradient(ellipse at center, #C0A060 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="w-full max-w-lg relative z-10">
        <button
          onClick={() => router.back()}
          className="mb-6 text-sm px-4 py-2 rounded-lg transition-colors hover:bg-white/10"
          style={{ color: 'var(--texto-secondary)' }}
        >
          ← Volver
        </button>

        <div className="card text-center space-y-6">
          <div className="text-5xl">🏆</div>
          <div>
            <h1 className="text-2xl font-bold mb-2">Ficha técnica para el taller</h1>
            <p style={{ color: 'var(--texto-secondary)' }}>
              Con tu pago se genera automáticamente un PDF profesional para el taller de costura con el diseño ganador, tallas de todos los alumnos y especificaciones técnicas.
            </p>
          </div>

          {/* ── Lo que incluye ──────────────────────────────── */}
          <div className="text-left space-y-3 p-4 rounded-xl"
               style={{ background: 'rgba(255,255,255,0.04)' }}>
            {[
              { emoji: '🎨', texto: 'Render del diseño ganador (imagen)' },
              { emoji: '📏', texto: 'Tabla de tallas de todos los alumnos' },
              { emoji: '🎨', texto: 'Color HEX de tela y especificaciones' },
              { emoji: '👤', texto: 'Datos de contacto del delegado' },
              { emoji: '📧', texto: 'Envío automático al taller por email' },
            ].map((item) => (
              <div key={item.texto} className="flex items-center gap-3 text-sm">
                <span>{item.emoji}</span>
                <span style={{ color: 'var(--texto-secondary)' }}>{item.texto}</span>
              </div>
            ))}
          </div>

          <div className="divider-gold" />

          {/* ── Precio ──────────────────────────────────────── */}
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--texto-secondary)' }}>
              Pago único por curso
            </p>
            <div className="text-5xl font-black text-gradient-gold">$5.000</div>
            <p className="text-xs mt-2" style={{ color: 'var(--texto-muted)' }}>ARS</p>
          </div>

          {/* ── Botón de pago ───────────────────────────────── */}
          <button
            onClick={iniciarPago}
            disabled={procesando}
            className="btn-primary w-full text-lg py-4 animate-pulse-gold"
            id="btn-pagar-mercadopago"
          >
            {procesando ? (
              <>
                <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Conectando con MercadoPago...
              </>
            ) : (
              <>💳 Pagar con MercadoPago</>
            )}
          </button>

          <div className="flex items-center justify-center gap-3 text-xs"
               style={{ color: 'var(--texto-muted)' }}>
            <span>🔒 Pago seguro</span>
            <span>·</span>
            <span>SSL encriptado</span>
            <span>·</span>
            <span>Tarjeta o efectivo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
