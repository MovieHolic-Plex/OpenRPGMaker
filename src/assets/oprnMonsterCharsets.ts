// OPRN 자체 제작 몬스터 걷기 칩 Monster4~6(2026-09-29, retro2003 3차 로스터). RM2K3 CharSet 규격 288×256,
// 8명(4열×2행) × 3패턴 × 4방향(행 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽 — EasyRPG RTP 와 같다).
// 그림 원본: scripts/asset-gen/oprn-charset/monster<N>.py(python3 + PIL 좌표 도트). 전투 15칸 시트는 party-pixel/monster<N>-<i>.png.
// id 는 EasyRPG RTP 규칙(easyrpg-charset-<시트>)을 따른다 — 로스터·전투 시트 자동 대응(rosterChip)이 같은 규칙을 쓰기 때문이다.
import type { EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";

const SHEETS = [
  { n: 4, name: "Monster4 · 숲·요괴" },
  { n: 5, name: "Monster5 · 저주받은 물건" },
  { n: 6, name: "Monster6 · 전설의 괴수" },
] as const;

export const OPRN_MONSTER_CHARSET_ASSETS = SHEETS.map(({ n, name }) => ({
  category: "charset",
  id: `easyrpg-charset-monster${n}`,
  name: `${name} · 캐릭터 그림 · OPRN`,
  sourcePath: `scripts/asset-gen/oprn-charset/monster${n}.py`,
  path: `assets/generated/charsets/Monster${n}.png`,
  fileName: `Monster${n}.png`,
  textureKey: `tex_easyrpg_charset_monster${n}`,
  group: "Monster",
})) satisfies readonly EasyRpgCharsetAsset[];

export const OPRN_MONSTER_CHARSET_RESOURCE_IDS: readonly string[] = OPRN_MONSTER_CHARSET_ASSETS.flatMap((asset) => [asset.id, asset.textureKey]);

export function resolveOprnMonsterCharsetUrl(resourceId: string): string | null {
  const asset = OPRN_MONSTER_CHARSET_ASSETS.find((entry) => entry.id === resourceId || entry.textureKey === resourceId);
  return asset ? `/${asset.path}` : null;
}

