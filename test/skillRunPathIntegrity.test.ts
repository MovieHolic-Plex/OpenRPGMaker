// 마을 생성 스킬 파이프라인 회귀(도그푸딩 결함 ③·④).
// p5/p6 타임라인 분석 결과: 스킬 폼 경로 자체는 일반 채팅과 동일한 sendText를 타지만,
// 폼의 제출 버튼("실행")이 상단 툴바의 테스트 플레이 버튼("실행")과 라벨이 충돌해
// 텍스트 기반 클릭이 풀스크린 테스트 플레이를 여는 오클릭을 유발 — 제출이 시작조차 안 된 채
// 7분+ 대기(status "새 대화" 유지, assistant 빈 응답, 산출 0)로 이어졌다.
// 계약: ① 제출 버튼 라벨은 "실행" 단독이 아니어야 한다(구분 가능) ② 마을 생성 폼 제출은
// onRunPrompt(=sendText)로 즉시 이어져야 한다 ③ 스킬 실행 경로는 테스트 플레이 이벤트를
// 발생시키지 않는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_SKILLS, type SkillRunContext } from "@/ai/skills";
import { renderSkillDrawer, renderSkillParamForm } from "@/editor/panels/aiSkillDrawer";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const CTX: SkillRunContext = {
  mapId: "map_v",
  mapName: "빈 맵",
  selection: null,
};

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(() => {
  restoreDom = installFakeDom();
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
});

describe("마을 생성 스킬 제출 경로", () => {
  it("제출 버튼 라벨이 '실행' 단독이 아니다(테스트 플레이 '실행'과 구분 — 오클릭 방지)", () => {
    const village = SYSTEM_SKILLS.find((skill) => skill.id === "build-village")!;
    const form = renderSkillParamForm(village, CTX, () => {}, () => {}) as unknown as FakeElement;
    const run = findByTestId(form, "skill-param-run");
    expect(run).toBeTruthy();
    expect(run?.textContent?.trim()).not.toBe("실행");
    expect(run?.textContent).toContain("스킬 실행");
  });

  it("폼 제출이 onSubmit(프롬프트)으로 즉시 이어진다 — 파이프라인 자체는 채팅과 동일 경로", () => {
    const village = SYSTEM_SKILLS.find((skill) => skill.id === "build-village")!;
    const onSubmit = vi.fn();
    const form = renderSkillParamForm(village, CTX, onSubmit, () => {}) as unknown as FakeElement;
    (findByTestId(form, "skill-param-theme") as unknown as HTMLInputElement).value = "강가의 어촌";
    (findByTestId(form, "skill-param-run") as unknown as HTMLElement).click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [prompt, displayAs] = onSubmit.mock.calls[0] as [string, string];
    expect(prompt).toContain("강가의 어촌");
    expect(prompt).toContain("단계별로 한 줄 보고하며 끝까지 진행");
    // 채팅 표시는 TUI 명령 줄 — 앱 라벨("🏘️ 마을 생성")이 아니라 `/build-village`.
    expect(displayAs).toBe("/build-village");
  });

  it("스킬 서랍 실행 경로가 테스트 플레이 창 이벤트를 발생시키지 않는다(자동 오픈 없음 — ④)", () => {
    const dispatched: string[] = [];
    vi.stubGlobal("window", {
      dispatchEvent: (event: { type: string }) => {
        dispatched.push(event.type);
        return true;
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      setTimeout: (fn: () => void) => {
        fn();
        return 0;
      },
      clearTimeout: () => undefined,
    });
    const onRunPrompt = vi.fn();
    const drawer = renderSkillDrawer({
      getContext: () => CTX,
      onRunPrompt,
      onAction: () => undefined,
      getSavePrefill: () => "",
    });
    const audit = SYSTEM_SKILLS.find((skill) => skill.id === "map-audit")!; // 인자 없는 스킬 — 즉시 실행.
    drawer.run(audit);
    expect(onRunPrompt).toHaveBeenCalledTimes(1);
    expect(dispatched).not.toContain("rpgzzu:test-play-window");
    vi.unstubAllGlobals();
  });
});
