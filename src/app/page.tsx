import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BuzoEgresados — Diseñá el buzo de tu curso',
  description: 'Plataforma colaborativa para que los cursos de secundaria argentina diseñen, voten y pidan su buzo de egresados.',
};

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* ── Navbar ──────────────────────────────────────────────────── */}
      <nav className="glass fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎓</span>
          <span className="font-bold text-lg text-gradient-gold">BuzoEgresados</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-secondary text-sm px-4 py-2">
            Iniciar sesión
          </Link>
          <Link href="/registro" className="btn-primary text-sm px-4 py-2">
            Registrarse
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="flex-1 flex items-center justify-center px-6 pt-32 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
               style={{ background: 'rgba(192,160,96,0.1)', border: '1px solid rgba(192,160,96,0.3)' }}>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-semibold text-dorado" style={{ color: 'var(--dorado)' }}>
              Plataforma oficial de diseño colaborativo
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            Diseñen el buzo
            <br />
            <span className="text-gradient-gold">juntos, en serio</span>
          </h1>

          <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed"
             style={{ color: 'var(--texto-secondary)' }}>
            Editor visual, votación en tiempo real y pedido directo al taller.
            El buzo de egresados que siempre quisieron, sin drama.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/registro?rol=alumno" className="btn-primary text-base px-8 py-4">
              🎒 Soy alumno o delegado
            </Link>
            <Link href="/registro?rol=taller" className="btn-secondary text-base px-8 py-4">
              🏭 Soy un taller
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">¿Cómo funciona?</h2>
          <p className="text-center mb-12" style={{ color: 'var(--texto-secondary)' }}>
            De la idea al taller en 4 pasos simples
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                emoji: '✏️',
                paso: '01',
                titulo: 'Diseñan',
                desc: 'Cada alumno puede proponer hasta 3 variantes de diseño con el editor visual.',
              },
              {
                emoji: '🗳️',
                paso: '02',
                titulo: 'Votan',
                desc: 'El curso vota en tiempo real. Las barras de progreso se actualizan al instante.',
              },
              {
                emoji: '💳',
                paso: '03',
                titulo: 'Pagan',
                desc: 'El delegado paga la ficha técnica con MercadoPago. Único pago, para siempre.',
              },
              {
                emoji: '📦',
                paso: '04',
                titulo: 'Al taller',
                desc: 'El taller recibe el PDF con todo: tallas, colores, cantidades y diseño.',
              },
            ].map((f) => (
              <div key={f.paso} className="card animate-fade-in">
                <div className="text-4xl mb-4">{f.emoji}</div>
                <div className="text-xs font-bold mb-2" style={{ color: 'var(--dorado)' }}>
                  PASO {f.paso}
                </div>
                <h3 className="text-lg font-bold mb-2">{f.titulo}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--texto-secondary)' }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Precios ─────────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Precios transparentes</h2>
          <div className="divider-gold" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="card">
              <div className="text-4xl mb-4">🆓</div>
              <h3 className="text-xl font-bold mb-2">Gratis</h3>
              <ul className="text-sm space-y-2 text-left" style={{ color: 'var(--texto-secondary)' }}>
                <li>✅ Editor visual ilimitado</li>
                <li>✅ Hasta 3 variantes por alumno</li>
                <li>✅ Votación en tiempo real</li>
                <li>✅ Cotizador de precios</li>
              </ul>
            </div>
            <div className="card animate-pulse-gold" style={{ borderColor: 'var(--dorado)' }}>
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-xl font-bold mb-2">Ficha técnica</h3>
              <div className="text-3xl font-black mb-4 text-gradient-gold">$5.000</div>
              <ul className="text-sm space-y-2 text-left" style={{ color: 'var(--texto-secondary)' }}>
                <li>✅ PDF profesional al taller</li>
                <li>✅ Tabla de tallas completa</li>
                <li>✅ Render del diseño</li>
                <li>✅ Pago único por curso</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="px-6 py-8 text-center text-sm" style={{ color: 'var(--texto-muted)', borderTop: '1px solid var(--border)' }}>
        <p>© {new Date().getFullYear()} BuzoEgresados · Hecho con ❤️ para la secundaria argentina</p>
      </footer>
    </main>
  );
}
