'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import type { RolUsuario } from '@/types';

const esquemaRegistro = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmarPassword: z.string(),
  rol: z.enum(['alumno', 'delegado', 'taller'] as const),
}).refine((data) => data.password === data.confirmarPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmarPassword'],
});

type FormRegistro = z.infer<typeof esquemaRegistro>;

const ROLES: { value: RolUsuario; label: string; emoji: string; desc: string }[] = [
  {
    value: 'alumno',
    label: 'Alumno',
    emoji: '🎒',
    desc: 'Me uno con el código de mi curso y puedo proponer diseños',
  },
  {
    value: 'delegado',
    label: 'Delegado',
    emoji: '⭐',
    desc: 'Creo el curso, gestiono el proceso y apruebo el diseño final',
  },
  {
    value: 'taller',
    label: 'Taller de costura',
    emoji: '🏭',
    desc: 'Recibo pedidos de cursos y entrego los buzos',
  },
];

function FormularioRegistro() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { registrar } = useAuth();
  const [cargando, setCargando] = useState(false);

  const rolInicial = (searchParams.get('rol') as RolUsuario) || 'alumno';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormRegistro>({
    resolver: zodResolver(esquemaRegistro),
    defaultValues: { rol: rolInicial },
  });

  const rolSeleccionado = watch('rol');

  const onSubmit = async (data: FormRegistro) => {
    setCargando(true);
    try {
      await registrar(data.email, data.password, data.nombre, data.rol);
      toast.success(`¡Bienvenido/a, ${data.nombre}!`);

      // Redirigir según el rol
      if (data.rol === 'taller') {
        router.push('/taller/perfil?nuevo=true');
      } else {
        router.push('/dashboard?nuevo=true');
      }
    } catch (error: any) {
      const mensajes: Record<string, string> = {
        'auth/email-already-in-use': 'Ese email ya está registrado',
        'auth/weak-password': 'La contraseña es muy débil',
        'auth/invalid-email': 'Email inválido',
      };
      toast.error(mensajes[error.code] || 'Error al registrarse. Intentá de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      {/* Fondo decorativo */}
      <div
        className="fixed inset-0 opacity-20"
        style={{
          background: 'radial-gradient(ellipse at top left, #1B2B4B 0%, transparent 60%), radial-gradient(ellipse at bottom right, #C0A060 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div className="w-full max-w-lg relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="text-3xl">🎓</span>
            <span className="text-xl font-bold text-gradient-gold">BuzoEgresados</span>
          </Link>
          <h1 className="text-2xl font-bold mb-2">Crear cuenta</h1>
          <p style={{ color: 'var(--texto-secondary)' }}>
            Elegí tu rol y empezá gratis
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">

          {/* Selector de rol */}
          <div>
            <label className="label">Tipo de cuenta</label>
            <div className="grid grid-cols-1 gap-3">
              {ROLES.map((rol) => (
                <button
                  key={rol.value}
                  type="button"
                  onClick={() => setValue('rol', rol.value)}
                  className={`flex items-start gap-4 p-4 rounded-xl text-left transition-all duration-200 border ${
                    rolSeleccionado === rol.value
                      ? 'border-[#C0A060] bg-[rgba(192,160,96,0.1)]'
                      : 'border-[rgba(192,160,96,0.2)] hover:border-[rgba(192,160,96,0.4)]'
                  }`}
                >
                  <span className="text-2xl flex-shrink-0">{rol.emoji}</span>
                  <div>
                    <div className="font-semibold text-sm">{rol.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--texto-muted)' }}>
                      {rol.desc}
                    </div>
                  </div>
                  {rolSeleccionado === rol.value && (
                    <span className="ml-auto text-[#C0A060]">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="divider-gold" />

          {/* Nombre */}
          <div>
            <label className="label" htmlFor="nombre">Nombre completo</label>
            <input
              id="nombre"
              type="text"
              className={`input ${errors.nombre ? 'input-error' : ''}`}
              placeholder="Ej: María García"
              {...register('nombre')}
            />
            {errors.nombre && <p className="text-error">{errors.nombre.message}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={`input ${errors.email ? 'input-error' : ''}`}
              placeholder="tu@email.com"
              {...register('email')}
            />
            {errors.email && <p className="text-error">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              className={`input ${errors.password ? 'input-error' : ''}`}
              placeholder="Mínimo 6 caracteres"
              {...register('password')}
            />
            {errors.password && <p className="text-error">{errors.password.message}</p>}
          </div>

          {/* Confirmar password */}
          <div>
            <label className="label" htmlFor="confirmarPassword">Confirmar contraseña</label>
            <input
              id="confirmarPassword"
              type="password"
              className={`input ${errors.confirmarPassword ? 'input-error' : ''}`}
              placeholder="Repetí la contraseña"
              {...register('confirmarPassword')}
            />
            {errors.confirmarPassword && (
              <p className="text-error">{errors.confirmarPassword.message}</p>
            )}
          </div>

          {/* Botón */}
          <button
            type="submit"
            disabled={cargando}
            className="btn-primary w-full"
            id="btn-registrarse"
          >
            {cargando ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Creando cuenta...
              </>
            ) : (
              'Crear cuenta gratis'
            )}
          </button>

          <p className="text-center text-sm" style={{ color: 'var(--texto-muted)' }}>
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="font-semibold" style={{ color: 'var(--dorado)' }}>
              Iniciá sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <span className="w-8 h-8 border-[var(--dorado)] border-2 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <FormularioRegistro />
    </Suspense>
  );
}
