---
name: unit-test-review
description: Revisa y completa pruebas unitarias de un archivo. Usar cuando el dev pida revisar tests, completar specs faltantes, mejorar cobertura, o auditar pruebas existentes. Detecta el stack y aplica los patrones correctos.
type: workflow
stacks:
  - angular
  - react
---

# Workflow: Revisar y Completar Tests

Eres un experto en testing. Tu objetivo es auditar tests existentes y generar los que faltan, siguiendo los patrones del proyecto.

## Antes de empezar

Lee estos archivos si existen:
- `.claude/skills/angular-developer/SKILL.md` — patrones de testing Angular
- Busca 2 specs existentes en el proyecto para aprender el estilo del equipo

## Pregunta inicial

¿Qué archivo quieres revisar? (si no lo mencionó el dev)

Detecta automáticamente si ya existe un `.spec.ts` o `.test.ts` para ese archivo.

## Auditoría — qué buscar

**Para componentes Angular:**
- ¿Falta test de estado inicial?
- ¿Falta test por cada `@Input()` / `input()`?
- ¿Falta test por cada método público?
- ¿Usa `detectChanges()` en vez de `await whenStable()`? → corregir
- ¿Hace `querySelector` directo en vez de harness? → sugerir harness
- ¿Solo testea la clase, no el template?

**Para ViewModels Angular:**
- ¿Falta test de cada `signal()` y `computed()`?
- ¿No testea estado de error?
- ¿No testea estado de loading?

**Para UseCases:**
- ¿Falta test con gateway mock?
- ¿No testea el observable?
- ¿No testea error del gateway?

**Para componentes React:**
- ¿Usa `querySelector` en vez de queries semánticas de RTL?
- ¿Usa `fireEvent` en vez de `userEvent`?
- ¿Falta test de estado inicial?
- ¿Falta test de cada prop relevante?
- ¿Falta test de interacciones?

**Para hooks React:**
- ¿Usa `renderHook` correctamente?
- ¿Testea estado inicial?
- ¿Testea actualizaciones de estado?

## Reglas Angular (obligatorias)

- Patrón: **Act → `await fixture.whenStable()` → Assert**
- NUNCA `fixture.detectChanges()` manual
- Usar `ComponentHarness` del Angular CDK para interacciones DOM
- NUNCA mockear `Router` directamente — usar `RouterTestingHarness`
- Un `describe` por clase, un `it` por comportamiento observable

## Reglas React (obligatorias)

- `render()` + queries semánticas (`getByRole`, `getByText`, `getByLabelText`)
- `userEvent` para interacciones — NUNCA `fireEvent`
- `renderHook` para hooks
- Assertions con `expect().toBeInTheDocument()`, `expect().toHaveValue()`, etc.

## Output esperado

1. Reporte de lo que encontraste: X tests existentes, Y casos faltantes
2. Tests completados/corregidos directamente en el archivo
3. Resumen final de cobertura por método/comportamiento
