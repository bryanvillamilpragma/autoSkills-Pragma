---
trigger: always_on
---

Cuando generes o modifiques código frontend, aplica estas reglas de rendimiento:

# Reglas de Performance Frontend

## Objetivo

Garantizar que todo código generado cumpla estándares de rendimiento. Estas reglas aplican a TODO código generado, sin excepción.

---

## 1. Core Web Vitals — Prohibiciones (CRITICAL)

- **NUNCA** usar lazy loading en imágenes o componentes above-the-fold (LCP).
- **NUNCA** crear tareas síncronas >50ms en el hilo principal (INP).
- **NUNCA** renderizar imágenes/video sin `width` y `height` explícitos (CLS).
- **NUNCA** inyectar contenido dinámico que desplace elementos ya visibles sin reservar espacio (CLS).
- **NUNCA** cargar datos del LCP element vía `useEffect` + spinner — usar SSR/SSG.

---

## 2. Bundle Size — Prohibiciones (HIGH)

- **NUNCA** importar librerías completas: `import _ from 'lodash'`, `import * as icons from '@heroicons/react'`.
- **NUNCA** usar `moment.js` — reemplazar con `date-fns` o `dayjs`.
- **NUNCA** usar barrel imports que anulen tree shaking: `import { X } from '@mui/material'` → usar `import X from '@mui/material/X'`.
- **NUNCA** dejar rutas sin code-splitting — cada ruta debe ser lazy-loaded.

---

## 3. Rendering — Obligaciones (HIGH)

- **SIEMPRE** usar `React.memo()` en componentes hijos costosos que reciben props estables.
- **SIEMPRE** usar `useMemo`/`useCallback` cuando se pasen objetos o funciones como props a componentes memorizados.
- **SIEMPRE** usar keys estables en listas (IDs, no índices) — `key={item.id}`.
- **SIEMPRE** usar `ChangeDetectionStrategy.OnPush` en componentes Angular.
- **SIEMPRE** usar `track item.id` en `@for` loops de Angular.
- **SIEMPRE** derivar estado con `useMemo` o `computed()` — **NUNCA** con `useEffect` + `setState`.

---

## 4. Imágenes y Fonts (MEDIUM)

- **SIEMPRE** usar formatos modernos (WebP/AVIF) con fallback.
- **SIEMPRE** usar `loading="lazy"` en imágenes below-the-fold.
- **SIEMPRE** usar `priority` / `fetchPriority="high"` en la imagen LCP.
- **SIEMPRE** usar `font-display: swap` en fuentes personalizadas.
- **SIEMPRE** precargar fuentes críticas con `<link rel="preload">`.

---

## 5. Data Fetching (HIGH)

- **NUNCA** crear cascadas de fetches secuenciales cuando pueden ser paralelos (`Promise.all`).
- **SIEMPRE** implementar cache strategy (staleTime en TanStack Query, revalidate en Next.js).
- **SIEMPRE** usar `AbortController` en fetches dentro de `useEffect` para cancelar en unmount.
- **SIEMPRE** cargar scripts de terceros con `strategy="lazyOnload"` o equivalente — nunca bloquear el render.
