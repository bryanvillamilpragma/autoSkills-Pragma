---
trigger: always_on
---

Cuando te pida generar código debes seguir estas reglas:

# 🧼 Reglas de desarrollo: SOLID + Clean Code

## 🎯 Objetivo

Generar código limpio, mantenible, escalable y fácil de entender, aplicando principios SOLID y buenas prácticas de Clean Code en cada implementación.

---

## 🧠 1. Principios generales

- Escribir código para humanos, no solo para máquinas.
- Priorizar claridad sobre complejidad.
- Cada pieza de código debe tener una intención clara y explícita.
- Evitar soluciones “inteligentes” que dificulten la lectura.

---

## 🧱 2. Aplicación de principios SOLID

### S - Single Responsibility Principle (SRP)

- Cada clase, función o módulo debe tener una única responsabilidad.
- Si un componente hace más de una cosa, debe dividirse.

✅ Correcto:

- `UserService` maneja lógica de usuario
- `EmailService` maneja envío de emails

❌ Incorrecto:

- Una clase que maneja lógica, persistencia y validaciones mezcladas

---

### O - Open/Closed Principle (OCP)

- El código debe estar abierto a extensión, pero cerrado a modificación.
- Evitar modificar código existente para agregar nuevas funcionalidades.

✅ Usar:

- interfaces
- abstracciones
- composición

---

### L - Liskov Substitution Principle (LSP)

- Las implementaciones deben poder sustituir a sus abstracciones sin romper el comportamiento.
- No cambiar contratos esperados.

---

### I - Interface Segregation Principle (ISP)

- No forzar a los consumidores a depender de métodos que no usan.
- Crear interfaces pequeñas y específicas.

---

### D - Dependency Inversion Principle (DIP)

- Depender de abstracciones, no de implementaciones.
- Inyectar dependencias en lugar de crearlas directamente.

---

## 🧼 3. Reglas de Clean Code

### Naming

- Usar nombres descriptivos y explícitos.
- Evitar abreviaciones innecesarias.

✅ `getUserById`  
❌ `getUsr`

---

### Funciones

- Deben ser pequeñas (idealmente < 20 líneas).
- Deben hacer una sola cosa.
- Evitar múltiples niveles de abstracción en la misma función.

---

### Clases

- Deben ser cohesivas.
- Evitar clases “Dios” con demasiadas responsabilidades.

---

### Comentarios

- Evitar comentarios innecesarios.
- El código debe ser autoexplicativo.
- Comentar solo cuando la intención no sea obvia.

---

### Manejo de errores

- No ignorar errores.
- Manejar errores de forma explícita.
- No usar `try/catch` sin propósito claro.

---

## 🔄 4. Diseño y mantenibilidad

- Priorizar bajo acoplamiento y alta cohesión.
- Evitar duplicación de lógica (DRY), sin sacrificar claridad.
- Preferir composición sobre herencia.
- Separar lógica de negocio de detalles técnicos.

---

## 🚫 5. Anti-patrones a evitar

- ❌ Clases con múltiples responsabilidades
- ❌ Funciones largas y complejas
- ❌ Código duplicado
- ❌ Dependencias acopladas directamente
- ❌ Uso excesivo de variables globales
- ❌ Lógica de negocio en capas incorrectas

---

## 🤖 6. Reglas específicas para IA

- NO generar código si no se entiende completamente el requerimiento.
- SIEMPRE priorizar claridad sobre “optimización prematura”.
- SI una solución rompe SOLID, proponer una alternativa mejor.
- EXPLICAR decisiones si hay trade-offs importantes.
- SI el código existente no cumple buenas prácticas, sugerir mejoras.

---

## ✅ 7. Checklist de validación (OBLIGATORIO)

Antes de entregar código, validar:

- [ ] Cada clase tiene una sola responsabilidad
- [ ] El código es fácil de leer sin comentarios adicionales
- [ ] No hay dependencias innecesarias
- [ ] Se usan abstracciones correctamente
- [ ] No hay duplicación evidente
- [ ] Las funciones son pequeñas y claras
- [ ] Se respeta la arquitectura del proyecto

---

## 🧪 8. Criterios de aceptación

El código generado es válido si:

- Es mantenible a largo plazo
- Es fácil de entender por otro desarrollador
- Permite extensión sin modificar código existente
- Cumple principios SOLID
- Sigue buenas prácticas de Clean Code
