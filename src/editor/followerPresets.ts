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
};

function projectActors(): readonly { id: string; name: string }[] {
  const p = store.getCurrent();
  const db = (p as unknown as { database?: { actors?: readonly { id: string; name: string }[] } }).database;
  const actors = db?.actors;
  if (!actors) return [];
  return actors;
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
    {
      id: "preset:companion-hero",
      kind: "actor",
      label: "동료 주인공",
      description: "파티 주인공 한 명을 뒤따라오게 한다. 대화 연출에 좋다.",
      hint: "addFollower(actorId)",
      refId: actors[0]?.id ?? "actor-1",
      displayName: actors[0]?.name ?? "동료",
    },
  ];

  // 프로젝트 몬스터는 프리셋 칩으로 노출하지 않는다 — 몬스터 동행은
  // monsterParty 가 단일 진실 원천(SSOT)이며, 편입 경로는 몬스터 도감 → 파티 편입이다.
  // 여기서 안내 메시지를 이벤트에 삽입하면 저자용 안내가 게임 콘텐츠로 흘러들어가므로
  // 칩 자체를 만들지 않는다 (2026-08-10, "동행" 칩 실수 클릭 사고 후속).

  // 배우가 2명 이상이면 두 번째 배우도 프리셋으로 노출
  if (actors[1]) {
    base.push({
      id: `preset:actor:${actors[1].id}`,
      kind: "actor",
      label: `${actors[1].name} 동행`,
      description: `${actors[1].name} 가 뒤따라온다.`,
      hint: "addFollower(actorId)",
      refId: actors[1].id,
      displayName: actors[1].name,
    });
  }

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
