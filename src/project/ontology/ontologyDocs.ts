import { ONTOLOGY_CLASSIFICATION_EXAMPLES } from "./ontologyClassificationExamples";
import { evaluateOntologyClassification } from "./ontologyEvaluation";
import type { DevelopmentOntology, OntologyCapability, OntologyContract } from "./ontologyTypes";

export function generatedDevelopmentOntologyMarkdown(ontology: DevelopmentOntology): string {
  const evaluation = evaluateOntologyClassification(ontology, ONTOLOGY_CLASSIFICATION_EXAMPLES);
  return [
    "# Editor Development Ontology",
    "",
    `- Ontology schema: ${ontology.metadata.schemaVersion}`,
    `- Project schema: ${ontology.metadata.projectSchemaVersion}`,
    `- Updated: ${ontology.metadata.updatedAt}`,
    "",
    "## Capabilities",
    "",
    ...ontology.capabilities.flatMap(capabilityMarkdown),
    "## Entities",
    "",
    ...ontology.entities.map((entity) => `- \`${entity.id}\`: ${entity.description}`),
    "",
    "## Relations",
    "",
    ...ontology.relations.map((relation) => `- \`${relation.id}\`: ${relation.label}`),
    "",
    "## Contracts",
    "",
    ...ontology.contracts.map(contractMarkdown),
    "",
    "## Classification Evaluation",
    "",
    `- Accuracy: ${evaluation.accuracy}`,
    `- Macro sensitivity: ${evaluation.macroSensitivity}`,
    `- Macro precision: ${evaluation.macroPrecision}`,
    "",
    ...Object.entries(evaluation.categories).map(([capabilityId, metrics]) =>
      `- \`${capabilityId}\`: sensitivity ${metrics.sensitivity}, precision ${metrics.precision}`
    ),
    "",
  ].join("\n");
}

function capabilityMarkdown(capability: OntologyCapability): readonly string[] {
  return [
    `### ${capability.id}`,
    "",
    capability.purpose,
    "",
    `- Entities: ${capability.entities.map(code).join(", ")}`,
    `- Types: ${capability.typeSurfaces.map(code).join(", ")}`,
    `- UI: ${capability.uiSurfaces.map(code).join(", ")}`,
    `- Runtime: ${capability.runtimeSurfaces.map(code).join(", ")}`,
    `- Storage: ${capability.storageSurfaces.map(code).join(", ")}`,
    `- Tests: ${capability.testSurfaces.map(code).join(", ")}`,
    "",
  ];
}

function contractMarkdown(contract: OntologyContract): string {
  return `- \`${contract.id}\` (${contract.severity}): ${contract.description}`;
}

function code(value: string): string {
  return `\`${value}\``;
}
