// 편집기 다이얼로그가 쓰는 그림 카탈로그를 유휴 시간에 미리 만들어 둔다.
//
// 문제(실측): NPC 그래픽 피커를 열면 캐릭셋 썸네일이 2.6초에 걸쳐 한 줄씩 채워졌다. 비용은
// 네트워크가 아니라 **투명색 처리 파이프라인**이다 — `applyCharsetFrameCrop` 은 모든 캐릭셋을
// `transparentColorKeyDataUrl` 에 통과시킨다(PNG 로드 → 캔버스 → 픽셀 색키 → toDataURL).
// 그 결과는 경로별로 세션 캐시에 남으므로, 유휴 시간에 같은 함수를 먼저 돌려 두면 다이얼로그는
// 캐시 히트로 즉시 채워진다. dev 서버가 public/ 을 `Cache-Control: no-cache` 로 내보내
// HTTP 캐시만 노린 워밍은 실측에서 200 재요청으로 되돌아왔다(17장/2.1초) — 그래서 JS 캐시를
// 노린다. 색키를 타지 않는 낱장 얼굴·아이콘·칩셋은 그림만 미리 받아 둔다.
//
// 무엇을 안 받는가: 몬스터/전투 스킨 아트(40MB+)와 업로드 dataUrl 은 제외한다. 앞의 것은
// 워밍 이득보다 대역폭 손해가 크고, 뒤의 것은 이미 메모리에 있다.

import { BUNDLED_EASYRPG_CHIPSET_ASSETS } from "@/assets/bundled";
import { CC0_ICON_ASSETS } from "@/assets/cc0IconAssets";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { FACESET_FACE_ASSETS } from "@/assets/facesetFaceAssets";
import { imageWarmSupported, normalizeWarmUrl, warmImageUrls } from "@/assets/imageWarmQueue";
import { transparentColorKeyDataUrl } from "@/assets/transparentColorKeyBackground";

export type EditorWarmupTier = "picker" | "library";

const TIER_ORDER: readonly EditorWarmupTier[] = ["picker", "library"];
const BACKGROUND_CONCURRENCY = 4;
const DEMAND_CONCURRENCY = 6;
const IDLE_FALLBACK_MS = 800;
const IDLE_TIMEOUT_MS = 3_000;

const tierWarms = new Map<EditorWarmupTier, Promise<void>>();
let backgroundScheduled = false;

export function editorWarmupUrls(tier: EditorWarmupTier): readonly string[] {
  const paths = tier === "picker" ? pickerCatalogPaths() : libraryCatalogPaths();
  return [...new Set(paths.map(normalizeWarmUrl))];
}

// 색키 처리를 미리 돌려 둘 캐릭셋 경로. 피커가 넘기는 경로 문자열과 **글자 그대로** 같아야
// 한다 — transparentColorKeyDataUrl 캐시 키가 경로 문자열이기 때문이다.
export function editorWarmupColorKeyPaths(): readonly string[] {
  return [...new Set(CHARSET_ASSETS.map((asset) => asset.path))];
}

// 편집기 부팅 직후 호출한다. 유휴 콜백으로 미루므로 첫 페인트와 경쟁하지 않는다.
export function scheduleEditorAssetWarmup(): void {
  if (backgroundScheduled) return;
  backgroundScheduled = true;
  if (!imageWarmSupported() || prefersReducedData()) return;
  onIdle(() => {
    void warmTiersInOrder();
  });
}

// 피커를 여는 상호작용(이벤트 편집기 열기 등) 직후 호출한다. 배경 워밍과 in-flight 를 공유한다.
export function warmEditorPickerAssets(): Promise<void> {
  return warmTier("picker", DEMAND_CONCURRENCY);
}

export function resetEditorAssetWarmup(): void {
  tierWarms.clear();
  backgroundScheduled = false;
}

async function warmTiersInOrder(): Promise<void> {
  for (const tier of TIER_ORDER) {
    await warmTier(tier, BACKGROUND_CONCURRENCY);
  }
}

function warmTier(tier: EditorWarmupTier, concurrency: number): Promise<void> {
  const existing = tierWarms.get(tier);
  if (existing !== undefined) return existing;
  const warm = tier === "picker"
    ? warmPickerTier(concurrency)
    : warmImageUrls(editorWarmupUrls(tier), { concurrency, priority: "low" });
  tierWarms.set(tier, warm);
  return warm;
}

async function warmPickerTier(concurrency: number): Promise<void> {
  await Promise.all([
    warmColorKeyPaths(editorWarmupColorKeyPaths(), concurrency),
    warmImageUrls(editorWarmupUrls("picker"), { concurrency, priority: "low" }),
  ]);
}

// 색키 처리는 캔버스 픽셀 루프 + PNG 재인코딩이라 CPU 를 쓴다 — 동시 처리 수를 묶어
// 편집기 입력이 끊기지 않게 한다.
async function warmColorKeyPaths(paths: readonly string[], concurrency: number): Promise<void> {
  const queue = [...paths];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (next === undefined) return;
      try {
        await transparentColorKeyDataUrl(next);
      } catch {
        // 워밍 실패는 무해하다 — 피커가 열릴 때 같은 경로로 다시 시도하고 폴백도 있다.
      }
    }
  });
  await Promise.all(workers);
}

function pickerCatalogPaths(): readonly string[] {
  return [
    ...FACESET_FACE_ASSETS.map((face) => face.path),
    ...BUNDLED_EASYRPG_CHIPSET_ASSETS.map((asset) => asset.path),
  ];
}

function libraryCatalogPaths(): readonly string[] {
  return CC0_ICON_ASSETS.map((asset) => asset.path);
}

type DataSaverConnection = {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
};

// 데이터 절약 모드/2G 에서는 배경 워밍이 사용자가 요청한 트래픽을 밀어낸다.
function prefersReducedData(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: DataSaverConnection }).connection;
  if (connection === undefined) return false;
  if (connection.saveData === true) return true;
  return connection.effectiveType === "slow-2g" || connection.effectiveType === "2g";
}

type IdleScheduler = (callback: () => void, options?: { readonly timeout: number }) => unknown;

function onIdle(run: () => void): void {
  const idle = (globalThis as { requestIdleCallback?: IdleScheduler }).requestIdleCallback;
  if (typeof idle === "function") {
    idle(run, { timeout: IDLE_TIMEOUT_MS });
    return;
  }
  globalThis.setTimeout(run, IDLE_FALLBACK_MS);
}
