export type OntologyRelationKind = "contains" | "dependsOn" | "reads" | "references" | "uses" | "writes";
export type OntologySeverity = "error" | "info" | "warning";

export type OntologyMetadata = {
  readonly schemaVersion: number;
  readonly updatedAt: string;
  readonly projectSchemaVersion: number;
  readonly notes: readonly string[];
};

export type DevelopmentRecipe = {
  readonly id: string;
  readonly label: string;
  readonly taskAliases: readonly string[];
  readonly checkSurfaces: readonly string[];
  readonly implementationOrder: readonly string[];
  readonly requiredTests: readonly string[];
};

export type OntologyCapability = {
  readonly id: string;
  readonly label: string;
  readonly purpose: string;
  readonly entities: readonly string[];
  readonly typeSurfaces: readonly string[];
  readonly uiSurfaces: readonly string[];
  readonly runtimeSurfaces: readonly string[];
  readonly storageSurfaces: readonly string[];
  readonly testSurfaces: readonly string[];
  readonly docsSurfaces: readonly string[];
  readonly commonTasks: readonly DevelopmentRecipe[];
  readonly contracts: readonly string[];
};

export type OntologyEntity = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly typeFiles: readonly string[];
  readonly ownerCapabilityIds: readonly string[];
  readonly relationIds: readonly string[];
  readonly validationRuleIds: readonly string[];
};

export type OntologyRelation = {
  readonly id: string;
  readonly label: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly kind: OntologyRelationKind;
  readonly sourceFiles: readonly string[];
  readonly reverseLabel: string;
};

export type OntologyContract = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly capabilityIds: readonly string[];
  readonly entityIds: readonly string[];
  readonly severity: OntologySeverity;
  readonly validationRuleId?: string;
};

export type DevelopmentOntology = {
  readonly metadata: OntologyMetadata;
  readonly capabilities: readonly OntologyCapability[];
  readonly entities: readonly OntologyEntity[];
  readonly relations: readonly OntologyRelation[];
  readonly contracts: readonly OntologyContract[];
};

export type OntologyWordMatch = {
  readonly inputWord: string;
  readonly matchedTerm: string;
  readonly source: "alias" | "entity" | "keyword" | "surface";
  readonly similarity: number;
  readonly contribution: number;
};

export type OntologyTaskPrediction = {
  readonly capabilityId: string;
  readonly label: string;
  readonly score: number;
  readonly similarity: number;
  readonly confidence: number;
  readonly wordMatches: readonly OntologyWordMatch[];
};

export type OntologyTaskClassification = {
  readonly task: string;
  readonly topCapabilityId: string | null;
  readonly predictions: readonly OntologyTaskPrediction[];
};

export type OntologyClassificationExample = {
  readonly task: string;
  readonly expectedCapabilityId: string;
};

export type OntologyCategoryMetrics = {
  readonly truePositive: number;
  readonly falsePositive: number;
  readonly falseNegative: number;
  readonly precision: number;
  readonly sensitivity: number;
};

export type OntologyClassificationMistake = {
  readonly task: string;
  readonly expectedCapabilityId: string;
  readonly actualCapabilityId: string | null;
};

export type OntologyClassificationEvaluation = {
  readonly total: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly macroPrecision: number;
  readonly macroSensitivity: number;
  readonly categories: Record<string, OntologyCategoryMetrics>;
  readonly mistakes: readonly OntologyClassificationMistake[];
};

export type OntologyIssue = {
  readonly code: string;
  readonly message: string;
};
