import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetEventDraftVaultForTest,
  eventDraftVaultStorageKey,
  persistEventDraftVaultNow,
  rememberEventDraftVaultEntry,
} from "@/project/eventDraftVault";
import type { GameEvent } from "@/project/types";

const DRAFT: GameEvent = {
  id: "draft-event",
  x: 1,
  y: 1,
  trigger: { kind: "action" },
  commands: [],
  pages: [],
  draft: { kind: "new" },
};

function countingLocalStorage(): { writes: () => string[]; storage: Record<string, unknown> } {
  const writes: string[] = [];
  const values = new Map<string, string>();
  return {
    writes: () => [...writes],
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writes.push(key);
        values.set(key, value);
      },
      removeItem: (key: string) => void values.delete(key),
    },
  };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const PAST_VAULT_DEBOUNCE_MS = 420;

describe("event draft vault persist debounce", () => {
  let counting: ReturnType<typeof countingLocalStorage>;

  beforeEach(() => {
    _resetEventDraftVaultForTest();
    counting = countingLocalStorage();
    vi.stubGlobal("localStorage", counting.storage);
  });

  afterEach(() => {
    _resetEventDraftVaultForTest();
    vi.unstubAllGlobals();
  });

  it("an explicit persist cancels the debounce it supersedes, so no duplicate write lands", async () => {
    const key = eventDraftVaultStorageKey();
    rememberEventDraftVaultEntry("map_blank_start", DRAFT);

    persistEventDraftVaultNow();
    expect(counting.writes().filter((entry) => entry === key)).toHaveLength(1);

    await wait(PAST_VAULT_DEBOUNCE_MS);

    expect(counting.writes().filter((entry) => entry === key)).toHaveLength(1);
  });

  it("a later remember still schedules its own persist after an explicit one", async () => {
    const key = eventDraftVaultStorageKey();
    persistEventDraftVaultNow();
    rememberEventDraftVaultEntry("map_blank_start", DRAFT);

    await wait(PAST_VAULT_DEBOUNCE_MS);

    expect(counting.writes().filter((entry) => entry === key).length).toBeGreaterThanOrEqual(1);
  });
});
