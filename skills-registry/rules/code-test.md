---
trigger: always_on
---

Cada vez que te pida realizar pruebas unitarias debes seguir estas reglas:

# Reglas para pruebas unitarias Frontend

## Objetivo

Generar pruebas unitarias confiables, legibles y mantenibles que validen el comportamiento del sistema, no su implementación interna. Estas reglas aplican sin importar la librería de testing.

---

## 0. Detección de librería de testing

Antes de escribir cualquier test, detecta qué herramientas usa el proyecto:

```yaml
detección:
  jest:
    señal: jest.config.* existe OR "jest" en package.json (devDependencies)
    mock_fn: jest.fn(), jest.spyOn(), jest.mock()
    runner: npx jest o npm test
  vitest:
    señal: vitest.config.* existe OR "vitest" en package.json
    mock_fn: vi.fn(), vi.spyOn(), vi.mock()
    runner: npx vitest
  karma_jasmine:
    señal: karma.conf.* existe OR "@angular-devkit/build-angular" con test architect
    mock_fn: jasmine.createSpy(), jasmine.createSpyObj()
    runner: ng test
  testing_library:
    señal: "@testing-library/react" o "@testing-library/angular" en package.json
    complemento: se usa JUNTO a jest/vitest/karma, no es runner
```

**Si no se detecta ninguna**, pregunta al usuario:
> ¿Qué librería de testing quieres usar? (Jest / Vitest / Karma+Jasmine)

**NUNCA mezcles** APIs de distintas librerías en un mismo archivo de test.

---

## 1. Principios fundamentales (aplica a TODAS las librerías)

- Probar comportamiento, no implementación.
- Cada test debe validar una sola responsabilidad.
- Las pruebas deben ser claras, determinísticas y fáciles de entender.
- Evitar tests frágiles que se rompan por cambios internos irrelevantes.
- Un test que nunca falla es un test que no valida nada.

---

## 2. Estructura de los tests — Patrón AAA

Utilizar el patrón AAA en TODOS los tests, sin excepción:

- **Arrange**: preparar datos, mocks y estado inicial.
- **Act**: ejecutar la acción a probar.
- **Assert**: validar el resultado esperado.

### Ejemplo Jest

```ts
it('should update user data successfully', () => {
  // Arrange
  const mockUpdate = jest.fn().mockResolvedValue({ success: true });
  const service = new UserService(mockUpdate);

  // Act
  const result = await service.updateUser(userData);

  // Assert
  expect(result.success).toBe(true);
  expect(mockUpdate).toHaveBeenCalledWith(userData);
});
```

### Ejemplo Vitest

```ts
it('should update user data successfully', () => {
  // Arrange
  const mockUpdate = vi.fn().mockResolvedValue({ success: true });
  const service = new UserService(mockUpdate);

  // Act
  const result = await service.updateUser(userData);

  // Assert
  expect(result.success).toBe(true);
  expect(mockUpdate).toHaveBeenCalledWith(userData);
});
```

### Ejemplo Karma + Jasmine

```ts
it('should update user data successfully', async () => {
  // Arrange
  const mockUpdate = jasmine.createSpy().and.returnValue(Promise.resolve({ success: true }));
  const service = new UserService(mockUpdate);

  // Act
  const result = await service.updateUser(userData);

  // Assert
  expect(result.success).toBe(true);
  expect(mockUpdate).toHaveBeenCalledWith(userData);
});
```

---

## 3. Convenciones de naming

- Usar nombres descriptivos en inglés: `should + acción + resultado esperado`
- Agrupar con `describe` por unidad funcional.
- Evitar nombres genéricos como `test1`, `works fine`, etc.
- Un `describe` por clase/componente/hook, `it` por comportamiento.

```ts
describe('UserService', () => {
  describe('updateUser', () => {
    it('should return success when data is valid', () => {});
    it('should throw error when user not found', () => {});
    it('should not call API when data is unchanged', () => {});
  });
});
```

---

## 4. Mocks y dependencias

- Mockear TODAS las dependencias externas (servicios, APIs, repositorios).
- NO usar implementaciones reales en unit tests.
- Preferir inyección de dependencias para facilitar el mocking.

### Equivalencias entre librerías

| Concepto | Jest | Vitest | Karma/Jasmine |
|----------|------|--------|---------------|
| Mock function | `jest.fn()` | `vi.fn()` | `jasmine.createSpy()` |
| Spy on method | `jest.spyOn(obj, 'method')` | `vi.spyOn(obj, 'method')` | `spyOn(obj, 'method')` |
| Mock module | `jest.mock('./module')` | `vi.mock('./module')` | N/A (usar DI) |
| Mock return | `.mockReturnValue(x)` | `.mockReturnValue(x)` | `.and.returnValue(x)` |
| Mock resolved | `.mockResolvedValue(x)` | `.mockResolvedValue(x)` | `.and.returnValue(Promise.resolve(x))` |
| Reset mocks | `jest.clearAllMocks()` | `vi.clearAllMocks()` | N/A (spies reset per spec) |
| Fake timers | `jest.useFakeTimers()` | `vi.useFakeTimers()` | `jasmine.clock().install()` |

---

## 5. Testing de componentes

### 5.1 React / Next.js — Testing Library

```ts
import { render, screen, fireEvent } from '@testing-library/react';

it('should call onSubmit when form is valid', async () => {
  // Arrange
  const onSubmit = vi.fn(); // o jest.fn()
  render(<LoginForm onSubmit={onSubmit} />);

  // Act
  await userEvent.type(screen.getByLabelText('Email'), 'user@test.com');
  await userEvent.click(screen.getByRole('button', { name: /submit/i }));

  // Assert
  expect(onSubmit).toHaveBeenCalledWith({ email: 'user@test.com' });
});
```

**Reglas Testing Library (React):**
- Usar queries por accesibilidad: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`
- Preferir `userEvent` sobre `fireEvent` (simula interacción real)
- NO usar `container.querySelector` — si necesitas, falta un role o aria-label
- Testear lo que el usuario ve, no la estructura interna del DOM

### 5.2 Angular — TestBed + Testing Library

**Con TestBed (tradicional):**
```ts
beforeEach(async () => {
  await TestBed.configureTestingModule({
    imports: [UserComponent],
    providers: [
      { provide: UserService, useValue: jasmine.createSpyObj('UserService', ['getUser']) }
    ]
  }).compileComponents();
});

it('should display user name', () => {
  // Arrange
  const fixture = TestBed.createComponent(UserComponent);
  const mockService = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;
  mockService.getUser.and.returnValue(of({ name: 'John' }));

  // Act
  fixture.detectChanges();

  // Assert
  expect(fixture.nativeElement.textContent).toContain('John');
});
```

**Con @testing-library/angular:**
```ts
it('should display user name', async () => {
  // Arrange
  const mockService = jasmine.createSpyObj('UserService', ['getUser']);
  mockService.getUser.and.returnValue(of({ name: 'John' }));

  // Act
  const { getByText } = await render(UserComponent, {
    providers: [{ provide: UserService, useValue: mockService }]
  });

  // Assert
  expect(getByText('John')).toBeTruthy();
});
```

**Reglas Testing Angular:**
- Mockear servicios con `createSpyObj` o providers override
- Llamar `fixture.detectChanges()` después de cambiar datos
- Para signals: mutar el signal → `fixture.detectChanges()` → assert
- NO testear `@Input/@Output` directamente — testear el comportamiento resultante

### 5.3 Hooks / Funciones reactivas

**React hooks (con renderHook):**
```ts
import { renderHook, act } from '@testing-library/react';

it('should increment counter', () => {
  const { result } = renderHook(() => useCounter());

  act(() => result.current.increment());

  expect(result.current.count).toBe(1);
});
```

**Angular signals (con effect/computed):**
```ts
it('should compute full name from signals', () => {
  const component = TestBed.createComponent(NameComponent);
  component.componentInstance.firstName.set('John');
  component.componentInstance.lastName.set('Doe');

  expect(component.componentInstance.fullName()).toBe('John Doe');
});
```

---

## 6. Anti-patrones a evitar

| Anti-patrón | Por qué es malo | Corrección |
|-------------|----------------|-----------|
| Tests que dependen de tiempo real (`setTimeout`, `delay`) | Flaky, lentos | Usar fake timers (`jest.useFakeTimers()` / `vi.useFakeTimers()` / `jasmine.clock()`) |
| Lógica compleja en el test (if/else, loops) | El test necesita su propio test | Separar en tests individuales |
| Duplicación excesiva de setup | Mantenimiento costoso | Usar `beforeEach` o factory functions |
| Probar detalles internos (variables privadas) | Se rompe con refactors | Testear outputs públicos |
| Tests que nunca fallan | No validan nada | Verificar con mutación: cambiar código y ver si falla |
| Assertions sobre `toMatchSnapshot()` sin criterio | Se auto-aprueban al actualizar | Usar snapshots solo para output estable (serialized HTML pequeño) |
| Mockear todo (incluido el SUT) | No prueba nada real | Mockear solo dependencias, no el sujeto bajo test |
| `any` en mocks | Pierde type-safety | Tipar los mocks: `jest.fn<ReturnType, Args>()` / `vi.fn<() => T>()` |

---

## 7. Cobertura inteligente

- NO buscar 100% de coverage ciego.
- Priorizar:
  - Lógica de negocio (use cases, services)
  - Edge cases (null, undefined, empty arrays, errores)
  - Caminos críticos del usuario (happy path + error path)
- Ignorar explícitamente:
  - Archivos de configuración
  - Barrel exports (index.ts)
  - Módulos de routing puro
  - DTOs/interfaces sin lógica

---

## 8. Ejecución de pruebas

Detectar y usar el comando correcto:

| Librería | Comando | Test individual |
|----------|---------|----------------|
| Jest | `npx jest` o `npm test` | `npx jest --testPathPattern='archivo.spec.ts'` |
| Vitest | `npx vitest` | `npx vitest run archivo.spec.ts` |
| Karma | `ng test` | `ng test --include='**/archivo.spec.ts'` |

**Antes de ejecutar**: verificar que el proyecto compila sin errores.
**Después de ejecutar**: si hay fallos, diagnosticar y corregir — no silenciar con `.skip`.

---

## 9. Reglas específicas para IA

- NO generar tests innecesarios o redundantes.
- SIEMPRE validar: comportamiento esperado + manejo de errores.
- SIEMPRE mockear dependencias externas.
- SI el código no es testeable, sugerir refactor para hacerlo testeable (inyección de dependencias, separar side effects).
- Mantener consistencia con el estilo de tests existentes en el proyecto.
- NUNCA generar un test que pase con implementación vacía (assert algo significativo).

---

## 10. Criterios de aceptación

Un test generado es válido si:

- ✅ Es claro y entendible sin contexto adicional.
- ✅ No depende de implementaciones reales externas.
- ✅ Valida comportamiento relevante (no trivial).
- ✅ Sigue convenciones de naming (`should...`).
- ✅ Usa la API correcta de la librería detectada.
- ✅ Es mantenible a largo plazo (no frágil).
- ✅ Falla si el código bajo test se rompe.
