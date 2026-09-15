// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
  databaseRecordArtUrl,
  describeDatabaseChanges,
  formatDatabaseFieldValue,
  renderDatabaseChangeCards,
} from "@/editor/panels/databaseAiChangeCards";
import { diffDatabaseRecords } from "@/project/databaseRecordDiff";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const BASE = createBlankProject();

function project(records: Record<string, unknown[]>): Project {
  const next = structuredClone(BASE) as Mutable<Project>;
  const database = next.database as unknown as Record<string, unknown[]>;
  for (const [collection, list] of Object.entries(records)) {
    database[collection] = [...(database[collection] ?? []), ...list];
  }
  return next;
}

const imp = (patch: Record<string, unknown> = {}) => ({
  id: "enemy_imp", name: "임프", graphicHue: 0, transparent: false, flying: false,
  monsterResourceId: "generated-enemy-slime-01",
  stats: { maxHp: 64, maxMp: 0, attack: 12, defense: 8, mind: 4, agility: 9 },
  rewards: { exp: 5, gold: 3, dropRatePercent: 0 },
  skillIds: [], actions: [], stateRates: {}, elementRates: {},
  ...patch,
});

describe("renderDatabaseChangeCards — 레코드 카드", () => {
  it("변경 카드는 그림·이름·id·동사·필드 before→after·델타·이동 단추를 그린다", () => {
    const before = project({ enemies: [imp()] });
    const after = project({
      enemies: [imp({ stats: { maxHp: 300, maxMp: 0, attack: 28, defense: 8, mind: 4, agility: 9 }, rewards: { exp: 40, gold: 3, dropRatePercent: 5, dropItemId: "item_sword" } })],
      items: [{ id: "item_sword", name: "동검", price: 120 }],
    });
    const onNavigate = vi.fn();
    const list = renderDatabaseChangeCards(diffDatabaseRecords(before, after), { before, after, onNavigate });
    document.body.append(list);

    const cards = list.querySelectorAll("[data-testid='database-ai-card']");
    expect(cards).toHaveLength(2);
    const impCard = list.querySelector<HTMLElement>("[data-record-id='enemy_imp']")!;
    expect(impCard.dataset.change).toBe("changed");
    expect(impCard.dataset.collection).toBe("enemies");
    expect(impCard.querySelector(".database-ai-card-name")?.textContent).toBe("임프");
    expect(impCard.querySelector(".database-ai-card-id")?.textContent).toBe("#enemy_imp");
    expect(impCard.querySelector(".database-ai-card-verb")?.textContent).toBe("변경");
    expect(impCard.querySelector(".database-ai-card-thumb img")).not.toBeNull();

    const hp = impCard.querySelector<HTMLElement>("[data-path='stats.maxHp']")!;
    expect(hp.querySelector(".database-ai-card-key")?.textContent).toBe("최대 HP");
    expect(hp.querySelector(".database-ai-card-before")?.textContent).toBe("64");
    expect(hp.querySelector(".database-ai-card-after")?.textContent).toBe("300");
    expect(hp.querySelector("[data-testid='database-ai-card-delta']")?.textContent).toBe("+236");
    expect(hp.querySelector(".database-ai-card-delta")?.classList.contains("is-up")).toBe(true);

    const drop = impCard.querySelector<HTMLElement>("[data-path='rewards.dropItemId']")!;
    expect(drop.querySelector(".database-ai-card-before")?.textContent).toBe("없음");
    expect(drop.querySelector(".database-ai-card-after")?.textContent).toBe("동검");
    expect(drop.querySelector("[data-testid='database-ai-card-delta']")).toBeNull();

    impCard.querySelector<HTMLButtonElement>("[data-testid='database-ai-card-goto']")!.click();
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ collection: "enemies", id: "enemy_imp" }));

    const swordCard = list.querySelector<HTMLElement>("[data-record-id='item_sword']")!;
    expect(swordCard.dataset.change).toBe("added");
    expect(swordCard.querySelector(".database-ai-card-verb")?.textContent).toBe("추가");
    // 아직 없는 레코드로는 이동할 수 없다 — 선택이 첫 레코드로 미끄러졌던 자리.
    expect(swordCard.querySelector("[data-testid='database-ai-card-goto']")).toBeNull();
    expect(swordCard.querySelector(".database-ai-card-before")).toBeNull();
    expect(swordCard.querySelector("[data-path='price'] .database-ai-card-after")?.textContent).toBe("120");
  });

  it("그림 필드가 바뀌면 지금/적용 후 두 장을 그린다", () => {
    const before = project({ enemies: [imp()] });
    const after = project({ enemies: [imp({ monsterResourceId: "generated-enemy-bat-01" })] });
    const list = renderDatabaseChangeCards(diffDatabaseRecords(before, after), { before, after });
    const pair = list.querySelector<HTMLElement>("[data-testid='database-ai-card-gfx']")!;
    expect(pair.dataset.path).toBe("monsterResourceId");
    const cells = pair.querySelectorAll(".database-ai-card-gfx-cell");
    expect(cells).toHaveLength(2);
    expect(cells[1]?.classList.contains("is-after")).toBe(true);
    expect(pair.textContent).toContain("지금");
    expect(pair.textContent).toContain("적용 후");
    expect(list.querySelector("[data-path='monsterResourceId'].database-ai-card-field")).toBeNull();
    expect(list.querySelector("[data-testid='database-ai-card-goto']")).toBeNull();
  });

  it("삭제 카드는 그림 없이 슬림하게 신원과 안내만 남긴다", () => {
    const before = project({ skills: [{ id: "skill_fog", name: "독 안개", mpCost: 6 }] });
    const after = project({});
    const list = renderDatabaseChangeCards(diffDatabaseRecords(before, after), { before, after });
    const card = list.querySelector<HTMLElement>("[data-testid='database-ai-card']")!;
    expect(card.classList.contains("is-slim")).toBe(true);
    expect(card.querySelector(".database-ai-card-thumb")).toBeNull();
    expect(card.querySelector(".database-ai-card-verb")?.textContent).toBe("삭제");
    expect(card.querySelector(".database-ai-card-note")?.textContent).toContain("삭제");
  });

  it("그림이 없는 레코드는 이름 첫 글자 배지를 쓴다", () => {
    const before = project({ skills: [{ id: "skill_a", name: "가시 찌르기", mpCost: 4 }] });
    const after = project({ skills: [{ id: "skill_a", name: "가시 찌르기", mpCost: 6 }] });
    const list = renderDatabaseChangeCards(diffDatabaseRecords(before, after), { before, after });
    expect(list.querySelector(".database-ai-card-thumb .database-ai-card-initial")?.textContent).toBe("가");
    expect(databaseRecordArtUrl(after, "skills", { id: "skill_a" })).toBeNull();
  });

  it("값 표기와 상태줄 요약", () => {
    const after = project({ items: [{ id: "item_sword", name: "동검", price: 120 }] });
    expect(formatDatabaseFieldValue(after, undefined)).toBe("없음");
    expect(formatDatabaseFieldValue(after, true)).toBe("켜짐");
    expect(formatDatabaseFieldValue(after, "item_sword")).toBe("동검");
    expect(formatDatabaseFieldValue(after, 42)).toBe("42");
    const changes = diffDatabaseRecords(project({ enemies: [imp()], skills: [{ id: "s", name: "s" }] }), project({ enemies: [imp({ level: 3 })], items: [{ id: "i", name: "i" }] }));
    expect(changes.map((change) => change.id).sort()).toEqual(["enemy_imp", "i", "s"]);
    expect(describeDatabaseChanges(changes)).toBe("바꾼 레코드 1 · 추가 1 · 삭제 1");
    expect(describeDatabaseChanges([])).toBe("바뀐 레코드 없음");
  });
});
