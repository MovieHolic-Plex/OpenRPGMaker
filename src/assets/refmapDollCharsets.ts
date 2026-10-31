// REFMAP 변형 인물 걷기 칩 RefmapDoll1~(2026-10-28). RM2K3 CharSet 규격 288×256, 시트당 8명(4열×2행) × 3패턴 × 4방향(행 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽).
// 비공개 생성기 char-gen 의 `refmap` 종이 인형: REFMAP 인물 242명 중 한 사람의 머리 덩어리를 다른 사람의 몸에 얹고 목을 다시 그린 칩이다.
// 짝 58,322개 → 숫자 관문 통과 4,798 → Kiro Opus 눈 검사 통과 2,793 → 같은 인물의 색 바꾼 쌍둥이 짝 93개 뺌 → 2,700 → 원본 한쪽과 거의 같은 칩 133개 뺌 → 2,567(사용자 위임 「번들, 검수 위임」 2026-10-28). 원본 시트는 싣지 않는다.
// 사용자 결정(2026-10-28): REFMAP 제외(2026-10-06)의 예외 — 변형한 칩만, 게임 안에서 무료로. 2026-10-31: 「수정된 것은 전부 허용」 — 이 칩을 쓰는 게임은 스토어에 게시할 수 있다(REFMAP-MODIFIED, storeGameThirdParty.ts, 크레딧 자동). 소재 자체는 REFMAP-MODIFIED 라이선스 무료 상품으로만 스토어에 올린다(약관: 고친 그림 재배포 허락·판매 금지 없음).
// 시트와 명단은 `python3 src/harnesses/charset-actor/install_refmap_dolls.py --from <char-gen export>` 가 굽는다. 크레딧: public/assets/ATTRIBUTION.md 「RefmapDoll」.
// 이 모듈은 명단 JSON 을 읽지 않는다 — 2,567명 이름·외형 문장이 내보낸 게임(플레이어)에 실리지 않게, 라벨은 refmapDollSemantics.ts(에디터 전용)에 둔다.
import type { EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";

/** 시트 수. 명단(refmapDollCharsets.json)의 sheets 와 같다(install_refmap_dolls.py 가 맞춰 쓴다). */
export const REFMAP_DOLL_SHEETS = 321;

export const REFMAP_DOLL_CHARSET_ASSETS = Array.from({ length: REFMAP_DOLL_SHEETS }, (_, i) => i + 1).map((n) => ({
  category: "charset",
  id: `oprn-charset-refmap-doll${n}`,
  name: `RefmapDoll${n} · REFMAP 변형 인물`,
  sourcePath: "src/harnesses/charset-actor/install_refmap_dolls.py",
  path: `assets/generated/charsets/RefmapDoll${n}.png`,
  fileName: `RefmapDoll${n}.png`,
  textureKey: `tex_oprn_charset_refmap_doll${n}`,
  group: "RefmapDoll",
})) satisfies readonly EasyRpgCharsetAsset[];

export const REFMAP_DOLL_CHARSET_RESOURCE_IDS: readonly string[] = REFMAP_DOLL_CHARSET_ASSETS.flatMap((asset) => [asset.id, asset.textureKey]);

// 프로젝트 글자 수만 번 불린다(웹 플레이어 미리 받기 목록) — 321장 배열을 매번 훑지 않는다.
let refmapDollPathByKey: Map<string, string> | undefined;
export function resolveRefmapDollCharsetUrl(resourceId: string): string | null {
  refmapDollPathByKey ??= new Map(REFMAP_DOLL_CHARSET_ASSETS.flatMap((entry): [string, string][] => [[entry.id, entry.path], [entry.textureKey, entry.path]]));
  const path = refmapDollPathByKey.get(resourceId);
  return path === undefined ? null : `/${path}`;
}

// ── 옆모습 전투 시트(2026-10-29) ─────────────────────────────────────────────────────────────────
// 대표 인물 13명(기사·병사·모험가·마법사·성직자·사냥꾼·상인·왕 등)만 전투 시트 144×384(48px 3열×8행 24자세, 왼쪽을 본다)와
// 마법 시트 144×336(7속성×3단계)이 있다. 모델(Claude Opus 5.5)이 칩을 보고 자세마다 화소를 찍고, 다른 호출이 적대적으로 결함을 찾고,
// 그 지적으로 고쳐 그린 그림이다(char-gen battledraw). install_refmap_battlers.py 가 아래 목록을 맞춰 쓴다.
// 목록 밖 칸은 전투 시트가 없다 — 그 칩을 파티에 넣으면 기존 일반 전투 그림 규칙을 따른다.

/** 전투 시트가 있는 칸 「시트-칸」(RefmapDoll<시트> 의 칸 0~7). install_refmap_battlers.py 가 맞춰 쓴다. */
export const REFMAP_DOLL_BATTLER_SLOTS: readonly string[] = ["1-2", "2-6", "66-0", "89-0", "105-1", "146-3", "167-4", "189-0", "206-2", "208-2", "250-6", "270-5", "295-3"];

const BATTLER_ID = /^charset-battler-refmap-doll(\d+)-([0-7])(-cast)?$/u;
const CHARSET_ID = /^(?:oprn-charset-refmap-doll|tex_oprn_charset_refmap_doll)(\d+)$/u;
const BATTLER_SLOTS = new Set(REFMAP_DOLL_BATTLER_SLOTS);

export const hasRefmapDollBattler = (sheet: number, index: number): boolean => BATTLER_SLOTS.has(`${sheet}-${index}`);
const hasBattler = hasRefmapDollBattler;

/** 이 걷기 칩 칸의 전투 시트 id(없으면 undefined). */
export function refmapDollBattlerFor(characterResourceId: string | undefined, characterIndex: number): string | undefined {
  const m = CHARSET_ID.exec(characterResourceId ?? "");
  if (!m || !Number.isInteger(characterIndex) || characterIndex < 0 || characterIndex > 7 || !hasBattler(Number(m[1]), characterIndex)) return undefined;
  return `charset-battler-refmap-doll${m[1]}-${characterIndex}`;
}

/** 전투 시트 id → 시트·시전 시트 경로와 원본 걷기 칩. 규칙에 안 맞거나 시트가 없는 칸이면 undefined. */
export function refmapDollBattler(resourceId: string) {
  const m = BATTLER_ID.exec(resourceId);
  if (!m || m[3] || !hasBattler(Number(m[1]), Number(m[2]))) return undefined;
  const file = `RefmapDoll${m[1]}-${m[2]}.png`;
  return {
    resourceId,
    path: `assets/generated/charset-battlers/refmap-doll/${file}`,
    castPath: `assets/generated/charset-battlers/refmap-doll/cast/${file}`,
    characterResourceId: `oprn-charset-refmap-doll${m[1]}`,
    characterIndex: Number(m[2]),
    label: `걷기 칩 전투 · RefmapDoll${m[1]} #${Number(m[2]) + 1}`,
  };
}

/** `charset-battler-refmap-doll<n>-<i>`(전투 시트)·`…-cast`(마법 시트)의 URL. */
export function resolveRefmapDollBattlerUrl(resourceId: string): string | null {
  const cast = resourceId.endsWith("-cast");
  const entry = refmapDollBattler(cast ? resourceId.slice(0, -"-cast".length) : resourceId);
  return entry ? `/${cast ? entry.castPath : entry.path}` : null;
}
