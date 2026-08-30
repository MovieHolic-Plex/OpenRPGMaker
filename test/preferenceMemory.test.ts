// test/preferenceMemory.test.ts
// 성향 저장소 계약. 이 파일이 지키는 것은 "AI 가 사람의 성향을 기억한다"의 하부 구조 전부다 —
// 상한 축출, 고정 면제, 프롬프트 블록의 우선순위 문장·하드캡.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildPreferenceMemorySection,
  buildPreferenceMemorySectionFrom,
  clearPreferenceFacts,
  comparePreferenceRank,
  deletePreferenceFact,
  dropPreferenceFactsUnpinned,
  evictOverLimit,
  GLOBAL_PREFERENCE_LIMIT,
  listPreferenceFacts,
  loadPreferenceFacts,
  normalizePreferenceText,
  PREFERENCE_MEMORY_STORAGE_KEY,
  PREFERENCE_PRECEDENCE_LINE,
  PREFERENCE_PROJECT_SUBHEADING,
  PREFERENCE_SECTION_HEADING,
  PREFERENCE_SECTION_MAX_CHARS,
  PREFERENCE_SECTION_MAX_LINES,
  PREFERENCE_TEXT_MAX_CHARS,
  PROJECT_PREFERENCE_LIMIT,
  savePreferenceFacts,
  setPreferenceFactPinned,
  upsertPreferenceFact,
  upsertPreferenceFactIn,
  type PreferenceFact,
} from "@/ai/preferenceMemory";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

function fact(overrides: Partial<PreferenceFact> & { readonly id: string; readonly text: string }): PreferenceFact {
  return {
    scope: "global",
    strength: "medium",
    evidence: 1,
    source: "observed",
    updatedAt: 1_000,
    ...overrides,
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: createMemoryStorage(),
  });
});

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("저장과 복원", () => {
  it("저장한 성향을 그대로 되읽는다", () => {
    expect(upsertPreferenceFact({ text: "마을은 작게 유지한다", scope: "global", strength: "strong" })).toBe(true);
    const loaded = loadPreferenceFacts();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].text).toBe("마을은 작게 유지한다");
    expect(loaded[0].strength).toBe("strong");
    expect(loaded[0].evidence).toBe(1);
  });

  it("같은 문장을 다시 관측하면 행을 늘리지 않고 근거를 올린다", () => {
    upsertPreferenceFact({ text: "마을은 작게 유지한다", scope: "global", strength: "weak" });
    upsertPreferenceFact({ text: "마을은,  작게 유지한다.", scope: "global", strength: "weak" });
    const loaded = loadPreferenceFacts();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].evidence).toBe(2);
  });

  it("근거가 쌓여도 강도는 약한 쪽으로 내려가지 않는다", () => {
    upsertPreferenceFact({ text: "어두운 톤을 선호한다", scope: "global", strength: "strong" });
    upsertPreferenceFact({ text: "어두운 톤을 선호한다", scope: "global", strength: "weak" });
    expect(loadPreferenceFacts()[0].strength).toBe("strong");
  });

  it("직접 입력(manual) 근거는 이후 관측이 덮어쓰지 않는다", () => {
    upsertPreferenceFact({ text: "집은 4채 이하", scope: "global", source: "manual", pinned: true });
    upsertPreferenceFact({ text: "집은 4채 이하", scope: "global", source: "observed" });
    const loaded = loadPreferenceFacts();
    expect(loaded[0].source).toBe("manual");
    expect(loaded[0].pinned).toBe(true);
  });

  it("프로젝트 스코프는 조회 키 없이는 저장되지 않는다", () => {
    expect(upsertPreferenceFact({ text: "이 게임은 호러다", scope: "project" })).toBe(false);
    expect(loadPreferenceFacts()).toHaveLength(0);
  });

  it("문장은 상한 길이로 잘린다", () => {
    upsertPreferenceFact({ text: "가".repeat(PREFERENCE_TEXT_MAX_CHARS + 40), scope: "global" });
    expect(loadPreferenceFacts()[0].text).toHaveLength(PREFERENCE_TEXT_MAX_CHARS);
  });

  it("깨진 저장값은 조용히 빈 목록으로 떨어진다", () => {
    localStorage.setItem(PREFERENCE_MEMORY_STORAGE_KEY, "{not json");
    expect(loadPreferenceFacts()).toEqual([]);
  });

  it("localStorage 가 없으면 로드는 빈 목록, 저장은 no-op", () => {
    Reflect.deleteProperty(globalThis, "localStorage");
    expect(loadPreferenceFacts()).toEqual([]);
    expect(() => savePreferenceFacts([fact({ id: "a", text: "x" })])).not.toThrow();
    expect(upsertPreferenceFact({ text: "y", scope: "global" })).toBe(false);
  });
});

describe("상한 축출", () => {
  it("전역 상한을 넘으면 최약체부터 버린다", () => {
    const facts = Array.from({ length: GLOBAL_PREFERENCE_LIMIT + 3 }, (_, index) =>
      fact({ id: `g${index}`, text: `성향 ${index}`, strength: index < 4 ? "strong" : "weak", evidence: index }),
    );
    const kept = evictOverLimit(facts);
    expect(kept).toHaveLength(GLOBAL_PREFERENCE_LIMIT);
    // strong 4건은 전부 살아 있어야 한다.
    expect(kept.filter((entry) => entry.strength === "strong")).toHaveLength(4);
  });

  it("프로젝트 상한은 프로젝트별로 따로 센다", () => {
    const make = (key: string, count: number): PreferenceFact[] =>
      Array.from({ length: count }, (_, index) =>
        fact({ id: `${key}-${index}`, text: `${key} ${index}`, scope: "project", projectScopeKey: key }),
      );
    const kept = evictOverLimit([
      ...make("local:A::m1", PROJECT_PREFERENCE_LIMIT + 4),
      ...make("local:B::m1", 2),
    ]);
    expect(kept.filter((entry) => entry.projectScopeKey === "local:A::m1")).toHaveLength(PROJECT_PREFERENCE_LIMIT);
    expect(kept.filter((entry) => entry.projectScopeKey === "local:B::m1")).toHaveLength(2);
  });

  it("고정된 항목은 상한 계산에서 면제된다", () => {
    const pinned = Array.from({ length: GLOBAL_PREFERENCE_LIMIT + 5 }, (_, index) =>
      fact({ id: `p${index}`, text: `고정 ${index}`, pinned: true, strength: "weak" }),
    );
    expect(evictOverLimit(pinned)).toHaveLength(GLOBAL_PREFERENCE_LIMIT + 5);
  });

  it("상한에 밀려 즉시 축출되는 신규는 저장됐다고 보고하지 않는다", () => {
    const full = Array.from({ length: GLOBAL_PREFERENCE_LIMIT }, (_, index) =>
      fact({ id: `s${index}`, text: `강한 성향 ${index}`, strength: "strong", evidence: 9 }),
    );
    const result = upsertPreferenceFactIn(full, { text: "약한 신규", scope: "global", strength: "weak" });
    expect(result.changed).toBe(false);
    expect(result.fact).toBeNull();
    expect(result.facts).toHaveLength(GLOBAL_PREFERENCE_LIMIT);
  });
});

describe("삭제와 고정", () => {
  it("증류 drop 은 고정된 항목을 지우지 못한다", () => {
    savePreferenceFacts([
      fact({ id: "keep", text: "고정된 성향", pinned: true }),
      fact({ id: "gone", text: "보통 성향" }),
    ]);
    expect(dropPreferenceFactsUnpinned(["keep", "gone"])).toBe(1);
    expect(loadPreferenceFacts().map((entry) => entry.id)).toEqual(["keep"]);
  });

  it("사용자 삭제는 고정된 항목도 지운다", () => {
    savePreferenceFacts([fact({ id: "keep", text: "고정된 성향", pinned: true })]);
    deletePreferenceFact("keep");
    expect(loadPreferenceFacts()).toHaveLength(0);
  });

  it("고정 토글이 저장된다", () => {
    savePreferenceFacts([fact({ id: "a", text: "성향 A" })]);
    setPreferenceFactPinned("a", true);
    expect(loadPreferenceFacts()[0].pinned).toBe(true);
    setPreferenceFactPinned("a", false);
    expect(loadPreferenceFacts()[0].pinned).toBe(false);
  });

  it("전체 비우기는 저장 키를 없앤다", () => {
    savePreferenceFacts([fact({ id: "a", text: "성향 A" })]);
    clearPreferenceFacts();
    expect(localStorage.getItem(PREFERENCE_MEMORY_STORAGE_KEY)).toBeNull();
    expect(loadPreferenceFacts()).toEqual([]);
  });
});

describe("프롬프트 블록", () => {
  it("우선순위 문장이 반드시 들어간다", () => {
    const section = buildPreferenceMemorySectionFrom([fact({ id: "a", text: "마을은 작게" })]);
    expect(section).toContain(PREFERENCE_SECTION_HEADING);
    expect(section).toContain(PREFERENCE_PRECEDENCE_LINE);
    expect(section).toContain("- [보통] 마을은 작게");
  });

  it("성향이 없으면 빈 문자열이다", () => {
    expect(buildPreferenceMemorySectionFrom([])).toBe("");
  });

  it("조회 키가 맞는 프로젝트 성향만 소제목과 함께 붙는다", () => {
    const facts = [
      fact({ id: "g", text: "전역 성향" }),
      fact({ id: "p", text: "이 게임은 호러다", scope: "project", projectScopeKey: "local:A::m1" }),
      fact({ id: "q", text: "남의 프로젝트", scope: "project", projectScopeKey: "local:B::m1" }),
    ];
    const section = buildPreferenceMemorySectionFrom(facts, "local:A::m1");
    expect(section).toContain(PREFERENCE_PROJECT_SUBHEADING);
    expect(section).toContain("이 게임은 호러다");
    expect(section).not.toContain("남의 프로젝트");
  });

  it("조회 키가 없으면 프로젝트 성향과 소제목이 모두 빠진다", () => {
    const section = buildPreferenceMemorySectionFrom(
      [fact({ id: "p", text: "이 게임은 호러다", scope: "project", projectScopeKey: "local:A::m1" })],
    );
    expect(section).toBe("");
  });

  it("강한 것부터 나열한다", () => {
    const section = buildPreferenceMemorySectionFrom([
      fact({ id: "w", text: "약한 성향", strength: "weak" }),
      fact({ id: "s", text: "강한 성향", strength: "strong" }),
    ]);
    expect(section.indexOf("강한 성향")).toBeLessThan(section.indexOf("약한 성향"));
  });

  it("줄 수 하드캡을 넘기지 않고 생략 건수를 밝힌다", () => {
    const facts = Array.from({ length: PREFERENCE_SECTION_MAX_LINES + 5 }, (_, index) =>
      fact({ id: `g${index}`, text: `성향 ${index}`, pinned: true }),
    );
    const section = buildPreferenceMemorySectionFrom(facts);
    const bullets = section.split("\n").filter((line) => line.startsWith("- ["));
    expect(bullets).toHaveLength(PREFERENCE_SECTION_MAX_LINES);
    expect(section).toContain("5건은 지면상 생략");
  });

  it("문자 수 하드캡을 넘기지 않는다", () => {
    const facts = Array.from({ length: PREFERENCE_SECTION_MAX_LINES }, (_, index) =>
      fact({ id: `g${index}`, text: `${index}`.padEnd(PREFERENCE_TEXT_MAX_CHARS, "가"), pinned: true }),
    );
    const section = buildPreferenceMemorySectionFrom(facts);
    // 생략 안내 한 줄은 캡 판정 뒤에 붙으므로 넉넉히 잡는다.
    expect(section.length).toBeLessThanOrEqual(PREFERENCE_SECTION_MAX_CHARS + 40);
  });

  it("localStorage 경유 블록도 같은 계약을 지킨다", () => {
    upsertPreferenceFact({ text: "밝은 톤을 선호한다", scope: "global", strength: "strong" });
    const section = buildPreferenceMemorySection();
    expect(section).toContain(PREFERENCE_PRECEDENCE_LINE);
    expect(section).toContain("밝은 톤을 선호한다");
  });
});

describe("보조 계산", () => {
  it("정규화가 공백·문장부호·대소문자를 접는다", () => {
    expect(normalizePreferenceText("  Village  SMALL,  please. ")).toBe("village small please");
  });

  it("랭크 비교는 강도 → 근거 → 최신 순", () => {
    const strong = fact({ id: "a", text: "a", strength: "strong", evidence: 1, updatedAt: 1 });
    const weakMany = fact({ id: "b", text: "b", strength: "weak", evidence: 9, updatedAt: 9 });
    expect(comparePreferenceRank(strong, weakMany)).toBeLessThan(0);

    const older = fact({ id: "c", text: "c", evidence: 2, updatedAt: 1 });
    const newer = fact({ id: "d", text: "d", evidence: 2, updatedAt: 5 });
    expect(comparePreferenceRank(newer, older)).toBeLessThan(0);
  });

  it("설정 화면 목록은 전역/프로젝트를 나눠 준다", () => {
    savePreferenceFacts([
      fact({ id: "g", text: "전역" }),
      fact({ id: "p", text: "프로젝트", scope: "project", projectScopeKey: "local:A::m1" }),
    ]);
    const listed = listPreferenceFacts("local:A::m1");
    expect(listed.global.map((entry) => entry.id)).toEqual(["g"]);
    expect(listed.project.map((entry) => entry.id)).toEqual(["p"]);
    expect(listPreferenceFacts().project).toEqual([]);
  });
});
