import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let adminDb: ReturnType<typeof getFirestore> | null = null;

function obtenerFirestoreAdmin() {
  if (adminDb) return adminDb;

  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      // Inicialización de respaldo durante el build en Vercel si no se proveen variables del SDK Admin
      initializeApp({
        projectId: projectId || 'buzearia',
      });
    }
  }

  adminDb = getFirestore();
  return adminDb;
}

/**
 * POST /api/pago/webhook
 * Recibe notificaciones de MercadoPago cuando cambia el estado de un pago.
 * Verifica el pago y actualiza pagoStatus en Firestore.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    // Solo procesar notificaciones de pagos
    if (type !== 'payment') {
      return NextResponse.json({ received: true });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return NextResponse.json({ error: 'ID de pago inválido' }, { status: 400 });
    }

    // Consultar el estado del pago en MercadoPago
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    if (!mpResponse.ok) {
      console.error('Error al consultar pago en MP:', mpResponse.status);
      return NextResponse.json({ error: 'Error consultando MercadoPago' }, { status: 500 });
    }

    const pago = await mpResponse.json();
    const { status: estadoPago, metadata } = pago;
    const cursoId = metadata?.curso_id;

    if (!cursoId) {
      console.error('cursoId no encontrado en metadata del pago');
      return NextResponse.json({ received: true });
    }

    // Mapear estado de MP a nuestro sistema
    const estadoMap: Record<string, string> = {
      'approved': 'aprobado',
      'in_process': 'procesando',
      'rejected': 'rechazado',
      'pending': 'pendiente',
    };

    const nuevoEstado = estadoMap[estadoPago] || 'pendiente';

    // Actualizar en Firestore
    const dbAdmin = obtenerFirestoreAdmin();
    const pedidoRef = dbAdmin.doc(`cursos/${cursoId}/pedido/datos`);
    await pedidoRef.update({
      pagoStatus: nuevoEstado,
      pagoId: paymentId.toString(),
      updatedAt: new Date(),
    });

    console.log(`Pago ${paymentId} → curso ${cursoId} → estado: ${nuevoEstado}`);

    return NextResponse.json({ received: true, estado: nuevoEstado });
  } catch (error) {
    console.error('Error en webhook de MercadoPago:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// GET para verificación del webhook por MercadoPago
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'BuzoEgresados webhook' });
}
