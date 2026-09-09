import type { Page } from "@playwright/test";
import type { QaFrameRequest, QaFrameReceipt } from "../../src/player/runtimeQaFrames";
import type { RuntimeDebugHook } from "../../src/player/playSceneTestHooks";

export declare function validateFrameRequest(request: QaFrameRequest): void;
export declare function pauseRuntimeFrames(page: Page): Promise<void>;
export declare function resumeRuntimeFrames(page: Page): Promise<void>;
export declare function performObservedFrames(
  page: Page,
  request: QaFrameRequest,
  trigger?: () => Promise<void>,
  timeoutMs?: number,
): Promise<{ readonly receipt: QaFrameReceipt; readonly state: ReturnType<RuntimeDebugHook["readState"]> | null }>;
