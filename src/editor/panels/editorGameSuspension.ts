// editor/panels/editorGameSuspension.ts
// 테스트 플레이 창이 열린 동안 **편집기 Phaser 게임**을 잠재운다.
//
// 왜: 테스트 플레이 창은 편집기 위에 겹쳐 뜨는 모달이라, 그 뒤에서 EditScene 이 자기 RAF 루프로
// 매 프레임 맵 전체를 계속 그린다. WebGL 컨텍스트 둘이 같은 GPU·메인 스레드를 나눠 쓰니 플레이
// 프레임이 늘어지고, 편집기 게임의 KeyboardManager 는 창 전역 keydown 을 계속 받아 캡처 키에
// preventDefault 를 건다. 플레이 중에는 어느 쪽도 필요 없다.
//
// 잠재우기는 loop.sleep() (RAF 정지) + 키보드 매니저 비활성이다. 키보드를 그대로 두면 잠든 동안
// 이벤트가 큐에 쌓여 깨어나는 순간 한꺼번에 EditScene 단축키로 쏟아진다.
//
// 게임 접근자는 `src/app/mode.ts` 가 부팅 때 주입한다 — 이 모듈이 `@/app/mode` 를 직접 끌어오면
// 테스트 플레이 창을 여는 모든 단위 테스트가 편집기 셸 전체(store·project storage)를 적재하게 된다.

type SuspendableGame = {
  /** Phaser.Game.isRunning — destroy 뒤 false. 잠든 사이 파괴된 게임은 깨우지 않는다. */
  readonly isRunning?: boolean;
  readonly loop: { readonly running: boolean; sleep(): void; wake(seamless?: boolean): void };
  readonly input?: { readonly keyboard?: { enabled: boolean } | null } | null;
  readonly scale?: { refresh(): unknown } | null;
};

type Suspension = {
  readonly game: SuspendableGame;
  readonly keyboardEnabled: boolean;
  readonly wasRunning: boolean;
};

let suspension: Suspension | null = null;
let editorGameAccessor: () => unknown = () => null;

/** 편집기 셸이 현재 편집기 Phaser 게임을 돌려주는 함수를 건다. 안 걸면 잠재우기는 no-op 다. */
export function configureEditorGameAccessor(accessor: () => unknown): void {
  editorGameAccessor = accessor;
}

export function suspendEditorGame(): void {
  if (suspension) return;
  const game = editorGameAccessor() as SuspendableGame | null;
  if (!game?.loop) return;
  const keyboard = game.input?.keyboard ?? null;
  suspension = {
    game,
    keyboardEnabled: keyboard?.enabled ?? true,
    wasRunning: game.loop.running,
  };
  if (keyboard) keyboard.enabled = false;
  if (game.loop.running) game.loop.sleep();
  publishSuspensionFlag();
}

export function resumeEditorGame(): void {
  const current = suspension;
  suspension = null;
  if (!current) return;
  const { game } = current;
  // 잠든 사이 편집기가 내려가 게임이 파괴됐으면(모드 전환·프로젝트 교체) 깨울 것이 없다 —
  // 파괴된 루프를 다시 돌리면 destroy 된 씬을 step 하다 던진다.
  if (game.isRunning === false) {
    publishSuspensionFlag();
    return;
  }
  const keyboard = game.input?.keyboard ?? null;
  if (keyboard) keyboard.enabled = current.keyboardEnabled;
  // seamless=true: 잠든 시간을 델타에서 빼서 트윈·타이머가 한 번에 뛰지 않게 한다.
  if (current.wasRunning && !game.loop.running) game.loop.wake(true);
  // 잠든 동안 창 크기가 바뀌었을 수 있다(RESIZE 모드).
  game.scale?.refresh();
  publishSuspensionFlag();
}

/** e2e 가 읽는 관측점 — 편집기 게임이 지금 잠들어 있는가. */
function publishSuspensionFlag(): void {
  if (typeof window === "undefined") return;
  Reflect.set(window, "__oprnEditorGameSuspended", suspension !== null);
}

export function isEditorGameSuspended(): boolean {
  return suspension !== null;
}

export function _resetEditorGameSuspensionForTest(): void {
  suspension = null;
  editorGameAccessor = () => null;
}
