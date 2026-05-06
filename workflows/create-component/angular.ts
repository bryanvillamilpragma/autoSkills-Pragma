import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
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

// ── Helpers internos ─────────────────────────────────────────

function scanFolders(basePath: string): string[] {
  if (!existsSync(basePath)) return [];
  return readdirSync(basePath, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

// ── Constructores de contenido ────────────────────────────────

function buildComponentTs(opts: {
  name: string;
  className: string;
  type: "page" | "presentacional" | "shared";
  needsViewModel: boolean;
  formType: "reactive" | "template" | "none";
}): string {
  const { name, className, type, needsViewModel, formType } = opts;

  const coreImports = ["Component"];
  if (type === "page") coreImports.push("OnInit");
  if (needsViewModel || formType !== "none") coreImports.push("inject");

  const ngImports: string[] = ["CommonModule"];
  const extraImports: string[] = [];

  if (formType === "reactive") {
    ngImports.push("ReactiveFormsModule");
    extraImports.push(`import { FormGroup, ReactiveFormsModule } from '@angular/forms';`);
  }
  if (formType === "template") {
    ngImports.push("FormsModule");
    extraImports.push(`import { FormsModule } from '@angular/forms';`);
  }
  if (needsViewModel) {
    extraImports.push(
      `import { ${className}ViewModel } from './${name}.view-model';`,
    );
  }

  let out = `import { ${coreImports.join(", ")} } from '@angular/core';\n`;
  out += `import { CommonModule } from '@angular/common';\n`;
  if (extraImports.length) out += extraImports.join("\n") + "\n";
  out += "\n";
  out += `@Component({\n`;
  out += `  selector: 'app-${name}',\n`;
  out += `  standalone: true,\n`;
  out += `  imports: [${ngImports.join(", ")}],\n`;
  out += `  templateUrl: './${name}.component.html',\n`;
  out += `})\n`;

  if (type === "page") {
    out += `export class ${className}Component implements OnInit {\n`;
    if (needsViewModel) {
      out += `  protected readonly vm = inject(${className}ViewModel);\n`;
    }
    if (formType === "reactive") {
      out += `  protected readonly form = new FormGroup({});\n`;
    }
    out += `\n  ngOnInit(): void {\n    // inicialización\n  }\n}\n`;
  } else if (type === "presentacional") {
    out += `export class ${className}Component {\n`;
    out += `  // Ejemplo: readonly title = input.required<string>();\n`;
    out += `  // Ejemplo: readonly action = output<void>();\n`;
    out += `}\n`;
  } else {
    out += `export class ${className}Component {\n`;
    out += `  // Ejemplo: readonly label = input<string>('');\n`;
    out += `}\n`;
  }

  return out;
}

function buildComponentHtml(name: string, className: string): string {
  return `<div class="${name}">\n  <!-- ${className}Component -->\n</div>\n`;
}

function buildComponentSpec(name: string, className: string): string {
  return `import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ${className}Component } from './${name}.component';

describe('${className}Component', () => {
  let component: ${className}Component;
  let fixture: ComponentFixture<${className}Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [${className}Component],
    }).compileComponents();

    fixture = TestBed.createComponent(${className}Component);
    component = fixture.componentInstance;
  });

  it('should create', async () => {
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });
});
`;
}

function buildViewModelTs(name: string, className: string): string {
  return `import { Injectable, signal, computed } from '@angular/core';

@Injectable()
export class ${className}ViewModel {
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly hasError = computed(() => this.error() !== null);
}
`;
}

function buildViewModelSpec(name: string, className: string): string {
  return `import { TestBed } from '@angular/core/testing';
import { ${className}ViewModel } from './${name}.view-model';

describe('${className}ViewModel', () => {
  let vm: ${className}ViewModel;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [${className}ViewModel],
    });
    vm = TestBed.inject(${className}ViewModel);
  });

  it('should initialize with default state', () => {
    expect(vm.isLoading()).toBe(false);
    expect(vm.error()).toBeNull();
    expect(vm.hasError()).toBe(false);
  });
});
`;
}

// ── Rama principal ────────────────────────────────────────────

export async function runAngularCleanArch(ctx: WorkflowContext): Promise<void> {
  const { projectDir, rl } = ctx;

  // P1 — nombre
  const rawName = await askText(rl, "¿Cómo se llama el componente?", "PaymentForm");
  const name = toKebabCase(rawName);
  const className = toPascalCase(rawName);

  // P2 — tipo
  const typeIdx = await askOption(rl, "¿Qué tipo de componente es?", [
    "page (smart) — tiene lógica, se conecta a ViewModels o UseCases",
    "presentacional (dumb) — solo recibe @Input() y emite @Output()",
    "shared / reutilizable — componente de UI genérico",
  ]);
  const typeMap = ["page", "presentacional", "shared"] as const;
  const type = typeMap[typeIdx];

  let feature: string | undefined;
  let needsViewModel = false;
  let formType: "reactive" | "template" | "none" = "none";

  if (type === "page") {
    // P3 — feature
    const pagesBase = join(projectDir, "src", "app", "presentation", "pages");
    const existing = scanFolders(pagesBase);
    const opts = [...existing, "+ crear nueva feature"];
    const idx = await askOption(rl, "¿En qué feature va?", opts);

    if (idx === opts.length - 1) {
      const raw = await askText(rl, "Nombre de la nueva feature:", "payments");
      feature = toKebabCase(raw);
    } else {
      feature = existing[idx];
    }

    // P4 — ViewModel
    const vmIdx = await askOption(rl, "¿Necesita ViewModel propio?", [
      "sí — tiene estado y lógica propios",
      "no — usa el ViewModel existente de la feature",
    ]);
    needsViewModel = vmIdx === 0;
  }

  if (type === "page" || type === "presentacional") {
    // P5 — formulario
    const formIdx = await askOption(rl, "¿El componente maneja un formulario?", [
      "sí, reactivo (ReactiveFormsModule)",
      "sí, template-driven (FormsModule)",
      "no",
    ]);
    formType = (["reactive", "template", "none"] as const)[formIdx];
  }

  // Calcular ruta destino
  let targetDir: string;
  if (type === "page" && feature) {
    targetDir = join(projectDir, "src", "app", "presentation", "pages", feature, name);
  } else if (type === "presentacional") {
    targetDir = join(projectDir, "src", "app", "presentation", "components", name);
  } else {
    targetDir = join(projectDir, "src", "app", "presentation", "components", "shared", name);
  }

  // Construir lista de archivos
  const files: Array<{ rel: string; content: string }> = [
    {
      rel: `${name}.component.ts`,
      content: buildComponentTs({ name, className, type, needsViewModel, formType }),
    },
    {
      rel: `${name}.component.html`,
      content: buildComponentHtml(name, className),
    },
    {
      rel: `${name}.component.spec.ts`,
      content: buildComponentSpec(name, className),
    },
  ];

  if (type === "page" && needsViewModel) {
    files.push({ rel: `${name}.view-model.ts`, content: buildViewModelTs(name, className) });
    files.push({ rel: `${name}.view-model.spec.ts`, content: buildViewModelSpec(name, className) });
  }

  // Confirmación
  const relTarget = targetDir.replace(projectDir + "/", "");
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

  const isPage = type === "page";
  const projectCtx = collectProjectContext(
    projectDir,
    name,
    isPage,
    ["angular", "clean-architecture-uml"],
  );

  const commandContent = buildAngularCommand({
    name,
    className,
    type,
    needsViewModel,
    formType,
    context: projectCtx,
    targetDir: relTarget,
    files: files.map((f) => f.rel),
  });

  // Escribir en .claude/commands/
  const commandsDir = join(projectDir, ".claude", "commands");
  mkdirSync(commandsDir, { recursive: true });
  const commandPath = join(commandsDir, `${name}.md`);
  writeFileSync(commandPath, commandContent, "utf-8");

  log("");
  log(green("  ✔") + " " + dim(`Comando generado: .claude/commands/${name}.md`));
  log("");
  log(cyan("  ◆ Corre en Claude Code:"));
  log(bold(`     /user:${name}`));
  log("");
  log(dim("  Claude Code leerá el contexto del proyecto y generará:"));
  for (const f of files) {
    log(dim("    +") + " " + join(relTarget, f.rel));
  }
  log("");
}

// ── Builder del comando ───────────────────────────────────────

interface CommandOptions {
  name: string;
  className: string;
  type: "page" | "presentacional" | "shared";
  needsViewModel: boolean;
  formType: "reactive" | "template" | "none";
  context: import("../context-collector.js").ProjectContext;
  targetDir: string;
  files: string[];
}

function buildAngularCommand(opts: CommandOptions): string {
  const { name, className, type, needsViewModel, formType, context, targetDir, files } = opts;

  const lines: string[] = [];

  lines.push(`# Crear componente: ${className}`);
  lines.push("");
  lines.push("## Instrucción");
  lines.push(
    `Crea el componente Angular "${className}" en \`${targetDir}/\` con todos sus archivos. ` +
    `Genera código real y funcional — no plantillas vacías ni TODOs.`,
  );
  lines.push("");
  lines.push("## Especificación");
  lines.push(`- Tipo: ${type}`);
  lines.push(`- ViewModel propio: ${needsViewModel ? "sí" : "no"}`);
  lines.push(`- Formulario: ${formType}`);
  lines.push("");
  lines.push("## Stack detectado");
  lines.push(context.stack.join(", "));

  if (context.designSystem) {
    lines.push("");
    lines.push("## Design system");
    lines.push(
      `Usar **${context.designSystem}** para todos los elementos de UI. ` +
      `No usar HTML nativo si existe un componente equivalente en el design system.`,
    );
  }

  if (context.domainModels.length > 0) {
    lines.push("");
    lines.push("## Modelos de dominio disponibles");
    lines.push("Usa estas interfaces para tipar el componente:");
    for (const m of context.domainModels) {
      lines.push(`\n### \`${m.name}\``);
      lines.push("```typescript");
      lines.push(m.content);
      lines.push("```");
    }
  }

  if (context.useCases.length > 0) {
    lines.push("");
    lines.push("## UseCases disponibles");
    lines.push("Inyecta y usa estos use cases en el componente:");
    for (const uc of context.useCases) {
      lines.push(`\n### \`${uc.name}\``);
      lines.push("```typescript");
      lines.push(uc.content);
      lines.push("```");
    }
  }

  if (context.similarComponents.length > 0) {
    lines.push("");
    lines.push("## Referencia de estilo del equipo");
    lines.push(
      "**IMPORTANTE:** genera el nuevo componente con el **mismo estilo** que estos componentes existentes. " +
      "Mismos patrones, misma estructura, mismas convenciones.",
    );
    for (const sc of context.similarComponents) {
      lines.push(`\n### \`${sc.name}\``);
      lines.push("```typescript");
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
  lines.push("- Usar `inject()` — NUNCA constructor DI");
  lines.push("- `standalone: true` en todos los componentes");
  lines.push("- Signals para estado: `signal()`, `computed()`, `effect()`");
  lines.push("- Tests: `await fixture.whenStable()` — NUNCA `fixture.detectChanges()`");
  lines.push("- No importar `infrastructure` desde `presentation`");
  lines.push("- Código real y funcional, sin placeholders ni comentarios TODO");

  return lines.join("\n") + "\n";
}
