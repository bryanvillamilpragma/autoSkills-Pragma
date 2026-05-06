import { ok, strictEqual } from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("workflow SKILL.md — frontmatter", () => {
  it("create-component tiene type: workflow", () => {
    const skillPath = join(
      __dirname,
      "..",
      "..",
      "skills-registry",
      "create-component",
      "SKILL.md",
    );
    ok(existsSync(skillPath), "SKILL.md debe existir");
    const content = readFileSync(skillPath, "utf-8");
    ok(content.includes("type: workflow"), "debe tener type: workflow");
    ok(content.includes("name: create-component"), "debe tener name correcto");
    ok(content.includes("description:"), "debe tener description");
  });

  it("unit-test-review tiene type: workflow", () => {
    const skillPath = join(
      __dirname,
      "..",
      "..",
      "skills-registry",
      "unit-test-review",
      "SKILL.md",
    );
    ok(existsSync(skillPath), "SKILL.md debe existir");
    const content = readFileSync(skillPath, "utf-8");
    ok(content.includes("type: workflow"), "debe tener type: workflow");
  });
});

describe("collectWorkflows", () => {
  it("retorna workflows para stack Angular detectado", async () => {
    const { collectWorkflows } = await import("../lib.js");
    const mockAngular = {
      id: "angular",
      name: "Angular",
      detect: {},
      skills: [],
      workflows: [
        "pragma/autoskills/create-component",
        "pragma/autoskills/unit-test-review",
      ],
    };

    const result = collectWorkflows({
      detected: [mockAngular],
      installedNames: [],
    });

    strictEqual(result.length, 2);
    ok(result.some((w) => w.skill.includes("create-component")));
    ok(result.some((w) => w.skill.includes("unit-test-review")));
  });

  it("no duplica workflows si dos stacks los comparten", async () => {
    const { collectWorkflows } = await import("../lib.js");
    const mockAngular = {
      id: "angular", name: "Angular", detect: {}, skills: [],
      workflows: ["pragma/autoskills/create-component"],
    };
    const mockReact = {
      id: "react", name: "React", detect: {}, skills: [],
      workflows: ["pragma/autoskills/create-component"],
    };

    const result = collectWorkflows({
      detected: [mockAngular, mockReact],
      installedNames: [],
    });

    strictEqual(result.length, 1);
  });

  it("omite workflows ya instalados", async () => {
    const { collectWorkflows } = await import("../lib.js");
    const mockAngular = {
      id: "angular", name: "Angular", detect: {}, skills: [],
      workflows: ["pragma/autoskills/create-component"],
    };

    const result = collectWorkflows({
      detected: [mockAngular],
      installedNames: ["create-component"],
    });

    strictEqual(result.length, 0);
  });

  it("retorna array vacío si no hay workflows en el stack", async () => {
    const { collectWorkflows } = await import("../lib.js");
    const mockTs = {
      id: "typescript", name: "TypeScript", detect: {}, skills: [],
      // sin workflows
    };

    const result = collectWorkflows({
      detected: [mockTs],
      installedNames: [],
    });

    strictEqual(result.length, 0);
  });
});
