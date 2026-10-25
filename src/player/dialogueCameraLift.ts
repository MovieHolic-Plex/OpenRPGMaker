// 대화 중 인물 보이기 — system.dialogueKeepActorsVisible.
//
// 필드에서 대사창(아래)과 선택지 창(가운데)이 함께 뜨면 화면 아래 절반이 덮인다. 카메라는 주인공을 화면 가운데에
// 두므로, 마주 서서 말하는 두 사람이 창 뒤로 숨는다(시타마치 VQA after: 전철·센토·사무소·옥상 고백 장면 모두
// 선택지 상자 위로 머리 끝 몇 화소만 보였다). 이 설정을 켜면 창이 떠 있는 동안 카메라 추적 오프셋을 내려
// 주인공을 창 위 빈 화면 가운데쯤에 둔다. 창이 닫히면 오프셋을 0 으로 되돌린다(추적 러프 0.2 가 부드럽게 옮긴다).
//
// 카메라가 주인공을 따르지 않을 때(컷신 고정·이동 연출)는 건드리지 않는다. 맵 아래 끝이나 화면보다 작은 방에서는
// 카메라 경계가 이동을 막으므로, 걸어 둔 동안만 경계 아래쪽을 같은 만큼 늘린다(늘어난 곳은 대사창 밑이라 보이지 않는다).
// 되돌릴 때는 그 사이 다른 코드(맵 이동의 syncRuntimeCameraBounds)가 경계를 바꾸지 않았을 때만 원래 경계로 돌린다.

/** 창이 덮기 시작하는 높이(화면 비율 0~1)가 주어졌을 때 카메라 중심을 주인공보다 얼마나 아래로 둘지(월드 px). */
export function dialogueLiftWorldPx(input: {
  readonly coverTopFraction: number;
  readonly worldViewHeight: number;
}): number {
  const cover = input.coverTopFraction;
  // 창이 화면 아래 15% 안쪽만 덮거나(작은 말풍선) 위쪽에 붙은 창이면 옮길 이유가 없다.
  if (!Number.isFinite(cover) || cover >= 0.85 || cover <= 0.15) return 0;
  // 빈 띠 [0, cover] 의 가운데보다 조금 아래(발이 띠 안에 들어오게). 너무 위로 올리지는 않는다.
  const desired = Math.max(0.2, cover * 0.55);
  return Math.max(0, (0.5 - desired) * input.worldViewHeight);
}

type Bounds = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
type LiftCamera = {
  readonly worldView: { readonly height: number };
  readonly followOffset: { readonly y: number };
  setFollowOffset(x?: number, y?: number): unknown;
  getBounds?(): Bounds;
  setBounds?(x: number, y: number, width: number, height: number): unknown;
};

/** 카메라마다 늘리기 전 경계와 늘린 경계. */
const extendedBounds = new WeakMap<object, { readonly original: Bounds; readonly extended: Bounds }>();

function sameBounds(a: Bounds, b: Bounds): boolean {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 && Math.abs(a.width - b.width) < 0.01 && Math.abs(a.height - b.height) < 0.01;
}

function extendBoundsDown(camera: LiftCamera, by: number): void {
  if (!camera.getBounds || !camera.setBounds) return;
  const current = camera.getBounds();
  const prior = extendedBounds.get(camera);
  const original = prior && sameBounds(prior.extended, current) ? prior.original : current;
  const extended = { x: original.x, y: original.y, width: original.width, height: original.height + Math.ceil(by) };
  if (!sameBounds(current, extended)) camera.setBounds(extended.x, extended.y, extended.width, extended.height);
  extendedBounds.set(camera, { original, extended });
}

function restoreBounds(camera: LiftCamera): void {
  const prior = extendedBounds.get(camera);
  extendedBounds.delete(camera);
  if (!prior || !camera.getBounds || !camera.setBounds) return;
  if (sameBounds(camera.getBounds(), prior.extended)) {
    camera.setBounds(prior.original.x, prior.original.y, prior.original.width, prior.original.height);
  }
}

type LiftScene = {
  readonly cameras: { readonly main: LiftCamera };
  readonly player: unknown;
  readonly game: { readonly canvas?: HTMLCanvasElement | null };
};

/** 덮개(대사창·선택지 창)의 가장 위 화면 y(px). 없으면 undefined. */
function coverTopPx(host: HTMLElement): number | undefined {
  let top: number | undefined;
  const nodes = host.querySelectorAll<HTMLElement>(".dialogue-overlay .dialogue-box, [data-testid='runtime-choices']");
  for (const node of nodes) {
    if (node.dataset.dialoguePhase === "exit") continue;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    top = top === undefined ? rect.top : Math.min(top, rect.top);
  }
  return top;
}

/**
 * 프레임마다 부른다. 설정이 꺼져 있으면 아무것도 하지 않는다. 이 함수가 건 오프셋만 되돌린다(lifted 상태를 돌려준다).
 */
export function syncDialogueCameraLift(
  scene: LiftScene,
  host: HTMLElement | undefined,
  enabled: boolean,
  lifted: boolean,
): boolean {
  const camera = scene.cameras.main;
  const following = (camera as unknown as { _follow?: unknown })._follow === scene.player;
  let target = 0;
  if (enabled && host && following) {
    const top = coverTopPx(host);
    const canvas = scene.game.canvas;
    if (top !== undefined && canvas) {
      const rect = canvas.getBoundingClientRect();
      if (rect.height > 0) {
        target = dialogueLiftWorldPx({ coverTopFraction: (top - rect.top) / rect.height, worldViewHeight: camera.worldView.height });
      }
    }
  }
  if (target > 0) {
    // Phaser: 카메라 중심 = 대상 - followOffset. 중심을 아래로 내리려면 음수.
    extendBoundsDown(camera, target);
    if (Math.abs(camera.followOffset.y + target) > 0.5) camera.setFollowOffset(0, -target);
    return true;
  }
  if (lifted) {
    camera.setFollowOffset(0, 0);
    restoreBounds(camera);
  }
  return false;
}
