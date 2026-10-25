// 조수 v2 그림 검사 — 고른 그림이 그 인물·장면의 설명과 맞는가(끝맺음 관문이 고칠 거리로 올린다).
//
// 왜(2026-10-25 조수 단독 게임 심사): 조수는 그림을 이름으로 고른다. 중간 수문장이 2배로 키워져 16px 파티 옆에서
// 도트가 뭉툭한 확대 그림이 되었다(J23).
// 순수 함수(before·after) — 워커·테스트가 같이 부른다.
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { CHARSET_FRAME_WIDTH } from "@/assets/easyrpgRtp";
import { normalizeCharacterScale } from "@/project/footprint";
import type { EventPageGraphic, Project } from "@/project/types";

type Obj = Record<string, unknown>;

/** 큰 몸으로 그려도 되는 이벤트(보스). id 의 _boss 접미사(던전 짓기)나 이름의 보스 낱말. */
const BOSS_NAME = /보스|마왕|최종|대마왕|魔王|boss/iu;

/** 걷기 칩 한 칸의 가로 화소. 번들 칩은 24, 업로드 칩은 meta.frameWidth. 칩이 아닌 그림(전투 그림에서 만든 필드 적)은 undefined. */
function frameWidthOf(project: Project, spriteId: string | undefined): number | undefined {
  if (!spriteId) return undefined;
  const uploaded = project.assets.uploaded?.[spriteId];
  if (uploaded) return uploaded.kind === "charset" ? uploaded.meta?.frameWidth ?? CHARSET_FRAME_WIDTH : undefined;
  return findCharsetAsset(spriteId) ? CHARSET_FRAME_WIDTH : undefined;
}

/**
 * 칩 한 칸이 화면에 그려지는 가로 화소(파티와 같은 맵 기준). 16px 칸에서 24px 칩의 자동 맞춤은 1배라 파티도 1배다 —
 * 자동(auto)이면 scale 은 그 위에 곱하는 몸 배율, 수동이면 절대 배율이라 둘 다 칸 폭 × scale 이다.
 */
function drawnWidth(frameWidth: number, graphic: Pick<EventPageGraphic, "scale"> | undefined): number {
  return frameWidth * normalizeCharacterScale(graphic?.scale);
}

/**
 * 파티보다 훨씬 크게 그려지는 칩(J23). 보스가 아닌 이벤트가 파티 칩의 1.75배 이상이면 짚는다 — 확대한 24px 칩은 도트가 뭉툭해
 * 같은 화면의 파티와 다른 해상도로 보인다. 이번에 새로 만들거나 바꾼 이벤트만 본다.
 */
export function oversizedSprites(before: Project, after: Project): string[] {
  const hero = after.database.actors.find((a) => a.id === (after.system.startActorIds?.[0] ?? "actor_hero")) ?? after.database.actors[0];
  const partyWidth = frameWidthOf(after, hero?.characterResourceId) ?? CHARSET_FRAME_WIDTH;
  const old = new Map<string, string>();
  for (const map of Object.values(before.maps)) for (const ev of map.events ?? []) old.set(`${map.id}/${ev.id}`, JSON.stringify(ev.pages ?? []));
  const out: string[] = [];
  for (const map of Object.values(after.maps)) {
    for (const ev of map.events ?? []) {
      if (old.get(`${map.id}/${ev.id}`) === JSON.stringify(ev.pages ?? [])) continue;
      if (/_boss$/u.test(ev.id) || BOSS_NAME.test(ev.name ?? "")) continue;
      for (const [pageIndex, page] of (ev.pages ?? []).entries()) {
        const graphic = page.graphic;
        const width = frameWidthOf(after, graphic?.sprite?.id);
        if (!graphic || !width) continue;
        const ratio = drawnWidth(width, graphic) / partyWidth;
        if (ratio < 1.75) continue;
        const scaleText = (graphic as Obj).scale !== undefined ? `배율 ${String((graphic as Obj).scale)}` : `칸 ${width}px`;
        out.push(`[게임 검사 크기] 「${ev.name || ev.id}」(${map.name ?? map.id}, ${ev.id}) ${pageIndex + 1}쪽 그림이 파티 칩의 ${ratio.toFixed(1)}배로 그려진다(${scaleText}) — 확대한 칩은 도트가 뭉툭해 16px 파티 옆에서 다른 해상도로 보인다. 보스가 아니면 patch_event_page 로 graphic.scale 을 빼서(또는 1) 파티와 같은 크기로 두고, 큰 몸이 필요하면 큰 그림(3×2 몸)이 있는 보스 그림을 고른다.`);
        break;
      }
    }
  }
  return out;
}
