import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActivityTrace, recordActivityEvent } from "@/ai/activityTrace";
import type { ActivityVisual } from "@/ai/activityVisual";
import { briefActivityVisuals, createActivityView } from "@/editor/panels/aiActivityView";
import { setActivityLevel } from "@/editor/panels/aiActivityPreference";
import { createInlineWorkCard } from "@/editor/panels/aiInlineWorkCard";
import { attachImage, releaseDetachedActivityImages, retainedActivityImageUrlCount } from "@/editor/panels/aiActivityMedia";

// 2026-09-23 도그푸딩(등대지기의 겨울): 조수 창이 조회한 초상화 6장과 개발자용 변경 집계
// 「타일 2536 · 이벤트 +157 · 맵 속성 2 · DB 11 · …」로 덮였고, 생성 중 콘솔에
// `blob:… net::ERR_FILE_NOT_FOUND` 가 ~200건 찍혔다.
let window: Window;
beforeEach(() => {
  window = new Window();
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("localStorage", window.localStorage);
  vi.stubGlobal("Event", window.Event);
  vi.stubGlobal("Node", window.Node);
  vi.stubGlobal("MutationObserver", window.MutationObserver);
  vi.stubGlobal("HTMLDetailsElement", window.HTMLDetailsElement);
  setActivityLevel("brief");
});
// 그림 칸은 비동기로 채워진다 — 전역을 풀기 전에 그 작업이 끝나게 둔다.
afterEach(async () => { await new Promise(resolve => setTimeout(resolve, 50)); vi.unstubAllGlobals(); });

const portrait = (i: number): ActivityVisual => ({ kind: "asset", title: `인물 ${i}`, caption: "캐릭터", phase: "read", target: `actor:${i}` });
const mapShot = (phase: ActivityVisual["phase"]): ActivityVisual => ({ kind: "record", title: "성에항", caption: "맵", phase, target: "map:harbor" });

describe("간단히 보기는 조수 창을 그림 앨범으로 만들지 않는다", () => {
  it("조회로 읽은 그림(확인한 모습)은 그리지 않고, 바꾼 그림은 마지막 한 쌍까지만 그린다", () => {
    expect(briefActivityVisuals([portrait(1), portrait(2)].map((v, i) => ({ id: String(i), title: v.title, phase: v.phase, target: v.target, kind: v.kind })))).toEqual([]);
    const view = createActivityView({ archive: false });
    document.body.append(view.root);
    let trace = createActivityTrace("생성");
    trace = recordActivityEvent(trace, { type: "tool_end", id: "look", name: "get_project_summary", ok: true, summary: "프로젝트 확인", visuals: [1, 2, 3, 4, 5, 6].map(portrait) });
    view.update(trace);
    expect(view.root.querySelectorAll(".ai-media-figure")).toHaveLength(0);

    trace = recordActivityEvent(trace, { type: "tool_end", id: "paint", name: "place_tiles", ok: true, summary: "길 깔기", visuals: [mapShot("before"), mapShot("draft"), mapShot("before"), mapShot("draft")] });
    view.update(trace);
    expect(view.root.querySelectorAll(".ai-media-figure")).toHaveLength(2);

    setActivityLevel("detail");
    expect(view.root.querySelectorAll(".ai-media-figure")).toHaveLength(10);
  });

  it("변경 집계 원문 줄은 자세히 보기에서만 보인다", () => {
    const card = createInlineWorkCard({ title: "등대지기의 겨울", onStop: () => {} });
    document.body.append(card.root);
    const project = { maps: {} };
    card.attachChange({ mapId: "m", before: project, after: project, chips: ["타일 2536", "이벤트 +157", "DB 11"] } as never);
    const line = card.root.querySelector<HTMLElement>("[data-testid='ai-work-card-changed']")!;
    expect(line.textContent).toBe("타일 2536 · 이벤트 +157 · DB 11");
    expect(line.hidden).toBe(true);
    setActivityLevel("detail");
    expect(line.hidden).toBe(false);
    setActivityLevel("brief");
    expect(line.hidden).toBe(true);
  });
});

describe("활동 그림 Blob URL 은 그림이 읽히기 전에 풀리지 않는다", () => {
  it("읽는 중이거나 아직 붙지 않은 그림은 두고, 붙었다 떨어진 뒤 다 읽힌 그림만 푼다", async () => {
    const revoked: string[] = [];
    let serial = 0;
    // 생성자는 남긴다 — happy-dom 이 img.src 를 `new URL` 로 해석한다.
    const RealURL = globalThis.URL;
    vi.stubGlobal("URL", Object.assign(class extends RealURL {}, { createObjectURL: () => `blob:http://localhost/${++serial}`, revokeObjectURL: (url: string) => { revoked.push(url); } }));
    const complete = new Map<unknown, boolean>();
    const proto = window.HTMLImageElement.prototype as unknown as object;
    Object.defineProperty(proto, "complete", { configurable: true, get() { return complete.get(this) ?? false; } });

    const before = retainedActivityImageUrlCount();
    // ① 카드가 로그에 붙기 전에 그림이 준비됐다 — 떨어진 게 아니라 아직 안 붙은 것이다.
    const early = document.createElement("span");
    attachImage(early as unknown as HTMLElement, new Blob(["png"]), "초안");
    const earlyImage = early.querySelector("img")!;
    complete.set(earlyImage, true);
    releaseDetachedActivityImages();
    expect(revoked).toEqual([]);
    document.body.append(early);
    releaseDetachedActivityImages();

    // ② 붙어 있다가 행이 교체돼 떨어졌지만 아직 읽는 중 — 풀면 ERR_FILE_NOT_FOUND 다.
    const row = document.createElement("span");
    document.body.append(row);
    attachImage(row as unknown as HTMLElement, new Blob(["png"]), "변경 전");
    const rowImage = row.querySelector("img")!;
    releaseDetachedActivityImages();
    row.remove();
    releaseDetachedActivityImages();
    expect(revoked).toEqual([]);
    // 다 읽힌 뒤에는 푼다.
    complete.set(rowImage, true);
    releaseDetachedActivityImages();
    expect(revoked).toEqual(["blob:http://localhost/2"]);

    // ③ 한 번도 붙지 않은 그림도 유예 시간이 지나면 푼다(누수 방지).
    releaseDetachedActivityImages(Date.now() + 60_000);
    expect(revoked).toEqual(["blob:http://localhost/2"]);
    early.remove();
    releaseDetachedActivityImages();
    expect(revoked).toEqual(["blob:http://localhost/2", "blob:http://localhost/1"]);
    expect(retainedActivityImageUrlCount()).toBe(before);
    delete (proto as { complete?: boolean }).complete;
  });
});
