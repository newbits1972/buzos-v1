import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BuzoEgresados — Diseñá el buzo de tu curso',
  description:
    'Plataforma colaborativa para que los cursos de secundaria argentina diseñen, voten y pidan su buzo de egresados. Simple, rápido y directo al taller.',
  keywords: 'buzo egresados, diseño colaborativo, secundaria, argentina',
  openGraph: {
    title: 'BuzoEgresados',
    description: 'Diseñá el buzo de tu curso con tu gente',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1B2B4B',
                color: '#F5F5F5',
                border: '1px solid #C0A060',
                borderRadius: '12px',
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
              },
              success: {
                iconTheme: {
                  primary: '#C0A060',
                  secondary: '#1B2B4B',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ff4b4b',
                  secondary: '#1B2B4B',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
