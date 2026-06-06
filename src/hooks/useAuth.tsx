'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { RolUsuario, Usuario } from '@/types';

interface AuthContextType {
  user: User | null;
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  registrar: (
    email: string,
    password: string,
    nombre: string,
    rol: RolUsuario
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Obtener perfil extendido desde Firestore
        const usuarioRef = doc(db, 'usuarios', firebaseUser.uid);
        const snap = await getDoc(usuarioRef);
        if (snap.exists()) {
          setUsuario({ uid: firebaseUser.uid, ...snap.data() } as Usuario);
        }
      } else {
        setUsuario(null);
      }

      setCargando(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const registrar = async (
    email: string,
    password: string,
    nombre: string,
    rol: RolUsuario
  ) => {
    const credencial = await createUserWithEmailAndPassword(auth, email, password);
    const { user: newUser } = credencial;

    // Actualizar displayName en Firebase Auth
    await updateProfile(newUser, { displayName: nombre });

    // Crear perfil en Firestore
    await setDoc(doc(db, 'usuarios', newUser.uid), {
      email,
      nombre,
      rol,
      createdAt: serverTimestamp(),
    });

    // Si es taller, crear perfil inicial en /talleres
    if (rol === 'taller') {
      await setDoc(doc(db, 'talleres', newUser.uid), {
        nombre,
        email,
        configPrecios: {
          precioBaseXBuzo: 15000,
          recargoPremium: 20,
          precioEstampado: 2000,
          precioBordado: 3000,
        },
        suscripcionActiva: false,
        aprobado: false,
        createdAt: serverTimestamp(),
      });
    }

    setUsuario({ uid: newUser.uid, email, nombre, rol, createdAt: new Date() });
  };

  const logout = async () => {
    await signOut(auth);
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ user, usuario, cargando, login, registrar, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
