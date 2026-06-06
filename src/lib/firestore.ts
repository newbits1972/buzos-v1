import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Curso,
  Miembro,
  Variante,
  Pedido,
  Mensaje,
  EstadoCurso,
  RolMiembro,
  TallaPrenda,
} from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Genera código de acceso aleatorio de 6 caracteres */
export function generarCodigoAcceso(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Cursos ───────────────────────────────────────────────────────────────────

/** Crea un nuevo curso y añade al delegado como miembro */
export async function crearCurso(
  delegadoUid: string,
  delegadoNombre: string,
  delegadoEmail: string,
  data: { nombre: string; escuela: string; anio: string }
): Promise<string> {
  const codigoAcceso = generarCodigoAcceso();
  const cursoRef = doc(collection(db, 'cursos'));

  await setDoc(cursoRef, {
    nombre: data.nombre,
    escuela: data.escuela,
    anio: data.anio,
    delegadoUid,
    codigoAcceso,
    estado: 'diseñando',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Agregar delegado como miembro
  await setDoc(doc(db, 'cursos', cursoRef.id, 'miembros', delegadoUid), {
    uid: delegadoUid,
    nombre: delegadoNombre,
    email: delegadoEmail,
    rol: 'delegado' as RolMiembro,
    talla: null,
    joinedAt: serverTimestamp(),
  });

  return cursoRef.id;
}

/** Busca un curso por código de acceso */
export async function buscarCursoPorCodigo(codigo: string): Promise<Curso | null> {
  const q = query(collection(db, 'cursos'), where('codigoAcceso', '==', codigo.toUpperCase()));
  return new Promise((resolve) => {
    onSnapshot(q, (snap) => {
      if (snap.empty) {
        resolve(null);
      } else {
        const docData = snap.docs[0];
        resolve({ id: docData.id, ...docData.data() } as Curso);
      }
    }, () => resolve(null));
  });
}

/** Une a un alumno a un curso existente */
export async function unirseACurso(
  cursoId: string,
  uid: string,
  nombre: string,
  email: string,
  rol: RolMiembro = 'alumno'
): Promise<void> {
  await setDoc(doc(db, 'cursos', cursoId, 'miembros', uid), {
    uid,
    nombre,
    email,
    rol,
    talla: null,
    joinedAt: serverTimestamp(),
  });
}

/** Obtiene los cursos donde el usuario es miembro */
export function observarCursosDelUsuario(
  uid: string,
  callback: (cursos: Curso[]) => void
): () => void {
  // Buscar en subcolecciones es costoso, usamos campo en el documento del usuario
  const q = query(collection(db, 'cursos'));
  return onSnapshot(q, async (snap) => {
    const cursos: Curso[] = [];
    for (const d of snap.docs) {
      const miembroRef = doc(db, 'cursos', d.id, 'miembros', uid);
      const miembroSnap = await getDoc(miembroRef);
      if (miembroSnap.exists()) {
        cursos.push({ id: d.id, ...d.data() } as Curso);
      }
    }
    callback(cursos);
  });
}

/** Actualiza el estado del curso (solo delegado) */
export async function actualizarEstadoCurso(cursoId: string, estado: EstadoCurso): Promise<void> {
  await updateDoc(doc(db, 'cursos', cursoId), {
    estado,
    updatedAt: serverTimestamp(),
  });
}

// ─── Miembros ────────────────────────────────────────────────────────────────

/** Observa los miembros de un curso en tiempo real */
export function observarMiembros(
  cursoId: string,
  callback: (miembros: Miembro[]) => void
): () => void {
  return onSnapshot(collection(db, 'cursos', cursoId, 'miembros'), (snap) => {
    callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as Miembro)));
  });
}

/** Actualiza la talla de un miembro */
export async function actualizarTalla(cursoId: string, uid: string, talla: TallaPrenda): Promise<void> {
  await updateDoc(doc(db, 'cursos', cursoId, 'miembros', uid), { talla });
}

// ─── Variantes ───────────────────────────────────────────────────────────────

/** Guarda o actualiza una variante de diseño */
export async function guardarVariante(
  cursoId: string,
  variantId: string | null,
  canvasJSON: string,
  autorUid: string,
  autorNombre: string
): Promise<string> {
  if (variantId) {
    await updateDoc(doc(db, 'cursos', cursoId, 'variantes', variantId), {
      canvasJSON,
      updatedAt: serverTimestamp(),
    });
    return variantId;
  }

  const ref = await addDoc(collection(db, 'cursos', cursoId, 'variantes'), {
    canvasJSON,
    autor: autorNombre,
    autorUid,
    votos: [],
    timestamp: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Observa las variantes de un curso en tiempo real */
export function observarVariantes(
  cursoId: string,
  callback: (variantes: Variante[]) => void
): () => void {
  return onSnapshot(collection(db, 'cursos', cursoId, 'variantes'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Variante)));
  });
}

/** Obtiene variantes de un autor específico */
export async function obtenerVariantesDeAutor(cursoId: string, autorUid: string): Promise<Variante[]> {
  const q = query(
    collection(db, 'cursos', cursoId, 'variantes'),
    where('autorUid', '==', autorUid)
  );
  return new Promise((resolve) => {
    onSnapshot(q, (snap) => {
      resolve(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Variante)));
    });
  });
}

// ─── Votación ────────────────────────────────────────────────────────────────

/** Registra el voto de un usuario por una variante */
export async function votar(cursoId: string, variantId: string, uid: string): Promise<void> {
  // Primero, quitar voto de cualquier variante anterior
  const variantes = await new Promise<Variante[]>((resolve) => {
    onSnapshot(collection(db, 'cursos', cursoId, 'variantes'), (snap) => {
      resolve(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Variante)));
    });
  });

  for (const v of variantes) {
    if (v.votos.includes(uid) && v.id !== variantId) {
      await updateDoc(doc(db, 'cursos', cursoId, 'variantes', v.id), {
        votos: arrayRemove(uid),
      });
    }
  }

  // Agregar voto a la variante elegida
  await updateDoc(doc(db, 'cursos', cursoId, 'variantes', variantId), {
    votos: arrayUnion(uid),
  });
}

/** Cierra la votación y fija la variante ganadora */
export async function cerrarVotacion(cursoId: string, variantId: string): Promise<void> {
  await updateDoc(doc(db, 'cursos', cursoId), {
    estado: 'cerrado',
    updatedAt: serverTimestamp(),
  });

  const varianteSnap = await getDoc(doc(db, 'cursos', cursoId, 'variantes', variantId));
  if (!varianteSnap.exists()) throw new Error('Variante no encontrada');

  await setDoc(doc(db, 'cursos', cursoId, 'pedido', 'datos'), {
    varianteElegida: variantId,
    cantidades: { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 },
    tipotela: 'basica',
    bordado: false,
    estampado: false,
    precioUnitario: 0,
    precioTotal: 0,
    pagoStatus: 'pendiente',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ─── Pedido ──────────────────────────────────────────────────────────────────

/** Observa el pedido de un curso en tiempo real */
export function observarPedido(
  cursoId: string,
  callback: (pedido: Pedido | null) => void
): () => void {
  return onSnapshot(doc(db, 'cursos', cursoId, 'pedido', 'datos'), (snap) => {
    if (snap.exists()) {
      callback({ ...snap.data() } as Pedido);
    } else {
      callback(null);
    }
  });
}

/** Actualiza los datos del pedido */
export async function actualizarPedido(
  cursoId: string,
  datos: Partial<Pedido>
): Promise<void> {
  await updateDoc(doc(db, 'cursos', cursoId, 'pedido', 'datos'), {
    ...datos,
    updatedAt: serverTimestamp(),
  });
}

// ─── Mensajes (chat) ─────────────────────────────────────────────────────────

/** Envía un mensaje al chat del curso */
export async function enviarMensaje(
  cursoId: string,
  autorUid: string,
  autorNombre: string,
  autorRol: 'delegado' | 'taller',
  contenido: string
): Promise<void> {
  await addDoc(collection(db, 'cursos', cursoId, 'mensajes'), {
    autorUid,
    autorNombre,
    autorRol,
    contenido,
    timestamp: serverTimestamp(),
    leido: false,
  });
}

/** Observa mensajes de un curso en tiempo real */
export function observarMensajes(
  cursoId: string,
  callback: (mensajes: Mensaje[]) => void
): () => void {
  const q = query(collection(db, 'cursos', cursoId, 'mensajes'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Mensaje)));
  });
}
