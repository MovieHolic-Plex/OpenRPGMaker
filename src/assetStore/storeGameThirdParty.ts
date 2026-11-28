import type { Project, ResourceProfile } from "@/project/types";
import { storeThirdPartyName } from "./format";

/**
 * 공개 라이선스 카탈로그 — OPRN CC0 곡·효과음(`cc0-…`)과 EasyRPG RTP(CC BY, `easyrpg-…`).
 * 이름에 「rtp」 같은 낱말이 들어 있어도 제3자 유료 팩이 아니다.
 */
const OPEN_CATALOG_PREFIXES = ["cc0-", "easyrpg-"] as const;

/**
 * 은퇴한 구 RefmapDoll 칩 ID(`oprn-charset-refmap-doll<n>` / `tex_oprn_charset_refmap_doll<n>`).
 * 번들에서는 2026-11-28 전량 제거되었으나, 과거 저장본의 resourceProfiles 에 남아 있을 때 불필요한 스토어 거절을 막고 정리하기 위해 패턴만 유지한다.
 */
const RETIRED_REFMAP_DOLL_ID = /^(?:oprn-charset-refmap-doll|tex_oprn_charset_refmap_doll)\d+$/u;

export function isModifiedRefmapProfile(profile: ResourceProfile): boolean {
  return RETIRED_REFMAP_DOLL_ID.test(profile.assetId ?? "");
}

/** 자원 목록 항목 하나가 스토어가 막는 제3자 팩 이름(REFMAP·Rasak·PAW·RPG Maker MV/MZ 계열)을 달고 있으면 그 낱말, 아니면 null. */
export function resourceProfileThirdPartyWord(profile: ResourceProfile): string | null {
  const assetId = profile.assetId ?? "";
  if (OPEN_CATALOG_PREFIXES.some((prefix) => assetId.startsWith(prefix))) return null;
  const license = isModifiedRefmapProfile(profile) ? "REFMAP-MODIFIED" : undefined;
  return storeThirdPartyName(assetId, license) ?? storeThirdPartyName(profile.name ?? "", license);
}

export interface StoreGameThirdPartyProfiles {
  /** 판본에 남길 자원 목록. */
  readonly kept: ResourceProfile[];
  /** 게임이 쓰지 않아 뺀 제3자 이름 자원. */
  readonly dropped: ResourceProfile[];
  /** 게임이 실제로 쓰는 제3자 이름 자원 — 이 판본은 올리면 안 된다. */
  readonly referenced: { readonly profile: ResourceProfile; readonly word: string }[];
  /** 게임이 실제로 쓰는 고친 REFMAP 칩 — 허용하되 크레딧에 REFMAP_CREDIT 을 단다. */
  readonly usesModifiedRefmap: boolean;
}

/**
 * 스토어 바로 플레이 판본에 실을 자원 목록을 가른다. 기본 자원 목록에는 게임이 쓰지 않는 제3자 이름 그림
 * (「RefmapDoll · REFMAP 변형 인물」 걷기 칩 321장 등)이 딸려 와 판본 파일로 실렸다(2026-10-30 maou-konbini 게시 점검).
 * 쓰지 않는 것은 빼고, 쓰는 것(assetId 가 자원 목록 밖에 문자열로 나오는 것)은 referenced 로 돌려준다.
 */
export function splitStoreGameThirdPartyProfiles(project: Project): StoreGameThirdPartyProfiles {
  const rest = JSON.stringify({ ...project, resourceProfiles: [] });
  const kept: ResourceProfile[] = [];
  const dropped: ResourceProfile[] = [];
  const referenced: { profile: ResourceProfile; word: string }[] = [];
  let usesModifiedRefmap = false;
  for (const profile of project.resourceProfiles ?? []) {
    // 고친 REFMAP 칩은 허용하되 게임이 쓰는 시트만 싣는다(321장을 통째로 재배포하지 않는다).
    if (isModifiedRefmapProfile(profile)) {
      if (profile.assetId && rest.includes(JSON.stringify(profile.assetId))) { usesModifiedRefmap = true; kept.push(profile); }
      else dropped.push(profile);
      continue;
    }
    const word = resourceProfileThirdPartyWord(profile);
    if (!word) { kept.push(profile); continue; }
    if (profile.assetId && rest.includes(JSON.stringify(profile.assetId))) { kept.push(profile); referenced.push({ profile, word }); continue; }
    dropped.push(profile);
  }
  return { kept, dropped, referenced, usesModifiedRefmap };
}
