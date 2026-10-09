import { SCHEMA_VERSION } from "@/project/types/base";
import { ONTOLOGY_CAPABILITIES } from "./ontologyCapabilities";
import { ONTOLOGY_CONTRACTS } from "./ontologyContracts";
import { ONTOLOGY_ENTITIES } from "./ontologyEntities";
import { ONTOLOGY_RELATIONS } from "./ontologyRelations";
import type { DevelopmentOntology } from "./ontologyTypes";

export const DEVELOPMENT_ONTOLOGY = {
  metadata: {
    schemaVersion: 1,
    updatedAt: "2026-06-27",
    projectSchemaVersion: SCHEMA_VERSION,
    notes: [
      "Source of truth for editor feature-development guidance.",
      "Generated docs and JSON exports must be derived from this model.",
    ],
  },
  capabilities: ONTOLOGY_CAPABILITIES,
  entities: ONTOLOGY_ENTITIES,
  relations: ONTOLOGY_RELATIONS,
  contracts: ONTOLOGY_CONTRACTS,
} satisfies DevelopmentOntology;
