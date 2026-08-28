import { afterEach, describe, expect, it, vi } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { deserialize } from "@/project/io";
import { loadProjectFromSupabase } from "@/project/supabaseProjectSync";

const TEST_CONFIG = {
  anonKey: "fixture-sweep-key",
  projectId: "fixture-sweep",
  url: "http://fixture-sweep.invalid",
} as const;

const FIXTURE_DIRECTORY = join(process.cwd(), "test/fixtures/projects");

async function projectFixtureNames(): Promise<string[]> {
  return (await readdir(FIXTURE_DIRECTORY))
    .filter((name) => name.endsWith(".json"))
    .sort();
}

describe("Supabase 프로젝트 픽스처 불러오기", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("기존에 열리던 모든 프로젝트 픽스처를 실제 Supabase 로드 경로로 연다", async () => {
    const fixtureNames = await projectFixtureNames();
    expect(fixtureNames.length).toBeGreaterThan(0);

    const failures: string[] = [];
    const intentionallyInvalid: string[] = [];
    for (const fixtureName of fixtureNames) {
      const raw = await readFile(join(FIXTURE_DIRECTORY, fixtureName), "utf8");
      const source = JSON.parse(raw) as unknown;
      // 끊긴 참조를 검증하는 음성 픽스처도 같은 디렉터리에 있다. 목록을 하드코딩하지 않고
      // 원본 자체가 열리는지를 기준으로 양성 픽스처를 판별해 새 픽스처도 자동 포함한다.
      let baselineLoads = true;
      try {
        deserialize(raw);
      } catch {
        baselineLoads = false;
        intentionallyInvalid.push(fixtureName);
      }
      vi.stubGlobal("fetch", (async (input) => {
        if (String(input).includes("/rest/v1/maps?")) return new Response(JSON.stringify([]), { status: 200 });
        return new Response(JSON.stringify([{ current_json: source }]), { status: 200 });
      }) satisfies typeof fetch);
      try {
        expect(await loadProjectFromSupabase(TEST_CONFIG), fixtureName).not.toBeNull();
      } catch (error) {
        if (baselineLoads) failures.push(`${fixtureName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    expect(intentionallyInvalid.length).toBeGreaterThan(0);
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
