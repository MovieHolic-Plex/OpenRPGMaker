import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { requireRecord, requireString } from "@/project/io/guards";
import type { AudioDescriptionOverrides, Project } from "@/project/types";

export const AUDIO_PERSISTENCE_CONFIG = {
  anonKey: "test-anon-key",
  projectId: "audio-description-persistence",
  url: "http://dbserver:8100",
} as const;

type Signal<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
};

function signal<T>(): Signal<T> {
  let resolveValue: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });
  if (resolveValue === undefined) throw new TypeError("Promise resolver was not initialized");
  return { promise, resolve: resolveValue };
}

function bounded<T>(promise: Promise<T>): Promise<T> {
  // Native AbortSignal deadlines remain active while autosave timers are frozen.
  const deadline = AbortSignal.timeout(10_000);
  return new Promise<T>((resolve, reject) => {
    const expired = () => reject(new TypeError("Persistence transport signal timed out"));
    deadline.addEventListener("abort", expired, { once: true });
    void promise.then(
      (value) => {
        deadline.removeEventListener("abort", expired);
        resolve(value);
      },
      (error: unknown) => {
        deadline.removeEventListener("abort", expired);
        reject(error);
      },
    );
  });
}

export function audioDescriptionProject(
  descriptions: AudioDescriptionOverrides | undefined,
  source: Project = createBlankProject(),
): Project {
  const project = structuredClone(source);
  // Match minimalValidProject in supabaseProjectSync.test.ts: generated monster
  // artwork is not available in the unit-test asset environment.
  for (const enemy of project.database.enemies) {
    delete enemy.monsterResourceId;
    delete enemy.speciesId;
  }
  for (const species of project.database.monsterSpecies ?? []) {
    if (species.graphic) delete species.graphic.monsterResourceId;
  }
  if (descriptions === undefined) delete project.audioDescriptions;
  else project.audioDescriptions = structuredClone(descriptions);
  return project;
}

export function createAudioDescriptionTransport(source: Project) {
  let project = structuredClone(source);
  let sha256 = "initial-sha";
  let rejectedCas = 0;
  let completedCommits = 0;
  const accepted: Project[] = [];
  const commitSignals = new Map<number, Signal<void>>();
  const gates: {
    readonly entered: Signal<void>;
    readonly response: Signal<number>;
  }[] = [];

  const transport = (async (input, init) => {
    const url = new URL(String(input), AUDIO_PERSISTENCE_CONFIG.url);
    const method = init?.method ?? "GET";
    if (url.pathname === "/rest/v1/projects") {
      if (method === "GET") {
        return new Response(JSON.stringify([{
          current_json: JSON.parse(serialize(project)),
          current_sha256: sha256,
        }]), { status: 200 });
      }
      if (method !== "PATCH" && method !== "POST") {
        throw new TypeError(`Unexpected project method: ${method}`);
      }
      const payload = requireRecord(
        "project payload",
        JSON.parse(requireString("request body", init?.body)),
      );
      const submitted = deserialize(JSON.stringify(payload.current_json));
      const submittedSha = requireString("current_sha256", payload.current_sha256);
      if (method === "PATCH") {
        const gate = gates.shift();
        if (gate) {
          gate.entered.resolve();
          const status = await gate.response.promise;
          if (status !== 200) return new Response("WRITE_FAILED", { status });
        }
        if (url.searchParams.get("current_sha256") !== `eq.${sha256}`) {
          rejectedCas += 1;
          return new Response("[]", { status: 200 });
        }
      }
      project = submitted;
      sha256 = submittedSha;
      accepted.push(structuredClone(submitted));
      return new Response(JSON.stringify([{
        project_id: AUDIO_PERSISTENCE_CONFIG.projectId,
      }]), { status: 200 });
    }
    if (url.pathname === "/rest/v1/project_changes" && method === "POST") {
      completedCommits += 1;
      for (const [count, completion] of commitSignals) {
        if (count <= completedCommits) {
          completion.resolve();
          commitSignals.delete(count);
        }
      }
      return new Response("[]", { status: 200 });
    }
    // As in the existing Supabase row transport, no child-table overlay is
    // installed; the real loader reads the accepted current_json snapshot.
    if ([
      "/rest/v1/maps",
      "/rest/v1/tilesets",
      "/rest/v1/project_commits",
    ].includes(url.pathname)) {
      return new Response("[]", { status: 200 });
    }
    throw new TypeError(`Unexpected persistence request: ${method} ${url.pathname}`);
  }) satisfies typeof fetch;

  return {
    fetch: transport,
    get accepted(): readonly Project[] {
      return accepted;
    },
    get rejectedCas(): number {
      return rejectedCas;
    },
    holdNextPatch() {
      const entered = signal<void>();
      const response = signal<number>();
      gates.push({ entered, response });
      return {
        entered: () => bounded(entered.promise),
        release: (status = 200) => response.resolve(status),
      };
    },
    waitForCommits(count: number): Promise<void> {
      if (completedCommits >= count) return Promise.resolve();
      const completion = signal<void>();
      commitSignals.set(count, completion);
      return bounded(completion.promise);
    },
  };
}
