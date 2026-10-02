import type { ItemRecord } from "../types";

// Bound JSON inference. Authored rows are validated by the normalizer and data inspectors.
declare const catalog: readonly (Partial<ItemRecord> & Pick<ItemRecord, "id" | "name">)[];
export default catalog;
