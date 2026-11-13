// 주인공의 쌍둥이로 선 사람을 다시 입힌다 — 주인공의 모습은 출하 기본값(shipLookDefaults.fillPartyLooks)에서 맨 나중에 정해지므로,
// 사람을 놓을 때(place/people.pickPersonGraphic)의 «주인공 칩은 피한다» 가 그 뒤에 정해진 주인공에게는 닿지 않는다.
// 왜(2026-11-13 r3b-fun · r2 의 선술집): 대장장이가 people1 «푸른 머리 청년» 으로 선 뒤에 주인공이 actor4 «파란 머리 청년» 이 됐다 — 걷는 그림도 흉상도 같은 사람이었다.
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Project } from "@/project/types";
import { pickPersonGraphic } from "../place/people";
import { sharedFaceForCharset } from "@/project/sharedCharacterFaceResolver";
import { bustOfChip, lookOfChip } from "./speakerBust";

type Graphic = { sprite?: { type?: string; id?: string }; pattern?: number; direction?: string };

/** 명령 나무 어디든(갈래 포함) 그 얼굴·흉상을 거는 얼굴 명령을 새 것으로 바꾼다("" = 이름표만). */
function swapFaces(node: unknown, old: ReadonlySet<string>, next: string): void {
  if (Array.isArray(node)) { for (const item of node) swapFaces(item, old, next); return; }
  if (!node || typeof node !== "object") return;
  const o = node as { kind?: unknown; resourceId?: unknown };
  if (o.kind === "changeFace" && typeof o.resourceId === "string" && old.has(o.resourceId)) o.resourceId = next;
  for (const value of Object.values(o)) if (value && typeof value === "object") swapFaces(value, old, next);
}

/**
 * 시작 파티와 같은 칩이거나 같은 모습(성별·나이·머리 — 시트만 다른 같은 사람)으로 선 사람을 사람 고르기로 다시 입힌다.
 * 이름이 파티의 것인 이벤트(장면에 선 주인공)는 그대로 둔다. 그 사람에게 맞는 다른 칩이 없으면 그대로 둔다. 바꾼 것마다 한 줄.
 */
export function redressHeroTwins(project: Project): string[] {
  const party = (project.system.startActorIds ?? []).map((id) => project.database.actors.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a);
  const chipOf = (id: string | undefined, index: number) => { const asset = id ? findCharsetAsset(id) : undefined; return asset ? { key: `${asset.id}#${index}`, look: lookOfChip(asset.id, index) } : undefined; };
  const heroes = party.map((a) => chipOf(a.characterResourceId, a.characterIndex ?? 0)).filter((c): c is NonNullable<typeof c> => !!c);
  const heroKeys = new Set(heroes.map((c) => c.key)), heroLooks = new Set(heroes.map((c) => c.look).filter((l): l is string => !!l));
  const partyNames = new Set(party.map((a) => a.name.trim()));
  const twin = (g: Graphic | undefined): boolean => {
    const chip = typeof g?.pattern === "number" ? chipOf(g.sprite?.id, decodeCharsetFrameIndex(g.pattern).characterIndex) : undefined;
    return !!chip && (heroKeys.has(chip.key) || (!!chip.look && heroLooks.has(chip.look)));
  };
  const out: string[] = [];
  if (!heroes.length) return out;
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    const name = (event.name ?? "").trim();
    const pages = event.pages ?? [];
    if (!name || partyNames.has(name) || !pages.some((page) => twin(page.graphic as Graphic | undefined))) continue;
    const step = project.gameBlueprint?.steps.find((s) => s.built?.eventId === event.id && s.built.mapId === map.id) as { who?: string; looks?: string } | undefined;
    // 모습을 말한 글이 없으면 지금 칩의 성별·나이를 지킨다 — 머리만 다른 같은 부류의 사람으로 바뀐다(청년 남성 대장장이가 젊은 여성이 되지 않게).
    const first = pages.map((page) => page.graphic as Graphic | undefined).find(twin)!;
    const kept = lookOfChip(first.sprite!.id, decodeCharsetFrameIndex(first.pattern!).characterIndex)?.split("|").slice(0, 2).join(" ");
    const pick = pickPersonGraphic(project, map, step?.who ?? name, step?.looks ?? kept, true);
    const asset = pick ? findCharsetAsset(pick.textureKey) : undefined;
    if (!pick || !asset || twin({ sprite: { id: pick.textureKey }, pattern: charsetFrameIndex({ characterIndex: pick.characterIndex, direction: "down", pattern: 1 }) })) continue;
    // 대화창의 얼굴도 그 사람의 것으로 — 옛 칩의 흉상·낱장 얼굴을 건 얼굴 명령을 새 칩의 흉상(없으면 낱장 얼굴, 그것도 없으면 이름표만)으로 바꾼다.
    const face = bustOfChip(pick.textureKey, pick.characterIndex) ?? pick.faceResourceId ?? "";
    for (const page of pages) {
      const g = page.graphic as Graphic | undefined;
      if (!twin(g)) continue;
      const at = decodeCharsetFrameIndex(g!.pattern!);
      const old = new Set([bustOfChip(g!.sprite!.id, at.characterIndex), sharedFaceForCharset(g!.sprite!.id!, at.characterIndex)?.resourceId].filter((id): id is string => !!id));
      for (const any of pages) swapFaces(any.commands, old, face);
      page.graphic = { ...g, sprite: { ...g!.sprite, id: pick.textureKey }, pattern: charsetFrameIndex({ ...at, characterIndex: pick.characterIndex }) } as typeof page.graphic;
    }
    out.push(`「${name}」(${map.name ?? map.id}) 모습 → ${pick.label} — 주인공과 같은 사람으로 보이는 칩이었다`);
  }
  return out;
}
