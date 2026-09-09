import { defineConfig, mergeConfig } from "vitest/config";
import base from "../../../../../vitest.config";

export default mergeConfig(base, defineConfig({
  test: {
    include: ["output/evidence/tile-to-world/manual-build-core/lineage-probes/adversarial.test.ts"],
    maxWorkers: 1,
  },
}));
