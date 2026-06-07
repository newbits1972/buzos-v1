// ─── Tipos de usuario y autenticación ───────────────────────────────────────

export type RolUsuario = 'alumno' | 'delegado' | 'taller';

export interface Usuario {
  uid: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  createdAt: Date;
}

// ─── Tipos de Curso ──────────────────────────────────────────────────────────

export type EstadoCurso = 'diseñando' | 'votando' | 'cerrado' | 'produccion';

export interface Curso {
  id: string;
  nombre: string;
  escuela: string;
  anio: string; // Ej: "2025"
  delegadoUid: string;
  codigoAcceso: string;
  estado: EstadoCurso;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Miembro de un curso ─────────────────────────────────────────────────────

export type RolMiembro = 'alumno' | 'delegado';
export type TallaPrenda = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface Miembro {
  uid: string;
  nombre: string;
  email: string;
  rol: RolMiembro;
  talla: TallaPrenda | null;
  joinedAt: Date;
}

// ─── Variante de diseño ──────────────────────────────────────────────────────

export interface Variante {
  id: string;
  canvasJSON: string;         // JSON serializado de Fabric.js
  autor: string;              // nombre del autor
  autorUid: string;
  votos: string[];            // array de UIDs que votaron esta variante
  previewURL?: string;        // URL de Storage del PNG preview
  timestamp: Date;
  updatedAt: Date;
}

// ─── Pedido del curso ────────────────────────────────────────────────────────

export type EstadoPago = 'pendiente' | 'procesando' | 'aprobado' | 'rechazado';

export interface CantidadesTallas {
  XS: number;
  S: number;
  M: number;
  L: number;
  XL: number;
  XXL: number;
}

export interface Pedido {
  varianteElegida: string;    // variantId ganadora
  cantidades: CantidadesTallas;
  tipotela: 'basica' | 'premium';
  bordado: boolean;
  estampado: boolean;
  precioUnitario: number;     // en ARS
  precioTotal: number;        // en ARS
  pagoStatus: EstadoPago;
  pagoId?: string;            // ID de pago en MercadoPago
  fichaTecnicaURL?: string;   // URL pública del PDF en Storage
  tallerId?: string;          // Taller asignado
  createdAt: Date;
  updatedAt: Date;
}

// ─── Taller de costura ───────────────────────────────────────────────────────

export interface ConfigPrecios {
  precioBaseXBuzo: number;    // Precio base por buzo (ARS)
  recargoPremium: number;     // % recargo tela premium
  precioEstampado: number;    // ARS adicional por estampado
  precioBordado: number;      // ARS adicional por bordado
}

export interface Taller {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  direccion?: string;
  configPrecios: ConfigPrecios;
  suscripcionActiva: boolean;
  aprobado: boolean;          // Aprobación manual del administrador
  createdAt: Date;
}

// ─── Pedido en el taller ─────────────────────────────────────────────────────

export type EstadoPedidoTaller = 'nuevo' | 'en_produccion' | 'entregado';

export interface PedidoTaller {
  id: string;
  cursoId: string;
  cursoNombre: string;
  escuela: string;
  delegadoUid: string;
  delegadoNombre: string;
  fichaTecnicaURL: string;
  cantidadTotal: number;
  estado: EstadoPedidoTaller;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mensaje de chat ─────────────────────────────────────────────────────────

export interface Mensaje {
  id: string;
  autorUid: string;
  autorNombre: string;
  autorRol: 'delegado' | 'taller';
  contenido: string;
  timestamp: Date;
}

// ─── Cotizador ───────────────────────────────────────────────────────────────

export interface InputsCotizador {
  cantidad: number;
  tipotela: 'basica' | 'premium';
  bordado: boolean;
  estampado: boolean;
}

export interface ResultadoCotizador {
  precioUnitario: number;
  precioTotal: number;
  desglose: {
    base: number;
    recargoPremium: number;
    estampado: number;
    bordado: number;
  };
}

// ─── Canvas / Editor ─────────────────────────────────────────────────────────

export type ColorTela =
  | '#1B2B4B'   // azul marino
  | '#0D3D56'   // azul petróleo
  | '#2D4A22'   // verde oscuro
  | '#4A1942'   // bordó
  | '#2C2C2C'   // negro carbón
  | '#5C3317'   // marrón
  | '#8B0000'   // rojo oscuro
  | '#1A1A4A'   // azul noche
  | '#3D3D3D'   // gris antracita
  | '#F5F5F5'   // blanco hueso
  | '#C0A060'   // dorado
  | '#6B8CAE'   // azul claro
  | '#A8C0D0'   // celeste
  | '#D4A5A5'   // rosa viejo
  | '#E8E0C8'   // crema
  | '#6E8B74';  // verde salvia

export type TipografiaEditor = 'clasica' | 'moderna' | 'deportiva';

export interface ConfiguracionEditor {
  colorTela: ColorTela;
  textoCurso: string;
  anioEgresados: string;
  numeroEgresado: string;
  tipografia: TipografiaEditor;
  logoURL?: string;
}

// ─── Notificaciones en-app ──────────────────────────────────────────────────

export type TipoNotificacion = 'estado_curso' | 'votacion' | 'pago' | 'pdf_listo';

export interface Notificacion {
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  timestamp: Date;
  leida: boolean;
}
