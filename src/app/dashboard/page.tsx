'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { crearCurso, buscarCursoPorCodigo, unirseACurso } from '@/lib/firestore';
import type { Curso } from '@/types';
import { doc, onSnapshot, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function SkeletonCurso() {
  return (
    <div className="card space-y-3">
      <div className="skeleton h-5 w-3/4 rounded" />
      <div className="skeleton h-4 w-1/2 rounded" />
      <div className="skeleton h-8 w-24 rounded-full" />
    </div>
  );
}

const ESTADO_COLORES: Record<string, string> = {
  'diseñando': 'badge-info',
  'votando': 'badge-warning',
  'cerrado': 'badge-success',
  'produccion': 'badge-gold',
};

const ESTADO_LABELS: Record<string, string> = {
  'diseñando': '✏️ Diseñando',
  'votando': '🗳️ Votando',
  'cerrado': '✅ Diseño elegido',
  'produccion': '📦 En producción',
};

export default function DashboardPage() {
  const router = useRouter();
  const { usuario, user, cargando, logout } = useAuth();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cargandoCursos, setCargandoCursos] = useState(true);

  // Modal crear curso
  const [modalCrear, setModalCrear] = useState(false);
  const [formCrear, setFormCrear] = useState({ nombre: '', escuela: '', anio: '' });
  const [creando, setCreando] = useState(false);

  // Modal unirse
  const [modalUnirse, setModalUnirse] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [uniendose, setUniendose] = useState(false);

  // Redirigir si no hay sesión
  useEffect(() => {
    if (!cargando && !user) router.push('/login');
    if (!cargando && usuario?.rol === 'taller') router.push('/taller');
  }, [user, cargando, usuario, router]);

  // Cargar cursos del usuario
  useEffect(() => {
    if (!user) return;

    // Buscar cursos donde el usuario es miembro
    const cargarCursos = async () => {
      setCargandoCursos(true);
      const cursosRef = collection(db, 'cursos');
      const snap = await getDocs(cursosRef);
      const cursosDelUsuario: Curso[] = [];

      for (const d of snap.docs) {
        const miembroRef = doc(db, 'cursos', d.id, 'miembros', user.uid);
        const miembroSnap = await getDocs(collection(db, 'cursos', d.id, 'miembros'));
        const esMiembro = miembroSnap.docs.some((m) => m.id === user.uid);
        if (esMiembro) {
          cursosDelUsuario.push({ id: d.id, ...d.data() } as Curso);
        }
      }

      setCursos(cursosDelUsuario);
      setCargandoCursos(false);
    };

    cargarCursos();
  }, [user]);

  const handleCrearCurso = async () => {
    if (!user || !usuario) return;
    if (!formCrear.nombre || !formCrear.escuela || !formCrear.anio) {
      toast.error('Completá todos los campos');
      return;
    }
    setCreando(true);
    try {
      const cursoId = await crearCurso(
        user.uid,
        usuario.nombre,
        usuario.email,
        formCrear
      );
      toast.success('¡Curso creado exitosamente!');
      setModalCrear(false);
      router.push(`/curso/${cursoId}`);
    } catch (e) {
      toast.error('Error al crear el curso');
    } finally {
      setCreando(false);
    }
  };

  const handleUnirse = async () => {
    if (!user || !usuario) return;
    if (!codigo.trim()) {
      toast.error('Ingresá el código del curso');
      return;
    }
    setUniendose(true);
    try {
      const curso = await buscarCursoPorCodigo(codigo.trim());
      if (!curso) {
        toast.error('No encontramos un curso con ese código');
        return;
      }
      await unirseACurso(curso.id, user.uid, usuario.nombre, usuario.email, 'alumno');
      toast.success(`¡Te uniste a ${curso.nombre}!`);
      setModalUnirse(false);
      router.push(`/curso/${curso.id}`);
    } catch (e) {
      toast.error('Error al unirse al curso');
    } finally {
      setUniendose(false);
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#C0A060] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="glass sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎓</span>
          <span className="font-bold text-gradient-gold">BuzoEgresados</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:block" style={{ color: 'var(--texto-secondary)' }}>
            Hola, {usuario?.nombre}
          </span>
          <button onClick={() => logout()} className="btn-secondary text-xs px-3 py-2">
            Salir
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Mis cursos</h1>
            <p style={{ color: 'var(--texto-secondary)' }} className="text-sm mt-1">
              Diseñá y gestioná el buzo de egresados de tu curso
            </p>
          </div>
          <div className="flex gap-3">
            {(usuario?.rol === 'delegado') && (
              <button
                onClick={() => setModalCrear(true)}
                className="btn-primary"
                id="btn-crear-curso"
              >
                + Crear curso
              </button>
            )}
            <button
              onClick={() => setModalUnirse(true)}
              className="btn-secondary"
              id="btn-unirse-curso"
            >
              🔑 Unirme con código
            </button>
          </div>
        </div>

        {/* Lista de cursos */}
        {cargandoCursos ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => <SkeletonCurso key={i} />)}
          </div>
        ) : cursos.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-4">🎓</div>
            <h3 className="text-lg font-bold mb-2">No estás en ningún curso aún</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--texto-secondary)' }}>
              {usuario?.rol === 'delegado'
                ? 'Creá el curso de tu división para empezar a diseñar'
                : 'Pedile el código al delegado de tu curso para unirte'}
            </p>
            <div className="flex justify-center gap-3">
              {usuario?.rol === 'delegado' && (
                <button onClick={() => setModalCrear(true)} className="btn-primary">
                  Crear mi curso
                </button>
              )}
              <button onClick={() => setModalUnirse(true)} className="btn-secondary">
                🔑 Unirme con código
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cursos.map((curso) => (
              <Link
                key={curso.id}
                href={`/curso/${curso.id}`}
                className="card-hover block animate-fade-in"
                id={`curso-${curso.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{curso.nombre}</h3>
                    <p className="text-sm" style={{ color: 'var(--texto-secondary)' }}>
                      {curso.escuela} · {curso.anio}
                    </p>
                  </div>
                  <span className={`badge ${ESTADO_COLORES[curso.estado] || 'badge-info'}`}>
                    {ESTADO_LABELS[curso.estado] || curso.estado}
                  </span>
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--texto-muted)' }}>
                  Código: <span className="font-mono font-bold" style={{ color: 'var(--dorado)' }}>
                    {curso.codigoAcceso}
                  </span>
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* ── Modal: Crear curso ──────────────────────────────── */}
      {modalCrear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setModalCrear(false)} />
          <div className="card relative z-10 w-full max-w-md space-y-5 animate-fade-in">
            <h2 className="text-xl font-bold">Crear nuevo curso</h2>

            <div>
              <label className="label" htmlFor="curso-nombre">Nombre del curso</label>
              <input
                id="curso-nombre"
                type="text"
                className="input"
                placeholder="Ej: 6to Año B"
                value={formCrear.nombre}
                onChange={(e) => setFormCrear({ ...formCrear, nombre: e.target.value })}
              />
            </div>

            <div>
              <label className="label" htmlFor="curso-escuela">Escuela</label>
              <input
                id="curso-escuela"
                type="text"
                className="input"
                placeholder="Ej: Instituto San Martín"
                value={formCrear.escuela}
                onChange={(e) => setFormCrear({ ...formCrear, escuela: e.target.value })}
              />
            </div>

            <div>
              <label className="label" htmlFor="curso-anio">Año de egreso</label>
              <input
                id="curso-anio"
                type="text"
                className="input"
                placeholder="Ej: 2025"
                value={formCrear.anio}
                onChange={(e) => setFormCrear({ ...formCrear, anio: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalCrear(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={handleCrearCurso}
                disabled={creando}
                className="btn-primary flex-1"
                id="btn-confirmar-crear"
              >
                {creando ? 'Creando...' : 'Crear curso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Unirse a curso ───────────────────────────── */}
      {modalUnirse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setModalUnirse(false)} />
          <div className="card relative z-10 w-full max-w-sm space-y-5 animate-fade-in">
            <h2 className="text-xl font-bold">Unirme a un curso</h2>
            <p className="text-sm" style={{ color: 'var(--texto-secondary)' }}>
              Pedile el código de 6 letras al delegado de tu curso
            </p>

            <div>
              <label className="label" htmlFor="codigo-acceso">Código de acceso</label>
              <input
                id="codigo-acceso"
                type="text"
                className="input font-mono text-center text-lg tracking-widest uppercase"
                placeholder="XXXXXX"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalUnirse(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={handleUnirse}
                disabled={uniendose || codigo.length < 6}
                className="btn-primary flex-1"
                id="btn-confirmar-unirse"
              >
                {uniendose ? 'Uniéndome...' : 'Unirme'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
