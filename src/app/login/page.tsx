'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

const esquemaLogin = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

type FormLogin = z.infer<typeof esquemaLogin>;

export default function LoginPage() {
  const router = useRouter();
  const { login, usuario } = useAuth();
  const [cargando, setCargando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormLogin>({ resolver: zodResolver(esquemaLogin) });

  const onSubmit = async (data: FormLogin) => {
    setCargando(true);
    try {
      await login(data.email, data.password);
      toast.success('¡Bienvenido de vuelta!');
      // La redirección la maneja el useEffect del dashboard
      router.push('/dashboard');
    } catch (error: any) {
      const mensajes: Record<string, string> = {
        'auth/invalid-credential': 'Email o contraseña incorrectos',
        'auth/user-not-found': 'No existe una cuenta con ese email',
        'auth/wrong-password': 'Contraseña incorrecta',
        'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos.',
      };
      toast.error(mensajes[error.code] || 'Error al iniciar sesión');
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
          background:
            'radial-gradient(ellipse at top right, #C0A060 0%, transparent 60%), radial-gradient(ellipse at bottom left, #1B2B4B 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="text-3xl">🎓</span>
            <span className="text-xl font-bold text-gradient-gold">BuzoEgresados</span>
          </Link>
          <h1 className="text-2xl font-bold mb-2">Iniciar sesión</h1>
          <p style={{ color: 'var(--texto-secondary)' }}>
            Accedé a tu cuenta para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
          {/* Email */}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={`input ${errors.email ? 'input-error' : ''}`}
              placeholder="tu@email.com"
              autoComplete="email"
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
              placeholder="Tu contraseña"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && <p className="text-error">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="btn-primary w-full"
            id="btn-login"
          >
            {cargando ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Ingresando...
              </>
            ) : (
              'Ingresar'
            )}
          </button>

          <p className="text-center text-sm" style={{ color: 'var(--texto-muted)' }}>
            ¿No tenés cuenta?{' '}
            <Link href="/registro" className="font-semibold" style={{ color: 'var(--dorado)' }}>
              Registrate gratis
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
