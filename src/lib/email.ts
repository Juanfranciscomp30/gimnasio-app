import { Resend } from 'resend';

// El cliente se crea "perezosamente" (no en cuanto se importa el módulo,
// sino la primera vez que hace falta enviar un correo). Si se creara arriba
// del todo, un RESEND_API_KEY vacío o mal puesto en el .env tira todo el
// endpoint con un 500 en crudo (le pasa a cualquiera que no haya rellenado
// esa variable todavía) en vez de un error controlado que el registro pueda
// atrapar y convertir en un mensaje legible.
let resend: Resend | null = null;

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      'Falta RESEND_API_KEY en el .env — crea una cuenta en resend.com, saca tu API key y pégala ahí (luego reinicia el servidor de desarrollo).'
    );
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Remitente que ve el usuario. Con el dominio de pruebas de Resend
// (onboarding@resend.dev) funciona sin verificar nada, pero solo entrega a
// tu propia cuenta de Resend — para que llegue a cualquier persona real hay
// que verificar un dominio propio en Resend y cambiar esta variable.
const FROM = process.env.RESEND_FROM_EMAIL || 'Gimnasio App <onboarding@resend.dev>';

function urlVerificacion(token: string) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${base}/api/auth/verify?token=${token}`;
}

// Envía el email con el enlace para confirmar la cuenta recién creada.
// Lanza si Resend devuelve error, para que quien la llame decida qué hacer
// (en el registro, si esto falla, no queremos dejar una cuenta "colgada"
// que nunca podrá confirmarse).
export async function enviarEmailVerificacion(email: string, name: string, token: string) {
  const enlace = urlVerificacion(token);
  const cliente = getResendClient();

  const { error } = await cliente.emails.send({
    from: FROM,
    to: email,
    subject: 'Confirma tu cuenta — Gimnasio App',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111;">¡Hola, ${name}!</h2>
        <p style="color: #333; line-height: 1.5;">
          Gracias por registrarte. Confirma tu cuenta haciendo clic en el
          siguiente botón para poder empezar a reservar tus clases:
        </p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${enlace}"
             style="background: #16a34a; color: #fff; text-decoration: none;
                    padding: 12px 24px; border-radius: 10px; font-weight: bold;
                    display: inline-block;">
            Confirmar mi cuenta
          </a>
        </p>
        <p style="color: #666; font-size: 13px; line-height: 1.5;">
          Este enlace caduca en 24 horas. Si no has sido tú quien se ha
          registrado, puedes ignorar este correo.
        </p>
        <p style="color: #999; font-size: 12px;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
          ${enlace}
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('Error enviando email de verificación:', error);
    throw new Error(`No se pudo enviar el email de confirmación: ${error.message || JSON.stringify(error)}`);
  }
}
