import { weightedTermsForCapability, type WeightedTerm } from "./ontologyClassificationTerms";
import type { DevelopmentOntology, OntologyTaskClassification, OntologyTaskPrediction, OntologyWordMatch } from "./ontologyTypes";

type WordMatchInput = {
  readonly inputWord: string;
  readonly terms: readonly WeightedTerm[];
};

export function classifyOntologyTask(ontology: DevelopmentOntology, task: string): OntologyTaskClassification {
  const inputWords = tokenize(task);
  const predictions = ontology.capabilities
    .map((capability) => predictionForCapability({ capability, inputWords }))
    .filter((prediction) => prediction.score > 0)
    .sort((left, right) => right.score - left.score || left.capabilityId.localeCompare(right.capabilityId));

  return {
    task,
    topCapabilityId: predictions[0]?.capabilityId ?? null,
    predictions,
  };
}

type PredictionInput = {
  readonly capability: DevelopmentOntology["capabilities"][number];
  readonly inputWords: readonly string[];
};

function predictionForCapability(input: PredictionInput): OntologyTaskPrediction {
  const terms = weightedTermsForCapability(input.capability);
  const wordMatches = input.inputWords.map((word) => bestMatch({ inputWord: word, terms })).filter(isWordMatch);
  const score = round(wordMatches.reduce((total, match) => total + match.contribution, 0));
  const similarity = round(Math.min(1, score / Math.max(input.inputWords.length, 1)));
  return {
    capabilityId: input.capability.id,
    label: input.capability.label,
    score,
    similarity,
    confidence: similarity,
    wordMatches,
  };
}

function bestMatch(input: WordMatchInput): OntologyWordMatch | null {
  const normalizedInput = normalize(input.inputWord);
  let current: OntologyWordMatch | null = null;
  for (const term of input.terms) {
    const normalizedTerm = normalize(term.term);
    const similarity = termSimilarity(normalizedInput, normalizedTerm);
    if (similarity < 0.45) continue;
    const contribution = round(similarity * term.weight);
    if (current && current.contribution >= contribution) continue;
    current = { inputWord: input.inputWord, matchedTerm: term.term, source: term.source, similarity: round(similarity), contribution };
  }
  return current;
}

function termSimilarity(inputWord: string, term: string): number {
  if (inputWord === term) return 1;
  if (term.includes(inputWord) || inputWord.includes(term)) return Math.min(inputWord.length, term.length) / Math.max(inputWord.length, term.length);
  return diceCoefficient(inputWord, term);
}

function diceCoefficient(left: string, right: string): number {
  const leftPairs = charPairs(left);
  const rightPairs = charPairs(right);
  if (leftPairs.length === 0 || rightPairs.length === 0) return 0;
  let matches = 0;
  const remaining = [...rightPairs];
  for (const pair of leftPairs) {
    const index = remaining.indexOf(pair);
    if (index < 0) continue;
    matches += 1;
    remaining.splice(index, 1);
  }
  return (2 * matches) / (leftPairs.length + rightPairs.length);
}

function charPairs(value: string): readonly string[] {
  if (value.length < 2) return value.length === 0 ? [] : [value];
  return Array.from({ length: value.length - 1 }, (_unused, index) => value.slice(index, index + 2));
}

function tokenize(value: string): readonly string[] {
  const tokens = normalize(value).split(/[^0-9a-z가-힣]+/).filter((token) => token.length > 0);
  return [...new Set(tokens)];
}

function isWordMatch(value: OntologyWordMatch | null): value is OntologyWordMatch {
  return value !== null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
