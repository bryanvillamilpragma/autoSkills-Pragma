import { ok, strictEqual } from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AGENT_PATH = join(
  __dirname, "..", "..", "..", "skills-registry", "agents", "create-view", "AGENT.md"
);

describe("create-view — archivo existe y es válido", () => {
  it("existe AGENT.md en la ruta correcta", () => {
    ok(existsSync(AGENT_PATH),
      "falta: skills-registry/agents/create-view/AGENT.md");
  });

  it("tiene frontmatter con name: create-view", () => {
    const c = readFileSync(AGENT_PATH, "utf-8");
    ok(c.includes("name: create-view"), "falta name: create-view");
  });

  it("tiene type: agent", () => {
    const c = readFileSync(AGENT_PATH, "utf-8");
    ok(c.includes("type: agent"), "falta type: agent");
  });

  it("tiene description que menciona crear componentes", () => {
    const c = readFileSync(AGENT_PATH, "utf-8");
    ok(c.includes("description:"), "falta campo description");
    ok(
      c.includes("componente") || c.includes("vista"),
      "description no menciona componente ni vista"
    );
  });

  it("menciona soporte de screenshot", () => {
    const c = readFileSync(AGENT_PATH, "utf-8");
    ok(c.toLowerCase().includes("screenshot"),
      "falta mención de screenshot");
  });

  it("menciona MCP de Figma e instrucciones de configuración", () => {
    const c = readFileSync(AGENT_PATH, "utf-8");
    ok(c.includes("MCP") && c.includes("Figma"),
      "falta instrucciones del MCP de Figma");
    ok(c.includes("FIGMA_API_TOKEN") || c.includes("figma-mcp"),
      "falta instrucción de configuración del MCP");
  });

  it("cubre Angular y React", () => {
    const c = readFileSync(AGENT_PATH, "utf-8");
    ok(c.includes("Angular") || c.includes("angular"),
      "falta soporte Angular");
    ok(c.includes("React") || c.includes("react"),
      "falta soporte React");
  });

  it("menciona HTML semántico y ARIA", () => {
    const c = readFileSync(AGENT_PATH, "utf-8");
    ok(c.includes("semántico") || c.includes("semantic"),
      "falta mención de HTML semántico");
    ok(c.includes("ARIA") || c.includes("aria"),
      "falta mención de ARIA/accesibilidad");
  });

  it("menciona testing", () => {
    const c = readFileSync(AGENT_PATH, "utf-8");
    ok(c.includes("test") || c.includes("spec"),
      "falta mención de testing");
  });

  it("menciona signals y inject para Angular", () => {
    const c = readFileSync(AGENT_PATH, "utf-8");
    ok(c.includes("signal"), "falta mención de signals");
    ok(c.includes("inject()"), "falta mención de inject()");
  });

  it("no contiene TODO ni placeholders", () => {
    const c = readFileSync(AGENT_PATH, "utf-8");
    ok(!c.includes("TODO"), "contiene TODO — no debe haber placeholders");
  });
});

describe("create-view — registrado en skills-map", () => {
  it("está en agents de Angular", async () => {
    const { SKILLS_MAP } = await import("../../skills-map.js");
    const angular = (SKILLS_MAP as unknown as Array<{ id: string; agents?: string[] }>)
      .find(t => t.id === "angular");
    ok(angular, "Angular no encontrado en SKILLS_MAP");
    ok(
      angular.agents?.some((a: string) => a.includes("create-view")),
      "create-view no está en agents de angular"
    );
  });

  it("está en agents de React", async () => {
    const { SKILLS_MAP } = await import("../../skills-map.js");
    const react = (SKILLS_MAP as unknown as Array<{ id: string; agents?: string[] }>)
      .find(t => t.id === "react");
    ok(react, "React no encontrado en SKILLS_MAP");
    ok(
      react.agents?.some((a: string) => a.includes("create-view")),
      "create-view no está en agents de react"
    );
  });
});

describe("create-view — registrado en index.json", () => {
  it("tiene entrada en el manifiesto del registry", () => {
    const indexPath = join(
      __dirname, "..", "..", "..", "skills-registry", "index.json"
    );
    ok(existsSync(indexPath), "falta skills-registry/index.json");
    const manifest = JSON.parse(readFileSync(indexPath, "utf-8")) as {
      skills: Record<string, { type: string }>;
    };
    ok(
      manifest.skills["agents/create-view"],
      "falta entrada 'agents/create-view' en index.json"
    );
    strictEqual(
      manifest.skills["agents/create-view"].type,
      "agent",
      "type debe ser 'agent'"
    );
  });
});
