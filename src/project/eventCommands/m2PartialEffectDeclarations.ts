export const M2_PARTIAL_EFFECT_DECLARATIONS = [
  {
    ids: [],
    supportedEffects: ["session actor-state recording"],
    unsupportedEffects: ["live native actor and database parity"],
  },
  {
    ids: [],
    supportedEffects: ["deterministic session and world-state recording"],
    unsupportedEffects: ["complete player-surface application"],
  },
  {
    ids: [],
    supportedEffects: ["host shell-action request"],
    unsupportedEffects: ["host UI completion"],
  },
  {
    ids: [],
    supportedEffects: ["interpreter termination request"],
    unsupportedEffects: ["native command-shape parity"],
  },
  {
    ids: [],
    supportedEffects: ["safe fallback recording"],
    unsupportedEffects: ["player-visible media and system effect"],
  },
  {
    ids: [],
    supportedEffects: ["deterministic modern runtime-state mutation"],
    unsupportedEffects: ["end-to-end owner-surface completion"],
  },
] as const;
