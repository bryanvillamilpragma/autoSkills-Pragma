import type { WorkflowDefinition } from "../runner.js";
import { runAngularCleanArch } from "./angular.js";
import { runReact } from "./react.js";

export const createComponentWorkflow: WorkflowDefinition = {
  name: "create-component",
  description:
    "Crea un componente siguiendo las convenciones del stack detectado",
  stacks: [
    {
      // Angular con Clean Architecture — rama más específica primero
      requires: ["angular", "clean-architecture-uml"],
      branch: runAngularCleanArch,
    },
    {
      // Angular sin clean arch
      requires: ["angular"],
      branch: runAngularCleanArch,
    },
    {
      requires: ["react"],
      branch: runReact,
    },
  ],
};
