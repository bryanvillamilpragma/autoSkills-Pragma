import { deepEqual, strictEqual, ok } from "node:assert/strict";
import { describe, it } from "node:test";

import { toKebabCase, toPascalCase } from "../../workflows/runner.js";

describe("toKebabCase", () => {
  it("convierte PascalCase", () => {
    strictEqual(toKebabCase("PaymentForm"), "payment-form");
    strictEqual(toKebabCase("MyComponent"), "my-component");
    strictEqual(toKebabCase("UserList"), "user-list");
  });

  it("convierte con espacios", () => {
    strictEqual(toKebabCase("payment form"), "payment-form");
  });

  it("pasa kebab-case sin cambios", () => {
    strictEqual(toKebabCase("payment-form"), "payment-form");
  });

  it("maneja una sola palabra", () => {
    strictEqual(toKebabCase("Header"), "header");
  });
});

describe("toPascalCase", () => {
  it("convierte kebab-case", () => {
    strictEqual(toPascalCase("payment-form"), "PaymentForm");
    strictEqual(toPascalCase("my-component"), "MyComponent");
  });

  it("pasa PascalCase sin cambios", () => {
    strictEqual(toPascalCase("PaymentForm"), "PaymentForm");
  });

  it("maneja una sola palabra", () => {
    strictEqual(toPascalCase("header"), "Header");
  });
});

describe("create-component workflow — stacks", () => {
  it("la rama angular-clean-arch requiere [angular, clean-architecture-uml]", async () => {
    const { createComponentWorkflow } = await import(
      "../../workflows/create-component/index.js"
    );
    const stack = createComponentWorkflow.stacks[0];
    deepEqual(stack.requires, ["angular", "clean-architecture-uml"]);
    ok(typeof stack.branch === "function");
  });

  it("la rama angular requiere solo [angular]", async () => {
    const { createComponentWorkflow } = await import(
      "../../workflows/create-component/index.js"
    );
    const stack = createComponentWorkflow.stacks[1];
    deepEqual(stack.requires, ["angular"]);
  });

  it("la rama react requiere [react]", async () => {
    const { createComponentWorkflow } = await import(
      "../../workflows/create-component/index.js"
    );
    const stack = createComponentWorkflow.stacks[2];
    deepEqual(stack.requires, ["react"]);
  });

  it("selecciona angular-clean-arch cuando ambos están detectados", async () => {
    const { createComponentWorkflow } = await import(
      "../../workflows/create-component/index.js"
    );
    const detectedIds = ["angular", "clean-architecture-uml", "typescript"];
    const match = createComponentWorkflow.stacks.find((s) =>
      s.requires.every((r) => detectedIds.includes(r)),
    );
    ok(match !== undefined);
    deepEqual(match!.requires, ["angular", "clean-architecture-uml"]);
  });

  it("selecciona react cuando solo react está detectado", async () => {
    const { createComponentWorkflow } = await import(
      "../../workflows/create-component/index.js"
    );
    const detectedIds = ["react", "typescript"];
    const match = createComponentWorkflow.stacks.find((s) =>
      s.requires.every((r) => detectedIds.includes(r)),
    );
    ok(match !== undefined);
    deepEqual(match!.requires, ["react"]);
  });

  it("no selecciona ninguna rama para vue", async () => {
    const { createComponentWorkflow } = await import(
      "../../workflows/create-component/index.js"
    );
    const detectedIds = ["vue", "typescript"];
    const match = createComponentWorkflow.stacks.find((s) =>
      s.requires.every((r) => detectedIds.includes(r)),
    );
    strictEqual(match, undefined);
  });
});
