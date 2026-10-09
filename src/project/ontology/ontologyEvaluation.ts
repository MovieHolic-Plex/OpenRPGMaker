import { classifyOntologyTask } from "./ontologyClassifier";
import type {
  DevelopmentOntology,
  OntologyCategoryMetrics,
  OntologyClassificationEvaluation,
  OntologyClassificationExample,
  OntologyClassificationMistake,
} from "./ontologyTypes";

type MutableMetrics = {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
};

export function evaluateOntologyClassification(
  ontology: DevelopmentOntology,
  examples: readonly OntologyClassificationExample[],
): OntologyClassificationEvaluation {
  const metrics: Record<string, MutableMetrics> = Object.fromEntries(
    ontology.capabilities.map((capability) => [capability.id, { truePositive: 0, falsePositive: 0, falseNegative: 0 }]),
  );
  const mistakes: OntologyClassificationMistake[] = [];
  let correct = 0;

  for (const example of examples) {
    const actualCapabilityId = classifyOntologyTask(ontology, example.task).topCapabilityId;
    if (actualCapabilityId === example.expectedCapabilityId) {
      correct += 1;
      metrics[example.expectedCapabilityId].truePositive += 1;
      continue;
    }
    metrics[example.expectedCapabilityId].falseNegative += 1;
    if (actualCapabilityId) metrics[actualCapabilityId].falsePositive += 1;
    mistakes.push({ task: example.task, expectedCapabilityId: example.expectedCapabilityId, actualCapabilityId });
  }

  const categories = finalizedMetrics(metrics);
  return {
    total: examples.length,
    correct,
    accuracy: ratio(correct, examples.length),
    macroPrecision: mean(Object.values(categories).map((category) => category.precision)),
    macroSensitivity: mean(Object.values(categories).map((category) => category.sensitivity)),
    categories,
    mistakes,
  };
}

function finalizedMetrics(metrics: Record<string, MutableMetrics>): Record<string, OntologyCategoryMetrics> {
  const finalized: Record<string, OntologyCategoryMetrics> = {};
  for (const [capabilityId, metric] of Object.entries(metrics)) {
    finalized[capabilityId] = {
      ...metric,
      precision: ratio(metric.truePositive, metric.truePositive + metric.falsePositive),
      sensitivity: ratio(metric.truePositive, metric.truePositive + metric.falseNegative),
    };
  }
  return finalized;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 1000;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return ratio(values.reduce((total, value) => total + value, 0), values.length);
}
