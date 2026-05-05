# AGENTS

## Qué es este proyecto

**autoskills-pragma** un CLI que auto-detecta las tecnologías de un proyecto y les instala "skills" curados (archivos Markdown) que enseñan a los agentes de IA (Cursor, Claude Code, etc.) a trabajar correctamente con ese stack.

### Qué hace hoy

1. **Escanea** el proyecto (package.json, config files, lockfiles, Gradle, .NET, etc.)
2. **Detecta** 50+ tecnologías y combos (Next.js + Supabase, React + shadcn, etc.)
3. **Muestra** un selector interactivo con los skills recomendados
4. **Instala** los skills en paralelo desde un registry local verificado con hashes SHA-256
5. **Genera** un `CLAUDE.md` automático cuando Claude Code es uno de los agentes target

### Qué buscamos (visión)

Evolucionar el concepto de "skills" para que el sistema también soporte:

- **Rules** — reglas de estilo, convenciones y restricciones del equipo (equivalente a steering files)
- **Prompts** — prompts reutilizables para tareas comunes (code review, refactoring, etc.)
- **Workflows** — flujos multi-paso guiados (similar a specs de Kiro)

Esto convertiría autoskills en una plataforma completa de contexto para agentes de IA, no solo un instalador de skills.

---

## Estructura del proyecto

```
autoskills-pragma/
├── index.mjs              # Entry point — verifica Node >= 22.6, carga main.ts o dist/
├── main.ts                # CLI principal: parseo de args, detección, selección, instalación
├── lib.ts                 # Lógica de detección de tecnologías, workspaces, combos
├── skills-map.ts          # Mapa declarativo: tecnología → paquetes/configs → skills
├── installer.ts           # Descarga, verificación de integridad, instalación de skills
├── claude.ts              # Generación/limpieza del archivo CLAUDE.md
├── colors.ts              # Helpers de color y output (log, write, spinners)
├── ui.ts                  # Componentes de UI interactiva (selector, banner)
├── package.json           # Metadata, scripts, dependencias
├── tsconfig.json          # Configuración TypeScript
│
├── skills-registry/       # Registry local de skills verificados
│   ├── index.json         # Manifiesto: hashes, reviews, metadata de cada skill
│   ├── accessibility/     # Cada carpeta = un skill con SKILL.md + references/
│   ├── angular-developer/
│   ├── next-best-practices/
│   ├── typescript-best-practices/
│   ├── frontend-design/
│   └── ...                # ~25 skills locales
│
├── scripts/
│   ├── sync-skills.mjs    # Descarga skills de GitHub, los audita con OpenAI, los persiste
│   ├── validate-registry.mjs  # Valida que skills-map ↔ registry estén sincronizados
│   └── release.mjs        # Bump de versión, changelog, publish a npm
│
├── tests/                 # Tests con node:test + node:assert/strict
│   ├── helpers.ts         # Utilidades compartidas (useTmpDir, writePackageJson, etc.)
│   ├── detect.test.ts     # Detección de tecnologías
│   ├── collect.test.ts    # Recolección de skills
│   ├── installer.test.ts  # Instalación y verificación de integridad
│   ├── workspace.test.ts  # Resolución de workspaces (pnpm, npm, deno)
│   ├── detect-agents.test.ts  # Detección de agentes instalados
│   ├── claude.test.ts     # Generación de CLAUDE.md
│   └── cli.test.ts        # Tests de integración del CLI
│
├── dist/                  # Output compilado (TypeScript → JS)
├── .codex/skills/         # Skills locales para desarrollo (legacy)
└── CHANGELOG.md           # Historial de releases
```

### Flujo de datos

```
skills-map.ts (declarativo)
       ↓
lib.ts detectTechnologies() → escanea proyecto → retorna tecnologías + combos
       ↓
lib.ts collectSkills() → mapea tecnologías a skills disponibles
       ↓
installer.ts installSkill() → verifica integridad (SHA-256) → copia a .agents/skills/
       ↓
Symlinks a carpetas de cada agente (.cursor/skills/, .claude/skills/, etc.)
```

### Registry y seguridad

- `scripts/sync-skills.mjs` descarga skills de repos upstream, los audita con un modelo de OpenAI (prompt de seguridad), y los persiste en `skills-registry/`.
- Cada skill tiene un `bundleHash` (SHA-256 de todos sus archivos) que se verifica en cada instalación.
- El manifiesto `skills-registry/index.json` contiene: source, commitSha, files, sha256 por archivo, bundleHash, y resultado del review.
- `scripts/validate-registry.mjs` se ejecuta en `prepublishOnly` para garantizar consistencia.

---

## Supply Chain Security

### Rules for AI assistants and contributors

- **Never use `^` or `~`** in dependency version specifiers. Always pin exact versions.
- **Always commit the lockfile** (`pnpm-lock.yaml`). Never delete it or add it to `.gitignore`.
- **Install scripts are disabled**. If a new dependency requires a build step, it must be explicitly approved.
- **New package versions must be at least 1 day old** before they can be installed (release age gating is enabled).
- When adding a dependency, verify it on [npmjs.com](https://www.npmjs.com) before installing.
- Prefer well-maintained packages with verified publishers and provenance.
- Run `pnpm install` with the lockfile present — never bypass it.
- Do not add git-based or tarball URL dependencies unless explicitly approved.
- **Do not run `npm update`**, `npx npm-check-updates`, or any blind upgrade command. Review each update individually.
- **Use deterministic installs**: prefer `pnpm install --frozen-lockfile` over `pnpm install` in CI and scripts.

---

## Testing

- Tests use Node.js built-in test runner (`node:test`) and `node:assert/strict`.
- Run tests: `node --test 'tests/*.test.ts'`
- **Always destructure** the specific assert functions you need instead of importing the default `assert` object. Use `ok(...)` instead of `assert.ok(...)`, `strictEqual(...)` instead of `assert.strictEqual(...)`, etc.

```js
// ✅ Correct
import { ok, strictEqual, deepStrictEqual } from "node:assert/strict";

ok(value);
strictEqual(a, b);

// ❌ Wrong
import assert from "node:assert/strict";

assert.ok(value);
assert.strictEqual(a, b);
```

- Use the shared helpers from `tests/helpers.ts` (`useTmpDir`, `writePackageJson`, `writeJson`, `writeFile`, `addWorkspace`) to avoid duplicating filesystem setup logic in tests.

---

## Output helpers

- **Never use `console.log` or `process.stdout.write` directly** in the CLI. Use the `log` and `write` helpers exported from `./colors.js` instead.

```ts
// ✅ Correct
import { log, write } from "./colors.js";

log("hello");
write("raw output\n");

// ❌ Wrong
console.log("hello");
process.stdout.write("raw output\n");
```

---

## Scripts útiles

| Script | Descripción |
|--------|-------------|
| `pnpm build` | Compila TypeScript a `dist/` |
| `pnpm test` | Ejecuta todos los tests |
| `pnpm validate:registry` | Valida integridad del registry vs skills-map |
| `pnpm sync:skills` | Descarga y audita skills desde GitHub (requiere `OPENAI_API_KEY`) |
| `pnpm release` | Release completa: bump, changelog, publish, GitHub release |
