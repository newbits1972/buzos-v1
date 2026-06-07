'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, Image as FabricImage, IText, Shadow, filters } from 'fabric';
import toast from 'react-hot-toast';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { guardarVariante } from '@/lib/firestore';
import type { ColorTela, TipografiaEditor } from '@/types';

// Paleta de 12 colores de tela predefinidos
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
];

// Tipografías disponibles
const TIPOGRAFIAS: { id: TipografiaEditor; nombre: string; font: string; preview: string }[] = [
  { id: 'clasica', nombre: 'Clásica', font: 'Georgia, serif', preview: 'Abc' },
  { id: 'moderna', nombre: 'Moderna', font: 'Inter, sans-serif', preview: 'Abc' },
  { id: 'deportiva', nombre: 'Deportiva', font: '"Impact", "Arial Black", sans-serif', preview: 'Abc' },
];

interface EditorBuzoProps {
  cursoId: string;
  variantId: string | null;
  autorUid: string;
  autorNombre: string;
  canvasInicial?: string;
  cantidadVariantes: number;
  onGuardado?: (nuevoId: string) => void;
}

export default function EditorBuzo({
  cursoId,
  variantId,
  autorUid,
  autorNombre,
  canvasInicial,
  cantidadVariantes,
  onGuardado,
}: EditorBuzoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const variantIdRef = useRef<string | null>(variantId);
  const siluetaRef = useRef<FabricImage | null>(null);

  const [colorTela, setColorTela] = useState<ColorTela>('#1B2B4B');
  const [tipografia, setTipografia] = useState<TipografiaEditor>('clasica');
  const [textoCurso, setTextoCurso] = useState('');
  const [textoNumero, setTextoNumero] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  // Actualizar la silueta en el lienzo usando BlendColor
  const actualizarSilueta = useCallback((colorP: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (!siluetaRef.current) {
      FabricImage.fromURL('/buzo_base.png', { crossOrigin: 'anonymous' })
        .then((img) => {
          if (!fabricRef.current) return;

          img.set({
            selectable: false,
            evented: false,
            left: fabricRef.current.width! / 2,
            top: fabricRef.current.height! / 2,
            originX: 'center',
            originY: 'center',
            opacity: 0.98,
          });

          // @ts-expect-error: propiedad personalizada
          img.isSilueta = true;
          // @ts-expect-error: propiedad personalizada
          img.colorTela = colorP;

          const escala = Math.min(
            (fabricRef.current.width! * 0.95) / (img.width || 800),
            (fabricRef.current.height! * 0.95) / (img.height || 600)
          );
          img.scale(escala);

          img.filters = [new filters.BlendColor({ color: colorP, mode: 'multiply', alpha: 1 })];
          img.applyFilters();

          fabricRef.current.add(img);
          fabricRef.current.sendObjectToBack(img);
          siluetaRef.current = img;
          fabricRef.current.renderAll();
        })
        .catch((err) => {
          console.error('Error al cargar buzo_base.png:', err);
        });
    } else {
      const img = siluetaRef.current;
      // @ts-expect-error: propiedad personalizada
      img.colorTela = colorP;
      img.filters = [new filters.BlendColor({ color: colorP, mode: 'multiply', alpha: 1 })];
      img.applyFilters();
      canvas.renderAll();
    }
  }, []);

  // Inicializar Fabric.js y cargar estado
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: 600,
      height: 500,
      selection: true,
      backgroundColor: '#F8FAFC',
    });

    fabricRef.current = canvas;

    if (canvasInicial) {
      canvas.loadFromJSON(canvasInicial, () => {
        const objetos = canvas.getObjects();
        const silueta = objetos.find((obj: any) => obj.isSilueta || (obj.type === 'image' && !obj.selectable));
        
        if (silueta) {
          siluetaRef.current = silueta as FabricImage;
          // @ts-expect-error: propiedad personalizada
          silueta.isSilueta = true;
          
          if ((silueta as any).colorTela) {
            const colorGuardado = (silueta as any).colorTela;
            setColorTela(colorGuardado);
            (silueta as FabricImage).filters = [new filters.BlendColor({ color: colorGuardado, mode: 'multiply', alpha: 1 })];
            (silueta as FabricImage).applyFilters();
          }
        } else {
          // Si por alguna razón no hay silueta, la cargamos
          actualizarSilueta(colorTela);
        }
        canvas.set('backgroundColor', '#F8FAFC');
        canvas.renderAll();
      });
    } else {
      actualizarSilueta(colorTela);
    }

    return () => {
      canvas.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actualizar colores
  useEffect(() => {
    if (!fabricRef.current) return;
    actualizarSilueta(colorTela);
    triggerGuardadoAuto();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorTela, actualizarSilueta]);

  // Guardado automático con debounce de 2s
  const triggerGuardadoAuto = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!fabricRef.current) return;
      const json = JSON.stringify((fabricRef.current as any).toJSON(['isSilueta', 'colorTela']));
      try {
        const nuevoId = await guardarVariante(
          cursoId,
          variantIdRef.current,
          json,
          autorUid,
          autorNombre
        );
        variantIdRef.current = nuevoId;
        onGuardado?.(nuevoId);
      } catch {
        // Silencioso — no mostrar error por cada guardado automático
      }
    }, 2000);
  }, [cursoId, autorUid, autorNombre, onGuardado]);

  // Escuchar cambios en el canvas
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.on('object:modified', triggerGuardadoAuto);
    canvas.on('object:added', triggerGuardadoAuto);
    canvas.on('object:removed', triggerGuardadoAuto);

    return () => {
      canvas.off('object:modified', triggerGuardadoAuto);
      canvas.off('object:added', triggerGuardadoAuto);
      canvas.off('object:removed', triggerGuardadoAuto);
    };
  }, [triggerGuardadoAuto]);

  // Agregar texto del curso
  const agregarTextoCurso = () => {
    if (!fabricRef.current || !textoCurso) return;
    const font = TIPOGRAFIAS.find((t) => t.id === tipografia)?.font || 'Inter, sans-serif';

    const texto = new IText(textoCurso, {
      left: 300,
      top: 150,
      fontFamily: font,
      fontSize: 28,
      fill: '#FFFFFF',
      fontWeight: 'bold',
      originX: 'center',
      originY: 'center',
      shadow: new Shadow({
        color: 'rgba(0,0,0,0.5)',
        blur: 8,
        offsetX: 2,
        offsetY: 2,
      }),
    });

    fabricRef.current.add(texto);
    fabricRef.current.setActiveObject(texto);
    fabricRef.current.renderAll();
    triggerGuardadoAuto();
  };

  // Agregar número de egresado
  const agregarNumeroEgresado = () => {
    if (!fabricRef.current || !textoNumero) return;
    const font = TIPOGRAFIAS.find((t) => t.id === tipografia)?.font || 'Inter, sans-serif';

    const texto = new IText(`#${textoNumero}`, {
      left: 300,
      top: 300,
      fontFamily: font,
      fontSize: 36,
      fill: '#C0A060',
      fontWeight: 'bold',
      originX: 'center',
      originY: 'center',
      shadow: new Shadow({
        color: 'rgba(0,0,0,0.5)',
        blur: 8,
        offsetX: 2,
        offsetY: 2,
      }),
    });

    fabricRef.current.add(texto);
    fabricRef.current.setActiveObject(texto);
    fabricRef.current.renderAll();
    triggerGuardadoAuto();
  };

  // Upload de logo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (500KB)
    if (file.size > 500 * 1024) {
      toast.error('El logo no puede superar 500KB');
      return;
    }

    // Validar tipo
    if (!['image/png', 'image/svg+xml', 'image/jpeg'].includes(file.type)) {
      toast.error('Solo se permiten PNG, SVG o JPG');
      return;
    }

    setSubiendoLogo(true);
    try {
      // Subir a Firebase Storage
      const logoRef = storageRef(storage, `logos/${cursoId}/${autorUid}/${file.name}`);
      await uploadBytes(logoRef, file);
      const url = await getDownloadURL(logoRef);

      // Agregar al canvas
      FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
        .then((img) => {
          if (!fabricRef.current) return;
          img.scaleToWidth(120);
          img.set({
            left: 200,
            top: 200,
            originX: 'center',
            originY: 'center',
          });
          fabricRef.current.add(img);
          fabricRef.current.setActiveObject(img);
          fabricRef.current.renderAll();
          triggerGuardadoAuto();
        })
        .catch((err) => {
          toast.error('Error al cargar la imagen en el lienzo');
          console.error(err);
        });

      toast.success('Logo subido exitosamente');
    } catch {
      toast.error('Error al subir el logo');
    } finally {
      setSubiendoLogo(false);
    }
  };

  // Eliminar objeto seleccionado
  const eliminarSeleccionado = () => {
    if (!fabricRef.current) return;
    const activo = fabricRef.current.getActiveObject();
    if (activo) {
      fabricRef.current.remove(activo);
      fabricRef.current.renderAll();
      triggerGuardadoAuto();
    }
  };

  // Guardar manualmente
  const guardarManual = async () => {
    if (!fabricRef.current) return;

    // Verificar límite de variantes (máx 3 por alumno)
    if (!variantIdRef.current && cantidadVariantes >= 3) {
      toast.error('Podés guardar máximo 3 variantes propias');
      return;
    }

    setGuardando(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    try {
      const json = JSON.stringify((fabricRef.current as any).toJSON(['isSilueta', 'colorTela']));
      const nuevoId = await guardarVariante(
        cursoId,
        variantIdRef.current,
        json,
        autorUid,
        autorNombre
      );
      variantIdRef.current = nuevoId;
      onGuardado?.(nuevoId);
      toast.success('¡Variante guardada!');
    } catch {
      toast.error('Error al guardar la variante');
    } finally {
      setGuardando(false);
    }
  };

  const tipografiaActual = TIPOGRAFIAS.find((t) => t.id === tipografia)?.font || 'Inter, sans-serif';

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full">
      {/* ── Panel izquierdo: Herramientas ───────────────────── */}
      <div className="lg:w-72 space-y-5 flex-shrink-0">

        {/* Colores */}
        <div className="card">
          <h3 className="font-bold text-sm mb-3 uppercase tracking-wide" style={{ color: 'var(--texto-secondary)' }}>
            🎨 Color de la Prenda
          </h3>
          <div className="grid grid-cols-6 gap-2">
            {COLORES_TELA.map(({ color, nombre }) => (
              <button
                key={`p-${color}`}
                title={nombre}
                onClick={() => setColorTela(color)}
                className="w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110"
                style={{
                  backgroundColor: color,
                  borderColor: colorTela === color ? '#C0A060' : 'rgba(255,255,255,0.2)',
                  boxShadow: colorTela === color ? '0 0 0 3px rgba(192,160,96,0.4)' : 'none',
                }}
                id={`color-${color.replace('#', '')}`}
              />
            ))}
          </div>
        </div>

        {/* Tipografía */}
        <div className="card">
          <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--texto-secondary)' }}>
            🖋️ Tipografía
          </h3>
          <div className="space-y-2">
            {TIPOGRAFIAS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTipografia(t.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${
                  tipografia === t.id
                    ? 'border-[#C0A060] bg-[rgba(192,160,96,0.1)]'
                    : 'border-[rgba(192,160,96,0.2)]'
                }`}
                id={`tipografia-${t.id}`}
              >
                <span className="text-sm font-medium">{t.nombre}</span>
                <span style={{ fontFamily: t.font, fontSize: '18px' }}>{t.preview}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Textos */}
        <div className="card space-y-3">
          <h3 className="font-bold text-sm mb-1" style={{ color: 'var(--texto-secondary)' }}>
            ✏️ Agregar texto
          </h3>

          <div>
            <label className="label text-xs">Nombre del curso / año</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input text-sm flex-1"
                placeholder="Ej: Egresados 2025"
                value={textoCurso}
                onChange={(e) => setTextoCurso(e.target.value)}
                style={{ fontFamily: tipografiaActual }}
              />
              <button
                onClick={agregarTextoCurso}
                disabled={!textoCurso}
                className="btn-primary px-3 py-2 text-xs"
                title="Agregar al canvas"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="label text-xs">Número de egresado</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input text-sm flex-1"
                placeholder="Ej: 42"
                value={textoNumero}
                onChange={(e) => setTextoNumero(e.target.value)}
              />
              <button
                onClick={agregarNumeroEgresado}
                disabled={!textoNumero}
                className="btn-primary px-3 py-2 text-xs"
                title="Agregar número"
              >
                #
              </button>
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="card">
          <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--texto-secondary)' }}>
            🖼️ Logo
          </h3>
          <label
            className={`btn-secondary w-full cursor-pointer text-center ${subiendoLogo ? 'opacity-50' : ''}`}
            htmlFor="logo-upload"
          >
            {subiendoLogo ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block mr-2" />
                Subiendo...
              </>
            ) : (
              '📎 Subir logo (PNG/SVG, máx 500KB)'
            )}
          </label>
          <input
            id="logo-upload"
            type="file"
            accept=".png,.svg,.jpg,.jpeg"
            className="hidden"
            onChange={handleLogoUpload}
            disabled={subiendoLogo}
          />
        </div>

        {/* Acciones */}
        <div className="space-y-2">
          <button
            onClick={eliminarSeleccionado}
            className="btn-danger w-full text-sm"
            id="btn-eliminar-objeto"
          >
            🗑️ Eliminar seleccionado
          </button>
          <button
            onClick={guardarManual}
            disabled={guardando}
            className="btn-primary w-full"
            id="btn-guardar-variante"
          >
            {guardando ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              variantIdRef.current ? '💾 Guardar cambios' : '💾 Guardar nueva variante'
            )}
          </button>
          {!variantIdRef.current && (
            <p className="text-xs text-center" style={{ color: 'var(--texto-muted)' }}>
              {3 - cantidadVariantes} variante(s) disponible(s)
            </p>
          )}
        </div>
      </div>

      {/* ── Canvas ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center">
        <div className="canvas-container canvas-wrapper w-full max-w-[800px] overflow-hidden">
          <canvas ref={canvasRef} id="buzo-canvas" />
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--texto-muted)' }}>
          💡 Hacé clic en un elemento para seleccionarlo · Doble clic para editar texto
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--texto-muted)' }}>
          Guardado automático cada 2 segundos
        </p>
      </div>
    </div>
  );
}
