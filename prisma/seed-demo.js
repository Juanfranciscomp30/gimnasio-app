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

  // --- Reservas: repartimos usuarios en las clases de los próximos 10 días
  const clasesFuturas = clases.filter((c) => c.date > new Date());
  let contadorReservas = 0;

  for (let i = 0; i < clasesFuturas.length; i++) {
    const clase = clasesFuturas[i];
    // Ocupación variable: algunas casi vacías, alguna llena a tope.
    const ocupacion = i % 5 === 0 ? 4 : i % 3 === 0 ? 2 : 1;
    const participantes = todosLosUsuarios.slice(0, ocupacion);

    for (const participante of participantes) {
      await prisma.booking.create({
        data: {
          userId: participante.id,
          classSessionId: clase.id,
          status: 'CONFIRMED',
        },
      });
      contadorReservas++;
    }

    if (i === 2) {
      // Una clase llena + alguien en lista de espera, para enseñar esa función.
      await prisma.booking.create({
        data: {
          userId: otrosUsuarios[otrosUsuarios.length - 1].id,
          classSessionId: clase.id,
          status: 'WAITLISTED',
        },
      });
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

  console.log('Listo. Usuarios:', todosLosUsuarios.length + 1, '(+admin) — Clases:', clases.length, '— Reservas:', contadorReservas);
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
