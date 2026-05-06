import type { Dirent } from "node:fs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

export interface ProjectContext {
  stack: string[];
  designSystem: string | null;
  domainModels: Array<{ name: string; content: string }>;
  useCases: Array<{ name: string; content: string }>;
  similarComponents: Array<{ name: string; content: string }>;
  conventions: string[];
}

// ── Helpers ───────────────────────────────────────────────────

function readSafe(path: string): string | null {
  try { return readFileSync(path, "utf-8"); } catch { return null; }
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".cache", ".angular"]);

function findFiles(dir: string, match: (name: string) => boolean, maxDepth = 4): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  function walk(current: string, depth: number): void {
    if (depth > maxDepth) return;
    let entries: Dirent<string>[];
    try { entries = readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(current, e.name);
      if (e.isDirectory() && !SKIP_DIRS.has(e.name)) walk(full, depth + 1);
      else if (e.isFile() && match(e.name)) results.push(full);
    }
  }

  walk(dir, 0);
  return results;
}

function truncate(s: string, max = 2000): string {
  return s.length <= max ? s : s.slice(0, max) + "\n// ...(truncado)";
}

function keyword(componentName: string): string {
  return componentName.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "").split("-")[0];
}

// ── Design system ─────────────────────────────────────────────

export function detectDesignSystem(projectDir: string): string | null {
  const raw = readSafe(join(projectDir, "package.json"));
  if (!raw) return null;
  let deps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(raw);
    deps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch { return null; }

  if (deps["@angular/material"]) return "Angular Material";
  if (deps["primeng"]) return "PrimeNG";
  if (deps["@chakra-ui/react"]) return "Chakra UI";
  if (deps["@mui/material"]) return "Material UI";
  if (deps["antd"]) return "Ant Design";
  if (existsSync(join(projectDir, "components.json"))) return "shadcn/ui";
  if (deps["tailwindcss"] || deps["@tailwindcss/vite"]) return "Tailwind CSS";
  return null;
}

// ── Domain models ─────────────────────────────────────────────

export function findDomainModels(
  projectDir: string,
  componentName: string,
): Array<{ name: string; content: string }> {
  const kw = keyword(componentName);
  const bases = [
    join(projectDir, "src", "app", "domain", "models"),
    join(projectDir, "src", "app", "aplication", "domain", "models"),
    join(projectDir, "src", "domain", "models"),
    join(projectDir, "src", "models"),
  ];

  const results: Array<{ name: string; content: string }> = [];
  for (const base of bases) {
    const files = findFiles(base, (n) => n.endsWith(".model.ts") && n.toLowerCase().includes(kw));
    for (const f of files.slice(0, 3)) {
      const content = readSafe(f);
      if (content) results.push({ name: relative(projectDir, f), content: truncate(content, 1500) });
    }
    if (results.length >= 3) break;
  }
  return results;
}

// ── Use cases ─────────────────────────────────────────────────

export function findUseCases(
  projectDir: string,
  componentName: string,
): Array<{ name: string; content: string }> {
  const kw = keyword(componentName);
  const bases = [
    join(projectDir, "src", "app", "application", "use-cases"),
    join(projectDir, "src", "app", "aplication", "use-cases"),
    join(projectDir, "src", "application", "use-cases"),
    join(projectDir, "src", "use-cases"),
  ];

  const results: Array<{ name: string; content: string }> = [];
  for (const base of bases) {
    const files = findFiles(base, (n) => n.endsWith(".usecase.ts") && n.toLowerCase().includes(kw));
    for (const f of files.slice(0, 2)) {
      const content = readSafe(f);
      if (content) results.push({ name: relative(projectDir, f), content: truncate(content, 1500) });
    }
    if (results.length >= 2) break;
  }
  return results;
}

// ── Componentes similares ─────────────────────────────────────

export function findSimilarComponents(
  projectDir: string,
  isPage: boolean,
): Array<{ name: string; content: string }> {
  const bases = isPage
    ? [
        join(projectDir, "src", "app", "presentation", "pages"),
        join(projectDir, "src", "pages"),
        join(projectDir, "src", "views"),
      ]
    : [
        join(projectDir, "src", "app", "presentation", "components"),
        join(projectDir, "src", "components"),
      ];

  const results: Array<{ name: string; content: string }> = [];
  for (const base of bases) {
    const files = findFiles(
      base,
      (n) => n.endsWith(".component.ts") && !n.endsWith(".spec.ts"),
    );
    for (const f of files.slice(0, 2)) {
      const content = readSafe(f);
      if (content && content.length > 100) {
        results.push({ name: relative(projectDir, f), content: truncate(content, 2500) });
        if (results.length >= 2) return results;
      }
    }
  }
  return results;
}

// ── Convenciones ──────────────────────────────────────────────

export function detectConventions(projectDir: string, detectedIds: string[]): string[] {
  const c: string[] = [];

  if (detectedIds.includes("angular")) {
    c.push("Usar inject() en vez de constructor DI");
    c.push("standalone: true en todos los componentes");
    c.push("Signals para estado: signal(), computed(), effect()");
    c.push("Tests: await fixture.whenStable() — NUNCA fixture.detectChanges()");
  }
  if (detectedIds.includes("react")) {
    c.push("Componentes funcionales, nunca clases");
    c.push("TypeScript estricto, siempre tipar props con interface Props");
    c.push("Tests con React Testing Library, nunca querySelector directo");
  }

  const srcApp = join(projectDir, "src", "app");
  const hasCleanArch = ["domain", "application", "aplication", "infrastructure", "presentation"]
    .some((l) => existsSync(join(srcApp, l)));
  if (hasCleanArch) {
    c.push("Clean Architecture: domain → application → infrastructure/presentation");
    c.push("No importar infrastructure desde presentation directamente");
  }

  return c;
}

// ── Entry point ───────────────────────────────────────────────

export function collectProjectContext(
  projectDir: string,
  componentName: string,
  isPage: boolean,
  detectedIds: string[],
): ProjectContext {
  return {
    stack: detectedIds,
    designSystem: detectDesignSystem(projectDir),
    domainModels: findDomainModels(projectDir, componentName),
    useCases: findUseCases(projectDir, componentName),
    similarComponents: findSimilarComponents(projectDir, isPage),
    conventions: detectConventions(projectDir, detectedIds),
  };
}
