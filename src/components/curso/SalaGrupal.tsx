'use client';

import { useEffect, useState, useRef } from 'react';
import type { Variante, Miembro, Curso } from '@/types';
import { enviarMensaje, observarMensajes } from '@/lib/firestore';
import { useAuth } from '@/hooks/useAuth';
import type { Mensaje } from '@/types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SalaGrupalProps {
  cursoId: string;
  variantes: Variante[];
  miembros: Miembro[];
  estadoCurso: Curso['estado'];
  esDelegado: boolean;
  onCambiarEstado: (estado: Curso['estado']) => void;
}

const ESTADO_INFO: Record<string, { emoji: string; descripcion: string }> = {
  'diseñando': { emoji: '✏️', descripcion: 'Los alumnos pueden proponer diseños en el editor' },
  'votando': { emoji: '🗳️', descripcion: 'Los miembros están votando su diseño favorito' },
  'cerrado': { emoji: '✅', descripcion: 'El diseño ganador fue elegido. Procedé al pago.' },
  'produccion': { emoji: '📦', descripcion: 'El pedido está en manos del taller' },
};

export default function SalaGrupal({
  cursoId,
  variantes,
  miembros,
  estadoCurso,
  esDelegado,
  onCambiarEstado,
}: SalaGrupalProps) {
  const { user, usuario } = useAuth();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [mensajeInput, setMensajeInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Observar mensajes en tiempo real
  useEffect(() => {
    const unsub = observarMensajes(cursoId, (msgs) => {
      // Ordenar por timestamp
      const ordenados = [...msgs].sort((a, b) => {
        const ta = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
        const tb = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
        return ta - tb;
      });
      setMensajes(ordenados);

      // Auto-scroll
      setTimeout(() => {
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    });
    return unsub;
  }, [cursoId]);

  const handleEnviarMensaje = async () => {
    if (!user || !usuario || !mensajeInput.trim()) return;
    setEnviando(true);
    try {
      await enviarMensaje(
        cursoId,
        user.uid,
        usuario.nombre,
        'delegado',
        mensajeInput.trim()
      );
      setMensajeInput('');
    } catch (e) {
      toast.error('Error al enviar el mensaje');
    } finally {
      setEnviando(false);
    }
  };

  const estadoInfo = ESTADO_INFO[estadoCurso] || { emoji: '❓', descripcion: '' };

  return (
    <div className="space-y-6">
      {/* Estado del curso */}
      <div className="card animate-fade-in">
        <div className="flex items-center gap-4">
          <span className="text-4xl">{estadoInfo.emoji}</span>
          <div>
            <h3 className="font-bold text-lg">Estado del curso</h3>
            <p className="text-sm" style={{ color: 'var(--texto-secondary)' }}>
              {estadoInfo.descripcion}
            </p>
          </div>
          <div className="ml-auto">
            <span className={`badge ${
              estadoCurso === 'diseñando' ? 'badge-info' :
              estadoCurso === 'votando' ? 'badge-warning' :
              estadoCurso === 'cerrado' ? 'badge-success' : 'badge-gold'
            }`}>
              {estadoCurso}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Miembros */}
        <div className="card">
          <h3 className="font-bold mb-4">
            👥 Miembros del curso ({miembros.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {miembros.map((m) => (
              <div
                key={m.uid}
                className="flex items-center gap-3 p-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'var(--azul-marino-claro)', color: 'var(--dorado)' }}
                >
                  {m.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.nombre}</p>
                  {m.talla && (
                    <p className="text-xs" style={{ color: 'var(--texto-muted)' }}>
                      Talla: {m.talla}
                    </p>
                  )}
                </div>
                {m.rol === 'delegado' && (
                  <span className="badge badge-gold text-xs">⭐</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Variantes propuestas */}
        <div className="card">
          <h3 className="font-bold mb-4">
            🎨 Variantes propuestas ({variantes.length})
          </h3>
          {variantes.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🖌️</div>
              <p className="text-sm" style={{ color: 'var(--texto-muted)' }}>
                Nadie ha propuesto diseños aún
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {variantes.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <div className="w-8 h-8 rounded-lg"
                       style={{ background: 'var(--azul-marino)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    🎨
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{v.autor}</p>
                    <p className="text-xs" style={{ color: 'var(--texto-muted)' }}>
                      {v.votos.length} voto(s)
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat grupal */}
      <div className="card">
        <h3 className="font-bold mb-4">💬 Chat del curso</h3>

        <div
          ref={chatRef}
          className="space-y-3 max-h-72 overflow-y-auto pr-1 mb-4"
        >
          {mensajes.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--texto-muted)' }}>
              Nadie ha escrito nada aún. ¡Empezá la conversación!
            </p>
          ) : (
            mensajes.map((msg) => {
              const esPropio = msg.autorUid === user?.uid;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 animate-fade-in ${esPropio ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: 'var(--azul-marino-claro)', color: 'var(--dorado)' }}
                  >
                    {msg.autorNombre.charAt(0).toUpperCase()}
                  </div>
                  <div className={`max-w-[75%] ${esPropio ? 'items-end' : 'items-start'} flex flex-col`}>
                    <p className="text-xs mb-1" style={{ color: 'var(--texto-muted)' }}>
                      {esPropio ? 'Vos' : msg.autorNombre}
                    </p>
                    <div
                      className="px-3 py-2 rounded-2xl text-sm"
                      style={{
                        background: esPropio
                          ? 'linear-gradient(135deg, var(--dorado-oscuro), var(--dorado))'
                          : 'var(--bg-card-hover)',
                        color: esPropio ? 'var(--azul-marino-oscuro)' : 'var(--texto-primary)',
                      }}
                    >
                      {msg.contenido}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1 text-sm"
            placeholder="Escribí un mensaje..."
            value={mensajeInput}
            onChange={(e) => setMensajeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleEnviarMensaje()}
            id="chat-input"
          />
          <button
            onClick={handleEnviarMensaje}
            disabled={enviando || !mensajeInput.trim()}
            className="btn-primary px-4"
            id="btn-enviar-mensaje"
          >
            {enviando ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}
