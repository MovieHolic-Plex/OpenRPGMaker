// scripts/lib/releaseAssets.mjs
// 릴리스 자산 계약 — 한 릴리스가 «내려받을 수 있는 상태»인지 판정하는 순수 함수들.
//
// 왜 (2026-11-07): scripts/release-auto.mjs 가 `gh release create` 로 릴리스를 **바로 발행**하고
// 데스크톱 산출물은 나중에 desktop-release 가 올렸다. 그 사이 latest 는 자산 0개인 릴리스를
// 가리켰고, 빌드가 실패하자 README 의 /releases/latest/download/OPRN.Studio-windows.exe 가
// 404 가 됐다(v0.408.0, 2026-11-06 22:05Z ~ 11-07). 순서를 뒤집는다: 초안 생성 → 빌드·업로드 →
// 이름·크기 검증 → 발행. 업로드가 실패하면 초안으로 남고 latest 는 이전 정상 릴리스를 계속 준다.

/**
 * README·문서가 버전 없이 부르는 이름과 버전이 박힌 이름, 합쳐 6개가 릴리스에 있어야 한다.
 * electron-builder 산출물 이름(`<product>-<version>-<arch>.<ext>`)을 전제로 한다.
 *
 * @param {string} version `0.408.0` 처럼 v 없는 버전
 * @returns {readonly string[]}
 */
export function requiredDesktopAssets(version) {
  const plain = String(version ?? "").replace(/^v/, "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(plain)) throw new Error(`버전이 X.Y.Z 가 아닙니다: ${version}`);
  return [
    // README·릴리스 노트가 버전 없이 부르는 고정 이름
    "OPRN.Studio-windows.exe",
    "OPRN.Studio-windows.zip",
    "OPRN.Studio-linux.AppImage",
    // 버전이 박힌 이름(옛 릴리스·직접 링크용)
    `OPRN.Studio.${plain}.exe`,
    `OPRN.Studio-${plain}-win.zip`,
    `OPRN.Studio-${plain}.AppImage`,
  ];
}

/**
 * 릴리스 자산 목록에서 «없는 이름»과 «크기 0»을 가려낸다. gh api 의 asset 은
 * `{ name, size, state }` 꼴이다. 업로드가 끝나지 않은 자산은 state 가 `starter` 이고
 * size 가 0 이라 크기 검사만으로도 걸린다.
 *
 * @param {string} version
 * @param {ReadonlyArray<{ name?: string, size?: number, state?: string }>} assets
 * @returns {{ readonly ok: boolean, readonly missing: readonly string[], readonly empty: readonly string[] }}
 */
export function checkDesktopAssets(version, assets) {
  const byName = new Map();
  for (const asset of assets ?? []) {
    if (asset && typeof asset.name === "string") byName.set(asset.name, asset);
  }
  const missing = [];
  const empty = [];
  for (const name of requiredDesktopAssets(version)) {
    const asset = byName.get(name);
    if (!asset) {
      missing.push(name);
      continue;
    }
    if (!(Number(asset.size) > 0)) empty.push(name);
  }
  return { ok: missing.length === 0 && empty.length === 0, missing, empty };
}

/**
 * `vX.Y.Z` 태그 목록에서 가장 높은 버전. 발행할 때 «이 릴리스가 latest 인가»를 정하는 데 쓴다 —
 * 옛 초안을 뒤늦게 발행하면서 latest 를 뒤로 돌리지 않기 위해서다. 비교는 숫자 3자리로 한다
 * (`sort -V` 와 같은 결과: v0.9.0 < v0.10.0).
 *
 * @param {Iterable<string>} tags
 * @returns {string | null}
 */
export function highestReleaseTag(tags) {
  let best = null;
  let bestParts = null;
  for (const raw of tags ?? []) {
    const tag = String(raw ?? "").trim();
    const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
    if (!match) continue;
    const parts = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (!bestParts || compareParts(parts, bestParts) > 0) {
      best = tag;
      bestParts = parts;
    }
  }
  return best;
}

function compareParts(a, b) {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}
