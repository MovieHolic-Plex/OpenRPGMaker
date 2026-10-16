// 컷신 도구(impact·staged)가 «주인공 걷기 칩»을 고르는 규칙 — 장르 잠금이 캐릭터 칩을 잠그면 허용 칩만, 아니면 옛 규칙(Actor1~4).
// 이전에는 Actor1~4 만 받아서 몬스터 수집 잠금 아래에서는 모델이 RTP 칩을 쓰게 몰렸고, 잠금이 그 칩을 거부했다(poke-adv-lock-1 #7).
import type { Project } from "@/project/types";
import { enforcingGenreLock, genreLockAllowedCharsetLabels, genreLockAllowsCharset } from "@/project/genreLock";

const LEGACY_DEFAULT = "tex_easyrpg_charset_actor1";

type LockProject = Pick<Project, "system" | "assets">;

/** 캐릭터 칩을 잠그는 강제 잠금이 켜져 있으면 그 표, 아니면 undefined. */
function charsetLock(project: LockProject | undefined) {
  if (!project) return undefined;
  const active = enforcingGenreLock(project);
  return active?.allowedCharsets && active.def.charsets ? active : undefined;
}

/** character.resourceId 를 안 줬을 때 쓰는 칩. 잠금이 있으면 그 장르의 기본 주인공 칩(허용 계열 안). */
export function defaultCutsceneCharset(project: LockProject | undefined): string {
  return charsetLock(project)?.def.charsets?.playerDefault.resourceId ?? LEGACY_DEFAULT;
}

/** 주인공(hero) 으로 쓸 수 있는 칩이면 undefined, 아니면 고칠 방법을 담은 거부 문장. */
export function cutsceneHeroChipError(project: LockProject | undefined, resourceId: string, who: string): string | undefined {
  const active = project ? charsetLock(project) : undefined;
  if (active && project) {
    if (genreLockAllowsCharset(project, resourceId)) return undefined;
    const fallback = active.def.charsets!.playerDefault;
    return `${who} 은 이 프로젝트의 장르 잠금(${active.def.label}) 허용 캐릭터 칩에서 고릅니다('${resourceId}' 는 허용 밖) — 허용: ${genreLockAllowedCharsetLabels(project).join(", ")}. `
      + `예: character:{resourceId:'${fallback.resourceId}', characterIndex:${fallback.characterIndex}}. 고른 인물로 맵 위 주인공 그래픽도 맞춰 줍니다.`;
  }
  if (/actor[1-4]$/iu.test(resourceId)) return undefined;
  return `${who} 은 캐릭터셋 Actor1~4 에서 고릅니다('${resourceId}' 아님) — 예: character:{resourceId:'tex_easyrpg_charset_actor1', characterIndex:0}(인물 0~7번). 고른 인물로 맵 위 주인공 그래픽도 맞춰 줍니다.`;
}

/** 배우의 characterResourceId 로 저장할 id — 텍스처 키(tex_<계열>_charset_<이름>)를 리소스 id(<계열>-charset-<이름>)로 바꾼다. */
export function heroCharacterResourceId(resourceId: string): string {
  return resourceId.replace(/^tex_([a-z0-9]+)_charset_/u, "$1-charset-");
}
