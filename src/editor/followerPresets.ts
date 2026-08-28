import type { Command, EventPageGraphic } from "@/project/types";
import { store } from "@/project/store";
import { charsetFollowerGraphic } from "@/project/followers";

export type FollowerPresetKind = "actor" | "mascot";

export type FollowerPreset = {
  readonly id: string;
  readonly kind: FollowerPresetKind;
  readonly label: string;
  readonly description: string;
  readonly hint: string;
  /** actorId (mascot은 내부 마스코트 refId) */
  readonly refId: string;
  /** 보기용 이름(폴백). 저장에는 쓰지 않음. */
  readonly displayName: string;
  /** 캐릭터셋 텍스처 키(썸네일 확인용, 없으면 undefined) */
  readonly textureKey?: string;
  /** DB 초상화(페이스셋/캐릭터셋) — 이미지 칩 렌더용. */
  readonly faceResourceId?: string | undefined;
  readonly characterResourceId?: string | undefined;
  readonly characterIndex?: number | undefined;
};

/** 프로젝트 DB 액터 전원 — 동료 로스터/프리셋은 이 목록이 단일 원천이다. */
function projectActors(): readonly {
  id: string;
  name: string;
  faceResourceId?: string;
  characterResourceId?: string;
  characterIndex?: number;
}[] {
  return store.getCurrent().database.actors.map((actor) => ({
    id: actor.id,
    name: actor.name,
    faceResourceId: actor.faceResourceId,
    characterResourceId: actor.characterResourceId,
    characterIndex: actor.characterIndex,
  }));
}

/** 프로젝트 상태를 읽어 프리셋 목록을 생성. 고정 3개 + 프로젝트 보유 액터를 덧붙임. */
export function buildFollowerPresets(): readonly FollowerPreset[] {
  const actors = projectActors();

  const base: FollowerPreset[] = [
    {
      // id 는 즐겨찾기/테스트 계약이라 고정. 번들 charset 에 개 스프라이트가 없어서
      // (tex_easyrpg_charset_animal = 주황 고양이/검은 고양이/닭/양/소/말/호랑이/고슴도치)
      // 이 칩은 검은 고양이로 정정했다. 이전에는 "강아지" 라벨이 붙은 채 고양이 프리셋과
      // 똑같은 0번 스프라이트를 렌더했다(pattern 을 원시 프레임으로 넣은 탓).
      id: "preset:pet-dog",
      kind: "mascot",
      label: "검은 고양이 동료",
      description: "주인공 바로 뒤를 따라오는 검은 고양이.",
      hint: "addFollower(그래픽) — animal charset 1번",
      refId: "__mascot_black_cat__",
      displayName: "까망이",
      textureKey: "tex_easyrpg_charset_animal",
    },
    {
      id: "preset:pet-cat",
      kind: "mascot",
      label: "고양이 동료",
      description: "느릿하게 뒤따라오는 주황 고양이. 마을·농장 분위기에 어울린다.",
      hint: "addFollower(그래픽) — animal charset 0번",
      refId: "__mascot_cat__",
      displayName: "야옹이",
      textureKey: "tex_easyrpg_charset_animal",
    },
    {
      id: "preset:pet-chick",
      kind: "mascot",
      label: "닭 동료",
      description: "작고 귀여운 닭. 농장 동료로 추천.",
      hint: "addFollower — farming-charset-chicken 사용",
      refId: "__mascot_chick__",
      displayName: "삐약이",
      textureKey: "tex_farming_charset_chicken",
    },
  ];

  // 프로젝트 몬스터는 프리셋 칩으로 노출하지 않는다 — 몬스터 동행은
  // monsterParty 가 단일 진실 원천(SSOT)이며, 편입 경로는 몬스터 도감 → 파티 편입이다.

  // DB 동료 전원을 칩으로 노출(2026-08-27 — 첫 두 명만 나오던 누락 수정).
  // 첫 액터 칩은 기존 계약 id(preset:companion-hero)를 유지해 즐겨찾기/테스트 호환을 지킨다.
  actors.forEach((actor, index) => {
    base.push({
      id: index === 0 ? "preset:companion-hero" : `preset:actor:${actor.id}`,
      kind: "actor",
      label: index === 0 ? `동료 주인공 (${actor.name || "동료"})` : `${actor.name} 동료`,
      description: `${actor.name} 가 뒤따라온다.`,
      hint: "addFollower(actorId)",
      refId: actor.id,
      displayName: actor.name || "동료",
      faceResourceId: actor.faceResourceId,
      characterResourceId: actor.characterResourceId,
      characterIndex: actor.characterIndex,
    });
  });

  return base;
}

/** 프리셋 → 실제 커맨드로 변환. 마스코트는 addFollower(그래픽), 액터는 addFollower(actorId) 한 줄. */
export function followerPresetToCommands(preset: FollowerPreset): readonly Command[] {
  if (preset.kind === "mascot") {
    const graphic = mascotGraphic(preset.refId);
    return [{ kind: "addFollower", name: preset.displayName, graphic } as unknown as Command];
  }
  // actor
  return [{ kind: "addFollower", actorId: preset.refId } as unknown as Command];
}

/** 마스코트 refId → 번들 charset 좌표. 프레임 계산은 charsetFollowerGraphic 이 단독으로 책임진다. */
const MASCOT_CHARSETS: Readonly<Record<string, { readonly textureKey: string; readonly characterIndex: number }>> = {
  __mascot_cat__: { textureKey: "tex_easyrpg_charset_animal", characterIndex: 0 },
  __mascot_black_cat__: { textureKey: "tex_easyrpg_charset_animal", characterIndex: 1 },
  __mascot_chick__: { textureKey: "tex_farming_charset_chicken", characterIndex: 0 },
};

function mascotGraphic(refId: string): EventPageGraphic | undefined {
  const entry = MASCOT_CHARSETS[refId];
  if (!entry) return undefined;
  return charsetFollowerGraphic(entry.textureKey, entry.characterIndex);
}
