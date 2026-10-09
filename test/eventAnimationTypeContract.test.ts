// 이벤트 페이지 animationType 계약 — 2026-09-24 갤러리 호러 도그푸딩 r3.
// 모델이 32페이지 전부에 유니온 밖 "none" 을 넣자 upsert_event 가 그대로 받아 저장했고,
// 브라우저에서 플레이어가 처음 이벤트를 조사하는 순간 canActionTurn 의 assertNever 가
// "Unhandled PlayScene variant" 로 씬을 죽여 입력이 전부 죽었다(완주 막힘).
// 경계 둘: 툴은 유효값과 함께 거절, 로더는 기존 저장본의Unknown 값을 지운다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { NATIVE_EVENT_PAGE_SCHEMA } from "@/editor/tools/schemaShapes";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { EVENT_ANIMATION_TYPES } from "@/project/types";

describe("이벤트 페이지 animationType 계약", () => {
  it("upsert_event 는 none 같은 유니온 밖 값을 유효값 목록과 함께 거절한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_event", {
      mapId: ctx.project.startMapId,
      event: {
        id: "ev_static_prop",
        x: 4,
        y: 4,
        pages: [{
          id: "p1",
          conditions: [],
          commands: [],
          trigger: { kind: "action" },
          priority: "below",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          graphic: { transparent: true },
          animationType: "none",
        }],
      },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(false);
    expect(result.summary).toContain("animationType");
    expect(result.summary).toContain("fixedGraphic");
  });

  it("스키마는 유니온과 같은 enum 을 노출한다", () => {
    expect(NATIVE_EVENT_PAGE_SCHEMA.properties?.animationType?.enum).toEqual([...EVENT_ANIMATION_TYPES]);
  });

  it("로더는 저장본의 유니온 밖 animationType 을 지워 기본값으로 되돌린다", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const raw = JSON.parse(serialize(project)) as Record<string, unknown>;
    const maps = raw.maps as Record<string, { events: Record<string, unknown>[] }>;
    maps[mapId]!.events.push({
      id: "ev_saved_bad_animation",
      x: 2,
      y: 2,
      trigger: { kind: "action" },
      commands: [],
      pages: [{
        id: "p1",
        name: "멈춰 있는 액자",
        conditions: [],
        commands: [],
        trigger: { kind: "action" },
        priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        graphic: { transparent: true },
        animationType: "none",
      }],
    });
    const loaded = deserialize(JSON.stringify(raw));
    const event = loaded.maps[mapId]!.events.find((entry) => entry.id === "ev_saved_bad_animation")!;
    expect(event.pages?.[0]?.animationType).toBeUndefined();
    // 정상 값은 그대로 남는다.
    const good = createBlankProject();
    const goodMapId = good.startMapId;
    good.maps[goodMapId]!.events.push({
      id: "ev_saved_ok_animation",
      x: 3,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      pages: [{
        id: "p1",
        name: "고정 소품",
        conditions: [],
        commands: [],
        trigger: { kind: "action" },
        priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        graphic: { transparent: true },
        animationType: "fixedGraphic",
      }],
    });
    const reloaded = deserialize(serialize(good));
    expect(reloaded.maps[goodMapId]!.events.find((entry) => entry.id === "ev_saved_ok_animation")?.pages?.[0]?.animationType).toBe("fixedGraphic");
  });
});
