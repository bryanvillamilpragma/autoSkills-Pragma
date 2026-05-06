---
name: create-component
description: Crea un componente nuevo siguiendo las convenciones del proyecto. Usar cuando el dev pida crear un componente, página, vista, o elemento de UI. Detecta automáticamente el stack (Angular, React) y aplica las convenciones correctas.
type: workflow
stacks:
  - angular
  - react
---

# Workflow: Crear Componente

Eres un experto en crear componentes bien estructurados. Tu objetivo es hacer las preguntas mínimas necesarias para generar los archivos correctos según el stack del proyecto y sus convenciones existentes.

## Antes de empezar

Lee estos archivos del proyecto si existen para entender las convenciones del equipo:
- `CLAUDE.md` o `AGENTS.md` — convenciones generales
- `.claude/skills/angular-developer/SKILL.md` — si es Angular
- `.claude/skills/clean-architecture-uml/SKILL.md` — si usa Clean Architecture
- Busca 2 componentes existentes similares al que se va a crear para aprender el estilo

## Preguntas a hacer (en orden)

1. **¿Cómo se llama el componente?** (si no lo mencionó el dev)
2. **¿Qué tipo es?** — page/smart, presentacional/dumb, shared/reutilizable
3. **¿Qué hace este componente?** — descripción breve de su responsabilidad

Con esas 3 respuestas tienes suficiente para generar. No hagas más preguntas a menos que algo sea ambiguo.

## Para proyectos Angular + Clean Architecture

**Detectar automáticamente:**
- Feature donde va (escaneando `presentation/pages/`)
- Modelos de dominio relacionados (buscando en `domain/models/`)
- UseCases relacionados (buscando en `application/use-cases/`)
- Design system instalado (Angular Material, PrimeNG, etc.)

**Archivos a generar según tipo:**

Page con ViewModel:
```
{feature}/{name}/
{name}.component.ts      — standalone, inject(), signals, OnInit
{name}.component.html    — template con design system detectado
{name}.component.spec.ts — TestBed, await whenStable(), no detectChanges()
{name}.view-model.ts     — @Injectable, signal(), computed()
{name}.view-model.spec.ts
```

Presentacional:
```
components/{name}/
{name}.component.ts      — input(), output(), standalone
{name}.component.html
{name}.component.spec.ts
```

**Reglas obligatorias:**
- `inject()` siempre — NUNCA constructor DI
- `standalone: true` en todos los componentes
- Signals para todo estado: `signal()`, `computed()`, `effect()`
- Tests: `await fixture.whenStable()` — NUNCA `fixture.detectChanges()`
- No importar `infrastructure` desde `presentation`
- Usar los mismos patrones que los componentes existentes del proyecto

## Para proyectos React

**Detectar automáticamente:**
- Carpeta destino (buscando `src/pages/`, `src/components/`, `src/features/`)
- Design system instalado (shadcn, Tailwind, MUI, etc.)
- Patrón de hooks del proyecto

**Archivos a generar según tipo:**

Page con hook:
```
{folder}/{Name}/
{Name}.tsx           — funcional, typed props, named export
{Name}.test.tsx      — RTL, userEvent, queries semánticas
use{Name}.ts         — hook con estado/lógica
use{Name}.test.ts    — renderHook
```

UI/Shared:
```
{folder}/{Name}/
{Name}.tsx
{Name}.test.tsx
```

**Reglas obligatorias:**
- Componentes funcionales únicamente
- `interface Props` siempre
- Named exports, no default exports
- Tests con RTL — nunca `querySelector` directo
- Mismo estilo que los componentes existentes del proyecto

## Después de generar

Muestra al dev:
1. Lista de archivos creados con sus rutas
2. Siguiente paso sugerido: `/unit-test-review` para revisar los tests generados

## Compatibilidad con Figma MCP

Si el dev tiene el MCP de Figma configurado y proporciona una URL de Figma:
1. Usa el MCP de Figma para obtener los datos del diseño
2. Genera el template HTML/JSX fiel al diseño
3. Usa los colores y componentes del design system del proyecto que correspondan al diseño
