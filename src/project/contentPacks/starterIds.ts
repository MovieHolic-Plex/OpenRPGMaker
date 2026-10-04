/** World starters reuse the normal genre engine; these are creation choices, not engine IDs. */
export type ProjectStarterId = "joseon-folklore";

export function isProjectStarterId(value: unknown): value is ProjectStarterId {
  return value === "joseon-folklore";
}
