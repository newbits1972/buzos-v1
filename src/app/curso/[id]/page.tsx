'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import {
  observarVariantes,
  observarMiembros,
  actualizarEstadoCurso,
  votar,
  cerrarVotacion,
  observarPedido,
} from '@/lib/firestore';
import type { Curso, Variante, Miembro, Pedido } from '@/types';
import Cotizador from '@/components/cotizador/Cotizador';
import SalaGrupal from '@/components/curso/SalaGrupal';

// Carga dinámica del editor (solo client-side por Fabric.js)
const EditorBuzo = dynamic(() => import('@/components/editor/EditorBuzo'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 skeleton rounded-2xl flex items-center justify-center">
      <span style={{ color: 'var(--texto-muted)' }}>Cargando editor...</span>
    </div>
  ),
});

type TabActual = 'editor' | 'sala' | 'votacion' | 'cotizador' | 'pedido';

export default function CursoPage() {
  const params = useParams();
  const router = useRouter();
  const cursoId = params.id as string;
  const { user, usuario, cargando } = useAuth();

  const [curso, setCurso] = useState<Curso | null>(null);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [miembro, setMiembro] = useState<Miembro | null>(null);
  const [variantIdActual, setVariantIdActual] = useState<string | null>(null);
  const [tab, setTab] = useState<TabActual>('editor');
  const [cargandoCurso, setCargandoCurso] = useState(true);

  // Verificar auth
  useEffect(() => {
    if (!cargando && !user) router.push('/login');
  }, [user, cargando, router]);

  // Cargar datos del curso
  useEffect(() => {
    if (!cursoId || !user) return;

    // Observar el curso
    const unsubCurso = onSnapshot(doc(db, 'cursos', cursoId), (snap) => {
      if (snap.exists()) {
        setCurso({ id: snap.id, ...snap.data() } as Curso);
      }
      setCargandoCurso(false);
    });

    // Observar variantes
    const unsubVariantes = observarVariantes(cursoId, setVariantes);

    // Observar miembros
    const unsubMiembros = observarMiembros(cursoId, (ms) => {
      setMiembros(ms);
      const yo = ms.find((m) => m.uid === user.uid);
      setMiembro(yo || null);
    });

    // Observar pedido
    const unsubPedido = observarPedido(cursoId, setPedido);

    // Cargar variante del usuario
    const cargarVariantePropia = async () => {
      const variante = variantes.find((v) => v.autorUid === user.uid);
      if (variante) setVariantIdActual(variante.id);
    };
    cargarVariantePropia();

    return () => {
      unsubCurso();
      unsubVariantes();
      unsubMiembros();
      unsubPedido();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursoId, user]);

  const esDelegado = miembro?.rol === 'delegado';
  const variantasPropias = variantes.filter((v) => v.autorUid === user?.uid);

  const handleVotar = async (variantId: string) => {
    if (!user || curso?.estado !== 'votando') return;
    try {
      await votar(cursoId, variantId, user.uid);
      toast.success('¡Voto registrado!');
    } catch (e) {
      toast.error('Error al votar');
    }
  };

  const handleCambiarEstado = async (nuevoEstado: Curso['estado']) => {
    try {
      await actualizarEstadoCurso(cursoId, nuevoEstado);
      toast.success(`Estado actualizado: ${nuevoEstado}`);
    } catch (e) {
      toast.error('Error al cambiar el estado');
    }
  };

  const handleCerrarVotacion = async (variantId: string) => {
    try {
      await cerrarVotacion(cursoId, variantId);
      toast.success('¡Votación cerrada! El diseño ganador fue fijado.');
    } catch (e) {
      toast.error('Error al cerrar la votación');
    }
  };

  if (cargandoCurso || cargando) {
    return (
      <div className="min-h-screen">
        <nav className="glass px-6 py-4">
          <div className="skeleton h-6 w-48 rounded" />
        </nav>
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
          <div className="skeleton h-10 w-64 rounded" />
          <div className="skeleton h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!curso) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card text-center">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-xl font-bold mb-2">Curso no encontrado</h2>
          <button onClick={() => router.push('/dashboard')} className="btn-primary mt-4">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const TABS: { id: TabActual; label: string; emoji: string; visible: boolean }[] = [
    { id: 'editor', label: 'Editor', emoji: '✏️', visible: curso.estado !== 'produccion' },
    { id: 'sala', label: 'Sala grupal', emoji: '👥', visible: true },
    { id: 'votacion', label: 'Votación', emoji: '🗳️', visible: curso.estado === 'votando' || curso.estado === 'cerrado' },
    { id: 'cotizador', label: 'Cotizador', emoji: '💰', visible: true },
    { id: 'pedido', label: 'Pedido', emoji: '📦', visible: curso.estado === 'cerrado' || curso.estado === 'produccion' },
  ];

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="glass sticky top-0 z-40 px-4 py-3 flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm px-3 py-2 rounded-lg transition-colors hover:bg-white/10"
          style={{ color: 'var(--texto-secondary)' }}
        >
          ← Volver
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-sm truncate">{curso.nombre}</h1>
          <p className="text-xs" style={{ color: 'var(--texto-muted)' }}>
            {curso.escuela} · {curso.anio}
          </p>
        </div>
        {esDelegado && (
          <div className="flex items-center gap-2">
            <span className="badge badge-gold text-xs">⭐ Delegado</span>
            <EstadoControl
              estadoActual={curso.estado}
              onCambiar={handleCambiarEstado}
            />
          </div>
        )}
      </nav>

      {/* Tabs */}
      <div className="sticky top-[60px] z-30 glass border-b"
           style={{ borderColor: 'var(--border)' }}>
        <div className="flex overflow-x-auto px-4">
          {TABS.filter((t) => t.visible).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-200 ${
                tab === t.id
                  ? 'border-[#C0A060] text-[#C0A060]'
                  : 'border-transparent hover:border-white/20'
              }`}
              style={{ color: tab === t.id ? 'var(--dorado)' : 'var(--texto-secondary)' }}
              id={`tab-${t.id}`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido de tabs */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {tab === 'editor' && (
          <EditorBuzo
            cursoId={cursoId}
            variantId={variantIdActual}
            autorUid={user!.uid}
            autorNombre={usuario?.nombre || ''}
            cantidadVariantes={variantasPropias.length}
            onGuardado={(id) => setVariantIdActual(id)}
          />
        )}

        {tab === 'sala' && (
          <SalaGrupal
            cursoId={cursoId}
            variantes={variantes}
            miembros={miembros}
            estadoCurso={curso.estado}
            esDelegado={esDelegado}
          />
        )}

        {tab === 'votacion' && (
          <VistadeVotacion
            variantes={variantes}
            miembros={miembros}
            estadoCurso={curso.estado}
            uidUsuario={user!.uid}
            esDelegado={esDelegado}
            onVotar={handleVotar}
            onCerrarVotacion={handleCerrarVotacion}
          />
        )}

        {tab === 'cotizador' && <Cotizador cursoId={cursoId} />}

        {tab === 'pedido' && (
          <VistaPedido
            pedido={pedido}
            cursoId={cursoId}
            esDelegado={esDelegado}
            usuario={usuario}
          />
        )}
      </main>
    </div>
  );
}

// ── Componente control de estado (delegado) ──────────────────────────────────
function EstadoControl({
  estadoActual,
  onCambiar,
}: {
  estadoActual: Curso['estado'];
  onCambiar: (estado: Curso['estado']) => void;
}) {
  const TRANSICIONES: Partial<Record<Curso['estado'], { siguiente: Curso['estado']; label: string }>> = {
    'diseñando': { siguiente: 'votando', label: '🗳️ Abrir votación' },
    'votando': { siguiente: 'diseñando', label: '↩️ Volver a diseño' },
  };

  const transicion = TRANSICIONES[estadoActual];
  if (!transicion) return null;

  return (
    <button
      onClick={() => onCambiar(transicion.siguiente)}
      className="btn-secondary text-xs px-3 py-2"
      id={`btn-estado-${transicion.siguiente}`}
    >
      {transicion.label}
    </button>
  );
}

// ── Vista de votación ────────────────────────────────────────────────────────
function VistadeVotacion({
  variantes,
  miembros,
  estadoCurso,
  uidUsuario,
  esDelegado,
  onVotar,
  onCerrarVotacion,
}: {
  variantes: Variante[];
  miembros: Miembro[];
  estadoCurso: Curso['estado'];
  uidUsuario: string;
  esDelegado: boolean;
  onVotar: (id: string) => void;
  onCerrarVotacion: (id: string) => void;
}) {
  const totalVotos = variantes.reduce((acc, v) => acc + v.votos.length, 0);
  const miVoto = variantes.find((v) => v.votos.includes(uidUsuario));

  const variantesOrdenadas = [...variantes].sort((a, b) => b.votos.length - a.votos.length);
  const ganadora = variantesOrdenadas[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Votación de diseños</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--texto-secondary)' }}>
            {totalVotos} voto(s) · {miembros.length} miembro(s) en el curso
          </p>
        </div>
        {esDelegado && estadoCurso === 'votando' && ganadora && (
          <button
            onClick={() => onCerrarVotacion(ganadora.id)}
            className="btn-primary"
            id="btn-cerrar-votacion"
          >
            🏆 Cerrar votación y elegir ganador
          </button>
        )}
      </div>

      {estadoCurso === 'cerrado' && (
        <div className="card mb-6 border-[#C0A060] animate-pulse-gold">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <div className="font-bold text-lg" style={{ color: 'var(--dorado)' }}>
                ¡Diseño ganador elegido!
              </div>
              <p className="text-sm" style={{ color: 'var(--texto-secondary)' }}>
                El delegado puede proceder al cotizador y pago de la ficha técnica
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {variantesOrdenadas.map((variante, idx) => {
          const porcentaje = totalVotos > 0
            ? Math.round((variante.votos.length / totalVotos) * 100)
            : 0;
          const yoVote = variante.votos.includes(uidUsuario);
          const esGanadora = estadoCurso === 'cerrado' && idx === 0;

          return (
            <div
              key={variante.id}
              className={`card transition-all duration-300 ${esGanadora ? 'border-[#C0A060]' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {esGanadora && <span className="text-xl">🏆</span>}
                  <div>
                    <span className="font-semibold text-sm">{variante.autor}</span>
                    <div className="text-xs" style={{ color: 'var(--texto-muted)' }}>
                      {variante.votos.length} voto(s) · {porcentaje}%
                    </div>
                  </div>
                </div>
                {estadoCurso === 'votando' && (
                  <button
                    onClick={() => onVotar(variante.id)}
                    className={yoVote ? 'btn-primary text-xs px-3 py-2' : 'btn-secondary text-xs px-3 py-2'}
                    id={`btn-votar-${variante.id}`}
                  >
                    {yoVote ? '✓ Mi voto' : 'Votar'}
                  </button>
                )}
              </div>

              {/* Barra de progreso */}
              <div className="barra-votos">
                <div
                  className="barra-votos-fill"
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Vista de pedido ──────────────────────────────────────────────────────────
function VistaPedido({
  pedido,
  cursoId,
  esDelegado,
  usuario,
}: {
  pedido: Pedido | null;
  cursoId: string;
  esDelegado: boolean;
  usuario: any;
}) {
  const router = useRouter();

  if (!pedido) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="font-bold mb-2">No hay pedido aún</h3>
        <p className="text-sm" style={{ color: 'var(--texto-secondary)' }}>
          El pedido se genera automáticamente al cerrar la votación
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Estado del pedido</h2>

      {/* Estado del pago */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="text-4xl">
            {pedido.pagoStatus === 'aprobado' ? '✅' : pedido.pagoStatus === 'procesando' ? '⏳' : '💳'}
          </div>
          <div>
            <h3 className="font-bold">Ficha técnica PDF</h3>
            <p className="text-sm" style={{ color: 'var(--texto-secondary)' }}>
              {pedido.pagoStatus === 'aprobado'
                ? 'Pago aprobado — Tu ficha técnica está lista'
                : pedido.pagoStatus === 'procesando'
                ? 'Procesando el pago...'
                : 'Pendiente de pago — Pagá para enviar al taller'}
            </p>
          </div>
          {pedido.pagoStatus === 'aprobado' && pedido.fichaTecnicaURL && (
            <a
              href={pedido.fichaTecnicaURL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary ml-auto"
              id="btn-ver-ficha"
            >
              📄 Ver PDF
            </a>
          )}
          {pedido.pagoStatus === 'pendiente' && esDelegado && (
            <button
              onClick={() => router.push(`/curso/${cursoId}/pago`)}
              className="btn-primary ml-auto animate-pulse-gold"
              id="btn-pagar-ficha"
            >
              💳 Pagar ficha ($5.000)
            </button>
          )}
        </div>
      </div>

      {/* Cantidades por talla */}
      <div className="card">
        <h3 className="font-bold mb-4">Cantidades por talla</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {(['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const).map((talla) => (
            <div key={talla} className="text-center p-3 rounded-xl"
                 style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="font-bold text-lg" style={{ color: 'var(--dorado)' }}>
                {pedido.cantidades?.[talla] || 0}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--texto-muted)' }}>{talla}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
