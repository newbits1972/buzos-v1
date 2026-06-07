'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, Image as FabricImage, IText, Shadow } from 'fabric';
import toast from 'react-hot-toast';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { guardarVariante } from '@/lib/firestore';
import type { ColorTela, TipografiaEditor } from '@/types';

// ── Tipos de zonas ────────────────────────────────────────
type ZonaBuzo = 'cuerpo' | 'mangas' | 'capucha' | 'capucha-int' | 'elasticos';

interface ColoresZona {
  cuerpo: string;
  mangas: string;
  capucha: string;
  'capucha-int': string;
  elasticos: string;
}

// IDs de elementos SVG que pertenecen a cada zona
const ZONA_IDS: Record<ZonaBuzo, string[]> = {
  cuerpo:        ['zona-cuerpo', 'zona-bolsillo'],
  mangas:        ['zona-manga-izq', 'zona-manga-der'],
  capucha:       ['zona-capucha-ext'],
  'capucha-int': ['zona-capucha-int'],
  elasticos:     ['zona-elastico-inf', 'zona-puño-izq', 'zona-puño-der'],
};

const ZONAS_CONFIG: { id: ZonaBuzo; label: string; emoji: string; desc: string }[] = [
  { id: 'cuerpo',       label: 'Cuerpo',    emoji: '👕', desc: 'Torso y bolsillo' },
  { id: 'mangas',       label: 'Mangas',    emoji: '💪', desc: 'Mangas izq. y der.' },
  { id: 'capucha',      label: 'Capucha',   emoji: '🎩', desc: 'Exterior de capucha' },
  { id: 'capucha-int',  label: 'Interior',  emoji: '🔳', desc: 'Forro de la capucha' },
  { id: 'elasticos',    label: 'Elásticos', emoji: '〰️', desc: 'Cintura y puños' },
];

// ── Paleta de colores ─────────────────────────────────────
const COLORES_TELA: { color: ColorTela; nombre: string }[] = [
  { color: '#1B2B4B', nombre: 'Azul marino' },
  { color: '#0D3D56', nombre: 'Azul petróleo' },
  { color: '#2D4A22', nombre: 'Verde oscuro' },
  { color: '#4A1942', nombre: 'Bordó' },
  { color: '#2C2C2C', nombre: 'Negro carbón' },
  { color: '#5C3317', nombre: 'Marrón' },
  { color: '#8B0000', nombre: 'Rojo oscuro' },
  { color: '#1A1A4A', nombre: 'Azul noche' },
  { color: '#3D3D3D', nombre: 'Gris antracita' },
  { color: '#F5F5F5', nombre: 'Blanco hueso' },
  { color: '#C0A060', nombre: 'Dorado' },
  { color: '#6B8CAE', nombre: 'Azul claro' },
  { color: '#A8C0D0', nombre: 'Celeste' },
  { color: '#D4A5A5', nombre: 'Rosa viejo' },
  { color: '#E8E0C8', nombre: 'Crema' },
  { color: '#6E8B74', nombre: 'Verde salvia' },
];

const TIPOGRAFIAS: { id: TipografiaEditor; nombre: string; font: string; preview: string }[] = [
  { id: 'clasica',   nombre: 'Clásica',   font: 'Georgia, serif',                           preview: 'Abc' },
  { id: 'moderna',   nombre: 'Moderna',   font: 'Inter, sans-serif',                        preview: 'Abc' },
  { id: 'deportiva', nombre: 'Deportiva', font: '"Impact", "Arial Black", sans-serif',      preview: 'Abc' },
];

const DEFAULT_COLORES: ColoresZona = {
  cuerpo:       '#1B2B4B',
  mangas:       '#1B2B4B',
  capucha:      '#1B2B4B',
  'capucha-int':'#F5F5F5',
  elasticos:    '#2C2C2C',
};

// ── Utilidades de color ───────────────────────────────────
function darkenHex(hex: string, amount = 30): string {
  const c = hex.replace('#', '');
  const r = Math.max(0, parseInt(c.substring(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(c.substring(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(c.substring(4, 6), 16) - amount);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ── Aplicar colores a SVG via DOMParser ───────────────────
function aplicarColoresAlSVG(svgText: string, colores: ColoresZona): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');

  Object.entries(ZONA_IDS).forEach(([zona, ids]) => {
    const color = colores[zona as ZonaBuzo];
    ids.forEach((id) => {
      const el = doc.getElementById(id);
      if (el) el.setAttribute('fill', color);
    });
  });

  return new XMLSerializer().serializeToString(doc);
}

// ── Props ─────────────────────────────────────────────────
interface EditorBuzoProps {
  cursoId: string;
  variantId: string | null;
  autorUid: string;
  autorNombre: string;
  canvasInicial?: string;
  cantidadVariantes: number;
  onGuardado?: (nuevoId: string) => void;
}

// ═══════════════════════════════════════════════════════════
export default function EditorBuzo({
  cursoId,
  variantId,
  autorUid,
  autorNombre,
  canvasInicial,
  cantidadVariantes,
  onGuardado,
}: EditorBuzoProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const fabricRef    = useRef<Canvas | null>(null);
  const debounceRef  = useRef<NodeJS.Timeout | null>(null);
  const variantIdRef = useRef<string | null>(variantId);
  const siluetaRef   = useRef<FabricImage | null>(null);
  const svgTemplateRef = useRef<string>('');

  const [zonaActiva, setZonaActiva]   = useState<ZonaBuzo>('cuerpo');
  const [coloresZona, setColoresZona] = useState<ColoresZona>(DEFAULT_COLORES);
  const [tipografia, setTipografia]   = useState<TipografiaEditor>('clasica');
  const [textoCurso, setTextoCurso]   = useState('');
  const [textoNumero, setTextoNumero] = useState('');
  const [guardando, setGuardando]     = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [cargando, setCargando]       = useState(false);

  // ── Renderizar SVG con los colores en Fabric.js ──────────
  const renderizarSilueta = useCallback((colores: ColoresZona) => {
    const canvas = fabricRef.current;
    if (!canvas || !svgTemplateRef.current) return;

    setCargando(true);
    const svgModificado = aplicarColoresAlSVG(svgTemplateRef.current, colores);
    const blob = new Blob([svgModificado], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);

    FabricImage.fromURL(url)
      .then((img) => {
        if (!fabricRef.current) return;

        // Remover silueta anterior
        if (siluetaRef.current) {
          fabricRef.current.remove(siluetaRef.current);
        }

        const escala = Math.min(
          (fabricRef.current.width!  * 0.88) / (img.width  || 400),
          (fabricRef.current.height! * 0.92) / (img.height || 500)
        );

        img.set({
          selectable: false,
          evented:    false,
          left:       fabricRef.current.width!  / 2,
          top:        fabricRef.current.height! / 2,
          originX:    'center',
          originY:    'center',
          opacity:    1,
        });
        img.scale(escala);

        // Guardar metadatos como propiedades personalizadas
        // @ts-expect-error: propiedad personalizada de persistencia
        img.isSilueta = true;
        // @ts-expect-error: propiedad personalizada de persistencia
        img.coloresZona = JSON.stringify(colores);

        fabricRef.current.add(img);
        fabricRef.current.sendObjectToBack(img);
        siluetaRef.current = img;
        fabricRef.current.renderAll();
        URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error('Error al renderizar silueta SVG:', err);
      })
      .finally(() => setCargando(false));
  }, []);

  // ── Inicializar Fabric.js ─────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width:           620,
      height:          580,
      selection:       true,
      backgroundColor: '#F0F4F8',
    });
    fabricRef.current = canvas;

    if (canvasInicial) {
      canvas.loadFromJSON(canvasInicial, () => {
        const objs    = canvas.getObjects();
        const silueta = objs.find((o: any) => o.isSilueta);

        if (silueta) {
          siluetaRef.current = silueta as FabricImage;
          const coloresGuardados = (silueta as any).coloresZona;
          if (coloresGuardados) {
            try {
              const c = JSON.parse(coloresGuardados) as ColoresZona;
              setColoresZona(c);
            } catch { /* ignorar */ }
          }
        } else {
          // Sin silueta guardada — cargar la plantilla fresca
          fetch('/plantillas/hoodie-zonas.svg')
            .then((r) => r.text())
            .then((text) => { svgTemplateRef.current = text; renderizarSilueta(coloresZona); })
            .catch(console.error);
        }
        canvas.set('backgroundColor', '#F0F4F8');
        canvas.renderAll();
      });
    } else {
      fetch('/plantillas/hoodie-zonas.svg')
        .then((r) => r.text())
        .then((text) => { svgTemplateRef.current = text; renderizarSilueta(DEFAULT_COLORES); })
        .catch(console.error);
    }

    return () => { canvas.dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reaccionar a cambios de color ─────────────────────────
  useEffect(() => {
    if (!fabricRef.current || !svgTemplateRef.current) return;
    renderizarSilueta(coloresZona);
    triggerGuardadoAuto();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coloresZona]);

  // ── Cambiar color de la zona activa ───────────────────────
  const cambiarColorZona = (color: string) => {
    setColoresZona((prev) => ({ ...prev, [zonaActiva]: color }));
  };

  // ── Presets ───────────────────────────────────────────────
  const aplicarMonocolor = () => {
    const base = coloresZona.cuerpo;
    setColoresZona({
      cuerpo:       base,
      mangas:       base,
      capucha:      base,
      'capucha-int':darkenHex(base, -40 < 0 ? 0 : 40),
      elasticos:    darkenHex(base, 40),
    });
  };

  const aplicarBicolor = () => {
    const c1 = coloresZona.cuerpo;
    const c2 = coloresZona.mangas;
    setColoresZona({
      cuerpo:       c1,
      mangas:       c2,
      capucha:      c1,
      'capucha-int':c2,
      elasticos:    darkenHex(c1, 30),
    });
  };

  // ── Guardado automático ───────────────────────────────────
  const triggerGuardadoAuto = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!fabricRef.current) return;
      const json = JSON.stringify(
        (fabricRef.current as any).toJSON(['isSilueta', 'coloresZona'])
      );
      try {
        const id = await guardarVariante(cursoId, variantIdRef.current, json, autorUid, autorNombre);
        variantIdRef.current = id;
        onGuardado?.(id);
      } catch { /* silencioso */ }
    }, 2000);
  }, [cursoId, autorUid, autorNombre, onGuardado]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.on('object:modified', triggerGuardadoAuto);
    canvas.on('object:added',    triggerGuardadoAuto);
    canvas.on('object:removed',  triggerGuardadoAuto);
    return () => {
      canvas.off('object:modified', triggerGuardadoAuto);
      canvas.off('object:added',    triggerGuardadoAuto);
      canvas.off('object:removed',  triggerGuardadoAuto);
    };
  }, [triggerGuardadoAuto]);

  // ── Agregar texto ─────────────────────────────────────────
  const agregarTextoCurso = () => {
    if (!fabricRef.current || !textoCurso) return;
    const font = TIPOGRAFIAS.find((t) => t.id === tipografia)?.font ?? 'Inter, sans-serif';
    const t = new IText(textoCurso, {
      left: 310, top: 180, fontFamily: font, fontSize: 24,
      fill: '#FFFFFF', fontWeight: 'bold', originX: 'center', originY: 'center',
      shadow: new Shadow({ color: 'rgba(0,0,0,0.6)', blur: 8, offsetX: 2, offsetY: 2 }),
    });
    fabricRef.current.add(t);
    fabricRef.current.setActiveObject(t);
    fabricRef.current.renderAll();
    triggerGuardadoAuto();
  };

  const agregarNumeroEgresado = () => {
    if (!fabricRef.current || !textoNumero) return;
    const font = TIPOGRAFIAS.find((t) => t.id === tipografia)?.font ?? 'Inter, sans-serif';
    const t = new IText(`#${textoNumero}`, {
      left: 310, top: 320, fontFamily: font, fontSize: 34,
      fill: '#C0A060', fontWeight: 'bold', originX: 'center', originY: 'center',
      shadow: new Shadow({ color: 'rgba(0,0,0,0.5)', blur: 8, offsetX: 2, offsetY: 2 }),
    });
    fabricRef.current.add(t);
    fabricRef.current.setActiveObject(t);
    fabricRef.current.renderAll();
    triggerGuardadoAuto();
  };

  // ── Upload de logo ────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024)  { toast.error('El logo no puede superar 500KB'); return; }
    if (!['image/png','image/svg+xml','image/jpeg'].includes(file.type)) {
      toast.error('Solo se permiten PNG, SVG o JPG'); return;
    }
    setSubiendoLogo(true);
    try {
      const logoRef = storageRef(storage, `logos/${cursoId}/${autorUid}/${file.name}`);
      await uploadBytes(logoRef, file);
      const url = await getDownloadURL(logoRef);
      FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
        .then((img) => {
          if (!fabricRef.current) return;
          img.scaleToWidth(110);
          img.set({ left: 310, top: 230, originX: 'center', originY: 'center' });
          fabricRef.current.add(img);
          fabricRef.current.setActiveObject(img);
          fabricRef.current.renderAll();
          triggerGuardadoAuto();
        })
        .catch(() => toast.error('Error al cargar la imagen en el lienzo'));
      toast.success('Logo subido exitosamente');
    } catch { toast.error('Error al subir el logo'); }
    finally  { setSubiendoLogo(false); }
  };

  const eliminarSeleccionado = () => {
    if (!fabricRef.current) return;
    const activo = fabricRef.current.getActiveObject();
    if (activo && !(activo as any).isSilueta) {
      fabricRef.current.remove(activo);
      fabricRef.current.renderAll();
      triggerGuardadoAuto();
    }
  };

  const guardarManual = async () => {
    if (!fabricRef.current) return;
    if (!variantIdRef.current && cantidadVariantes >= 3) {
      toast.error('Podés guardar máximo 3 variantes propias'); return;
    }
    setGuardando(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try {
      const json = JSON.stringify((fabricRef.current as any).toJSON(['isSilueta', 'coloresZona']));
      const id = await guardarVariante(cursoId, variantIdRef.current, json, autorUid, autorNombre);
      variantIdRef.current = id;
      onGuardado?.(id);
      toast.success('¡Variante guardada!');
    } catch { toast.error('Error al guardar la variante'); }
    finally { setGuardando(false); }
  };

  const tipografiaActual = TIPOGRAFIAS.find((t) => t.id === tipografia)?.font ?? 'Inter, sans-serif';

  // ── JSX ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col xl:flex-row gap-6 w-full">

      {/* ═══ PANEL IZQUIERDO ═══════════════════════════════ */}
      <div className="xl:w-76 w-full space-y-4 flex-shrink-0" style={{ maxWidth: '300px' }}>

        {/* ── Selector de Zonas ── */}
        <div className="card">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-3"
              style={{ color: 'var(--texto-secondary)' }}>
            🎨 Zonas de color
          </h3>
          <div className="space-y-1.5">
            {ZONAS_CONFIG.map((z) => (
              <button
                key={z.id}
                onClick={() => setZonaActiva(z.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 transition-all duration-200 text-left ${
                  zonaActiva === z.id
                    ? 'border-[#C0A060] bg-[rgba(192,160,96,0.08)]'
                    : 'border-transparent hover:border-[rgba(192,160,96,0.3)]'
                }`}
                id={`zona-btn-${z.id}`}
              >
                {/* Swatch del color actual de esta zona */}
                <span
                  className="w-6 h-6 rounded-full border-2 flex-shrink-0 shadow-sm"
                  style={{
                    backgroundColor: coloresZona[z.id],
                    borderColor: zonaActiva === z.id ? '#C0A060' : 'rgba(0,0,0,0.15)',
                  }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-none">
                    {z.emoji} {z.label}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--texto-muted)' }}>
                    {z.desc}
                  </p>
                </div>
                {zonaActiva === z.id && (
                  <span className="ml-auto text-[#C0A060] text-xs font-bold">●</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Paleta de colores ── */}
        <div className="card">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-1"
              style={{ color: 'var(--texto-secondary)' }}>
            Color de: <span className="text-[#C0A060]">
              {ZONAS_CONFIG.find(z => z.id === zonaActiva)?.label}
            </span>
          </h3>
          <div className="grid grid-cols-8 gap-1.5 mt-3">
            {COLORES_TELA.map(({ color, nombre }) => (
              <button
                key={color}
                title={nombre}
                onClick={() => cambiarColorZona(color)}
                className="w-7 h-7 rounded-full border-2 transition-all duration-200 hover:scale-125 hover:shadow-lg"
                style={{
                  backgroundColor: color,
                  borderColor:
                    coloresZona[zonaActiva] === color ? '#C0A060' : 'rgba(255,255,255,0.2)',
                  boxShadow:
                    coloresZona[zonaActiva] === color
                      ? '0 0 0 3px rgba(192,160,96,0.45)'
                      : 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                }}
                id={`color-zona-${color.replace('#', '')}`}
              />
            ))}
          </div>
        </div>

        {/* ── Presets de combinación ── */}
        <div className="card">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-3"
              style={{ color: 'var(--texto-secondary)' }}>
            ✨ Combinaciones rápidas
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={aplicarMonocolor}
              className="py-2 px-2 rounded-lg border text-xs font-semibold transition-all hover:border-[#C0A060] hover:bg-[rgba(192,160,96,0.08)]"
              style={{ borderColor: 'rgba(192,160,96,0.3)' }}
            >
              🎨 Monocolor
            </button>
            <button
              onClick={aplicarBicolor}
              className="py-2 px-2 rounded-lg border text-xs font-semibold transition-all hover:border-[#C0A060] hover:bg-[rgba(192,160,96,0.08)]"
              style={{ borderColor: 'rgba(192,160,96,0.3)' }}
            >
              🎭 Bicolor
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--texto-muted)' }}>
            Bicolor usa el color del Cuerpo y las Mangas.
          </p>
        </div>

        {/* ── Tipografía ── */}
        <div className="card">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-2"
              style={{ color: 'var(--texto-secondary)' }}>
            🖋️ Tipografía
          </h3>
          <div className="space-y-1.5">
            {TIPOGRAFIAS.map((t) => (
              <button key={t.id} onClick={() => setTipografia(t.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${
                  tipografia === t.id
                    ? 'border-[#C0A060] bg-[rgba(192,160,96,0.1)]'
                    : 'border-[rgba(192,160,96,0.2)]'
                }`}
                id={`tip-${t.id}`}
              >
                <span className="text-xs font-medium">{t.nombre}</span>
                <span style={{ fontFamily: t.font, fontSize: '17px' }}>{t.preview}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Textos ── */}
        <div className="card space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-1"
              style={{ color: 'var(--texto-secondary)' }}>
            ✏️ Agregar texto
          </h3>
          <div>
            <label className="label text-xs">Nombre / año del curso</label>
            <div className="flex gap-1.5">
              <input type="text" className="input text-sm flex-1"
                placeholder="Egresados 2025" value={textoCurso}
                onChange={(e) => setTextoCurso(e.target.value)}
                style={{ fontFamily: tipografiaActual }}/>
              <button onClick={agregarTextoCurso} disabled={!textoCurso}
                className="btn-primary px-3 py-2 text-xs" title="Agregar al canvas">+</button>
            </div>
          </div>
          <div>
            <label className="label text-xs">Número de egresado</label>
            <div className="flex gap-1.5">
              <input type="text" className="input text-sm flex-1"
                placeholder="42" value={textoNumero}
                onChange={(e) => setTextoNumero(e.target.value)}/>
              <button onClick={agregarNumeroEgresado} disabled={!textoNumero}
                className="btn-primary px-3 py-2 text-xs" title="Agregar número">#</button>
            </div>
          </div>
        </div>

        {/* ── Logo ── */}
        <div className="card">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-3"
              style={{ color: 'var(--texto-secondary)' }}>
            🖼️ Logo del curso
          </h3>
          <label className={`btn-secondary w-full cursor-pointer text-center text-xs ${subiendoLogo ? 'opacity-50' : ''}`}
            htmlFor="logo-upload">
            {subiendoLogo
              ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block mr-2"/>Subiendo...</>
              : '📎 Subir logo (PNG/SVG, máx 500KB)'}
          </label>
          <input id="logo-upload" type="file" accept=".png,.svg,.jpg,.jpeg"
            className="hidden" onChange={handleLogoUpload} disabled={subiendoLogo}/>
        </div>

        {/* ── Acciones ── */}
        <div className="space-y-2">
          <button onClick={eliminarSeleccionado} className="btn-danger w-full text-sm"
            id="btn-eliminar-objeto">
            🗑️ Eliminar seleccionado
          </button>
          <button onClick={guardarManual} disabled={guardando}
            className="btn-primary w-full" id="btn-guardar-variante">
            {guardando
              ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>Guardando...</>
              : variantIdRef.current ? '💾 Guardar cambios' : '💾 Guardar nueva variante'}
          </button>
          {!variantIdRef.current && (
            <p className="text-xs text-center" style={{ color: 'var(--texto-muted)' }}>
              {3 - cantidadVariantes} variante(s) disponible(s)
            </p>
          )}
        </div>
      </div>

      {/* ═══ CANVAS ════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center">
        <div className="relative">
          {cargando && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/30 rounded-xl">
              <span className="w-8 h-8 border-4 border-[#C0A060] border-t-transparent rounded-full animate-spin"/>
            </div>
          )}
          <div className="canvas-container canvas-wrapper rounded-xl overflow-hidden shadow-xl">
            <canvas ref={canvasRef} id="buzo-canvas"/>
          </div>
        </div>
        <div className="flex gap-6 mt-3 text-xs" style={{ color: 'var(--texto-muted)' }}>
          <span>💡 Clic para seleccionar · doble clic para editar texto</span>
          <span>💾 Guardado automático activo</span>
        </div>
      </div>
    </div>
  );
}
