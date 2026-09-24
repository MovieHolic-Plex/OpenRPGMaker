/** @vitest-environment happy-dom */
/**
 * 타격 세기 계약(2026-09-03): 피해량/최대 HP 비율 → graze·normal·heavy·crushing, 급소는 최소 heavy,
 * 막타는 crushing. 세기는 대상 노드(넉백·찌그러짐)와 씬 루트(펀치·흔들림) 변수로 옮겨진다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HIT_INTENSITY_STYLE,
  hitIntensity,
  hitIntensityStageVariables,
  hitIntensityTargetVariables,
} from "@/player/battleHitIntensity";
import { applyHitIntensity, battlerMaxHp } from "@/player/battleHitIntensityDom";
import { flashBattleField } from "@/player/battleJuice";
import { ENEMY_WINDUP_MS, planEnemyActionBeats } from "@/player/battleActionBeats";
import { HIT_BLINK_STEP_MS, applyActionMotion, blinkBattlerNode, spawnDeathShards, spawnHitSparks } from "@/player/battleFieldDom";

const damage = (amount: number, extra: Partial<{ critical: boolean; miss: boolean; healing: boolean; blocked: boolean }> = {}) => ({
  amount,
  critical: extra.critical ?? false,
  miss: extra.miss ?? false,
  healing: extra.healing ?? false,
  blocked: extra.blocked ?? false,
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("hitIntensity", () => {
  it("비율 경계: 8% 미만 graze · 30% 미만 normal · 60% 미만 heavy · 그 이상 crushing", () => {
    expect(hitIntensity(damage(5), 100)).toBe("graze");
    expect(hitIntensity(damage(8), 100)).toBe("normal");
    expect(hitIntensity(damage(29), 100)).toBe("normal");
    expect(hitIntensity(damage(30), 100)).toBe("heavy");
    expect(hitIntensity(damage(60), 100)).toBe("crushing");
  });

  it("급소는 최소 heavy, 막타는 비율과 무관하게 crushing", () => {
    expect(hitIntensity(damage(3, { critical: true }), 100)).toBe("heavy");
    expect(hitIntensity(damage(3), 100, true)).toBe("crushing");
  });

  it("빗나감·회복·막힘·0 피해는 세기가 없다", () => {
    expect(hitIntensity(damage(0), 100)).toBeUndefined();
    expect(hitIntensity(damage(40, { miss: true }), 100)).toBeUndefined();
    expect(hitIntensity(damage(40, { healing: true }), 100)).toBeUndefined();
    expect(hitIntensity(damage(40, { blocked: true }), 100)).toBeUndefined();
  });

  it("세기가 오를수록 넉백·찌그러짐·펀치·흔들림이 단조 증가한다", () => {
    const order = ["graze", "normal", "heavy", "crushing"] as const;
    for (let i = 1; i < order.length; i += 1) {
      const prev = HIT_INTENSITY_STYLE[order[i - 1]!];
      const next = HIT_INTENSITY_STYLE[order[i]!];
      expect(next.knockbackPx).toBeGreaterThan(prev.knockbackPx);
      expect(next.squash).toBeGreaterThan(prev.squash);
      expect(next.punchScale).toBeGreaterThanOrEqual(prev.punchScale);
      expect(next.shakePx).toBeGreaterThanOrEqual(prev.shakePx);
    }
    // 2026-09-25: 명중하면 잽도 흔든다(바닥값). 정보는 진폭의 차이가 든다 — 잽 2px 과 막타 11px.
    expect(HIT_INTENSITY_STYLE.graze.shakePx).toBeGreaterThan(0);
    expect(HIT_INTENSITY_STYLE.crushing.shakePx).toBeGreaterThanOrEqual(HIT_INTENSITY_STYLE.graze.shakePx * 5);
  });

  it("CSS 변수 매핑", () => {
    expect(hitIntensityTargetVariables("heavy")).toEqual({ "--hit-knockback": "40px", "--hit-squash": "0.1" });
    expect(hitIntensityStageVariables("crushing")["--hit-punch"]).toBe("1.05");
    expect(hitIntensityStageVariables("crushing")["--battle-shake-x"]).toBe("11px");
  });
});

describe("applyHitIntensity / flashBattleField", () => {
  it("대상 노드와 루트에 세기를 심고, 없으면 걷는다", () => {
    const root = document.createElement("section");
    const target = document.createElement("div");
    root.append(target);
    document.body.append(root);

    applyHitIntensity(root, target, "heavy");
    expect(target.dataset.hitIntensity).toBe("heavy");
    expect(target.style.getPropertyValue("--hit-knockback")).toBe("40px");
    expect(root.dataset.hitIntensity).toBe("heavy");
    expect(root.style.getPropertyValue("--hit-punch")).toBe("1.03");

    applyHitIntensity(root, target, undefined);
    expect(target.dataset.hitIntensity).toBeUndefined();
    expect(target.style.getPropertyValue("--hit-knockback")).toBe("");
    expect(root.dataset.hitIntensity).toBeUndefined();
  });

  it("heavy 타격은 급소가 아니어도 무대를 흔들고 자기 진폭 변수를 심는다", async () => {
    const root = document.createElement("section");
    document.body.append(root);
    flashBattleField(root, "hit", "heavy");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    expect(root.classList.contains("battle-hit-shake")).toBe(true);
    expect(root.style.getPropertyValue("--battle-hit-shake-x")).toBe("7px");
  });

  it("normal 타격도 짧고 작게 흔든다(3px · 60ms × 2)", async () => {
    const root = document.createElement("section");
    document.body.append(root);
    flashBattleField(root, "hit", "normal");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    expect(root.classList.contains("battle-hit-shake")).toBe(true);
    expect(root.classList.contains("battle-flash-hit")).toBe(true);
    expect(root.style.getPropertyValue("--battle-hit-shake-x")).toBe("3px");
    expect(root.style.getPropertyValue("--battle-hit-shake-period")).toBe("60ms");
    // 스킬 애니메이션 층의 클래스·변수와 섞이지 않는다.
    expect(root.classList.contains("battle-screen-shake")).toBe(false);
  });

  it("세기가 없는 타격(회복·빗나감 폴백)은 흔들지 않는다", async () => {
    const root = document.createElement("section");
    document.body.append(root);
    flashBattleField(root, "hit");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    expect(root.classList.contains("battle-hit-shake")).toBe(false);
  });

  it("아군이 맞으면 hurt 클래스가 함께 붙는다", async () => {
    const root = document.createElement("section");
    document.body.append(root);
    flashBattleField(root, "hit", "normal", { hurt: true });
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    expect(root.classList.contains("battle-flash-hurt")).toBe(true);
    flashBattleField(root, "victory");
    expect(root.classList.contains("battle-flash-hurt")).toBe(false);
  });

  it("펀치 축은 맞은 노드 좌표를 따른다", () => {
    const root = document.createElement("section");
    const target = document.createElement("div");
    target.style.setProperty("--battle-node-x", "25%");
    target.style.setProperty("--battle-node-y", "70%");
    root.append(target);
    document.body.append(root);
    applyHitIntensity(root, target, "normal");
    expect(root.style.getPropertyValue("--hit-origin-x")).toBe("25%");
    expect(root.style.getPropertyValue("--hit-origin-y")).toBe("70%");
  });

  it("battlerMaxHp 는 적 id·아군 recordId 어느 쪽으로도 찾고 없으면 1", () => {
    const snapshot = {
      enemies: [{ id: "enemy_1", recordId: "enemy_slime", maxHp: 24 }],
      actors: [{ id: "actor_1", recordId: "actor_hero", maxHp: 120 }],
    } as never;
    expect(battlerMaxHp(snapshot, "enemy_1")).toBe(24);
    expect(battlerMaxHp(snapshot, "actor_hero")).toBe(120);
    expect(battlerMaxHp(snapshot, "nobody")).toBe(1);
  });
});

describe("적 행동 비트 — 예고(windup)", () => {
  const feedback = { targetId: "actor_1", amount: 12, critical: false, miss: false, healing: false, blocked: false } as never;

  it("windup → impact(lunge+knockback) → recover 세 비트, 예고는 300ms 기준", () => {
    const beats = planEnemyActionBeats({ userId: "enemy_1", feedback, hitStopMs: 110, impactMs: 430 });
    expect(beats.map((b) => b.kind)).toEqual(["approach", "impact", "recover"]);
    expect(beats[0]!.userMotion).toBe("windup");
    expect(beats[0]!.durationMs).toBe(ENEMY_WINDUP_MS);
    expect(beats[1]!.userMotion).toBe("lunge");
    expect(beats[1]!.targetMotion).toBe("knockback");
  });

  it("weight 가 예고 길이를 늘리고(heavy) 줄인다(light)", () => {
    const heavy = planEnemyActionBeats({ userId: "e", feedback, hitStopMs: 110, impactMs: 430, weight: "heavy" });
    const light = planEnemyActionBeats({ userId: "e", feedback, hitStopMs: 110, impactMs: 430, weight: "light" });
    expect(heavy[0]!.durationMs).toBeGreaterThan(ENEMY_WINDUP_MS);
    expect(light[0]!.durationMs).toBeLessThan(ENEMY_WINDUP_MS);
  });

  it("windupMs 0 이면 옛 2비트 케이던스로 돌아간다", () => {
    const beats = planEnemyActionBeats({ userId: "e", feedback, hitStopMs: 110, impactMs: 430, windupMs: 0 });
    expect(beats.map((b) => b.kind)).toEqual(["impact", "recover"]);
  });
});

describe("격파 조각", () => {
  it("노드에 12조각을 결정적으로 뿌리고 컨테이너 하나만 둔다", () => {
    const node = document.createElement("div");
    node.className = "battle-enemy";
    const image = document.createElement("img");
    image.className = "battle-enemy-image";
    node.append(image);
    document.body.append(node);
    spawnDeathShards(node);
    spawnDeathShards(node);
    const containers = node.querySelectorAll(".battle-death-shards");
    expect(containers.length).toBe(1);
    const shards = node.querySelectorAll<HTMLElement>(".battle-death-shard");
    expect(shards.length).toBe(12);
    const first = shards[0]!;
    expect(first.style.getPropertyValue("--sx")).toMatch(/px$/);
    expect(first.style.getPropertyValue("--sd")).toBe("0ms");
    // 같은 인덱스는 같은 값 — 스크린샷 비교가 성립한다.
    spawnDeathShards(node);
    expect(node.querySelectorAll<HTMLElement>(".battle-death-shard")[3]!.style.getPropertyValue("--sx")).toBe(shards[3]!.style.getPropertyValue("--sx"));
  });
});

describe("명중 파편 · 피격 점멸 · 공격자 표시 (2026-09-25)", () => {
  it("파편 수는 세기를 따르고 컨테이너는 하나다", () => {
    const node = document.createElement("div");
    node.className = "battle-enemy";
    document.body.append(node);
    spawnHitSparks(node, "graze");
    expect(node.querySelectorAll(".battle-hit-spark").length).toBe(5);
    spawnHitSparks(node, "crushing");
    expect(node.querySelectorAll(".battle-hit-sparks").length).toBe(1);
    expect(node.querySelectorAll(".battle-hit-spark").length).toBe(12);
  });

  it("점멸은 세 번 꺼졌다 켜지고 켜진 채로 끝난다", () => {
    vi.useFakeTimers();
    try {
      const node = document.createElement("div");
      document.body.append(node);
      blinkBattlerNode(node);
      const seen: boolean[] = [];
      for (let step = 0; step <= 6; step += 1) {
        vi.advanceTimersByTime(step === 0 ? 0 : HIT_BLINK_STEP_MS);
        seen.push(node.classList.contains("battle-hit-blink-off"));
      }
      expect(seen).toEqual([true, false, true, false, true, false, false]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("approach 비트는 전진 노드에 비트 길이를 심고, 그려지지 않은 아군은 파티 행을 띄운다", () => {
    const scene = document.createElement("section");
    const field = document.createElement("div");
    const enemy = document.createElement("div");
    enemy.className = "battle-enemy";
    enemy.dataset.testid = "enemy_1";
    field.append(enemy);
    const party = document.createElement("div");
    party.className = "battle-party";
    const row = document.createElement("div");
    row.className = "battle-actor-status";
    row.dataset.recordId = "actor_hero";
    party.append(row);
    scene.append(field, party);
    document.body.append(scene);

    applyActionMotion(field, { kind: "approach", directorStep: "acting", durationMs: 470, userId: "enemy_1", userMotion: "lunge", targetMotion: "idle", hitStop: false });
    expect(enemy.dataset.motionPhase).toBe("approach");
    expect(enemy.style.getPropertyValue("--motion-beat-ms")).toBe("470ms");

    applyActionMotion(field, { kind: "approach", directorStep: "acting", durationMs: 470, userId: "actor_hero", targetId: "enemy_1", userMotion: "lunge", targetMotion: "idle", hitStop: false });
    expect(row.classList.contains("is-acting")).toBe(true);
    applyActionMotion(field, undefined);
    expect(row.classList.contains("is-acting")).toBe(false);
  });
});
