---
name: unit-test-review
description: Revisa y completa pruebas unitarias de un archivo. Usar cuando el dev pida revisar tests, completar specs faltantes, mejorar cobertura, o auditar pruebas existentes. Detecta el stack y aplica los patrones correctos.
type: workflow
stacks:
  - angular
  - react
---

# Workflow: Revisar y Completar Tests

Eres un experto en testing frontend. Tu objetivo es auditar tests existentes, generar los que faltan, ejecutarlos y confirmar que pasan — siguiendo los patrones exactos del proyecto.

---

## Inputs — Definition of Ready (DoR)

Antes de iniciar, el workflow recopila automáticamente o pregunta lo mínimo necesario:

| Input | Fuente |
|-------|--------|
| **Stack del proyecto** | Detectado de `package.json` automáticamente |
| **Archivo de implementación** | Path provisto por el dev, o preguntado si no se mencionó |
| **Spec existente** | Detectado automáticamente (`*.spec.ts` / `*.test.tsx`) |
| **Estilo de tests del equipo** | 2 specs existentes del proyecto leídas automáticamente |
| **Cobertura mínima objetivo** | Detectada de `jest.config.*` / `karma.conf.*` / `angular.json` — o preguntada al dev |

---

## Outputs — Definition of Done (DoD)

El workflow está completo cuando se cumplen **todos** estos criterios:

| Output | Descripción |
|--------|-------------|
| **Spec corregido y completado** | Archivo actualizado directamente con tests nuevos y correcciones |
| **Tests ejecutados y pasando** | `npm test` / `ng test` corre sin errores antes de cerrar |
| **Cobertura ≥ objetivo** | Todos los métodos públicos y signals/computed cubiertos |
| **Reporte generado** | `reports/unit-test-review.md` con métricas, tabla de cobertura y resultados de ejecución |
| **Siguiente paso sugerido** | `/code-reviewer` para calidad del código fuente |

---

## Paso 1 — Detectar stack y leer contexto

### 1a. Detectar stack automáticamente

Leer `package.json` y determinar:

```
@angular/core presente   → stack: Angular
react + react-dom        → stack: React
next presente            → stack: Next.js
```

Leer skills instalados según stack:
- Angular: `.claude/skills/angular-developer/SKILL.md`
- React/Next.js: `.claude/skills/react-best-practices/SKILL.md`

### 1b. Leer el archivo de implementación

**Antes de ver el spec**, leer el archivo fuente (`.ts`, `.tsx`, `.component.ts`) para entender:

- Todos los métodos públicos que deben tener tests
- Signals, computed, inputs, outputs en Angular
- Props, hooks internos, eventos emitidos en React
- Casos de error y estados de carga presentes en el código

### 1c. Detectar spec existente

Buscar automáticamente:

- Angular: `{nombre}.spec.ts`
- React: `{nombre}.test.tsx` o `{nombre}.test.ts`

Si no existe → crearlo desde cero siguiendo el estilo del equipo.

### 1d. Leer estilo del equipo

Buscar 2 specs existentes para aprender las convenciones:

- Angular: `src/**/presentation/**/*.spec.ts` (excluir `node_modules`)
- React: `src/**/*.test.tsx` (excluir `node_modules`)

---

## Paso 2 — Preguntar solo lo necesario

Si el dev no mencionó el archivo a revisar:

> ¿Qué archivo quieres revisar?
>
> Ejemplo: `src/app/presentation/pages/payments/payment-form.component.ts`

Detectar si hay cobertura mínima configurada:

- `jest.config.*` → `coverageThreshold`
- `karma.conf.*` → `coverageReporter`
- `angular.json` → `codeCoverage: true`

Si **no hay configuración**, preguntar una sola vez:

> ¿Qué cobertura mínima buscas?
>
> - **Básica (70%)** — métodos principales cubiertos
> - **Estándar (80%)** — recomendado para producción
> - **Exhaustiva (100%)** — todos los casos incluyendo errores

**Máximo 2 preguntas. No preguntar más.**

---

## Paso 3 — Auditoría

### Para componentes Angular

- ¿Falta test de estado inicial?
- ¿Falta test por cada `input()` / `@Input()`?
- ¿Falta test por cada método público?
- ¿Usa `detectChanges()` en vez de `await whenStable()`? → corregir
- ¿Hace `querySelector` directo en vez de harness? → migrar a harness
- ¿Solo testea la clase pero no el template?

### Para ViewModels Angular

- ¿Falta test de cada `signal()` y `computed()`?
- ¿No testea estado de error?
- ¿No testea estado de loading?

### Para UseCases

- ¿Falta test con gateway mock?
- ¿No testea el observable / promise?
- ¿No testea error del gateway?

### Para componentes React

- ¿Usa `querySelector` en vez de queries semánticas de RTL?
- ¿Usa `fireEvent` en vez de `userEvent`?
- ¿Falta test de estado inicial?
- ¿Falta test de cada prop relevante?
- ¿Falta test de interacciones del usuario?

### Para hooks React

- ¿Usa `renderHook` correctamente?
- ¿Testea estado inicial?
- ¿Testea actualizaciones de estado tras acciones?

---

## Reglas Angular (obligatorias)

- Patrón: **Act → `await fixture.whenStable()` → Assert**
- NUNCA `fixture.detectChanges()` manual
- Usar `ComponentHarness` del Angular CDK para interacciones DOM
- NUNCA mockear `Router` directamente — usar `RouterTestingHarness`
- Un `describe` por clase, un `it` por comportamiento observable

## Reglas React (obligatorias)

- `render()` + queries semánticas (`getByRole`, `getByText`, `getByLabelText`)
- `userEvent` para interacciones — NUNCA `fireEvent`
- `renderHook` para hooks — NUNCA testar internals
- Assertions con `expect().toBeInTheDocument()`, `expect().toHaveValue()`, etc.
- NUNCA `container.querySelector` — si lo necesitas, falta un role/aria

---

## Paso 4 — Mostrar resumen y confirmar

Antes de escribir cualquier archivo, mostrar:

```
◆ Tests a agregar/corregir en payment-form.component.spec.ts:

  Existentes:  3 tests
  A corregir:  1  (detectChanges → whenStable en línea 42)
  A agregar:   5  casos faltantes
    + estado inicial: isLoading signal = false
    + error cuando el UseCase falla
    + loading = true durante la llamada async
    + emit del outputEvent al completar
    + template: botón deshabilitado cuando isLoading = true

  Cobertura estimada tras cambios: ~85% (objetivo: 80%)

  ¿Confirmas? (s/n)
```

Solo escribir los archivos tras confirmación explícita.

---

## Paso 5 — Ejecutar los tests

Después de escribir los archivos, ejecutar los tests para verificar que pasan:

**Angular:**
```bash
ng test --include="**/payment-form.component.spec.ts" --watch=false --code-coverage
```

**React / Next.js:**
```bash
npx jest payment-form.test.tsx --coverage --watchAll=false
```

Si algún test falla:
1. Mostrar el error exacto al dev
2. Analizar la causa (implementación incorrecta del test o bug en el código)
3. Corregir y re-ejecutar
4. Repetir hasta que **todos los tests pasen**

**No marcar el workflow como completo hasta que todos los tests pasen.**

---

## Paso 6 — Generar reporte

Generar `reports/unit-test-review.md`:

```markdown
# Unit Test Review — {Nombre del archivo}

**Fecha:** {fecha}
**Stack:** {Angular / React / Next.js}
**Archivo revisado:** {path completo}
**Spec:** {path del spec}

## Resumen

| Métrica | Valor |
|---------|-------|
| Tests existentes | X |
| Tests corregidos | Y |
| Tests agregados | Z |
| Total final | X+Z |
| Cobertura estimada | XX% |
| Objetivo de cobertura | XX% |
| Estado | ✅ Objetivo alcanzado / ⚠️ Por debajo del objetivo |

## Cobertura por método / comportamiento

| Método / Comportamiento | Test | Estado |
|------------------------|------|--------|
| estado inicial | it("should initialize with isLoading = false") | ✅ existente |
| manejo de error | it("should set error when UseCase fails") | ✅ agregado |
| estado de loading | it("should set isLoading = true during call") | ✅ agregado |

## Ejecución

✅ X/X tests passing — 0 failures
```

---

## Paso 7 — Notificar y sugerir siguiente paso

```
✔ {X} tests existentes revisados, {Y} corregidos, {Z} agregados
✔ Todos los tests pasan (X/X)
✔ Cobertura: XX% (objetivo: XX%)
✔ Reporte generado: reports/unit-test-review.md

Siguiente paso sugerido:
→ /code-reviewer   para revisar calidad del código fuente del componente
```
