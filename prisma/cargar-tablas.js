// Carga tablas de ejercicios en la base de datos a la que apunte el .env,
// sin tener que meterlas a mano una a una desde /admin/tablas.
//
// Uso:  npm run tablas:cargar
//
// - Los ejercicios se buscan por nombre en el catálogo y se crean si no
//   existen (si ya existen no se tocan, así no se pierde nada).
// - Si la tabla de ese mes/tarifa/versión ya existe, se sustituye su
//   contenido por el de aquí. Si no, se crea.
// - Cada día se escribe como una lista de BLOQUES: los ejercicios de un
//   mismo bloque se hacen seguidos (superserie) y cada vuelta es una serie.
//
// Para cargar otro mes basta con añadir otra entrada a TABLAS.

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Catálogo: nombre -> grupo muscular (null si no está claro)
const EJERCICIOS = {
  'Press de pecho con mancuernas': 'Pecho',
  'Sentadilla Zercher': 'Pierna',
  'Press de hombro en soportes': 'Hombro',
  'Remo a una mano': 'Espalda',
  'Curl martillo': 'Bíceps',
  'Peso muerto con barra hexagonal': 'Pierna',
  'Fondos': 'Tríceps',
  'Core / cardio': 'Core',
  'Zancada Zercher': 'Pierna',
  'Aperturas con mancuernas': 'Pecho',
  'Remo Seal': 'Espalda',
  'Elevaciones 6 ways': 'Hombro',
  'Kali press': null,
  'Sentadilla goblet': 'Pierna',
  'Curl en banco Scott': 'Bíceps',
};

// Un ejercicio dentro de un bloque: nombre o { nombre, notas, reps }
const TABLAS = [
  {
    year: 2026,
    month: 11,
    weeklyPlan: 'TWO_DAYS',
    variant: 'MEN',
    series: 4, // 4 series de cada bloque
    dias: [
      {
        nombre: null,
        bloques: [
          ['Press de pecho con mancuernas', 'Sentadilla Zercher'],
          ['Press de hombro en soportes', 'Remo a una mano'],
          [{ nombre: 'Curl martillo', notas: 'Dropset' }, 'Peso muerto con barra hexagonal'],
          ['Fondos', 'Core / cardio'],
        ],
      },
      {
        nombre: null,
        bloques: [
          ['Zancada Zercher', 'Aperturas con mancuernas'],
          ['Remo Seal', 'Elevaciones 6 ways'],
          ['Kali press', 'Sentadilla goblet'],
          ['Curl en banco Scott', 'Core / cardio'],
        ],
      },
    ],
  },
];

const ETIQUETA = { MEN: 'hombre', WOMEN: 'mujer' };

async function main() {
  // 1. Catálogo
  const idPorNombre = {};
  for (const [name, muscleGroup] of Object.entries(EJERCICIOS)) {
    const existente = await prisma.exercise.findUnique({ where: { name } });
    const ejercicio = existente ?? (await prisma.exercise.create({ data: { name, muscleGroup } }));
    idPorNombre[name] = ejercicio.id;
    if (!existente) console.log(`+ ejercicio: ${name}`);
  }

  // 2. Tablas
  for (const t of TABLAS) {
    const dias = t.dias.map((dia, i) => {
      let orden = 0;
      const exercises = dia.bloques.flatMap((bloque, numBloque) =>
        bloque.map((e) => {
          const { nombre, notas = null, reps = null } = typeof e === 'string' ? { nombre: e } : e;
          if (!idPorNombre[nombre]) throw new Error(`"${nombre}" no está en EJERCICIOS`);
          return {
            exerciseId: idPorNombre[nombre],
            order: orden++,
            block: numBloque,
            sets: t.series,
            reps,
            notes: notas,
          };
        })
      );
      return { dayNumber: i + 1, name: dia.nombre, exercises: { create: exercises } };
    });

    const clave = { year: t.year, month: t.month, weeklyPlan: t.weeklyPlan, variant: t.variant };
    const existente = await prisma.routine.findUnique({
      where: { year_month_weeklyPlan_variant: clave },
    });

    // Borrar y crear en una transacción: si algo falla, no queda a medias
    await prisma.$transaction([
      ...(existente ? [prisma.routine.delete({ where: { id: existente.id } })] : []),
      prisma.routine.create({ data: { ...clave, days: { create: dias } } }),
    ]);

    console.log(
      `${existente ? '↻ sustituida' : '+ creada'}: tabla ${t.month}/${t.year} · ` +
        `${t.weeklyPlan} · ${ETIQUETA[t.variant]} (${t.dias.length} días)`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
