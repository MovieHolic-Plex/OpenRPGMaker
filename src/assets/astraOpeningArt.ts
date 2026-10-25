/**
 * 『아스트라 호라이즌』 인트로·타이틀 층 그림. 새 화소 없음 — 이미 고른 타이틀 그림(title-meadow)에서
 * 하늘만 오려 내고 땅을 달빛 밤 색으로 다시 칠한 것이다(scripts/content/astra/astra-night-cutouts.py).
 * 뒤에는 OPRN 밤하늘 파노라마 세 겹을 깐다. 플레이어·내보내기는 generatedAssetResourceResolver 가 id 로 찾는다.
 */
export type AstraArtId = 'meadow-night';

export type AstraArt = { readonly id: AstraArtId; readonly resourceId: string; readonly fileName: string; readonly width: number; readonly height: number };

const art = (id: AstraArtId, width: number, height: number): AstraArt => ({ id, resourceId: `oprn_astra_art_${id}`, fileName: `${id}.png`, width, height });

export const ASTRA_ART: readonly AstraArt[] = [
  // 240×160 밤 풀밭(하늘 투명). 인트로 무대(480×320)에는 nearest 2배로, 타이틀에는 cover 전경 층(정확히 2배)으로 깐다.
  art('meadow-night', 240, 160),
];

export const ASTRA_ART_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  ASTRA_ART.map(entry => [entry.resourceId, `/assets/emerald-monster/astra/${entry.fileName}`]),
);

export function astraArt(id: AstraArtId): AstraArt {
  return ASTRA_ART.find(entry => entry.id === id)!;
}
