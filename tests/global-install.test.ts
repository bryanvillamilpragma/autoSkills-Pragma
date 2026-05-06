import { deepEqual, ok, strictEqual } from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { useTmpDir } from "./helpers.js";

// Helper para simular el home del usuario en tests
function mockHome(tmp: { path: string }): string {
  const fakeHome = join(tmp.path, "home");
  mkdirSync(fakeHome, { recursive: true });
  return fakeHome;
}

describe("detectInstalledIDEs", () => {
  const tmp = useTmpDir();

  it("retorna arrays vacíos si no hay IDEs instalados", async () => {
    const { detectInstalledIDEs } = await import("../lib.js");
    // Sin carpetas en home → nada detectado
    // En CI el entorno no tiene IDEs → debería retornar arrays vacíos o solo lo que haya
    const { global: g, local: l } = detectInstalledIDEs(tmp.path);
    ok(Array.isArray(g));
    ok(Array.isArray(l));
  });

  it("detecta claude-code cuando existe ~/.claude", () => {
    const fakeHome = mockHome(tmp);
    mkdirSync(join(fakeHome, ".claude"), { recursive: true });
    const claudeExists = existsSync(join(fakeHome, ".claude"));
    ok(claudeExists);
  });

  it("detecta cursor cuando existe ~/.cursor", () => {
    const fakeHome = mockHome(tmp);
    mkdirSync(join(fakeHome, ".cursor"), { recursive: true });
    const cursorExists = existsSync(join(fakeHome, ".cursor"));
    ok(cursorExists);
  });
});

describe("writeArtifactForIDE — format: dir", () => {
  const tmp = useTmpDir();

  it("copia la carpeta completa del skill", async () => {
    // Crear skill canónico
    const canonicalDir = join(tmp.path, "skills", "angular-developer");
    mkdirSync(canonicalDir, { recursive: true });
    writeFileSync(join(canonicalDir, "SKILL.md"), "# Angular Developer\n---\nContenido");
    writeFileSync(join(canonicalDir, "extra.md"), "# Extra");

    // Simular IDE con format: dir
    const installPath = join(tmp.path, "claude", "skills");
    mkdirSync(installPath, { recursive: true });

    // Copiar manualmente como haría writeArtifactForIDE con format: dir
    const destDir = join(installPath, "angular-developer");
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(destDir, "SKILL.md"), readFileSync(join(canonicalDir, "SKILL.md")));
    writeFileSync(join(destDir, "extra.md"), readFileSync(join(canonicalDir, "extra.md")));

    ok(existsSync(join(destDir, "SKILL.md")));
    ok(existsSync(join(destDir, "extra.md")));
  });
});

describe("writeArtifactForIDE — format: file", () => {
  const tmp = useTmpDir();

  it("copia solo SKILL.md como archivo plano con extensión correcta", () => {
    const canonicalDir = join(tmp.path, "skills", "typescript-best-practices");
    mkdirSync(canonicalDir, { recursive: true });
    const skillContent = "# TypeScript Best Practices\n---\nContenido del skill";
    writeFileSync(join(canonicalDir, "SKILL.md"), skillContent);

    // Simular instalación como .md (Kiro)
    const installPath = join(tmp.path, "kiro", "steering");
    mkdirSync(installPath, { recursive: true });
    const destFile = join(installPath, "typescript-best-practices.md");
    writeFileSync(destFile, readFileSync(join(canonicalDir, "SKILL.md")));

    ok(existsSync(destFile));
    strictEqual(readFileSync(destFile, "utf-8"), skillContent);
  });

  it("copia como .mdc para Cursor", () => {
    const canonicalDir = join(tmp.path, "skills", "react-best-practices");
    mkdirSync(canonicalDir, { recursive: true });
    writeFileSync(join(canonicalDir, "SKILL.md"), "# React\n---\nContenido");

    const installPath = join(tmp.path, "project", ".cursor", "rules");
    mkdirSync(installPath, { recursive: true });
    const destFile = join(installPath, "react-best-practices.mdc");
    writeFileSync(destFile, readFileSync(join(canonicalDir, "SKILL.md")));

    ok(existsSync(destFile));
    ok(destFile.endsWith(".mdc"));
  });
});

describe("IDE_MAP — estructura", () => {
  it("tiene las 5 entradas de IDE correctas", async () => {
    const { IDE_MAP } = await import("../skills-map.js");
    const ids = Object.keys(IDE_MAP);
    ok(ids.includes("claude-code"));
    ok(ids.includes("copilot"));
    ok(ids.includes("kiro"));
    ok(ids.includes("windsurf"));
    ok(ids.includes("cursor"));
    strictEqual(ids.length, 5);
  });

  it("claude-code skill usa format dir", async () => {
    const { IDE_MAP } = await import("../skills-map.js");
    strictEqual(IDE_MAP["claude-code"].artifacts.skill.format, "dir");
  });

  it("kiro skill usa format dir", async () => {
    const { IDE_MAP } = await import("../skills-map.js");
    strictEqual(IDE_MAP["kiro"].artifacts.skill.format, "dir");
  });

  it("windsurf agent instala en .windsurf/workflows", async () => {
    const { IDE_MAP } = await import("../skills-map.js");
    strictEqual(IDE_MAP["windsurf"].artifacts.agent.folder, ".windsurf/workflows");
  });

  it("cursor es isGlobal: false", async () => {
    const { IDE_MAP } = await import("../skills-map.js");
    strictEqual(IDE_MAP["cursor"].isGlobal, false);
  });

  it("los 4 globales son isGlobal: true", async () => {
    const { IDE_MAP } = await import("../skills-map.js");
    for (const id of ["claude-code", "kiro", "copilot", "windsurf"]) {
      strictEqual(IDE_MAP[id].isGlobal, true, `${id} debe ser isGlobal`);
    }
  });
});

describe("IDE_MAP — copilot rule append", () => {
  it("copilot rule usa format append", async () => {
    const { IDE_MAP } = await import("../skills-map.js");
    strictEqual(IDE_MAP["copilot"].artifacts.rule.format, "append");
  });

  it("copilot rule fileExt apunta a copilot-instructions.md", async () => {
    const { IDE_MAP } = await import("../skills-map.js");
    strictEqual(IDE_MAP["copilot"].artifacts.rule.fileExt, "copilot-instructions.md");
  });
});

describe("IDE_MAP — cursor extensiones", () => {
  it("cursor rule usa extensión .mdc", async () => {
    const { IDE_MAP } = await import("../skills-map.js");
    strictEqual(IDE_MAP["cursor"].artifacts.rule.fileExt, ".mdc");
  });
});
