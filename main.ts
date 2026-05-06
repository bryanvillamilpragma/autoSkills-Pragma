import type { Dirent } from "node:fs";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkAuth, authenticate, logout as authLogout } from "./auth.js";
import { cleanupClaudeMd } from "./claude.js";
import {
    bold,
    cyan,
    dim,
    gray,
    green,
    log,
    magenta,
    muted,
    pink,
    red,
    SHOW_CURSOR,
    write,
    yellow,
} from "./colors.js";
import type { InstallSecurityCheck } from "./installer.js";
import {
    clearAutoskillsCache,
    getRegistryDir,
    installSkillGlobal,
    loadRegistry,
    securityCheckForSkillPath,
} from "./installer.js";
import type { ComboSkill, SkillEntry, Technology } from "./lib.js";
import { collectAutoRules, collectSkills, detectAgents, detectInstalledIDEs, detectTechnologies, getInstalledSkillNames, parseSkillPath } from "./lib.js";
import { formatTime, multiSelect, printBanner } from "./ui.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION: string = (() => {
  for (const base of [__dirname, resolve(__dirname, "..")]) {
    const p = join(base, "package.json");
    if (!existsSync(p)) continue;
    try {
      const pkg = JSON.parse(readFileSync(p, "utf-8"));
      if (pkg.name === "autoskills-pragma") return pkg.version;
    } catch {}
  }
  return "0.0.0";
})();
const ISSUES_URL = "https://github.com/bryanvillamilpragma/autoSkills-Pragma/issues";

process.on("SIGINT", () => {
  write(SHOW_CURSOR + "\n");
  process.exit(130);
});

// ── CLI ──────────────────────────────────────────────────────

export interface CliArgs {
  autoYes: boolean;
  dryRun: boolean;
  verbose: boolean;
  help: boolean;
  clearCache: boolean;
  logout: boolean;
  agents: string[];
  listAgents: boolean;
  workflow: string | null;
}

// Positional words that activate the agents screen (not treated as workflow names)
const RESERVED_COMMANDS = ["agents", "agent"];

export function parseArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const consumed = new Set<number>();

  // Collect values for the -a / --agent IDE-targeting flag
  const agentFlagIdx = argv.findIndex((a) => a === "-a" || a === "--agent");
  const agentFlagValues: string[] = [];
  if (agentFlagIdx !== -1) {
    consumed.add(agentFlagIdx);
    for (let i = agentFlagIdx + 1; i < argv.length; i++) {
      if (argv[i].startsWith("-")) break;
      agentFlagValues.push(argv[i]);
      consumed.add(i);
    }
  }

  // Extract positional arguments (not flags, not flag values)
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (consumed.has(i)) continue;
    if (argv[i].startsWith("-")) continue;
    positionals.push(argv[i]);
  }

  const firstPositional = positionals[0] ?? null;
  const isAgentsCommand = firstPositional !== null && RESERVED_COMMANDS.includes(firstPositional);
  const workflow = firstPositional !== null && !isAgentsCommand ? firstPositional : null;
  const listAgents = isAgentsCommand || argv.includes("--agents");

  return {
    autoYes: argv.includes("-y") || argv.includes("--yes"),
    dryRun: argv.includes("--dry-run"),
    verbose: argv.includes("--verbose") || argv.includes("-v"),
    help: argv.includes("--help") || argv.includes("-h"),
    clearCache: argv.includes("--clear-cache"),
    logout: argv.includes("--logout"),
    agents: agentFlagValues,
    listAgents,
    workflow,
  };
}

function showHelp(): void {
  log(`
  ${bold("autoskills")} — Auto-install the best AI skills for your project

  ${bold("Usage:")}
    npx autoskills                   Detect & install skills
    npx autoskills ${dim("-y")}                   Skip confirmation
    npx autoskills ${dim("--dry-run")}            Show what would be installed
    npx autoskills ${dim("--clear-cache")}        Clear downloaded skills cache
    npx autoskills ${dim("-a cursor claude-code")} Install for specific IDEs only
    npx autoskills ${dim("agents")}               Show & install agents/workflows for your stack
    npx autoskills ${dim("--logout")}             Sign out and remove cached token

  ${bold("Options:")}
    -y, --yes       Skip confirmation prompt
    --dry-run       Show skills without installing
    --clear-cache   Clear downloaded skills cache
    -v, --verbose   Show install trace and error details
    -a, --agent     Install for specific IDEs only (e.g. cursor, claude-code)
    --logout        Sign out from your @pragma.com.co account
    -h, --help      Show this help message

  ${bold("Auth:")}
    Requires a @pragma.com.co Google account. Set AUTOSKILLS_SKIP_AUTH=1 to bypass in CI.
`);
}

// ── Display ──────────────────────────────────────────────────

function printDetected(detected: Technology[], combos: ComboSkill[], isFrontend: boolean): void {
  if (detected.length > 0) {
    const withSkills = detected.filter((t) => t.skills.length > 0);
    const withoutSkills = detected.filter((t) => t.skills.length === 0);
    const allTech = [...withSkills, ...withoutSkills];

    log(cyan("   ◆ ") + bold("Detected technologies:"));
    log();

    const COLS = 3;
    const colWidth = Math.max(...allTech.map((t) => t.name.length)) + 3;

    const formatTech = (tech: Technology): string => {
      const hasSkills = tech.skills.length > 0;
      const icon = hasSkills ? green("✔") : dim("●");
      const name = tech.name.padEnd(colWidth);
      return `${icon} ${hasSkills ? name : dim(name)}`;
    };

    for (let i = 0; i < allTech.length; i += COLS) {
      const row = allTech
        .slice(i, i + COLS)
        .map(formatTech)
        .join("");
      log(`     ${row}`);
    }

    if (combos.length > 0) {
      log();
      log(magenta("   ◆ ") + bold("Detected combos:"));
      log();
      for (const combo of combos) {
        log(magenta(`     ⚡ `) + combo.name);
      }
    }
    log();
  }

  if (isFrontend && detected.length === 0) {
    log(cyan("   ◆ ") + bold("Web frontend detected ") + dim("(from project files)"));
    log();
  }
}

function formatSkillLabel(skill: string, { styled = false }: { styled?: boolean } = {}): string {
  if (/^https?:\/\//i.test(skill)) {
    return styled ? cyan(skill) : skill;
  }

  const parts = skill.split("/");
  if (parts.length !== 3) {
    return styled ? cyan(skill) : skill;
  }

  const [author, , skillName] = parts;
  if (!styled) {
    return `${author} › ${skillName}`;
  }

  return `${muted(author)} ${gray("›")} ${cyan(bold(skillName))}`;
}

function securityWarningForSkill(skill: string): string | null {
  const check = securityCheckForSkillPath(skill);
  if (check?.status !== "warning") return null;

  const findings = check.findings.map((finding) => finding.trim()).filter(Boolean);
  const detail = [check.summary.trim(), findings.join("; ")].filter(Boolean).join(" ");
  return detail || "The sync review found issues that should be checked.";
}

function printSkillsList(skills: SkillEntry[]): void {
  const INSTALLED_TAG = " (installed)";
  const SECURITY_TAG = " (security check ⚠)";
  const entries = skills.map((s) => ({
    ...s,
    label: formatSkillLabel(s.skill),
    styledLabel: formatSkillLabel(s.skill, { styled: true }),
    hasSecurityWarning: Boolean(securityWarningForSkill(s.skill)),
  }));
  const maxEffective = Math.max(
    ...entries.map(
      (e) =>
        e.label.length +
        (e.installed ? INSTALLED_TAG.length : 0) +
        (e.hasSecurityWarning ? SECURITY_TAG.length : 0),
    ),
  );
  const newCount = skills.filter((s) => !s.installed).length;
  const installedCount = skills.length - newCount;
  const countLabel =
    installedCount > 0
      ? `(${skills.length}, ${installedCount} already installed)`
      : `(${skills.length})`;
  log(cyan("   ◆ ") + bold(`Skills to install `) + dim(countLabel));
  log();
  for (let i = 0; i < entries.length; i++) {
    const { label, styledLabel, sources, installed, hasSecurityWarning } = entries[i];
    const techSources = sources.filter((s) => !s.includes(" + "));
    const installedTag = installed ? dim(INSTALLED_TAG) : "";
    const securityTag = hasSecurityWarning ? yellow(SECURITY_TAG) : "";
    const effectiveLen =
      label.length +
      (installed ? INSTALLED_TAG.length : 0) +
      (hasSecurityWarning ? SECURITY_TAG.length : 0);
    const pad = " ".repeat(maxEffective - effectiveLen);
    const num = String(i + 1).padStart(2, " ");
    const sourceSuffix = techSources.length > 0 ? `  ${dim(`← ${techSources.join(", ")}`)}` : "";
    log(dim(`   ${num}.`) + ` ${styledLabel}${installedTag}${securityTag}${pad}${sourceSuffix}`);
  }
  log();
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function extractErrorLines(stderr: string, output: string): string[] {
  const raw = stderr?.trim() || output?.trim() || "";
  const noisePatterns = [
    /^npm\s+(warn|notice|http)\b/i,
    /^npm\s+error\s*$/i,
    /^\s*$/,
    /^>\s/,
    /^added\s+\d+\s+packages/i,
    /^up to date/i,
    /^npm error A complete log of this run/i,
    /^npm error\s+[\w/\\:.-]+debug-\d+\.log$/i,
  ];

  return stripAnsi(raw)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !noisePatterns.some((p) => p.test(l)));
}

function briefErrorReason(stderr: string, output: string): string {
  const lines = extractErrorLines(stderr, output);
  if (lines.length === 0) return "Unknown error";
  const line = lines[0];
  return line.length > 80 ? line.slice(0, 77) + "..." : line;
}

function visiblePad(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - stripAnsi(value).length));
}

function truncateVisible(value: string, width: number): string {
  const plain = stripAnsi(value);
  if (plain.length <= width) return value;
  if (width <= 1) return "…";
  return plain.slice(0, width - 1) + "…";
}

function wrapText(value: string, width: number): string[] {
  if (width <= 0) return [value];
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (word.length > width) {
      if (line) {
        lines.push(line);
        line = "";
      }
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.slice(i, i + width));
      }
      continue;
    }

    const next = line ? `${line} ${word}` : word;
    if (next.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function formatSecurityFindings(check: InstallSecurityCheck): string | null {
  const findings = check.findings.map((finding) => finding.trim()).filter(Boolean);
  if (findings.length === 0) return null;

  const summary = check.summary.trim();
  return [summary, findings.join("; ")].filter(Boolean).join(" ");
}

function printSecurityChecks(checks: InstallSecurityCheck[]): void {
  const checksWithFindings = checks
    .map((check) => ({ check, findings: formatSecurityFindings(check) }))
    .filter((entry): entry is { check: InstallSecurityCheck; findings: string } =>
      Boolean(entry.findings),
    );
  if (checksWithFindings.length === 0) return;

  const sorted = checksWithFindings.sort((a, b) => a.check.name.localeCompare(b.check.name));
  const skillWidth = Math.min(34, Math.max(5, ...sorted.map(({ check }) => check.name.length)));
  const checkWidth = 7;
  const terminalWidth = process.stdout.columns || 100;
  const findingsWidth = Math.max(40, terminalWidth - skillWidth - checkWidth - 16);

  log();
  log(cyan("   ◆ ") + bold("Security checks"));
  log();
  log(
    dim(
      `   | ${visiblePad("Skill", skillWidth)} | ${visiblePad("Check", checkWidth)} | ${visiblePad("Findings", findingsWidth)} |`,
    ),
  );
  log(
    dim(
      `   | ${"-".repeat(skillWidth)} | ${"-".repeat(checkWidth)} | ${"-".repeat(findingsWidth)} |`,
    ),
  );

  for (const { check, findings } of sorted) {
    const status = check.status === "warning" ? yellow("warning") : green("ok");
    const lines = wrapText(findings, findingsWidth);
    log(
      `   | ${visiblePad(truncateVisible(check.name, skillWidth), skillWidth)} | ${visiblePad(status, checkWidth)} | ${visiblePad(lines[0], findingsWidth)} |`,
    );
    for (const line of lines.slice(1)) {
      log(
        `   | ${visiblePad("", skillWidth)} | ${visiblePad("", checkWidth)} | ${visiblePad(line, findingsWidth)} |`,
      );
    }
  }
}

interface SummaryOptions {
  installed: number;
  failed: number;
  errors: {
    name: string;
    output: string;
    stderr: string;
    exitCode: number | null;
    command: string;
  }[];
  elapsed: number;
  verbose: boolean;
}

function printSummary({ installed, failed, errors, elapsed, verbose }: SummaryOptions): void {
  log();

  if (failed === 0) {
    log(
      green(
        bold(
          `   ✔ Done! ${installed} skill${installed !== 1 ? "s" : ""} installed in ${formatTime(elapsed)}.`,
        ),
      ),
    );
  } else {
    log(
      yellow(
        `   Done: ${green(`${installed} installed`)}, ${red(`${failed} failed`)} in ${formatTime(elapsed)}.`,
      ),
    );

    if (errors.length > 0) {
      log();
      log(bold(red("   Errors:")));
      for (const { name, output, stderr, exitCode, command } of errors) {
        log(red(`     ✘ ${name}`));

        if (verbose) {
          if (exitCode !== undefined && exitCode !== null) {
            log(dim(`       exit code ${exitCode}`));
          }

          const errorLines = extractErrorLines(stderr, output);
          if (errorLines.length > 0) {
            log();
            for (const line of errorLines.slice(0, 20)) {
              log(dim(`       ${line}`));
            }
            if (errorLines.length > 20) {
              log(dim(`       … (${errorLines.length - 20} more lines)`));
            }
          }

          if (command) {
            log();
            log(dim(`       command: ${command}`));
          }
          log();
        } else {
          const reason = briefErrorReason(stderr, output);
          log(dim(`       ${reason}`));
        }
      }
      log();
      if (!verbose) {
        log(dim("   Run again with --verbose to see the full error details."));
      }
      log(dim(`   If it looks like an autoskills bug, please create an issue: ${ISSUES_URL}`));
    }
  }

  log();
  log(pink("   autoskills-pragma is a Pragma fork of autoskills by @midudev → https://github.com/sponsors/midudev"));
  log();
}

// ── Skill Selection ──────────────────────────────────────────

async function selectSkills(skills: SkillEntry[], autoYes: boolean): Promise<SkillEntry[]> {
  if (autoYes) {
    printSkillsList(skills);
    return skills;
  }

  const INSTALLED_TAG = " (installed)";
  const SECURITY_TAG = " (security check ⚠)";
  const labelCache = new Map<
    string,
    { label: string; styledLabel: string; hasSecurityWarning: boolean }
  >();
  for (const s of skills) {
    labelCache.set(s.skill, {
      label: formatSkillLabel(s.skill),
      styledLabel: formatSkillLabel(s.skill, { styled: true }),
      hasSecurityWarning: Boolean(securityWarningForSkill(s.skill)),
    });
  }
  const maxEffective = Math.max(
    ...skills.map((s) => {
      const cached = labelCache.get(s.skill)!;
      return (
        cached.label.length +
        (s.installed ? INSTALLED_TAG.length : 0) +
        (cached.hasSecurityWarning ? SECURITY_TAG.length : 0)
      );
    }),
  );

  const newCount = skills.filter((s) => !s.installed).length;
  const installedCount = skills.length - newCount;
  const countLabel =
    installedCount > 0
      ? `${skills.length} found, ${installedCount} already installed`
      : `${skills.length} found`;
  log(cyan("   ◆ ") + bold(`Select skills to install `) + dim(`(${countLabel})`));
  log();

  const selected = await multiSelect(skills, {
    labelFn: (s) => {
      const { label, styledLabel, hasSecurityWarning } = labelCache.get(s.skill)!;
      const installedTag = s.installed ? " " + dim("(installed)") : "";
      const securityTag = hasSecurityWarning ? yellow(SECURITY_TAG) : "";
      const effectiveLen =
        label.length +
        (s.installed ? INSTALLED_TAG.length : 0) +
        (hasSecurityWarning ? SECURITY_TAG.length : 0);
      return styledLabel + installedTag + securityTag + " ".repeat(maxEffective - effectiveLen);
    },
    hintFn: (s) => {
      const techSources = s.sources.filter((src) => !src.includes(" + "));
      return techSources.length > 1 ? `← ${techSources.join(", ")}` : "";
    },
    groupFn: (s) => s.sources[0],
    initialSelected: skills.map((s) => !s.installed),
    shortcuts:
      installedCount > 0
        ? [
            { key: "n", label: "new", fn: (items: SkillEntry[]) => items.map((s) => !s.installed) },
            {
              key: "i",
              label: "installed",
              fn: (items: SkillEntry[]) => items.map((s) => s.installed),
            },
          ]
        : [],
  });

  if (selected.length === 0) {
    log();
    log(dim("   Nothing selected."));
    log();
    process.exit(0);
  }

  return selected;
}

// ── Auth gate ────────────────────────────────────────────────

async function runAuthGate(): Promise<void> {
  if (process.env.AUTOSKILLS_SKIP_AUTH) return;
  const auth = await checkAuth();
  if (auth) {
    log(dim(`  ✓ Sesión activa: ${auth.email}\n`));
  } else {
    log(`\n  🔐 Se requiere autenticación con tu cuenta @pragma.com.co\n`);
    await authenticate();
  }
}

// ── Agents registry ───────────────────────────────────────────

interface AgentEntry {
  name: string;        // "create-component"
  description: string; // short label shown in the list
  requires: string[];  // technology IDs that unlock this agent
  skillPath: string;   // registry path used by installAll
  hint: string;        // sub-text shown in the selector
}

// Hardcoded until the remote registry natively carries agent metadata.
// Keep in sync with skills-map.ts workflows/agents fields.
const AGENTS_REGISTRY: AgentEntry[] = [
  {
    name: "create-component",
    description: "Crea un componente nuevo siguiendo las convenciones del proyecto",
    requires: ["react", "angular"],
    skillPath: "pragma/autoskills/create-component",
    hint: "Componentes funcionales con hooks y RTL",
  },
  {
    name: "unit-test-review",
    description: "Revisa y genera unit tests siguiendo el patrón del proyecto",
    requires: ["react", "angular"],
    skillPath: "pragma/autoskills/unit-test-review",
    hint: "Tests con Vitest/Jest y Testing Library",
  },
  {
    name: "create-view",
    description: "Crea vistas y páginas con las convenciones del stack",
    requires: ["react", "angular", "nextjs"],
    skillPath: "pragma/autoskills/agents/create-view",
    hint: "Vistas estructuradas con routing y estado",
  },
];

// ── Agents screen ─────────────────────────────────────────────

async function showAvailableAgents(
  projectDir: string,
  autoYes: boolean,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  await printBanner(VERSION);

  const { detected, isFrontend, combos } = detectTechnologies(projectDir);
  printDetected(detected, combos, isFrontend);

  // Filter registry to agents compatible with the detected stack
  const detectedIds = new Set(detected.map((t) => t.id));
  const availableAgents = AGENTS_REGISTRY.filter((a) => a.requires.some((id) => detectedIds.has(id)));

  if (availableAgents.length === 0) {
    log(yellow("  ⚠ No agents available for your stack yet."));
    if (detected.length > 0) {
      log(dim(`  Stack detected: ${detected.map((t) => t.id).join(", ")}`));
    }
    log();
    log(dim('  Run "npx autoskills-pragma" to install skills instead.'));
    log();
    return;
  }

  // Build SkillEntry list (with extra metadata for display)
  const installedNames = getInstalledSkillNames(projectDir);

  interface AgentSkillEntry extends SkillEntry {
    agent: AgentEntry;
    tech: string; // first matching tech name for grouping
  }

  const entries: AgentSkillEntry[] = availableAgents.map((agent) => {
    const { skillName } = parseSkillPath(agent.skillPath);
    const matchingTech = detected.find((t) => agent.requires.includes(t.id));
    return {
      skill: agent.skillPath,
      sources: [matchingTech?.name ?? agent.requires[0]],
      installed: installedNames.has(skillName),
      agent,
      tech: matchingTech?.name ?? agent.requires[0],
    };
  });

  const newCount = entries.filter((e) => !e.installed).length;
  const installedCount = entries.length - newCount;
  const countLabel =
    installedCount > 0
      ? `(${entries.length} found, ${installedCount} already installed)`
      : `(${entries.length} found)`;

  log(cyan("  ◆ ") + bold("Available agents for your stack:") + "  " + dim(countLabel));
  log();

  // Non-interactive or dry-run — print list and return
  if (dryRun || !process.stdin.isTTY) {
    for (const entry of entries) {
      const { skillName } = parseSkillPath(entry.skill);
      const installedTag = entry.installed ? dim(" (installed)") : "";
      const techSuffix = entry.tech ? `  ${dim(`← ${entry.tech}`)}` : "";
      log(`  ${green("›")} ${bold(skillName)}  ${dim(entry.agent.hint)}${installedTag}${techSuffix}`);
    }
    log();
    if (dryRun) {
      log(dim("  --dry-run: nothing was installed."));
      log();
    }
    return;
  }

  // Interactive selection
  const selected = await multiSelect(entries, {
    labelFn: (entry) => {
      const { skillName } = parseSkillPath(entry.skill);
      const installedTag = entry.installed ? dim(" (installed)") : "";
      return `${formatSkillLabel(entry.skill, { styled: true })}  ${dim(entry.agent.hint)}${installedTag}`;
    },
    hintFn: () => "",
    groupFn: (entry) => entry.tech,
    initialSelected: entries.map((e) => !e.installed),
  });

  if (selected.length === 0) {
    log();
    log(dim("  Nothing selected."));
    log();
    return;
  }

  const toInstall = selected.filter((e) => !e.installed);

  if (toInstall.length === 0) {
    log(dim("  All selected agents are already installed."));
    log();
    return;
  }

  const { global: globalIDEs, local: localIDEs } = detectInstalledIDEs(projectDir);
  const allIDEs = [...globalIDEs, ...localIDEs];

  if (allIDEs.length === 0) {
    log(yellow("  ⚠ No se detectó ningún IDE de IA instalado."));
    log(dim("  Instala Claude Code, Cursor, Kiro, Windsurf o VS Code con Copilot."));
    log();
    return;
  }

  log();
  log(cyan("  ◆ ") + bold("Installing agents globally..."));
  log(dim(`  IDEs: ${allIDEs.map((i) => i.id).join(", ")}`));
  log();

  let totalInstalled = 0;
  let totalFailed = 0;

  for (const entry of toInstall) {
    const result = await installSkillGlobal(
      entry.skill,
      globalIDEs,
      localIDEs,
      { projectDir, verbose },
    );
    totalInstalled += result.installed.length;
    totalFailed += result.failed.length;

    if (verbose) {
      for (const inst of result.installed) {
        log(green("   ✔") + dim(` ${result.skillName} → ${inst.ide}`));
      }
      for (const fail of result.failed) {
        log(red("   ✘") + dim(` ${result.skillName} → ${fail.ide}: ${fail.error}`));
      }
    }
  }

  log(green(`  ✔ ${totalInstalled} installation${totalInstalled !== 1 ? "s" : ""} completed`));
  if (totalFailed > 0) {
    log(yellow(`  ⚠ ${totalFailed} failed`));
  }
  log();
  log(green("  ✨ ") + bold("Agents installed globally! Now go to your IDE and ask your agent to do things."));
  log(dim("     Your agent will use the installed workflows automatically."));
  log();
}

// ── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { autoYes, dryRun, verbose, help, clearCache, logout, agents, listAgents, workflow } = parseArgs();

  if (help) {
    showHelp();
    process.exit(0);
  }

  if (clearCache) {
    const { cacheDir, removed } = clearAutoskillsCache();
    log(
      removed
        ? green(`   ✔ Cleared autoskills cache: ${cacheDir}`)
        : dim(`   No autoskills cache found: ${cacheDir}`),
    );
    log();
    process.exit(0);
  }

  if (logout) {
    await authLogout();
    log(green("  ✓ Sesión cerrada. Tokens eliminados."));
    log();
    process.exit(0);
  }

  // ── Auth gate (CI bypass: AUTOSKILLS_SKIP_AUTH=1) ────────
  // await runAuthGate(); // TODO: temporalmente deshabilitado

  // ── Agents / workflows screen ──────────────────────────
  if (listAgents) {
    await showAvailableAgents(resolve("."), autoYes, dryRun, verbose);
    process.exit(0);
  }

  // ── Educational message for workflow positional ─────────
  if (workflow) {
    log("");
    log(cyan("  ◆ ") + bold("autoskills-pragma installs tools — your IDE runs them."));
    log("");
    log(dim(`  To use "${workflow}", go to your IDE and ask your agent:`));
    log(cyan(`    "use the ${workflow} workflow"`));
    log("");
    log(dim("  Your agent will use the installed skills and workflows automatically."));
    log("");
    log(dim('  Tip: run ') + cyan('"npx autoskills-pragma agents"') + dim(" to install agents first."));
    log("");
    process.exit(0);
  }

  await printBanner(VERSION);

  const projectDir = resolve(".");

  write(dim("   Scanning project...\r"));
  const { detected, isFrontend, combos } = detectTechnologies(projectDir);
  write("\x1b[K");

  if (detected.length === 0 && !isFrontend) {
    log(yellow("   ⚠ No supported technologies detected."));
    log(dim("   Make sure you run this in a project directory."));
    log();
    process.exit(0);
  }

  printDetected(detected, combos, isFrontend);

  const installedNames = getInstalledSkillNames(projectDir);
  const allSkills = collectSkills({ detected, isFrontend, combos, installedNames });

  // In dry-run mode show every detected skill; during actual install restrict to locally-available ones.
  const validSkills = allSkills.filter((s) => parseSkillPath(s.skill).skillName.length > 0);
  const skills = dryRun
    ? validSkills
    : (() => {
        const registryDir = getRegistryDir();
        const localSkillDirs = new Set(
          existsSync(registryDir)
            ? readdirSync(registryDir, { withFileTypes: true })
                .filter((e: Dirent<string>) => e.isDirectory())
                .map((e: Dirent<string>) => e.name)
            : [],
        );
        return validSkills.filter((s) => localSkillDirs.has(parseSkillPath(s.skill).skillName));
      })();

  if (skills.length === 0) {
    log(yellow("   No skills available for your stack yet."));
    log(dim("   Check https://autoskills.sh for the latest."));
    log();
    process.exit(0);
  }

  if (!dryRun) {
    setImmediate(loadRegistry);
  }

  if (dryRun) {
    printSkillsList(skills);
    const agentList = agents.length > 0 ? agents : detectAgents();
    log(dim(`   Agents: ${agentList.join(", ")}`));
    log();
    log(dim("   --dry-run: nothing was installed."));
    log();
    process.exit(0);
  }

  const selectedSkills = await selectSkills(skills, autoYes);

  log();

  const { global: globalIDEs, local: localIDEs } = detectInstalledIDEs(projectDir);
  const allIDEsDetected = [...globalIDEs, ...localIDEs];

  if (allIDEsDetected.length === 0) {
    log(yellow("  ⚠ No se detectó ningún IDE de IA instalado."));
    log(dim("  Instala Claude Code, Cursor, Kiro, Windsurf o VS Code con Copilot."));
    log();
    process.exit(0);
  }

  let selectedIDEs: typeof allIDEsDetected;

  if (allIDEsDetected.length === 1) {
    selectedIDEs = allIDEsDetected;
    log(cyan("  ◆ IDE detectado:") + " " + bold(allIDEsDetected[0].id));
    log();
  } else {
    log(cyan("  ◆ IDEs detectados en tu sistema:"));
    log();

    selectedIDEs = await multiSelect(allIDEsDetected, {
      labelFn: (ide) => `${ide.id}${ide.config.isGlobal ? "" : " (local — sin soporte global)"}`,
      initialSelected: allIDEsDetected.map(() => autoYes),
    });
    log();
  }

  const selectedGlobal = selectedIDEs.filter((ide) => ide.config.isGlobal);
  const selectedLocal = selectedIDEs.filter((ide) => !ide.config.isGlobal);

  log(cyan("  ◆ ") + bold("Instalando skills globalmente..."));
  log(dim(`  IDEs: ${selectedIDEs.map((i) => i.id).join(", ")}`));
  if (selectedLocal.length > 0) {
    log(dim(`  Cursor instalará en este proyecto: ${projectDir}`));
  }
  log();

  const startTime = Date.now();
  let totalInstalled = 0;
  let totalFailed = 0;

  for (const skill of selectedSkills) {
    const result = await installSkillGlobal(
      skill.skill,
      selectedGlobal,
      selectedLocal,
      { projectDir, verbose },
    );
    totalInstalled += result.installed.length;
    totalFailed += result.failed.length;

    if (verbose) {
      for (const inst of result.installed) {
        log(green("   ✔") + dim(` ${result.skillName} → ${inst.ide}`));
      }
      for (const fail of result.failed) {
        log(red("   ✘") + dim(` ${result.skillName} → ${fail.ide}: ${fail.error}`));
      }
    }
  }

  const elapsed = Date.now() - startTime;
  log(green("  ✔ ") + bold(`${totalInstalled} instalaciones completadas`) + dim(` en ${formatTime(elapsed)}`));
  if (totalFailed > 0) {
    log(yellow(`  ⚠ ${totalFailed} fallaron`));
  }
  log();
  log(dim("  Tus IDEs ya tienen el contexto del proyecto."));
  log(dim("  Abre cualquier proyecto y tu agente estará listo."));
  log();
}

// Run main() only when invoked as CLI entry point — not when imported by tests.
// Uses realpathSync so npm-link symlinks resolve correctly.
function _realpath(p: string): string {
  try { return realpathSync(p); } catch { return p; }
}

const __filename = fileURLToPath(import.meta.url);
const _argv1 = _realpath(process.argv[1] ?? "");
const _self  = _realpath(__filename);

if (_argv1.endsWith("index.mjs") || _argv1 === _self) {
  main().catch((err: Error) => {
    console.error(red(`\n   Error: ${err.message}\n`));
    process.exit(1);
  });
}
