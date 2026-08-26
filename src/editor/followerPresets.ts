import type { Command } from "@/project/types";
import { store } from "@/project/store";

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
  readonly faceIndex?: number | undefined;
  readonly characterResourceId?: string | undefined;
  readonly characterIndex?: number | undefined;
};

/** 프로젝트 DB 액터 전원 — 동료 로스터/프리셋은 이 목록이 단일 원천이다. */
function projectActors(): readonly {
  id: string;
  name: string;
  faceResourceId?: string;
  faceIndex?: number;
  characterResourceId?: string;
  characterIndex?: number;
}[] {
  return store.getCurrent().database.actors.map((actor) => ({
    id: actor.id,
    name: actor.name,
    faceResourceId: actor.faceResourceId,
    faceIndex: actor.faceIndex,
    characterResourceId: actor.characterResourceId,
    characterIndex: actor.characterIndex,
  }));
}

/** 프로젝트 상태를 읽어 프리셋 목록을 생성. 고정 3개 + 프로젝트 보유 액터를 덧붙임. */
export function buildFollowerPresets(): readonly FollowerPreset[] {
  const actors = projectActors();

  const base: FollowerPreset[] = [
    {
      id: "preset:pet-dog",
      kind: "mascot",
      label: "강아지 펫",
      description: "시골 마을에 어울리는 작은 강아지. 주인공 바로 뒤에서 따라온다.",
      hint: "addFollower(임시 그래픽) — 저장 없이 필드 전용",
      refId: "__mascot_dog__",
      displayName: "멍멍이",
    },
    {
      id: "preset:pet-cat",
      kind: "mascot",
      label: "고양이 펫",
      description: "느릿하게 뒤따라오는 고양이. 농장/마을 분위기에 좋다.",
      hint: "addFollower(임시 그래픽)",
      refId: "__mascot_cat__",
      displayName: "야옹이",
    },
    {
      id: "preset:pet-chick",
      kind: "mascot",
      label: "병아리",
      description: "작고 귀여운 병아리. 농장 펫으로 추천.",
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
      label: index === 0 ? `동료 주인공 (${actor.name || "동료"})` : `${actor.name} 동행`,
      description: `${actor.name} 가 뒤따라온다.`,
      hint: "addFollower(actorId)",
      refId: actor.id,
      displayName: actor.name || "동료",
      faceResourceId: actor.faceResourceId,
      faceIndex: actor.faceIndex,
      characterResourceId: actor.characterResourceId,
      characterIndex: actor.characterIndex,
    });
  });

  return base;
}

/** 프리셋 → 실제 커맨드로 변환. 펫(마스코트)은 addFollower(그래픽), 액터는 addFollower(actorId) 한 줄. */
export function followerPresetToCommands(preset: FollowerPreset): readonly Command[] {
  if (preset.kind === "mascot") {
    const graphic = mascotGraphic(preset.refId);
    return [{ kind: "addFollower", name: preset.displayName, graphic } as unknown as Command];
  }
  // actor
  return [{ kind: "addFollower", actorId: preset.refId } as unknown as Command];
}

type MascotGraphic = { sprite: { type: "bundled"; id: string }; pattern: number; direction: "down"; transparent?: boolean };

function mascotGraphic(refId: string): MascotGraphic | undefined {
  // 프로젝트에 번들로 존재하는 charset만 쓴다 — 없는 텍스처는 playSceneFollowers에서 투명 가드로 스킵된다.
  // chicken은 farming 에셋, animal은 EasyRPG RTP(정식 텍스처키: tex_easyrpg_charset_animal).
  if (refId === "__mascot_chick__")
    return { sprite: { type: "bundled", id: "tex_farming_charset_chicken" }, pattern: 1, direction: "down", transparent: false };
  if (refId === "__mascot_cat__")
    return { sprite: { type: "bundled", id: "tex_easyrpg_charset_animal" }, pattern: 0, direction: "down", transparent: false };
  if (refId === "__mascot_dog__")
    return { sprite: { type: "bundled", id: "tex_easyrpg_charset_animal" }, pattern: 1, direction: "down", transparent: false };
  return undefined;
}
