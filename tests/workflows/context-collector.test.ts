import { strictEqual, ok, deepEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { useTmpDir } from "../helpers.js";
import {
  detectDesignSystem,
  findDomainModels,
  findUseCases,
  findSimilarComponents,
  detectConventions,
} from "../../workflows/context-collector.js";

describe("detectDesignSystem", () => {
  const tmp = useTmpDir();

  it("retorna null sin package.json", () => {
    strictEqual(detectDesignSystem(tmp.path), null);
  });

  it("detecta Angular Material", () => {
    writeFileSync(
      join(tmp.path, "package.json"),
      JSON.stringify({ dependencies: { "@angular/material": "^17.0.0" } }),
    );
    strictEqual(detectDesignSystem(tmp.path), "Angular Material");
  });

  it("detecta Tailwind CSS", () => {
    writeFileSync(
      join(tmp.path, "package.json"),
      JSON.stringify({ devDependencies: { tailwindcss: "^3.0.0" } }),
    );
    strictEqual(detectDesignSystem(tmp.path), "Tailwind CSS");
  });

  it("detecta shadcn por components.json", () => {
    writeFileSync(join(tmp.path, "package.json"), JSON.stringify({ dependencies: {} }));
    writeFileSync(join(tmp.path, "components.json"), "{}");
    strictEqual(detectDesignSystem(tmp.path), "shadcn/ui");
  });

  it("retorna null si no hay design system", () => {
    writeFileSync(
      join(tmp.path, "package.json"),
      JSON.stringify({ dependencies: { react: "^18.0.0" } }),
    );
    strictEqual(detectDesignSystem(tmp.path), null);
  });
});

describe("findDomainModels", () => {
  const tmp = useTmpDir();

  it("retorna array vacío si no existe carpeta domain", () => {
    const result = findDomainModels(tmp.path, "payment");
    deepEqual(result, []);
  });

  it("encuentra modelo por keyword del nombre del componente", () => {
    const modelsDir = join(tmp.path, "src", "app", "domain", "models");
    mkdirSync(modelsDir, { recursive: true });
    writeFileSync(
      join(modelsDir, "payment.model.ts"),
      "export interface Payment { id: string; amount: number; }",
    );
    writeFileSync(
      join(modelsDir, "user.model.ts"),
      "export interface User { id: string; }",
    );

    const result = findDomainModels(tmp.path, "PaymentForm");
    strictEqual(result.length, 1);
    ok(result[0].name.includes("payment.model.ts"));
    ok(result[0].content.includes("Payment"));
  });

  it("no encuentra modelos que no coinciden con el keyword", () => {
    const modelsDir = join(tmp.path, "src", "app", "domain", "models");
    mkdirSync(modelsDir, { recursive: true });
    writeFileSync(join(modelsDir, "invoice.model.ts"), "export interface Invoice {}");

    const result = findDomainModels(tmp.path, "PaymentForm");
    strictEqual(result.length, 0);
  });
});

describe("findUseCases", () => {
  const tmp = useTmpDir();

  it("retorna array vacío si no existe carpeta use-cases", () => {
    deepEqual(findUseCases(tmp.path, "payment"), []);
  });

  it("encuentra use case por keyword", () => {
    const ucDir = join(tmp.path, "src", "app", "application", "use-cases");
    mkdirSync(ucDir, { recursive: true });
    writeFileSync(
      join(ucDir, "create-payment.usecase.ts"),
      "@Injectable() export class CreatePaymentUseCase { execute() {} }",
    );

    const result = findUseCases(tmp.path, "PaymentForm");
    strictEqual(result.length, 1);
    ok(result[0].name.includes("create-payment.usecase.ts"));
  });
});

describe("findSimilarComponents", () => {
  const tmp = useTmpDir();

  it("retorna array vacío sin carpeta de componentes", () => {
    deepEqual(findSimilarComponents(tmp.path, true), []);
  });

  it("encuentra componentes en presentation/pages para isPage=true", () => {
    const pagesDir = join(tmp.path, "src", "app", "presentation", "pages", "users");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(
      join(pagesDir, "user-list.component.ts"),
      "@Component({ selector: 'app-user-list', standalone: true, imports: [], templateUrl: './user-list.component.html' })\nexport class UserListComponent implements OnInit {\n  ngOnInit(): void {}\n}",
    );

    const result = findSimilarComponents(tmp.path, true);
    ok(result.length >= 1);
    ok(result[0].name.includes("user-list.component.ts"));
  });

  it("no incluye archivos .spec.ts", () => {
    const pagesDir = join(tmp.path, "src", "app", "presentation", "pages", "payments");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(join(pagesDir, "payment.component.spec.ts"), "describe('test', () => {});");

    const result = findSimilarComponents(tmp.path, true);
    ok(result.every((r) => !r.name.includes(".spec.ts")));
  });
});

describe("detectConventions", () => {
  const tmp = useTmpDir();

  it("incluye convenciones Angular cuando angular está en detectedIds", () => {
    const result = detectConventions(tmp.path, ["angular"]);
    ok(result.some((c) => c.includes("inject()")));
    ok(result.some((c) => c.includes("standalone")));
    ok(result.some((c) => c.includes("whenStable")));
  });

  it("incluye convenciones React cuando react está en detectedIds", () => {
    const result = detectConventions(tmp.path, ["react"]);
    ok(result.some((c) => c.includes("funcionales")));
    ok(result.some((c) => c.includes("Testing Library")));
  });

  it("detecta clean architecture cuando existen las carpetas", () => {
    mkdirSync(join(tmp.path, "src", "app", "domain"), { recursive: true });
    mkdirSync(join(tmp.path, "src", "app", "application"), { recursive: true });
    const result = detectConventions(tmp.path, ["angular"]);
    ok(result.some((c) => c.includes("Clean Architecture")));
  });

  it("retorna array vacío para stack desconocido", () => {
    const result = detectConventions(tmp.path, ["vue"]);
    strictEqual(result.length, 0);
  });
});
