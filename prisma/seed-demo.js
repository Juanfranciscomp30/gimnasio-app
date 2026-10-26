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
//
// Historias pensadas para lucir el asistente IA en /admin/ia:
//   - Carlos: venía 2 días/semana y lleva 2 semanas sin aparecer
//   - Marta: cuota vencida hace unos días
//   - David: dos cancelaciones tardías en el último mes
//   - Ana: la cuota le vence en 3 días
//   - Laura y el usuario demo: socios constantes (sin avisos)
// Y el usuario demo trae perfil fitness + planes de IA de ejemplo, para que
// se vea contenido nada más entrar sin gastar llamadas a la API.

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

// Todos los socios demo llevan "un par de meses" en el gimnasio.
const ALTA_SOCIOS = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 60);
  return d;
})();

const SEMANAS_HISTORIAL = 6;

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
    update: { passwordHash: passwordHashUser, emailVerified: new Date(), createdAt: ALTA_SOCIOS, weeklyPlan: 'TWO_DAYS', routineVariant: 'MEN' },
    create: {
      createdAt: ALTA_SOCIOS,
      name: 'Usuario Demo',
      email: DEMO_USER.email,
      passwordHash: passwordHashUser,
      role: 'USER',
      weeklyPlan: 'TWO_DAYS',
      routineVariant: 'MEN',
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
      update: { weeklyPlan: datos.weeklyPlan, createdAt: ALTA_SOCIOS, cancellationRequested: false },
      create: {
        createdAt: ALTA_SOCIOS,
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
  await prisma.aiPlan.deleteMany({});
  await prisma.aiReport.deleteMany({});
  await prisma.fitnessProfile.deleteMany({});

  // --- Clases: de lunes a viernes, dos horarios al día, desde hace 6
  // semanas (historial para las estadísticas y la IA) hasta dentro de 3.
  const clases = [];
  for (let dia = -SEMANAS_HISTORIAL * 7; dia <= 18; dia++) {
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

  // --- Historial: clases ya pasadas -----------------------------------
  const porEmail = Object.fromEntries(todosLosUsuarios.map((u) => [u.email, u]));
  const hace14 = aLasHoras(-14, 0);
  const hace30 = aLasHoras(-27, 0); // margen para que caigan dentro del "último mes" de la app

  const clasesPasadas = clases.filter((c) => c.date <= new Date()).sort((a, b) => a.date - b.date);
  const semanasPasadas = new Map();
  for (const clase of clasesPasadas) {
    const claveSemana = inicioSemana(clase.date);
    if (!semanasPasadas.has(claveSemana)) semanasPasadas.set(claveSemana, new Map());
    const porDia = semanasPasadas.get(claveSemana);
    const claveDia = new Date(clase.date).toDateString();
    if (!porDia.has(claveDia)) porDia.set(claveDia, []);
    porDia.get(claveDia).push(clase);
  }
  const ocupacionPasada = new Map(clasesPasadas.map((c) => [c.id, 0]));
  let tardiasDavid = 0;
  let contadorHistorial = 0;

  for (const usuario of todosLosUsuarios) {
    const limite = LIMITE_SEMANAL[usuario.weeklyPlan] ?? 1;

    for (const [, clasesPorDia] of semanasPasadas) {
      const dias = mezclar([...clasesPorDia.keys()]).slice(0, limite);

      for (const dia of dias) {
        const opciones = clasesPorDia.get(dia);
        const clase = Math.random() < 0.7 ? opciones[opciones.length - 1] : opciones[0];

        // Carlos: dejó de venir hace dos semanas
        if (usuario.email === 'carlos.ruiz@demo.com' && clase.date >= hace14) continue;

        let estado = 'CONFIRMED';
        if (usuario.email === 'david.lopez@demo.com' && clase.date >= hace30 && tardiasDavid < 2) {
          estado = 'CANCELLED_LATE';
          tardiasDavid++;
        } else if (Math.random() < 0.08) {
          estado = 'CANCELLED_ON_TIME'; // alguna cancelación normal, como en la vida real
        }

        if (estado === 'CONFIRMED') {
          const ocupadas = ocupacionPasada.get(clase.id);
          if (ocupadas >= clase.capacity) continue; // clase llena: ese día no vino
          ocupacionPasada.set(clase.id, ocupadas + 1);
        }

        await prisma.booking.create({
          data: {
            userId: usuario.id,
            classSessionId: clase.id,
            status: estado,
            cancelledAt: estado === 'CONFIRMED' ? null : new Date(clase.date.getTime() - 60 * 60 * 1000),
          },
        });
        contadorHistorial++;
      }
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
    // Carlos sigue desconectado y Marta tiene la cuota vencida (la app no
    // le dejaría reservar), así que ninguno tiene clases futuras.
    if (['carlos.ruiz@demo.com', 'marta.sanchez@demo.com'].includes(usuario.email)) continue;

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
  // Cada pago cubre un mes desde que se paga (igual que en la app).
  const unMesDespues = (fecha) => {
    const fin = new Date(fecha);
    fin.setMonth(fin.getMonth() + 1);
    return fin;
  };
  // Días desde hoy en que se hizo el último pago de cada socio
  const DIA_ULTIMO_PAGO = {
    'marta.sanchez@demo.com': -36, // vencida hace ~5 días
    'ana.torres@demo.com': -28, // le vence en ~3 días
  };
  for (const u of todosLosUsuarios) {
    const paidAt = aLasHoras(DIA_ULTIMO_PAGO[u.email] ?? -10, 10);
    // Pago del mes anterior (historial para ingresos)
    const pagoAnterior = new Date(paidAt);
    pagoAnterior.setMonth(pagoAnterior.getMonth() - 1);
    for (const fecha of [pagoAnterior, paidAt]) {
      await prisma.payment.create({
        data: {
          userId: u.id,
          weeklyPlan: u.weeklyPlan,
          amount: PRECIOS[u.weeklyPlan],
          paidAt: fecha,
          validUntil: unMesDespues(fecha),
        },
      });
    }
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

  // --- IA: perfil fitness y planes de ejemplo del usuario demo ----------
  await prisma.fitnessProfile.create({
    data: {
      userId: usuarioPrincipal.id,
      goal: 'GANAR_MUSCULO',
      level: 'INTERMEDIO',
      minutesPerSession: 60,
      trainsAtHome: true,
      dietPreference: 'OMNIVORA',
      limitations: null,
    },
  });

  // Fecha anterior al lunes de esta semana: así estos planes de ejemplo NO
  // cuentan para el límite semanal y el visitante puede generar los suyos.
  const antesDeEstaSemana = new Date(inicioSemana(new Date()) - 60 * 60 * 1000);

  await prisma.aiPlan.createMany({
    data: [
      {
        userId: usuarioPrincipal.id,
        kind: 'TRAINING',
        createdAt: antesDeEstaSemana,
        content: {
          resumen:
            'Semana de fuerza en dos bloques: un día tren inferior y otro tren superior, para ganar músculo sin repetir grupos.',
          sesiones: [
            {
              titulo: 'Día 1 · Tren inferior',
              enfoque: 'Piernas y glúteo con trabajo de core',
              calentamiento: '5 min de comba suave y 10 sentadillas con pausa.',
              ejercicios: [
                { nombre: 'Sentadilla goblet con kettlebell', series: '4 x 10', nota: 'Baja controlando 3 segundos' },
                { nombre: 'Peso muerto rumano con mancuernas', series: '4 x 8' },
                { nombre: 'Zancadas alternas', series: '3 x 12', nota: 'Rodilla alineada con el pie' },
                { nombre: 'Hip thrust en banco', series: '3 x 12' },
                { nombre: 'Plancha frontal', series: '3 x 40 s' },
              ],
            },
            {
              titulo: 'Día 2 · Tren superior',
              enfoque: 'Empuje y tracción equilibrados',
              calentamiento: 'Movilidad de hombros con banda y 2 x 10 flexiones fáciles.',
              ejercicios: [
                { nombre: 'Press de banca con mancuernas', series: '4 x 8' },
                { nombre: 'Remo con mancuerna a una mano', series: '4 x 10', nota: 'Espalda neutra' },
                { nombre: 'Press militar de pie', series: '3 x 10' },
                { nombre: 'Jalón con banda elástica', series: '3 x 12' },
                { nombre: 'Curl de bíceps + extensión de tríceps', series: '3 x 12' },
              ],
            },
          ],
          extraEnCasa: {
            titulo: 'Rutina exprés en casa (15 min)',
            ejercicios: ['3 rondas: 15 sentadillas', '10 flexiones', '20 escaladores', '30 s de plancha lateral por lado'],
          },
          consejo: 'Vas muy constante: esta semana intenta subir un poco el peso en la sentadilla goblet. ¡A por ello!',
        },
      },
      {
        userId: usuarioPrincipal.id,
        kind: 'NUTRITION',
        createdAt: antesDeEstaSemana,
        content: {
          resumen:
            'Para ganar músculo, prioriza proteína en cada comida y no te saltes los hidratos los días de clase.',
          claves: [
            'Incluye una ración de proteína en cada comida (huevos, pollo, legumbres, pescado o yogur).',
            'Añade fruta o verdura en todas las comidas principales.',
            'Bebe agua a lo largo del día, sobre todo antes y después de entrenar.',
            'Ten a mano un tentempié con proteína para la tarde.',
          ],
          ejemploDia: [
            { comida: 'Desayuno', idea: 'Tostadas integrales con tomate, huevos revueltos y una pieza de fruta.' },
            { comida: 'Comida', idea: 'Lentejas con verduras y un filete de pollo a la plancha.' },
            { comida: 'Merienda', idea: 'Yogur natural con avena y frutos secos.' },
            { comida: 'Cena', idea: 'Salmón al horno con patata y ensalada.' },
          ],
          diaDeEntreno: 'Una o dos horas antes, algo ligero con hidratos (plátano y tostada); después, proteína y una ración de arroz o pasta.',
          aviso: 'Son ideas generales. Para un plan a tu medida, consulta con un dietista-nutricionista.',
        },
      },
    ],
  });

  // --- Tablas de ejercicios ---------------------------------------------
  // Catálogo + una tabla por tarifa para este mes y los dos anteriores, y
  // pesos apuntados por el usuario demo para que "Mi tabla" muestre la
  // última vez / récord y "Progreso" tenga gráficas con contenido. La
  // sentadilla goblet sale hace dos meses y este mes (no el pasado), para
  // enseñar que la app recuerda el peso aunque el ejercicio no saliera.
  await prisma.setLog.deleteMany({});
  await prisma.routine.deleteMany({}); // borra en cascada días y ejercicios
  await prisma.exercise.deleteMany({});

  const catalogo = [
    ['Sentadilla goblet', 'Pierna'], ['Prensa de piernas', 'Pierna'], ['Zancadas con mancuernas', 'Pierna'],
    ['Peso muerto rumano', 'Femoral'], ['Hip thrust', 'Glúteo'], ['Press banca', 'Pecho'],
    ['Press inclinado con mancuernas', 'Pecho'], ['Remo con mancuerna', 'Espalda'], ['Jalón al pecho', 'Espalda'],
    ['Press militar', 'Hombro'], ['Elevaciones laterales', 'Hombro'], ['Curl de bíceps', 'Brazo'],
    ['Extensión de tríceps en polea', 'Brazo'], ['Plancha', 'Core'],
  ];
  const ej = {};
  for (const [name, muscleGroup] of catalogo) {
    ej[name] = await prisma.exercise.create({ data: { name, muscleGroup } });
  }

  // [ejercicio, series, reps, descanso, peso inicial del usuario demo, subida por semana]
  const PLANTILLAS = {
    // offset de mes: 0 = este mes, -1 = el anterior, -2 = hace dos meses
    '-2': {
      TWO_DAYS: [
        ['Pierna y glúteo', [['Sentadilla goblet', 4, '10', 90, 14, 1], ['Hip thrust', 3, '12', 60, 30, 2.5], ['Plancha', 3, '30 seg', 45, 0, 0]]],
        ['Torso', [['Press banca', 4, '8-10', 120, 30, 1.25], ['Remo con mancuerna', 3, '10-12', 90, 12, 1]]],
      ],
    },
    '-1': {
      TWO_DAYS: [
        ['Pierna y glúteo', [['Prensa de piernas', 4, '10-12', 90, 60, 5], ['Hip thrust', 3, '10', 60, 40, 2.5], ['Peso muerto rumano', 3, '10', 90, 20, 2]]],
        ['Torso', [['Press banca', 4, '8', 120, 35, 1.25], ['Jalón al pecho', 3, '10-12', 90, 30, 2.5], ['Elevaciones laterales', 3, '15', 45, 4, 0.5]]],
      ],
    },
    '0': {
      TWO_DAYS: [
        ['Pierna y glúteo', [['Sentadilla goblet', 4, '8-10', 90, 20, 1], ['Hip thrust', 4, '10', 60, 45, 2.5], ['Zancadas con mancuernas', 3, '10 por pierna', 60, 8, 1]]],
        ['Torso', [['Press banca', 4, '6-8', 120, 37.5, 1.25], ['Remo con mancuerna', 3, '10', 90, 16, 1], ['Press militar', 3, '10', 90, 20, 1.25]]],
      ],
    },
  };
  // Las tarifas de 1 y 3 días reutilizan los ejercicios de la de 2 días
  const tablaDeTarifa = (plantilla2, plan) => {
    if (plan === 'TWO_DAYS') return plantilla2;
    if (plan === 'ONE_DAY') {
      return [['Cuerpo completo', [plantilla2[0][1][0], plantilla2[1][1][0], plantilla2[0][1][1], plantilla2[1][1][1]]]];
    }
    return [...plantilla2, ['Hombro, brazo y core', [['Press militar', 3, '10', 90, 20, 1], ['Curl de bíceps', 3, '12', 60, 8, 0.5], ['Extensión de tríceps en polea', 3, '12', 60, 15, 1], ['Plancha', 3, '40 seg', 45, 0, 0]]]];
  };

  const ahoraTablas = new Date();
  const mesConOffset = (offset) => {
    const d = new Date(ahoraTablas.getFullYear(), ahoraTablas.getMonth() + offset, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  };
  const TITULOS = { '-2': 'Adaptación', '-1': 'Volumen', '0': 'Fuerza base' };

  for (const offset of Object.keys(PLANTILLAS)) {
    const { year, month } = mesConOffset(Number(offset));
    // Misma tabla para la versión de hombre y la de mujer (es una demo)
    for (const [plan, variant] of ['ONE_DAY', 'TWO_DAYS', 'THREE_DAYS'].flatMap((p) => [[p, 'MEN'], [p, 'WOMEN']])) {
      const dias = tablaDeTarifa(PLANTILLAS[offset].TWO_DAYS, plan);
      await prisma.routine.create({
        data: {
          year, month, weeklyPlan: plan, variant, title: TITULOS[offset],
          notes: offset === '0' ? 'Calienta 10 minutos antes de empezar y apunta tus pesos al terminar cada ejercicio.' : null,
          days: {
            create: dias.map(([name, ejercicios], i) => ({
              dayNumber: i + 1,
              name,
              exercises: {
                create: ejercicios.map(([nombre, sets, reps, rest], orden) => ({
                  exerciseId: ej[nombre].id, order: orden, sets, reps, restSeconds: rest,
                  // Este mes, ejercicios de dos en dos en superserie (bloques)
                  block: offset === '0' ? Math.floor(orden / 2) : orden,
                })),
              },
            })),
          },
        },
      });
    }
  }

  // Pesos del usuario demo (tarifa de 2 días): martes = día 1, jueves = día 2,
  // desde hace dos meses hasta ayer, subiendo un poco cada semana.
  const diaISOLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const redondear = (kg) => Math.round(kg / 1.25) * 1.25;
  const inicioLogs = new Date(ahoraTablas.getFullYear(), ahoraTablas.getMonth() - 2, 1);
  const hoyLocal = new Date(ahoraTablas.getFullYear(), ahoraTablas.getMonth(), ahoraTablas.getDate());
  const series = [];
  for (let d = new Date(inicioLogs); d < hoyLocal; d.setDate(d.getDate() + 1)) {
    const diaSemana = d.getDay();
    if (diaSemana !== 2 && diaSemana !== 4) continue; // martes y jueves
    const offset = (d.getFullYear() - ahoraTablas.getFullYear()) * 12 + d.getMonth() - ahoraTablas.getMonth();
    const plantilla = PLANTILLAS[String(offset)]?.TWO_DAYS;
    if (!plantilla) continue;
    const [, ejercicios] = plantilla[diaSemana === 2 ? 0 : 1];
    const semanaDelMes = Math.floor((d.getDate() - 1) / 7);
    for (const [nombre, sets, reps, , pesoInicial, subida] of ejercicios) {
      const objetivo = parseInt(reps, 10) || 10;
      const peso = redondear(pesoInicial + subida * semanaDelMes);
      for (let n = 1; n <= sets; n++) {
        series.push({
          userId: usuarioPrincipal.id,
          exerciseId: ej[nombre].id,
          sessionDate: new Date(`${diaISOLocal(d)}T00:00:00.000Z`),
          setNumber: n,
          weight: peso,
          // la última serie cuesta un poco más
          reps: n === sets && objetivo > 6 ? objetivo - 2 : objetivo,
        });
      }
    }
  }
  await prisma.setLog.createMany({ data: series });

  console.log(
    'Listo. Usuarios:', todosLosUsuarios.length + 1, '(+admin) — Clases:', clases.length,
    '— Historial:', contadorHistorial, '— Reservas futuras confirmadas:', contadorReservas, '— En lista de espera:', contadorEspera
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
