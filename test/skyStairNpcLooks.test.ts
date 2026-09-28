// 《천공의 계단》 NPC 그래픽이 **역할과 맞는지** 데이터로 지킨다.
//
// 왜 필요한가: 이 파일이 생기기 전에는 skyStairMaps.ts 가 `charset(PEOPLE_3, 0)` 처럼
// 생 숫자를 썼고, 그 숫자가 무슨 그림인지는 어디에도 적혀 있지 않았다. 그래서
// 카탈로그(charsetSemantics)의 라벨이 정정될 때마다 그림이 **조용히** 어긋났다.
// 2026-07-27 전수 조사에서 실제로 나온 어긋남:
//   · 길 잃은 아이 ← people3#0 "왕"      · 농부의 아내 ← people1#4 "중년 남성 주민(흑인)"
//   · 부두 상인   ← people2#1 "수녀"      · 늙은 광부   ← people2#5 "토끼 귀 여성"
//   · 호수 신전 봉인 3개가 전부 monster2#2 한 칸을 공유(그 칸은 라벨조차 없었다)
// 타입 검사도 projectLint 도 이런 종류를 못 잡는다 — 라벨을 아는 이 테스트만 잡는다.
import { describe, expect, it } from "vitest";
import { findCharsetSemantic } from "@/assets/charsetSemantics";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { LEGACY_FACESET_SHEET_IDS } from "@/assets/facesetFaceAssets";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { skyStairMaps } from "@/editor/content/skyStairMaps";
import type { GameEvent } from "@/project/types";

type Cell = { readonly textureKey: string; readonly characterIndex: number };

function cellOf(graphic: unknown): Cell | null {
  const g = graphic as { transparent?: boolean; sprite?: { type?: string; id?: string }; pattern?: number } | undefined;
  if (!g || g.transparent) return null;
  const textureKey = g.sprite?.id;
  if (!textureKey || typeof g.pattern !== "number") return null;
  for (let i = 0; i < 8; i += 1) {
    if (charsetFrameIndex({ characterIndex: i, direction: "down", pattern: 1 }) === g.pattern) {
      return { textureKey, characterIndex: i };
    }
  }
  return null;
}

/** fork 의 then/else 안에 들어간 커맨드까지 펼친다 — 아이의 대사는 전투 승리 분기 안에 있다. */
function flatCommands(commands: readonly unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const raw of commands) {
    const c = raw as Record<string, unknown>;
    out.push(c);
    for (const key of ["then", "otherwise", "else"]) {
      const branch = c[key];
      if (Array.isArray(branch)) out.push(...flatCommands(branch));
    }
  }
  return out;
}

/** GameEvent.pages 는 스키마상 optional 이다 — 없으면 빈 배열로 다룬다. */
function pagesOf(ev: GameEvent): readonly NonNullable<GameEvent["pages"]>[number][] {
  return ev.pages ?? [];
}

function allEvents(): GameEvent[] {
  return skyStairMaps().flatMap((map) => map.events);
}

/** 그래픽이 모든 페이지에서 투명한 이벤트 — 화면에 아무것도 그리지 않는다. */
function fullyTransparentEventIds(): string[] {
  return allEvents()
    .filter((ev) => pagesOf(ev).every((pg) => (pg.graphic as { transparent?: boolean } | undefined)?.transparent))
    .map((ev) => ev.id);
}

describe("천공의 계단 NPC 그래픽", () => {
  it("보이는 그래픽은 모두 카탈로그에 라벨이 있는 칸이다", () => {
    const unlabeled: string[] = [];
    for (const map of skyStairMaps()) {
      for (const ev of map.events) {
        for (const pg of pagesOf(ev)) {
          const cell = cellOf(pg.graphic);
          if (!cell) continue;
          if (!findCharsetSemantic(cell.textureKey, cell.characterIndex)) {
            unlabeled.push(`${ev.id}/${pg.id} → ${cell.textureKey}#${cell.characterIndex}`);
          }
        }
      }
    }
    // 라벨 없는 칸은 "무슨 그림인지 아무도 확인하지 않은 칸"이다 — 저작에 쓰면 안 된다.
    expect(unlabeled, `라벨 없는 칸을 쓰고 있다:\n${unlabeled.join("\n")}`).toEqual([]);
  });

  it("호수 신전 세 봉인의 수호자가 서로 다른 그림이다", () => {
    const events = allEvents().filter((ev) => /^ev_sky_s_seal[123]$/.test(ev.id));
    expect(events).toHaveLength(3);
    const guardians = events.map((ev) => {
      // 전투 페이지(= battleProcessing 을 가진 페이지)의 그래픽이 수호자다.
      const page = pagesOf(ev).find((pg) => flatCommands(pg.commands).some((c) => c.kind === "battleProcessing"));
      const cell = page ? cellOf(page.graphic) : null;
      return cell ? `${cell.textureKey}#${cell.characterIndex}` : "(none)";
    });
    expect(new Set(guardians).size, `봉인 수호자가 겹친다: ${guardians.join(", ")}`).toBe(3);
    expect(guardians).not.toContain("(none)");
  });

  it("사람 NPC 의 대화 얼굴은 공용 대응표의 짝이고, 대응표가 얼굴 없음이면 얼굴이 없다", () => {
    // 정답지는 AI 도구와 같은 공용 대응표(sharedCharacterGraphics.json)다. 예전엔 짝 없는 시트를 성별·나이로
    // FaceSet/People1 에서 골랐고, 그 추정이 기름 장수·선원·여관 주인 등 10명에게 다른 인물을 붙였다(2026-09-28).
    let facedPages = 0;
    const problems: string[] = [];
    for (const ev of allEvents()) {
      for (const pg of pagesOf(ev)) {
        const cell = cellOf(pg.graphic);
        const cmds = flatCommands(pg.commands);
        const faces = cmds.filter((c) => c.kind === "changeFace");
        const look = cell ? `${cell.textureKey}#${cell.characterIndex}` : "투명";
        const expected = cell ? reviewedFaceIdForCharset(cell.textureKey, cell.characterIndex) : undefined;
        if (!expected) {
          if (faces.length > 0) problems.push(`${ev.id}/${pg.id}: ${look} 은 얼굴 없음인데 얼굴이 붙었다`);
          continue;
        }
        // 화자가 있는 대사만 본다. 몬스터 수호자는 나레이션(화자 없음)만 있어 얼굴이 없는 게 맞다.
        if (!cmds.some((c) => c.kind === "text" && typeof c.speaker === "string")) continue;
        const isPerson = cell!.textureKey.includes("people") || cell!.textureKey.includes("actor");
        // 보스(파수꾼·계단의 주인)는 얼굴 없이 말하는 연출이다 — 붙인다면 짝이어야 할 뿐 강제하지 않는다.
        if (faces.length === 0 && !isPerson) continue;
        if (faces.length === 0) {
          problems.push(`${ev.id}/${pg.id}: 짝 얼굴 ${expected} 가 있는데 changeFace 가 없다`);
          continue;
        }
        facedPages += 1;
        const face = faces[0] as { resourceId: string };
        if (face.resourceId !== expected) problems.push(`${ev.id}/${pg.id}: ${look} 의 짝은 ${expected} 인데 ${face.resourceId} 가 붙었다`);
        // 얼굴은 낱장 리소스 id 다 — 시트 id 를 그대로 쓰면 칸이 정해지지 않는다.
        expect(LEGACY_FACESET_SHEET_IDS).not.toContain(face.resourceId);
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
    expect(facedPages).toBeGreaterThan(20);
  });

  it("투명한 이벤트는 이동문·자동 트리거·등대뿐이다", () => {
    const ids = fullyTransparentEventIds().sort();
    const allowed = ids.filter((id) => /_gate(_[a-z0-9]+)?$/.test(id)
      || id === "ev_sky_m_fog" || id === "ev_sky_mine_enter"
      || id === "ev_sky_sn_snow" || id === "ev_sky_al_clear"
      || id === "ev_sky_h_lighthouse");
    // 여기 없는 이벤트가 투명하면 "화면에 없는 이벤트"다 — 플레이어가 찾을 수 없다.
    expect(ids, `근거 없는 투명 이벤트: ${ids.filter((i) => !allowed.includes(i)).join(", ")}`)
      .toEqual(allowed);
    // 목도리 단서 3개는 예전에 투명이었다 — 이제 보여야 한다(찾을 수 없는 퀘스트였다).
    for (const id of ["ev_sky_m_clue_1", "ev_sky_m_clue_2", "ev_sky_m_clue_3"]) {
      expect(ids, `${id} 가 다시 투명해졌다`).not.toContain(id);
    }
  });
});
