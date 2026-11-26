import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { classifyRequest } from "@/ai/v2/request/intent";
import { recordTopicsNamed } from "@/ai/v2/request/topics";
import { exposeV2Tools } from "@/ai/v2/tools/toolExposure";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { buildFixture, type FixtureId } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import { isolateTimers } from "./mergedTeardown";

// 작은 일은 그 일을 하는 도구에 늘 닿는다 — 작은 일 둘째 묶음 35건의 손 풀이(reference)가 부르는 도구가 처음부터 실리거나 load_tools 로 닿는다(모델 없음).
// 2026-11-11: 「이 맵에 세이브 포인트 하나 놓아 줘」「철 검의 공격력을 12로 낮춰 줘」 등 다섯 문장은 게임 도구 묶음을 받지 못했고(tools.game=false, extra=0),
// 손 풀이가 부르는 넷(set_session_start · duplicate_event · script_cutscene · place_battle_blocker)은 v2 풀에 없었다(openwiki/assistant-v2.md 「작은 일은 그 일을 하는 도구에 늘 닿는다」).
describe("aiV2SmallJobReach", () => {
  isolateTimers();
  interface Job { readonly id: string; readonly fixture: FixtureId; readonly request: string; readonly reference?: readonly { readonly tool: string }[] }
  const SET_2 = (JSON.parse(readFileSync("harness-data/assistant-capability/small-jobs-2.json", "utf8")) as { jobs: Job[] }).jobs;
  function offer(fixture: FixtureId, task: string) {
    const project = buildFixture(fixture);
    const env = {
      ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project, projectKey: "small-job-reach" },
      emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, contextEpoch: () => 0,
    } as never;
    const exposure = exposeV2Tools(env, createV2Tools(env, new V2Session()));
    return { intent: classifyRequest(task, project), upFront: exposure.tools.map((t) => t.name), lazy: exposure.lazy };
  }
  describe("둘째 묶음 35건 — 손 풀이 도구에 닿는다", () => {
    it("묶음에 35건이 있다", () => {
      expect(SET_2).toHaveLength(35);
    });

    it.each(SET_2.map((job) => [job.id, job] as const))("%s", (_id, job) => {
      const { upFront, lazy } = offer(job.fixture, job.request);
      for (const name of new Set((job.reference ?? []).map((call) => call.tool))) expect(upFront.includes(name) || lazy.has(name), `${name} 에 닿지 않는다`).toBe(true);
      // load_tools 포함 19개 — 실행기가 더하는 todo 한 자리까지 20개.
      expect(upFront.length).toBeLessThanOrEqual(19);
    }, 60_000);
  });
  describe("그 일을 하는 도구를 처음부터 싣는다", () => {
    /** [일, 처음부터 실려 있어야 하는 도구]. */
    const DOING: readonly (readonly [string, readonly string[]])[] = [
      ["savepoint-blank", ["place_savepoint"]],
      ["equip-attack-blank", ["upsert_equipment", "get_database_records"]],
      ["enemy-hp-double-built", ["upsert_enemy", "get_database_records"]],
      ["enemy-gold-starter", ["upsert_enemy", "get_database_records"]],
      ["dark-cave-built", ["set_scene_mood"]],
      ["weather-rain-blank", ["set_scene_mood"]],
      ["no-save-built", ["set_map_properties"]],
      ["stock-remove-built", ["set_shop_stock", "get_database_records"]],
      ["item-new-built", ["upsert_item"]],
      ["start-in-house-built", ["set_start_position"]],
      ["start-items-starter", ["set_session_start"]],
      ["gameover-text-starter", ["set_game_over"]],
      ["quest-errand-starter", ["create_quest"]],
      ["copy-chest-built", ["duplicate_event"]],
      ["boss-line-starter", ["place_battle_blocker"]],
    ];
    it.each(DOING)("%s", (id, names) => {
      const job = SET_2.find((entry) => entry.id === id)!;
      expect(offer(job.fixture, job.request).upFront).toEqual(expect.arrayContaining([...names]));
    }, 60_000);
  });
  describe("이름으로 부른 기록의 주제", () => {
    const database = { items: [{ name: "해독초" }, { name: "" }], equipment: [{ name: "철 검" }], enemies: [{ name: "얼음의 파수꾼" }, { name: "쥐" }] };

    it("글에 나온 기록 이름으로 아이템·장비·적 주제를 안다(띄어쓰기 무시, 두 글자 이상)", () => {
      expect(recordTopicsNamed("철검의 공격력을 12로 낮춰 줘", database)).toEqual(["equipment"]);
      expect(recordTopicsNamed("얼음의 파수꾼의 HP를 지금의 두 배로 늘려 줘", database)).toEqual(["enemy"]);
      expect(recordTopicsNamed("떠돌이 상인이 해독초는 더 이상 팔지 않게 해 줘", database)).toEqual(["items"]);
      // 한 글자 이름·빈 이름은 세지 않는다. 기록이 없는 프로젝트는 빈 답이다.
      expect(recordTopicsNamed("쥐가 다니는 다락을 꾸며 줘", database)).toEqual([]);
      expect(recordTopicsNamed("철 검의 공격력을 12로 낮춰 줘", undefined)).toEqual([]);
    });

    it("작은 일에서만 본다 — 장소를 짓는 요청은 기록 이름으로 주제를 더하지 않는다", () => {
      const built = buildFixture("built");
      const edit = classifyRequest("얼음의 파수꾼의 HP를 지금의 두 배로 늘려 줘", built);
      expect(edit).toMatchObject({ scope: "edit", editOnly: true });
      expect(edit.topics).toContain("enemy");
      expect(edit.smallTools).toEqual(expect.arrayContaining(["upsert_enemy", "get_database_records"]));
      const place = classifyRequest("얼음의 파수꾼이 사는 동굴을 하나 더 만들어 줘", built);
      expect(place.scope).toBe("place");
      expect(place.topics).not.toContain("enemy");
    });
  });
});

describe("aiV2TodoBriefResult", () => {
  isolateTimers();
  // 2026-11-12 Haiku 게임 하나(r1v-fun) 실측: todo 91번, 결과마다 목록 전체(평균 6.7천 자) — 대화에 쌓여 그 판 입력의 8.7%.
  // 항목 하나를 고친 결과는 그 줄과 열린 줄만 싣는다(전체는 todo view). 문서 openwiki/assistant-v2.md 「할 일 결과는 짧게」.

  function listOf(n: number): TodoStore {
    const store = new TodoStore();
    store.init([{ phase: "짓기", items: Array.from({ length: n }, (_, i) => ({ content: `할 일 ${i + 1} — 무언가를 짓는다` })) }]);
    return store;
  }
  describe("viewFocusEn — 항목 하나를 고친 뒤의 짧은 목록", () => {
    it("짧은 목록은 전체를 준다", () => {
      const store = listOf(TodoStore.SHORT_LIST);
      expect(store.viewFocusEn(store.items[0]!.id)).toBe(store.view(40, true));
    });

    it("긴 목록은 세는 줄 + 그 항목 + 열린 항목 8개 + 나머지 수만", () => {
      const store = listOf(30);
      for (const item of store.items.slice(0, 12)) store.done(item, undefined);
      const focus = store.items[11]!;
      const text = store.viewFocusEn(focus.id);
      const lines = text.split("\n");
      expect(lines[0]).toBe(store.view(40, true).split("\n")[0]);
      expect(lines[1]).toContain(` ${focus.id} `);
      expect(lines.slice(2, 10).map((l) => l.trim().split(" ")[1])).toEqual(store.items.slice(12, 20).map((i) => i.id));
      expect(lines.at(-1)).toContain("todo view shows the whole list");
      expect(lines.at(-1)).toContain("10 open");
      expect(text).not.toContain(` ${store.items[0]!.id} `);
      expect(text.length).toBeLessThan(store.view(40, true).length / 2);
    });

    it("전체 목록의 40줄 상한 뒤에 있는 열린 항목도 보인다", () => {
      const store = listOf(46);
      for (const item of store.items.slice(0, 44)) store.done(item, undefined);
      const text = store.viewFocusEn(store.items[43]!.id);
      expect(text).toContain(` ${store.items[45]!.id} `);
      expect(store.view(40, true)).not.toContain(` ${store.items[45]!.id} `);
    });

    it("항목을 못 찾았으면(id 없음) 전체를 준다", () => {
      const store = listOf(30);
      expect(store.viewFocusEn(undefined)).toBe(store.view(40, true));
    });
  });
});
