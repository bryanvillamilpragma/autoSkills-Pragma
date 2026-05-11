# AGENTS

## Qué es este proyecto

**sopp-front** es un CLI (`npx sopp-front`) que auto-detecta las tecnologías de un proyecto y les instala "skills" curados (archivos Markdown) que enseñan a los agentes de IA (Cursor, Claude Code, etc.) a trabajar correctamente con ese stack. Escanea `package.json`, archivos de config, lockfiles, Gradle y .NET, presenta un selector interactivo e instala los skills verificados en `.agents/skills/` con symlinks a la carpeta de cada agente.

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

## Comandos

```bash
pnpm build              # Compila TypeScript → dist/
pnpm test               # Ejecuta todos los tests (node:test runner)
pnpm validate:registry  # Valida skills-map ↔ skills-registry consistency
pnpm sync:skills        # Descarga y audita skills desde GitHub (requiere OPENAI_API_KEY)
pnpm release            # Bump de versión, changelog, publish a npm
```

Ejecutar un test específico:

```bash
node --test 'tests/detect.test.ts'
```

Requiere Node.js >= 22.6.0.

---

## Estructura del proyecto

```text
sopp-front/
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

### Tabla de arquitectura

Todo el código TypeScript vive en la raíz del proyecto (sin directorio `src/`):

| Archivo         | Rol                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `index.mjs`     | Entry del CLI: verifica versión de Node, carga `dist/main.js` o fallback a `main.ts` con `--experimental-strip-types` |
| `main.ts`       | Orquestación del CLI: parseo de args, flujo de detección, selección interactiva, instalación                          |
| `lib.ts`        | Motor de detección: `detectTechnologies()`, `collectSkills()`, resolución de workspaces, detección de combos          |
| `skills-map.ts` | Mapa declarativo de 50+ tecnologías → reglas de detección → skills                                                    |
| `installer.ts`  | Carga del registry, verificación de integridad SHA-256, instalación de skills, creación de symlinks                   |
| `ui.ts`         | Prompt multi-select interactivo, banner animado, spinner                                                              |
| `colors.ts`     | Helpers `log()` y `write()` — usar en lugar de `console.log`                                                          |
| `claude.ts`     | Generación y limpieza de `CLAUDE.md`                                                                                  |

### Flujo de datos

```text
skills-map.ts (declarativo)
       ↓
lib.ts detectTechnologies() → escanea proyecto → retorna tecnologías + combos
       ↓
lib.ts collectSkills() → mapea tecnologías a skills disponibles
       ↓
installer.ts installSkillGlobal() → verifica integridad (SHA-256) → copia a ~/.agents/skills/
       ↓
writeArtifactForIDE() → distribuye a cada IDE según su formato:
  • format "dir"  → copia la carpeta completa (Claude, Kiro, Copilot/Cursor/Windsurf comparten ~/.agents/skills/)
  • format "file" → extrae SKILL.md como archivo plano (agents, rules, prompts)
  • format "append" → agrega contenido a un archivo existente (copilot-instructions.md)
```

### IDE Map (rutas de instalación)

Todos los IDEs son `isGlobal: true` (se detectan en `$HOME`):

| IDE        | detectionPath        | skills              | agents                              | rules                    | prompts                  |
| ---------- | -------------------- | ------------------- | ----------------------------------- | ------------------------ | ------------------------ |
| claude-code| `.claude`            | `.claude/skills`    | `.claude/agents`                    | `.claude/rules`          | `.claude/prompts`        |
| kiro       | `.kiro`              | `.kiro/skills`      | `.kiro/agents`                      | `.kiro/rules`            | `.kiro/prompts`          |
| copilot    | `.vscode`            | `.agents/skills`    | `.agents/agents`                    | `.copilot` (append)      | `.copilot/prompts`       |
| windsurf   | `.codeium/windsurf`  | `.agents/skills`    | `.codeium/windsurf/global_workflows`| `.codeium/windsurf/rules`| `.codeium/windsurf/prompts`|
| cursor     | `.cursor`            | `.agents/skills`    | `.agents/agents`                    | `.cursor/rules`          | `.cursor/prompts`        |

> Copilot, Windsurf y Cursor comparten `~/.agents/skills/` para evitar duplicación de archivos.
> Los agents se instalan como archivos `.md` planos en la carpeta target. El staging temporal
> vive en `~/.agents/.cache/agents/` y no contamina la carpeta final.

### Registry y seguridad

- `scripts/sync-skills.mjs` descarga skills de repos upstream, los audita con un modelo de OpenAI (prompt de seguridad), y los persiste en `skills-registry/`.
- Cada skill tiene un `bundleHash` (SHA-256 de todos sus archivos) que se verifica en cada instalación.
- El manifiesto `skills-registry/index.json` contiene: source, commitSha, files, sha256 por archivo, bundleHash, y resultado del review.
- `scripts/validate-registry.mjs` se ejecuta en `prepublishOnly` para garantizar consistencia.

### Skills locales de Pragma vs skills upstream

El registry maneja **dos tipos de skills**:

#### 1. Skills upstream (sincronizados desde GitHub)

- Se descargan con `pnpm sync:skills` desde repos públicos (e.g. `vercel-labs/next-skills`, `angular/skills`).
- Se auditan automáticamente con OpenAI antes de persistirse.
- Su entry en `index.json` tiene `commitSha` con un SHA de git real y `skillPath` con la ruta completa (`owner/repo/skill-name`).
- Para re-sincronizar: `pnpm sync:skills --only <skill-name>` o `pnpm sync:skills --force`.

#### 2. Skills locales de Pragma (agregados manualmente)

- **No viven en un repo externo**: se mantienen directamente en `skills-registry/` dentro de este repositorio.
- Su entry en `index.json` tiene `commitSha: "local"` y usa `source` (equivalente a `skillPath`).
- Incluyen: todas las carpetas bajo `skills-registry/rules/`, `skills-registry/workflows/`, y skills como `angular-security`, `clean-architecture-uml`, `typescript-best-practices`, etc.
- Para agregar un skill local nuevo:
  1. Crear la carpeta en `skills-registry/<nombre>/` con al menos un `SKILL.md`.
  2. Agregar una entry en `skills-registry/index.json` con `commitSha: "local"`, `source`, `files`, `sha256`, y `bundleHash`.
  3. Declarar el skill en `skills-map.ts` bajo la tecnología correcta (campo `skills`, `workflows`, `autoRules` o `agents`).
  4. Ejecutar `pnpm validate:registry` para verificar consistencia.

#### Campos del skills-map.ts que declaran contenido instalable

| Campo        | Propósito                                            | Ejemplo                                        |
| ------------ | ---------------------------------------------------- | ---------------------------------------------- |
| `skills`     | Skills de conocimiento (Markdown con best practices) | `"pragma/autoskills/react-security"`           |
| `workflows`  | Workflows multi-paso (code-review, testing, etc.)    | `"pragma/autoskills/workflows/unit-test-review"`|
| `autoRules`  | Reglas auto-inyectadas (SOLID, seguridad, etc.)      | `"pragma/autoskills/rules/solid-clean"`        |
| `agents`     | Agentes autónomos con instrucciones de ejecución     | `"pragma/autoskills/workflows/create-view"`    |

> **Importante**: `validate-registry.mjs` y `sync-skills.mjs` recopilan entries de **todos** estos campos.
> Si un skill existe en `index.json` pero no está declarado en ninguno de estos campos, la validación falla.

#### Regenerar hashes de skills locales

Si editas el contenido de un skill local (e.g. modificas `SKILL.md`), los hashes en `index.json` quedarán desactualizados. Para regenerarlos:

```bash
node -e "
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const REGISTRY_DIR = 'skills-registry';
const MANIFEST_PATH = join(REGISTRY_DIR, 'index.json');
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');
for (const [name, entry] of Object.entries(manifest.skills)) {
  if (entry.commitSha !== 'local') continue;
  const dir = join(REGISTRY_DIR, name);
  if (!existsSync(dir)) continue;
  const newSha = {}, parts = [];
  for (const file of entry.files) {
    const h = sha256Hex(readFileSync(join(dir, file)));
    newSha[file] = h; parts.push(file+':'+h);
  }
  entry.sha256 = newSha;
  entry.bundleHash = sha256Hex(parts.sort().join('\n'));
}
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
console.log('Hashes regenerated.');
"
```

Luego ejecutar `pnpm validate:registry` para confirmar.

---

## Auth System

sopp-front requiere autenticación con una cuenta de Google `@pragma.com.co`.

### Cómo funciona

- OAuth 2.0 para Installed Applications (RFC 8252) con PKCE obligatorio (RFC 7636)
- Flujo: loopback IP redirect (`http://127.0.0.1:<puerto-efímero>`)
- Token almacenado en `~/.config/sopp-front/auth.json` (permisos: `600`)
- Refresh automático cuando el token expira (tokens de Google expiran en 1 h)
- Validación de dominio vía claim `hd` del ID token de Google

### Setup en Google Cloud Console

1. Crear proyecto `sopp-front-auth` en Google Cloud Console
2. Habilitar **Google Identity API** / **People API**
3. OAuth consent screen:
   - User Type: **Internal** (restringe a cuentas del workspace `pragma.com.co`)
   - Scopes: `openid`, `email`
4. Credentials → Create → **Desktop application**
   - Copiar `CLIENT_ID` y `CLIENT_SECRET`
   - Para desktop apps el `client_secret` no es un secreto verdadero (documentado por Google)
5. Inyectar los valores como variables de entorno en el build:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

### Variables de entorno

| Variable                 | Descripción                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`       | Client ID de la app de escritorio en Google Cloud Console           |
| `GOOGLE_CLIENT_SECRET`   | Client Secret de la app de escritorio en Google Cloud Console       |
| `AUTOSKILLS_SKIP_AUTH`   | Valor `1` omite la autenticación (para pipelines CI/CD)             |
| `AUTOSKILLS_CONFIG_DIR`  | Sobreescribe el directorio base de configuración (útil en tests)    |

### Ubicación del token

```text
~/.config/sopp-front/auth.json   (permisos 600)
```

### Logout

```bash
npx sopp-front --logout
```

---

## Supply Chain Security

### Reglas para agentes de IA y contribuidores

- **Nunca usar `^` o `~`** en versiones de dependencias — siempre pin exacto.
- **Siempre commitear el lockfile** (`pnpm-lock.yaml`). Nunca borrarlo ni agregarlo a `.gitignore`.
- **Los install scripts están deshabilitados**. Si una dependencia requiere un build step, debe aprobarse explícitamente.
- **Las versiones de paquetes nuevos deben tener al menos 1 día de antigüedad** antes de instalarlas.
- Al agregar una dependencia, verificarla en [npmjs.com](https://www.npmjs.com) antes de instalar.
- Preferir paquetes bien mantenidos con publishers verificados y provenance.
- Ejecutar `pnpm install` con el lockfile presente — nunca saltearlo.
- No agregar dependencias git-based o tarball URL sin aprobación explícita.
- **No ejecutar `npm update`**, `npx npm-check-updates`, ni ningún comando de upgrade masivo. Revisar cada actualización individualmente.
- **Usar installs deterministas**: preferir `pnpm install --frozen-lockfile` en CI y scripts.

---

## Testing

- Los tests usan el runner built-in de Node.js (`node:test`) y `node:assert/strict`.
- **Siempre destructurar** las funciones de assert específicas en lugar de importar el objeto `assert` por defecto.

```ts
// ✅ Correcto
import { ok, strictEqual, deepStrictEqual } from "node:assert/strict";
ok(value);
strictEqual(a, b);

// ❌ Incorrecto
import assert from "node:assert/strict";
assert.ok(value);
assert.strictEqual(a, b);
```

- Usar los helpers compartidos de `tests/helpers.ts` (`useTmpDir`, `writePackageJson`, `writeJson`, `writeFile`, `addWorkspace`) para evitar duplicar lógica de setup de filesystem en los tests.

---

## Output helpers

- **Nunca usar `console.log` o `process.stdout.write` directamente** en el CLI. Usar los helpers `log` y `write` exportados desde `./colors.js`.

```ts
// ✅ Correcto
import { log, write } from "./colors.js";
log("hello");
write("raw output\n");

// ❌ Incorrecto
console.log("hello");
process.stdout.write("raw output\n");
```

---

## Scripts útiles

| Script                   | Descripción                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `pnpm build`             | Compila TypeScript a `dist/`                                      |
| `pnpm test`              | Ejecuta todos los tests                                           |
| `pnpm validate:registry` | Valida integridad del registry vs skills-map                      |
| `pnpm sync:skills`       | Descarga y audita skills desde GitHub (requiere `OPENAI_API_KEY`) |
| `pnpm release`           | Release completa: bump, changelog, publish, GitHub release        |
