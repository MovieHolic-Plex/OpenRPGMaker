import { createMapRunLocks } from "./mapRunLocks.mjs";
/** One browser's Pi turns and rapid stamp orders share ownership. No store dependency. */
export const editorAiMapRuns = createMapRunLocks();
