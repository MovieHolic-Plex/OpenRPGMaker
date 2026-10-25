/**
 * 『아스트라 호라이즌』 인트로·타이틀 층 그림. 새 화소 없음 — 이미 고른 타이틀 그림(title-meadow)에서
 * 하늘만 오려 내고 땅을 달빛 밤 색으로 다시 칠한 것이다(scripts/content/astra/astra-night-cutouts.py).
 * 뒤에는 OPRN 밤하늘 파노라마 세 겹을 깐다. 플레이어·내보내기는 generatedAssetResourceResolver 가 id 로 찾는다.
 */
export type AstraArtId = 'meadow-night' | 'title-night';

export type AstraArt = { readonly id: AstraArtId; readonly resourceId: string; readonly fileName: string; readonly width: number; readonly height: number };

const art = (id: AstraArtId, width: number, height: number): AstraArt => ({ id, resourceId: `oprn_astra_art_${id}`, fileName: `${id}.png`, width, height });

export const ASTRA_ART: readonly AstraArt[] = [
  // 240×160 밤 풀밭(하늘 투명). 오프닝 무대(480×320)에는 nearest 2배로 그린다.
  art('meadow-night', 240, 160),
  // 타이틀 층(320×240): 위 그림을 2배로 키워 가운데 아래를 잘라 낸 창 — 타이틀 배경 층 규격(320×240)과 같다.
  art('title-night', 320, 240),
];

export const ASTRA_ART_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  ASTRA_ART.map(entry => [entry.resourceId, `/assets/emerald-monster/astra/${entry.fileName}`]),
);

export function astraArt(id: AstraArtId): AstraArt {
  return ASTRA_ART.find(entry => entry.id === id)!;
}
