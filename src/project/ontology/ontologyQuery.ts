import type { DevelopmentOntology, OntologyCapability, OntologyEntity, OntologyIssue } from "./ontologyTypes";

type MissingRefCheck = {
  readonly issues: OntologyIssue[];
  readonly code: string;
  readonly ownerId: string;
  readonly refs: readonly string[];
  readonly allowedRefs: ReadonlySet<string>;
};

export function queryOntologyByCapability(ontology: DevelopmentOntology, capabilityId: string): OntologyCapability | null {
  const normalizedId = normalize(capabilityId);
  return ontology.capabilities.find((capability) => normalize(capability.id) === normalizedId) ?? null;
}

export function queryOntologyByEntity(ontology: DevelopmentOntology, entityId: string): OntologyEntity | null {
  const normalizedId = normalize(entityId);
  return ontology.entities.find((entity) => normalize(entity.id) === normalizedId) ?? null;
}

export function queryOntologyByFile(ontology: DevelopmentOntology, filePath: string): readonly OntologyCapability[] {
  const normalizedPath = normalizePath(filePath);
  return ontology.capabilities.filter((capability) => capabilitySurfaces(capability).some((surface) => normalizePath(surface) === normalizedPath));
}

export function queryOntologyByTask(ontology: DevelopmentOntology, task: string): readonly OntologyCapability[] {
  const normalizedTask = normalize(task);
  const scored = ontology.capabilities.map((capability) => ({ capability, score: scoreCapability(capability, normalizedTask) }));
  const exactMatches = scored.filter((candidate) => candidate.score >= EXACT_ALIAS_SCORE);
  const candidates = exactMatches.length > 0 ? exactMatches : scored;
  return candidates
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.capability.id.localeCompare(right.capability.id))
    .map((candidate) => candidate.capability);
}

export function checkDevelopmentOntology(ontology: DevelopmentOntology): readonly OntologyIssue[] {
  const capabilityIds = new Set(ontology.capabilities.map((capability) => capability.id));
  const entityIds = new Set(ontology.entities.map((entity) => entity.id));
  const contractIds = new Set(ontology.contracts.map((contract) => contract.id));
  const relationIds = new Set(ontology.relations.map((relation) => relation.id));
  const issues: OntologyIssue[] = [];

  for (const capability of ontology.capabilities) {
    pushMissingRefs({ issues, code: "missing-capability-entity", ownerId: capability.id, refs: capability.entities, allowedRefs: entityIds });
    pushMissingRefs({ issues, code: "missing-capability-contract", ownerId: capability.id, refs: capability.contracts, allowedRefs: contractIds });
  }

  for (const entity of ontology.entities) {
    pushMissingRefs({ issues, code: "missing-entity-owner", ownerId: entity.id, refs: entity.ownerCapabilityIds, allowedRefs: capabilityIds });
    pushMissingRefs({ issues, code: "missing-entity-relation", ownerId: entity.id, refs: entity.relationIds, allowedRefs: relationIds });
    pushMissingRefs({ issues, code: "missing-entity-contract", ownerId: entity.id, refs: entity.validationRuleIds, allowedRefs: contractIds });
  }

  for (const relation of ontology.relations) {
    pushMissingRefs({ issues, code: "missing-relation-entity", ownerId: relation.id, refs: [relation.fromEntityId, relation.toEntityId], allowedRefs: entityIds });
  }

  for (const contract of ontology.contracts) {
    pushMissingRefs({ issues, code: "missing-contract-capability", ownerId: contract.id, refs: contract.capabilityIds, allowedRefs: capabilityIds });
    pushMissingRefs({ issues, code: "missing-contract-entity", ownerId: contract.id, refs: contract.entityIds, allowedRefs: entityIds });
  }

  return issues;
}

function capabilitySurfaces(capability: OntologyCapability): readonly string[] {
  return [
    ...capability.typeSurfaces,
    ...capability.uiSurfaces,
    ...capability.runtimeSurfaces,
    ...capability.storageSurfaces,
    ...capability.testSurfaces,
    ...capability.docsSurfaces,
  ];
}

const EXACT_ALIAS_SCORE = 100;

function scoreCapability(capability: OntologyCapability, normalizedTask: string): number {
  const aliases = capability.commonTasks.flatMap((task) => [task.label, ...task.taskAliases]).map(normalize);
  if (aliases.some((alias) => normalizedTask.includes(alias) || alias.includes(normalizedTask))) return EXACT_ALIAS_SCORE;
  const corpus = normalize([
    capability.id,
    capability.label,
    capability.purpose,
    ...capability.entities,
    ...capability.commonTasks.flatMap((task) => task.taskAliases),
  ].join(" "));
  return words(normalizedTask).reduce((score, word) => score + (corpus.includes(word) ? 1 : 0), 0);
}

function pushMissingRefs(check: MissingRefCheck): void {
  for (const ref of check.refs) {
    if (check.allowedRefs.has(ref)) continue;
    check.issues.push({ code: check.code, message: `${check.ownerId} references missing ${ref}` });
  }
}

function words(value: string): readonly string[] {
  return value.split(/\s+/).filter((word) => word.length > 0);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePath(value: string): string {
  return value.trim().replaceAll("\\", "/");
}
