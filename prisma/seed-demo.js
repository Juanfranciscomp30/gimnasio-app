// Script de siembra para la BASE DE DATOS DEMO (portfolio).
//
// OJO: esto es solo para la base de datos del despliegue de demostración,
// NUNCA para correrlo contra una base de datos real/en uso. Antes de
// ejecutarlo comprueba que tu DATABASE_URL apunta al proyecto de Supabase
// del demo, no al de desarrollo.
//
// Uso:
//   npm run seed:demo
//
// Es idempotente en lo importante (usuarios por email con upsert); las
// clases/reservas/pagos/gastos se limpian y se vuelven a crear cada vez
// para que las fechas de las clases estén siempre "cerca de hoy".

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Credenciales de demo — se muestran también en el README para que
// cualquiera pueda entrar a curiosear sin registrarse.
const DEMO_ADMIN = { email: 'admin@demo.com', password: 'Demo1234' };
const DEMO_USER = { email: 'usuario@demo.com', password: 'Demo1234' };

const PRECIOS = { ONE_DAY: 25, TWO_DAYS: 40, THREE_DAYS: 55 };

// Máximo de días/clases por semana según la tarifa contratada — tiene que
// coincidir con la lógica real de la app (nunca reservar por encima de esto).
const LIMITE_SEMANAL = { ONE_DAY: 1, TWO_DAYS: 2, THREE_DAYS: 3 };

function aLasHoras(diasDesdeHoy, horas, minutos = 0) {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  fecha.setDate(fecha.getDate() + diasDesdeHoy);
  fecha.setHours(horas, minutos, 0, 0);
  return fecha;
}

function finDeMes(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59);
}

// Lunes (00:00) de la semana a la que pertenece una fecha — lo usamos como
// clave para agrupar las clases por semana.
function inicioSemana(fecha) {
  const d = new Date(fecha);
  const diaSemana = d.getDay(); // 0 domingo ... 6 sábado
  const diferencia = (diaSemana === 0 ? -6 : 1) - diaSemana;
  d.setDate(d.getDate() + diferencia);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function mezclar(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

async function main() {
  console.log('Sembrando base de datos de DEMO...');

  const passwordHashAdmin = await bcrypt.hash(DEMO_ADMIN.password, 10);
  const passwordHashUser = await bcrypt.hash(DEMO_USER.password, 10);

  // --- Usuarios ---------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { email: DEMO_ADMIN.email },
    update: { passwordHash: passwordHashAdmin, role: 'ADMIN', emailVerified: new Date() },
    create: {
      name: 'Admin Demo',
      email: DEMO_ADMIN.email,
      passwordHash: passwordHashAdmin,
      role: 'ADMIN',
      weeklyPlan: 'THREE_DAYS',
      emailVerified: new Date(),
    },
  });

  const usuarioPrincipal = await prisma.user.upsert({
    where: { email: DEMO_USER.email },
    update: { passwordHash: passwordHashUser, emailVerified: new Date() },
    create: {
      name: 'Usuario Demo',
      email: DEMO_USER.email,
      passwordHash: passwordHashUser,
      role: 'USER',
      weeklyPlan: 'TWO_DAYS',
      emailVerified: new Date(),
    },
  });

  const otrosDatos = [
    { name: 'Laura Gómez', email: 'laura.gomez@demo.com', weeklyPlan: 'THREE_DAYS' },
    { name: 'Carlos Ruiz', email: 'carlos.ruiz@demo.com', weeklyPlan: 'TWO_DAYS' },
    { name: 'Marta Sánchez', email: 'marta.sanchez@demo.com', weeklyPlan: 'ONE_DAY' },
    { name: 'David López', email: 'david.lopez@demo.com', weeklyPlan: 'THREE_DAYS' },
    { name: 'Ana Torres', email: 'ana.torres@demo.com', weeklyPlan: 'TWO_DAYS' },
  ];

  const otrosUsuarios = [];
  for (const datos of otrosDatos) {
    const u = await prisma.user.upsert({
      where: { email: datos.email },
      update: { weeklyPlan: datos.weeklyPlan },
      create: {
        name: datos.name,
        email: datos.email,
        weeklyPlan: datos.weeklyPlan,
        role: 'USER',
        createdByAdmin: true,
        passwordHash: null, // usuarios "de plantilla", sin acceso propio
        emailVerified: new Date(),
      },
    });
    otrosUsuarios.push(u);
  }

  const todosLosUsuarios = [usuarioPrincipal, ...otrosUsuarios];

  // --- Limpiar datos "de calendario" para regenerarlos frescos ----------
  await prisma.booking.deleteMany({});
  await prisma.classSession.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.notification.deleteMany({});

  // --- Clases: de lunes a viernes, dos horarios al día, próximas 3 semanas
  const clases = [];
  for (let dia = -3; dia <= 18; dia++) {
    const fechaBase = aLasHoras(dia, 0);
    const diaSemana = fechaBase.getDay(); // 0 domingo ... 6 sábado
    if (diaSemana === 0 || diaSemana === 6) continue; // solo entre semana

    for (const horas of [8, 18]) {
      const clase = await prisma.classSession.create({
        data: {
          date: aLasHoras(dia, horas),
          capacity: 4,
          cancelled: false,
        },
      });
      clases.push(clase);
    }
  }

  // --- Reservas: cada usuario reserva como máximo los días/semana que le
  // permite su tarifa (LIMITE_SEMANAL), nunca más. Agrupamos las clases
  // futuras por semana y, dentro de cada semana, por día (cada día tiene
  // sesión de mañana y de tarde) para poder elegir días distintos.
  const clasesFuturas = clases
    .filter((c) => c.date > new Date())
    .sort((a, b) => a.date - b.date);

  const semanas = new Map(); // inicioSemana -> Map(díaISO -> [clases del día])
  for (const clase of clasesFuturas) {
    const claveSemana = inicioSemana(clase.date);
    if (!semanas.has(claveSemana)) semanas.set(claveSemana, new Map());
    const porDia = semanas.get(claveSemana);
    const claveDia = new Date(clase.date).toDateString();
    if (!porDia.has(claveDia)) porDia.set(claveDia, []);
    porDia.get(claveDia).push(clase);
  }

  // Plazas ya ocupadas (CONFIRMED) por clase, para respetar el aforo (4).
  const ocupacionPorClase = new Map(clasesFuturas.map((c) => [c.id, 0]));

  let contadorReservas = 0;
  let contadorEspera = 0;

  for (const usuario of todosLosUsuarios) {
    const limite = LIMITE_SEMANAL[usuario.weeklyPlan] ?? 1;

    for (const [, clasesPorDia] of semanas) {
      const diasDisponibles = mezclar([...clasesPorDia.keys()]);
      // Nunca más días reservados que los que permite su tarifa esa semana.
      const diasAReservar = diasDisponibles.slice(0, limite);

      for (const dia of diasAReservar) {
        const opciones = clasesPorDia.get(dia); // [clase 8:00, clase 18:00]
        // La tarde suele llenarse antes que la mañana en un gimnasio real.
        const clase = Math.random() < 0.7 ? opciones[opciones.length - 1] : opciones[0];

        const ocupadas = ocupacionPorClase.get(clase.id);
        const estado = ocupadas < clase.capacity ? 'CONFIRMED' : 'WAITLISTED';

        await prisma.booking.create({
          data: { userId: usuario.id, classSessionId: clase.id, status: estado },
        });

        if (estado === 'CONFIRMED') {
          ocupacionPorClase.set(clase.id, ocupadas + 1);
          contadorReservas++;
        } else {
          contadorEspera++;
        }
      }
    }
  }

  // --- Pagos del mes actual para todos los usuarios con acceso ----------
  const ahora = new Date();
  for (const u of todosLosUsuarios) {
    await prisma.payment.create({
      data: {
        userId: u.id,
        weeklyPlan: u.weeklyPlan,
        amount: PRECIOS[u.weeklyPlan],
        paidAt: aLasHoras(-ahora.getDate() + 1, 10), // día 1 de este mes
        validUntil: finDeMes(ahora),
      },
    });
  }

  // --- Gastos del gimnasio ------------------------------------------------
  await prisma.expense.createMany({
    data: [
      { concept: 'Factura de luz', amount: 180.5, category: 'Suministros', date: aLasHoras(-10, 9) },
      { concept: 'Alquiler del local', amount: 650, category: 'Alquiler', date: aLasHoras(-8, 9) },
      { concept: 'Mantenimiento de máquinas', amount: 95, category: 'Material', date: aLasHoras(-4, 9) },
      { concept: 'Agua', amount: 45.2, category: 'Suministros', date: aLasHoras(-2, 9) },
    ],
  });

  // --- Un par de avisos in-app para el usuario demo ----------------------
  await prisma.notification.createMany({
    data: [
      { userId: usuarioPrincipal.id, message: 'Tu clase del viernes se ha movido a las 19:00.', read: false },
      { userId: usuarioPrincipal.id, message: '¡Bienvenido/a! Esto es una notificación de ejemplo.', read: true },
    ],
  });

  console.log(
    'Listo. Usuarios:', todosLosUsuarios.length + 1, '(+admin) — Clases:', clases.length,
    '— Reservas confirmadas:', contadorReservas, '— En lista de espera:', contadorEspera
  );
  console.log(`Admin demo -> ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}`);
  console.log(`Usuario demo -> ${DEMO_USER.email} / ${DEMO_USER.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
