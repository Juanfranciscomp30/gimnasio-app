# Gimnasio App

Aplicación web/PWA para la gestión de un gimnasio: reservas de clases, pagos y usuarios.

## Stack
- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS**
- **Prisma** + **PostgreSQL** (Supabase)
- **NextAuth.js** (roles: admin / usuario)
- **next-pwa** (instalable en móvil sin tiendas de apps)
- Despliegue: **Vercel** (app) + **Supabase** (base de datos)

## Roles

### Administrador
- Gestiona pagos de los usuarios.
- Ve qué personas hay en cada clase/día.
- Puede añadir un usuario manualmente.

### Usuario
- Solo puede añadirse o eliminarse de las clases.
- Si cancela con **menos de 3h de antelación**, pierde ese día (cuenta como usado).
- Si cancela con **3h o más de antelación**, el hueco se libera y no pierde el día.

## Reglas de negocio clave
- Cada usuario tiene una tarifa: **1, 2 o 3 días/semana**.
- Reservar una clase ocupa un hueco de aforo → menos disponibilidad para el resto.
- Cancelar a tiempo libera el hueco de aforo para futuras reservas.
- Ver la lógica centralizada en `src/lib/booking-logic.ts`.

## Estructura del proyecto
```
src/
  app/
    (admin)/admin/        -> páginas solo para admin (pagos, usuarios, clases)
    (user)/mis-clases/    -> páginas solo para usuario (reservar/cancelar)
    (auth)/                -> login / registro
    api/                   -> endpoints (auth, bookings, classes, users)
  components/              -> componentes reutilizables
  lib/                     -> lógica de negocio y conexión a BD/auth
  types/                   -> tipos TypeScript compartidos
prisma/
  schema.prisma            -> modelo de datos
```

## Puesta en marcha (cuando se instale)
```bash
npm install
cp .env.example .env   # rellenar con credenciales reales
npx prisma migrate dev
npm run dev
```

## Flujo de trabajo en Git

- `main` → siempre estable, es lo que está en producción.
- `feature/nombre-de-la-tarea` → una rama por cada funcionalidad.
- Al terminar una feature: Pull Request contra `main`, revisión, y merge.
- Vercel despliega automáticamente cada actualización de `main`.

Ramas previstas a corto plazo:
- `feature/auth-roles` — login y roles admin/usuario
- `feature/gestion-usuarios` — alta manual y tarifas
- `feature/reservas-usuario` — apuntarse/cancelar clases
- `feature/panel-admin-clases` — vista de aforo y asistentes
- `feature/pagos` — registro de pagos por el admin
