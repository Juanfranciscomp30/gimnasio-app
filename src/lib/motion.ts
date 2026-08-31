// Variantes de Framer Motion reutilizadas en toda la app para que el
// "idioma" de movimiento sea consistente (mismas curvas, mismos tiempos)
// en vez de cada pantalla inventando sus propias animaciones.
import type { Variants, Transition } from 'framer-motion';

export const SPRING_SUAVE: Transition = { type: 'spring', stiffness: 340, damping: 30 };
export const SPRING_MODAL: Transition = { type: 'spring', stiffness: 320, damping: 32, mass: 0.9 };

// Contenedor: hace que sus hijos con `fadeUpItem` entren en cascada.
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: SPRING_SUAVE },
};

export const scaleInItem: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: SPRING_SUAVE },
};

// Bottom-sheet modal (usado en mis-clases y en el panel de admin)
export const sheetBackdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const sheetPanel: Variants = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: SPRING_MODAL },
  exit: { opacity: 0, y: 24, transition: { duration: 0.18, ease: 'easeIn' } },
};

// Feedback táctil estándar para botones/cards interactivas
export const tapScale = { scale: 0.97 };
export const hoverLift = { y: -2 };
