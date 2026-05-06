import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bold, cyan, dim, green, yellow, log } from "../../colors.js";
import {
  type WorkflowContext,
  askOption,
  askText,
  toKebabCase,
  toPascalCase,
} from "../runner.js";
import { collectProjectContext } from "../context-collector.js";

// ── Constructores de contenido ────────────────────────────────

function buildPageWithHook(className: string): string {
  return `import { use${className} } from './use${className}';

export function ${className}() {
  const { isLoading, error, data } = use${className}();

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      {/* ${className} */}
    </div>
  );
}
`;
}

function buildPageWithoutHook(className: string): string {
  return `export function ${className}() {
  return (
    <div>
      {/* ${className} */}
    </div>
  );
}
`;
}

function buildUiComponent(className: string): string {
  return `interface Props {
  // definir props
}

export function ${className}({ }: Props) {
  return (
    <div>
      {/* ${className} */}
    </div>
  );
}
`;
}

function buildSharedComponent(className: string): string {
  return `interface Props {
  children?: React.ReactNode;
  className?: string;
}

export function ${className}({ children, className }: Props) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
`;
}

function buildReactSpec(className: string): string {
  return `import { render, screen } from '@testing-library/react';
import { ${className} } from './${className}';

describe('${className}', () => {
  it('should render without errors', () => {
    render(<${className} />);
    expect(document.querySelector('div')).toBeInTheDocument();
  });
});
`;
}

function buildHook(className: string): string {
  return `import { useState } from 'react';

export function use${className}() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState(null);

  return { isLoading, error, data };
}
`;
}

function buildHookSpec(className: string): string {
  return `import { renderHook } from '@testing-library/react';
import { use${className} } from './use${className}';

describe('use${className}', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => use${className}());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
`;
}

// ── Rama principal ────────────────────────────────────────────

export async function runReact(ctx: WorkflowContext): Promise<void> {
  const { projectDir, rl } = ctx;

  // P1 — nombre
  const rawName = await askText(rl, "¿Cómo se llama el componente?", "PaymentForm");
  const className = toPascalCase(rawName);

  // P2 — tipo
  const typeIdx = await askOption(rl, "¿Qué tipo de componente es?", [
    "page / view — componente de ruta, puede tener fetching de datos",
    "componente de UI — recibe props, no tiene lógica de negocio",
    "shared / reutilizable — componente genérico de design system",
  ]);
  const typeMap = ["page", "ui", "shared"] as const;
  const type = typeMap[typeIdx];

  let needsHook = false;
  if (type === "page") {
    const hookIdx = await askOption(rl, "¿Necesita hook propio para manejar su estado?", [
      "sí — tiene loading, error, datos o lógica compleja",
      "no — estado simple con useState local",
    ]);
    needsHook = hookIdx === 0;
  }

  // P3 — carpeta destino
  const candidates = ["src/components", "src/pages", "src/views", "src/features"].filter((p) =>
    existsSync(join(projectDir, p)),
  );

  let targetFolder: string;
  if (candidates.length === 0) {
    targetFolder = type === "page" ? "src/pages" : "src/components";
    log("");
    log(dim(`  No se encontraron carpetas existentes. Se usará: ${targetFolder}`));
  } else {
    const opts = [...candidates, "+ crear carpeta nueva"];
    const idx = await askOption(rl, "¿Dónde va el componente?", opts);
    if (idx === opts.length - 1) {
      const raw = await askText(rl, "Ruta relativa desde la raíz:", "src/features/payments");
      targetFolder = raw.startsWith("src/") ? raw : `src/${raw}`;
    } else {
      targetFolder = candidates[idx];
    }
  }

  const targetDir = join(projectDir, targetFolder, className);
  const relTarget = join(targetFolder, className);

  // Construir archivos
  const files: Array<{ rel: string; content: string }> = [];

  let componentContent: string;
  if (type === "page" && needsHook) {
    componentContent = buildPageWithHook(className);
  } else if (type === "ui") {
    componentContent = buildUiComponent(className);
  } else if (type === "shared") {
    componentContent = buildSharedComponent(className);
  } else {
    componentContent = buildPageWithoutHook(className);
  }

  files.push({ rel: `${className}.tsx`, content: componentContent });
  files.push({ rel: `${className}.test.tsx`, content: buildReactSpec(className) });

  if (type === "page" && needsHook) {
    files.push({ rel: `use${className}.ts`, content: buildHook(className) });
    files.push({ rel: `use${className}.test.ts`, content: buildHookSpec(className) });
  }

  // Confirmación
  log("");
  log(yellow("  ◆ Se van a generar estos archivos:"));
  log("");
  log(dim(`  ${relTarget}/`));
  for (const f of files) {
    log(green("    +") + " " + f.rel);
  }
  log("");

  const confirmIdx = await askOption(rl, "¿Confirmar y generar?", [
    "sí, generar",
    "cancelar",
  ]);

  if (confirmIdx === 1) {
    log("");
    log(dim("  Cancelado."));
    return;
  }

  // ── Generar comando enriquecido para Claude Code ──────────

  const projectCtx = collectProjectContext(
    projectDir,
    className,
    type === "page",
    ["react"],
  );

  const commandContent = buildReactCommand({
    className,
    type,
    needsHook,
    context: projectCtx,
    targetDir: relTarget,
    files: files.map((f) => f.rel),
  });

  const commandsDir = join(projectDir, ".claude", "commands");
  mkdirSync(commandsDir, { recursive: true });
  const commandPath = join(commandsDir, `${className}.md`);
  writeFileSync(commandPath, commandContent, "utf-8");

  log("");
  log(green("  ✔") + " " + dim(`Comando generado: .claude/commands/${className}.md`));
  log("");
  log(cyan("  ◆ Corre en Claude Code:"));
  log(bold(`     /user:${className}`));
  log("");
  log(dim("  Claude Code leerá el contexto del proyecto y generará:"));
  for (const f of files) {
    log(dim("    +") + " " + join(relTarget, f.rel));
  }
  log("");
}

// ── Builder del comando ───────────────────────────────────────

interface ReactCommandOptions {
  className: string;
  type: "page" | "ui" | "shared";
  needsHook: boolean;
  context: import("../context-collector.js").ProjectContext;
  targetDir: string;
  files: string[];
}

function buildReactCommand(opts: ReactCommandOptions): string {
  const { className, type, needsHook, context, targetDir, files } = opts;

  const lines: string[] = [];

  lines.push(`# Crear componente: ${className}`);
  lines.push("");
  lines.push("## Instrucción");
  lines.push(
    `Crea el componente React "${className}" en \`${targetDir}/\` con todos sus archivos. ` +
    `Genera código real y funcional — no plantillas vacías ni TODOs.`,
  );
  lines.push("");
  lines.push("## Especificación");
  lines.push(`- Tipo: ${type}`);
  lines.push(`- Hook propio: ${needsHook ? "sí" : "no"}`);
  lines.push("");
  lines.push("## Stack detectado");
  lines.push(context.stack.join(", "));

  if (context.designSystem) {
    lines.push("");
    lines.push("## Design system");
    lines.push(`Usar **${context.designSystem}**. No usar HTML nativo si existe equivalente.`);
  }

  if (context.similarComponents.length > 0) {
    lines.push("");
    lines.push("## Referencia de estilo del equipo");
    lines.push("Genera el componente con el **mismo estilo** que estos:");
    for (const sc of context.similarComponents) {
      lines.push(`\n### \`${sc.name}\``);
      lines.push("```tsx");
      lines.push(sc.content);
      lines.push("```");
    }
  }

  if (context.conventions.length > 0) {
    lines.push("");
    lines.push("## Convenciones del equipo (obligatorias)");
    for (const c of context.conventions) {
      lines.push(`- ${c}`);
    }
  }

  lines.push("");
  lines.push("## Archivos a generar");
  lines.push(`Ruta base: \`${targetDir}/\``);
  lines.push("");
  for (const f of files) {
    lines.push(`- \`${f}\``);
  }

  lines.push("");
  lines.push("## Reglas de generación");
  lines.push("- Componentes funcionales únicamente — nunca clases");
  lines.push("- TypeScript estricto — siempre `interface Props`");
  lines.push("- Named exports, no default exports");
  lines.push("- Tests con React Testing Library — nunca querySelector directo");
  lines.push("- Código real y funcional, sin placeholders ni TODOs");

  return lines.join("\n") + "\n";
}
