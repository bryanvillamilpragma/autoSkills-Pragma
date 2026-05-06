---
trigger: always_on
---

Cada vez que te pida realizar una arquitectura limpia debes seguir las siguientes reglas:

# Reglas para desarrollo con Arquitectura Limpia

## Objetivo

Generar código mantenible, testeable y desacoplado siguiendo los principios de Clean Architecture y buenas prácticas de ingeniería de software.

---

## 1. Principios fundamentales

- Aplicar separación de responsabilidades estricta.
- El dominio NO debe depender de frameworks, librerías externas ni detalles de infraestructura.
- Las dependencias siempre deben apuntar hacia el dominio (Dependency Rule).
- Priorizar código claro, explícito y mantenible sobre soluciones "inteligentes" pero complejas.

---

## 2. Capas de la arquitectura

### 2.1 Dominio (Core)

- Contiene entidades y lógica de negocio pura.
- No debe importar nada externo (frameworks, DB, APIs).
- Define interfaces (ports) necesarias para interactuar con el exterior.
- Debe ser completamente testeable sin infraestructura.

### 2.2 Aplicación (Use Cases)

- Orquesta la lógica de negocio.
- Implementa casos de uso específicos.
- Depende únicamente del dominio.
- No contiene lógica de infraestructura.

### 2.3 Infraestructura

- Implementa las interfaces definidas en el dominio.
- Maneja persistencia, APIs externas, frameworks, etc.
- Puede depender de cualquier librería externa.

### 2.4 Interfaces (Adapters / Controllers)

- Expone la aplicación al mundo exterior (REST, GraphQL, CLI, etc).
- Traduce requests/responses a modelos del dominio.

---

## 3. Reglas de dependencias

- Dominio → NO depende de nadie.
- Aplicación → depende de Dominio.
- Infraestructura → depende de Dominio.
- Interfaces → depende de Aplicación.
  Nunca:

- Infraestructura → Dominio (con lógica)
- Dominio → Infraestructura
- Casos de uso → frameworks

---

## 4. Diseño de código

### Entidades

- Deben contener comportamiento, no solo datos.
- Deben ser invariantes (validaciones internas).

### Casos de uso

- Una responsabilidad clara.
- Entrada y salida bien definidas (DTOs).
- No deben manejar detalles técnicos.

### Interfaces (Ports)

- Definir contratos claros.
- Nombrar según intención, no implementación (ej: `UserRepository`, no `PostgresUserRepository`).

---

## 5. Testing

- El dominio y los casos de uso deben ser testeables sin dependencias externas.
- Usar mocks/fakes para interfaces externas.
- Priorizar tests de comportamiento sobre implementación.

---

## 6. Seguridad

- Nunca exponer datos sensibles en logs.
- Validar inputs en la capa de entrada (controllers).
- No confiar en datos externos.

---

## 7. Uso de frameworks

- Los frameworks son detalles, no el centro de la aplicación.
- El core del sistema debe poder existir sin framework.
- Evitar anotar entidades de dominio con anotaciones específicas del framework.

---

## 8. Buenas prácticas

- Aplicar principios SOLID.
- Evitar duplicación (DRY) sin sacrificar claridad.
- Nombrar variables, clases y métodos de forma explícita.
- Preferir composición sobre herencia.

---

## 9. Anti-patrones a evitar

- Lógica de negocio en controladores.
- Acceso directo a base de datos desde casos de uso.
- Uso de entidades del dominio como DTOs de entrada/salida.
- Mezclar lógica de infraestructura con dominio.

## 10. Reglas específicas para IA

- NO asumir contexto implícito: pedir claridad si falta información.
- Generar código modular y desacoplado.
- Explicar decisiones arquitectónicas cuando sean relevantes.
- Evitar sobreingeniería.
- Priorizar soluciones simples que cumplan los requisitos.

---

## 11. Criterios de aceptación del código generado

- Cumple con separación de capas.
- No hay dependencias incorrectas.
- Código legible y mantenible.
- Casos de uso claros y testeables.
- Sin lógica de negocio fuera del dominio.
