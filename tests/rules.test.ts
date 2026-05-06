import { ok, strictEqual } from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("rules registry — archivos existen", () => {
  const rulesDir = join(__dirname, "..", "..", "skills-registry", "rules");

  const expectedRules = [
    "code-test.md",
    "solid-clean.md",
    "performance.md",
    "clean-architecture.md",
    "security.md",
  ];

  for (const rule of expectedRules) {
    it(`existe ${rule}`, () => {
      ok(existsSync(join(rulesDir, rule)), `falta: skills-registry/rules/${rule}`);
    });
  }
});

describe("rules registry — frontmatter correcto", () => {
  const rulesDir = join(__dirname, "..", "..", "skills-registry", "rules");

  it("todos tienen trigger: always_on", () => {
    const files = [
      "code-test.md",
      "solid-clean.md",
      "performance.md",
      "clean-architecture.md",
      "security.md",
    ];
    for (const file of files) {
      const content = readFileSync(join(rulesDir, file), "utf-8");
      ok(content.includes("trigger: always_on"), `${file} falta trigger: always_on`);
    }
  });
});

describe("collectAutoRules", () => {
  it("retorna rules para Angular", async () => {
    const { collectAutoRules } = await import("../lib.js");
    const mockAngular = {
      id: "angular",
      name: "Angular",
      detect: {},
      skills: [],
      autoRules: [
        "pragma/autoskills/rules/clean-architecture",
        "pragma/autoskills/rules/solid-clean",
        "pragma/autoskills/rules/code-test",
        "pragma/autoskills/rules/security",
      ],
    };

    const result = collectAutoRules({ detected: [mockAngular], installedNames: [] });
    strictEqual(result.length, 4);
    ok(result.some((r) => r.skill.includes("clean-architecture")));
    ok(result.some((r) => r.skill.includes("solid-clean")));
    ok(result.some((r) => r.skill.includes("code-test")));
    ok(result.some((r) => r.skill.includes("security")));
  });

  it("no duplica rules si dos tecnologías las comparten", async () => {
    const { collectAutoRules } = await import("../lib.js");
    const mockAngular = {
      id: "angular", name: "Angular", detect: {}, skills: [],
      autoRules: ["pragma/autoskills/rules/solid-clean"],
    };
    const mockTs = {
      id: "typescript", name: "TypeScript", detect: {}, skills: [],
      autoRules: ["pragma/autoskills/rules/solid-clean"],
    };

    const result = collectAutoRules({ detected: [mockAngular, mockTs], installedNames: [] });
    strictEqual(result.length, 1);
  });

  it("omite rules ya instaladas", async () => {
    const { collectAutoRules } = await import("../lib.js");
    const mockAngular = {
      id: "angular", name: "Angular", detect: {}, skills: [],
      autoRules: ["pragma/autoskills/rules/solid-clean"],
    };

    const result = collectAutoRules({
      detected: [mockAngular],
      installedNames: ["rules/solid-clean"],
    });
    strictEqual(result.length, 0);
  });

  it("retorna array vacío si no hay autoRules en la tecnología", async () => {
    const { collectAutoRules } = await import("../lib.js");
    const mockTs = {
      id: "typescript", name: "TypeScript", detect: {}, skills: [],
      // sin autoRules
    };

    const result = collectAutoRules({ detected: [mockTs], installedNames: [] });
    strictEqual(result.length, 0);
  });

  it("acepta installedNames como Set", async () => {
    const { collectAutoRules } = await import("../lib.js");
    const mockReact = {
      id: "react", name: "React", detect: {}, skills: [],
      autoRules: ["pragma/autoskills/rules/performance"],
    };

    const result = collectAutoRules({
      detected: [mockReact],
      installedNames: new Set(["rules/performance"]),
    });
    strictEqual(result.length, 0);
  });
});
