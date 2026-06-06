import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/pago/crear-preferencia
 * Llama a la Cloud Function de Firebase que crea la preferencia de MercadoPago.
 * La Cloud Function tiene acceso a MP_ACCESS_TOKEN de forma segura server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cursoId, uid } = body;

    if (!cursoId || !uid) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      );
    }

    // URL de la Cloud Function (se configura después del deploy)
    const funcionURL = process.env.CLOUD_FUNCTION_CREAR_PREFERENCIA_URL;

    if (!funcionURL) {
      // En desarrollo sin Cloud Functions, devolver URL de prueba
      console.warn('CLOUD_FUNCTION_CREAR_PREFERENCIA_URL no configurada');
      return NextResponse.json(
        {
          init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=DEMO',
          error: 'Cloud Function no configurada — modo demo',
        },
        { status: 200 }
      );
    }

    const response = await fetch(funcionURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cursoId, uid }),
    });

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error al crear preferencia de pago:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
