import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { bold, cyan, dim, green, red, yellow, log, write } from "../colors.js";
import { detectTechnologies } from "../lib.js";

// ── Tipos públicos ────────────────────────────────────────────

export interface WorkflowContext {
  projectDir: string;
  detectedIds: string[];
  rl: ReturnType<typeof createInterface>;
}

export type WorkflowBranch = (ctx: WorkflowContext) => Promise<void>;

export interface WorkflowDefinition {
  name: string;
  description: string;
  stacks: Array<{
    requires: string[];
    branch: WorkflowBranch;
  }>;
}

// ── Helpers de UI — exportados para usar en las ramas ────────

export function askText(
  rl: ReturnType<typeof createInterface>,
  question: string,
  placeholder: string,
): Promise<string> {
  return new Promise((resolve) => {
    log("");
    log(cyan("  ?") + " " + bold(question) + dim(` (ej: ${placeholder})`));
    log("");
    const tryAsk = () => {
      rl.question(dim("  › "), (raw) => {
        const trimmed = raw.trim();
        if (trimmed.length > 0) {
          resolve(trimmed);
        } else {
          write(red("  No puede estar vacío. Intenta de nuevo.\n"));
          tryAsk();
        }
      });
    };
    tryAsk();
  });
}

export function askOption(
  rl: ReturnType<typeof createInterface>,
  question: string,
  options: string[],
): Promise<number> {
  return new Promise((resolve) => {
    log("");
    log(cyan("  ?") + " " + bold(question));
    options.forEach((opt, i) => log(dim(`    [${i + 1}]`) + " " + opt));
    log("");
    const tryAsk = () => {
      rl.question(dim("  › "), (raw) => {
        const num = parseInt(raw.trim(), 10);
        if (num >= 1 && num <= options.length) {
          resolve(num - 1);
        } else {
          write(red(`  Opción inválida. Ingresa un número entre 1 y ${options.length}.\n`));
          tryAsk();
        }
      });
    };
    tryAsk();
  });
}

// ── Helpers de nombre — exportados para tests ────────────────

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

export function toPascalCase(str: string): string {
  return toKebabCase(str)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

// ── Motor principal ───────────────────────────────────────────

export async function runWorkflow(workflow: WorkflowDefinition): Promise<void> {
  const projectDir = resolve(".");
  const { detected } = detectTechnologies(projectDir);
  const detectedIds = detected.map((t) => t.id);

  const match = workflow.stacks.find((s) =>
    s.requires.every((req) => detectedIds.includes(req)),
  );

  if (!match) {
    log("");
    log(yellow(`  ⚠ El workflow "${workflow.name}" no está disponible para este stack.`));
    log(dim(`  Stack detectado: ${detectedIds.join(", ") || "ninguno"}`));
    log(
      dim(
        `  Stacks soportados: ${workflow.stacks.map((s) => s.requires.join(" + ")).join(" | ")}`,
      ),
    );
    log("");
    process.exit(0);
  }

  log("");
  log(
    cyan(`  ◆ Workflow: ${workflow.name}`) +
      dim(`  [${match.requires.join(" + ")}]`),
  );
  log("");

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    await match.branch({ projectDir, detectedIds, rl });
  } finally {
    rl.close();
  }
}
