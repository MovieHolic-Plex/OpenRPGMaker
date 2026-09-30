// 사용법: node run-ssr.mjs bundle-owner-cost.mts
// 번들 소유 참고문서 판본을 새로 만드는 데 드는 시간과 크기.
export async function run(mods: { defaultAssets: any }) {
  const t0 = performance.now();
  const fresh = mods.defaultAssets.defaultTilesets();
  const t1 = performance.now();
  mods.defaultAssets.ensureBundledTilesets({ tilesets: fresh });
  const t2 = performance.now();
  let n = 0, bytes = 0;
  const t3 = performance.now();
  for (const t of Object.values<any>(fresh)) {
    if (t.referenceDocuments?.length) { n++; bytes += JSON.stringify(t.referenceDocuments).length; }
  }
  const t4 = performance.now();
  console.log(JSON.stringify({ defaultTilesetsMs: Math.round(t1 - t0), ensureMs: Math.round(t2 - t1), stringifyMs: Math.round(t4 - t3), tilesetsWithDocs: n, docsMB: +(bytes / 1e6).toFixed(2), count: Object.keys(fresh).length }));
  // 두 번째 호출(모듈 캐시 뜨거운 상태)
  const s = performance.now();
  const fresh2 = mods.defaultAssets.defaultTilesets();
  mods.defaultAssets.ensureBundledTilesets({ tilesets: fresh2 });
  console.log("second", Math.round(performance.now() - s));
}
