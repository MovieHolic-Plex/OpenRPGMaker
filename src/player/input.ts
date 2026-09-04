// player/input.ts
// 플레이어 키보드 입력 추상화. 이동(4방향) + 조사/확인 + UI 확인.
// 눌림 상태(지속)와 "방금 누름"(엣지)을 구분.

import type Phaser from "phaser";

import {
  type Dir,
  directionForKey,
  isAttackKey,
  isConfirmKey,
  isDashKey,
  isGuardKey,
  isSkillCycleKey,
  isSkillKey,
  normalizeKey,
} from "@/player/keyBindings";

export type { Dir };

export type Axis = -1 | 0 | 1;

export interface InputState {
  dir: Dir | null; // 스프라이트 facing(4방향, 수평 우선)
  x: Axis; // 수평 이동 성분(-1 좌 / 0 / 1 우)
  y: Axis; // 수직 이동 성분(-1 상 / 0 / 1 하)
  dash: boolean; // 대시(Shift) 유지 여부
  actionPressed: boolean; // 이번 프레임에 action(조사) 엣지
  confirmPressed: boolean; // 이번 프레임에 confirm(대사 진행) 엣지
  attackPressed: boolean; // 이번 프레임에 attack(액션 전투 스윙) 엣지. attackMode에서 Space가 이쪽으로 라우팅된다.
  skillPressed: boolean; // 이번 프레임에 skill(Q — 액션 스킬 캐스트) 엣지
}

// 눌린 방향 우선순위 목록(오래된→최근)에서 8방향 이동 의도를 해석한다.
// - 수평/수직 각각 "가장 최근에 눌린" 방향을 축 성분으로 채택(반대 키가 나중에
//   눌리면 그쪽을 따름).
// - facing 은 RM 관례상 수평 우선: 대각선이면 수평 방향을 바라본다.
export interface MovementIntent {
  readonly dir: Dir | null;
  readonly x: Axis;
  readonly y: Axis;
}

export function resolveMovementIntent(priority: readonly Dir[]): MovementIntent {
  let horizontal: Dir | null = null;
  let vertical: Dir | null = null;
  for (const d of priority) {
    if (d === "left" || d === "right") horizontal = d;
    else vertical = d;
  }
  const x: Axis = horizontal === "right" ? 1 : horizontal === "left" ? -1 : 0;
  const y: Axis = vertical === "down" ? 1 : vertical === "up" ? -1 : 0;
  return { dir: horizontal ?? vertical, x, y };
}

export interface ResolvedStep {
  readonly dx: Axis;
  readonly dy: Axis;
}

// 대각선 통행/미끄러짐 판정(순수). canStep(dx,dy)=현재 칸에서 (dx,dy) 칸으로 갈 수 있나?
// - 직교 입력: 해당 칸이 열려있으면 이동, 아니면 null.
// - 대각선 입력: 양쪽 직교 칸이 모두 열리고 **대각선 목적지 자체도** 열려야 대각선 이동.
//   목적지 검사가 빠지면 두 직교가 열린 코너에서 통행 불가 칸으로 들어가는 코너컷이 난다.
//   한쪽만 막히면 가능한 직교 방향으로 미끄러지고, 둘 다 막히면 null.
export function resolveDiagonalStep(
  x: Axis,
  y: Axis,
  canStep: (dx: number, dy: number) => boolean
): ResolvedStep | null {
  if (x === 0 && y === 0) return null;
  if (x !== 0 && y !== 0) {
    const horiz = canStep(x, 0);
    const vert = canStep(0, y);
    if (horiz && vert && canStep(x, y)) return { dx: x, dy: y };
    if (horiz) return { dx: x, dy: 0 };
    if (vert) return { dx: 0, dy: y };
    return null;
  }
  return canStep(x, y) ? { dx: x, dy: y } : null;
}

// 이동 성분 → 4방향 facing(수평 우선).
export function facingForStep(dx: number, dy: number): Dir {
  if (dx !== 0) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

export class RuntimeKeyHoldTracker {
  private readonly actionKeys = new Set<string>();
  private readonly skillKeys = new Set<string>();
  private readonly guardKeys = new Set<string>();
  private readonly directions = new Set<Dir>();
  // 마지막 소비 이후 **새로 눌린** 방향. 눌렀다 뗀 키도 남는다 — 방향 입력의 「엣지」다.
  // 눌림(directions)만 보면 한 프레임 사이에 끝난 탭은 update 가 한 번도 못 본다. 브라우저 실측
  // (2026-09-03): 즉시 탭 4회 → 1칸, 같은 태스크 안 dir(down)→dir(null) → 0칸. 프레임이 늘어지는
  // 기계에서는 사람의 짧은 탭도 이렇게 사라져 「될 때도 안 될 때도 있다」가 된다.
  private readonly tappedDirections = new Set<Dir>();
  private pendingActionEdge = false;
  private pendingAttackEdge = false;
  private pendingSkillEdge = false;
  private pendingSkillCycleEdge = false;
  private attackMode = false;
  private dashHeld = false;

  setAttackMode(enabled: boolean): void {
    this.attackMode = enabled;
    if (!enabled) this.pendingAttackEdge = false;
  }

  // repeat=true 는 OS 키 리피트다. 눌린 상태는 이미 기록돼 있으므로 엣지를 만들지 않는다.
  // 조사/공격은 actionKeys 로 이미 막혀 있었지만 스킬(Q)만 가드가 없어 누르고 있으면
  // 리피트 속도로 연사되던 결함(적대 리뷰 9)의 수정 지점.
  keyDown(key: string, repeat = false): void {
    if (repeat) return;
    if (isDashKey(key)) this.dashHeld = true;
    const normalized = normalizeKey(key);
    if (isSkillKey(key)) {
      if (!this.skillKeys.has(normalized)) this.pendingSkillEdge = true;
      this.skillKeys.add(normalized);
    }
    if (isSkillCycleKey(key)) this.pendingSkillCycleEdge = true;
    if (isGuardKey(key)) this.guardKeys.add(normalized);
    if (isConfirmKey(key)) {
      if (!this.actionKeys.has(normalized)) {
        // 액션 전투 맵에서는 확인 키 하나가 조사와 공격을 겸한다. 정면에 조사 대상이
        // 있으면 조사하고, 없으면 스윙한다(판정은 playSceneMovement). Space 만 공격이고
        // Z 는 조사로 남던 반쪽 라우팅이 결함이었다(적대 리뷰 10).
        this.pendingActionEdge = true;
        if (this.attackMode && isAttackKey(key)) this.pendingAttackEdge = true;
      }
      this.actionKeys.add(normalized);
    }
    const dir = directionForKey(key);
    if (dir) {
      this.directions.add(dir);
      this.noteDirectionTap(dir);
    }
  }

  /**
   * 방향 엣지만 남긴다(눌림 집합은 건드리지 않는다). 자동화 주입은 눌림을 `injectedDir` 로 따로
   * 들고 있어서 여기서 눌림까지 더하면 놓을 길이 없어 영원히 걷는다(프로브 실측: 탭 4회 → 6칸).
   */
  noteDirectionTap(dir: Dir): void {
    this.tappedDirections.add(dir);
  }

  keyUp(key: string): void {
    if (isDashKey(key)) this.dashHeld = false;
    const normalized = normalizeKey(key);
    if (isConfirmKey(key)) this.actionKeys.delete(normalized);
    if (isSkillKey(key)) this.skillKeys.delete(normalized);
    if (isGuardKey(key)) this.guardKeys.delete(normalized);
    const dir = directionForKey(key);
    if (dir) this.directions.delete(dir);
  }

  // 창이 포커스를 잃으면 keyup 이 오지 않는다. 눌림 상태를 전부 털어내지 않으면
  // 돌아왔을 때 캐릭터가 혼자 걷거나 대시가 고착된다(적대 리뷰 3).
  releaseAll(): void {
    this.actionKeys.clear();
    this.skillKeys.clear();
    this.guardKeys.clear();
    this.directions.clear();
    this.tappedDirections.clear();
    this.dashHeld = false;
    this.pendingActionEdge = false;
    this.pendingAttackEdge = false;
    this.pendingSkillEdge = false;
    this.pendingSkillCycleEdge = false;
  }

  isGuarding(): boolean {
    return this.guardKeys.size > 0;
  }

  consumeSkillCycleEdge(): boolean {
    const edge = this.pendingSkillCycleEdge;
    this.pendingSkillCycleEdge = false;
    return edge;
  }

  isDashing(): boolean {
    return this.dashHeld;
  }

  consumeActionEdge(): boolean {
    const edge = this.pendingActionEdge;
    this.pendingActionEdge = false;
    return edge;
  }

  consumeAttackEdge(): boolean {
    const edge = this.pendingAttackEdge;
    this.pendingAttackEdge = false;
    return edge;
  }

  consumeSkillEdge(): boolean {
    const edge = this.pendingSkillEdge;
    this.pendingSkillEdge = false;
    return edge;
  }

  injectSkillEdge(): void {
    this.pendingSkillEdge = true;
  }

  injectAttackEdge(): void {
    this.pendingAttackEdge = true;
  }

  clearPendingActionEdge(): void {
    this.pendingActionEdge = false;
    this.pendingAttackEdge = false;
    this.pendingSkillEdge = false;
  }

  heldDirections(): readonly Dir[] {
    return [...this.directions];
  }

  /**
   * 마지막 소비 이후 눌린 방향을 꺼내고 비운다. 뗀 키도 한 번은 나온다.
   * 보관하는 경로는 없다 — RPG Maker 처럼 걷는 중에 온 탭은 그 프레임에 소비되고 버려진다.
   * (예전 peek/미루기 경로는 걸음 이어 붙이기와 겹쳐 래치가 영영 남아 키를 떼도 걷게 했다.)
   */
  takeTappedDirections(): readonly Dir[] {
    const tapped = [...this.tappedDirections];
    this.tappedDirections.clear();
    return tapped;
  }

  clearTappedDirections(): void {
    this.tappedDirections.clear();
  }
}

export class Input {
  private keys: Partial<Record<string, Phaser.Input.Keyboard.Key>> = {};
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private priority: Dir[] = []; // 눌린 순서
  private actionConsumed = false;
  private confirmConsumed = false;
  private attackConsumed = false;

  // action/confirm 엣지를 이벤트 기반으로 추적.
  // Phaser의 JustDown(폴링)은 headless/프레임 타이밍에 따라 keydown↔update
  // 정렬이 어긋나 엣지를 놓칠 수 있다. keydown 리스너로 직접 엣지를 잡아
  // 큐에 담고 update에서 소비하면 타이밍에 강해진다.
  private readonly runtimeKeys = new RuntimeKeyHoldTracker();
  // 자동화용 주입 방향(실제 키보드와 병합).
  private injectedDir: Dir | null = null;

  // 활성/비활성 토글(인터프리터 실행 중엔 입력 차단).
  private enabled = true;
  private readonly onDocumentKeyDown = (event: KeyboardEvent): void => {
    this.captureRuntimeKeyDown(event);
  };
  private readonly onDocumentKeyUp = (event: KeyboardEvent): void => {
    this.captureRuntimeKeyUp(event);
  };
  // 포커스를 잃으면 keyup 을 못 받는다 — 눌림 상태를 즉시 턴다.
  private readonly onWindowBlur = (): void => {
    this.releaseAllKeys();
  };
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") this.releaseAllKeys();
  };

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys("W,A,S,D,SPACE,ENTER,E") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    kb.on("keydown", (event: KeyboardEvent) => {
      this.captureRuntimeKeyDown(event);
    });
    kb.on("keyup", (event: KeyboardEvent) => {
      this.captureRuntimeKeyUp(event);
    });
    document.addEventListener("keydown", this.onDocumentKeyDown);
    document.addEventListener("keyup", this.onDocumentKeyUp);
    window.addEventListener("blur", this.onWindowBlur);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    const detach = (): void => {
      document.removeEventListener("keydown", this.onDocumentKeyDown);
      document.removeEventListener("keyup", this.onDocumentKeyUp);
      window.removeEventListener("blur", this.onWindowBlur);
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
    };
    scene.events.once("destroy", detach);
    scene.events.once("shutdown", detach);
  }

  private captureRuntimeKeyDown(event: KeyboardEvent): void {
    this.runtimeKeys.keyDown(event.key, event.repeat);
  }

  private captureRuntimeKeyUp(event: KeyboardEvent): void {
    this.runtimeKeys.keyUp(event.key);
  }

  // 포커스 이탈 시 눌림 상태 해제. 주입 방향과 priority 까지 함께 비운다.
  releaseAllKeys(): void {
    this.runtimeKeys.releaseAll();
    this.priority = [];
    this.injectedDir = null;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    this.runtimeKeys.clearPendingActionEdge();
    // 닫히는 순간과 열리는 순간 모두 비운다 — 이벤트·전투 중에 누른 방향이 끝난 뒤 한 걸음을
    // 만들면 안 된다. 계속 누르고 있는 키는 눌림(directions)으로 남아 열린 뒤 그대로 걷는다.
    this.runtimeKeys.clearTappedDirections();
    if (!v) {
      this.priority = [];
    }
  }

  /** 메뉴가 열린 동안 쌓인 방향 탭을 버린다 — 닫힌 순간 유령 걸음이 나가지 않게. */
  clearDirectionTaps(): void {
    this.runtimeKeys.clearTappedDirections();
  }

  // 액션 전투 활성 맵에서 Space를 조사(action) 대신 공격(attack) 엣지로 라우팅한다.
  setAttackMode(enabled: boolean): void {
    this.runtimeKeys.setAttackMode(enabled);
  }

  // 매 프레임 호출. 엣지 이벤트 갱신. RPG Maker 의 Input.update 처럼 「지금 눌림」을 읽고, 프레임 사이에
  // 시작하고 끝난 탭만 한 번 눌림으로 보충한다. 미루기는 없다 — 걷는 중에 온 입력은 그 프레임에 소비된다.
  update(): InputState {
    if (!this.enabled) {
      this.runtimeKeys.clearPendingActionEdge();
      this.runtimeKeys.clearTappedDirections();
      return { dir: null, x: 0, y: 0, dash: false, actionPressed: false, confirmPressed: false, attackPressed: false, skillPressed: false };
    }

    // 현재 눌린 방향들 수집(우선순위: 위/아래 > 좌/우 관례 → 여기선 마지막 눌림).
    const downSet = new Set<Dir>();
    if (this.isDown("up")) downSet.add("up");
    if (this.isDown("down")) downSet.add("down");
    if (this.isDown("left")) downSet.add("left");
    if (this.isDown("right")) downSet.add("right");
    for (const dir of this.runtimeKeys.heldDirections()) {
      downSet.add(dir);
    }
    // 눌렀다 뗀 방향도 이번 프레임에서는 눌림으로 친다(1회 엣지).
    for (const dir of this.runtimeKeys.takeTappedDirections()) downSet.add(dir);
    // 자동화 주입 방향 병합.
    if (this.injectedDir) downSet.add(this.injectedDir);

    // priority에서 떼진 건 제거.
    this.priority = this.priority.filter((d) => downSet.has(d));
    // 새로 눌린 건 뒤에 추가.
    for (const d of downSet) {
      if (!this.priority.includes(d)) this.priority.push(d);
    }
    // 8방향 이동 의도 해석(수평/수직 축 성분 + 수평 우선 facing).
    const intent = resolveMovementIntent(this.priority);
    const dash = this.runtimeKeys.isDashing() || (this.cursors?.shift?.isDown ?? false);

    // action/confirm 엣지: 이벤트 기반(keydown 리스너) 큐에서 소비.
    // JustDown(폴링)은 headless/프레임 타이밍에 취약하므로 직접 잡은 엣지를 쓴다.
    const actionEdge = this.runtimeKeys.consumeActionEdge();
    const attackEdge = this.runtimeKeys.consumeAttackEdge();
    const skillEdge = this.runtimeKeys.consumeSkillEdge();

    const state: InputState = {
      dir: intent.dir,
      x: intent.x,
      y: intent.y,
      dash,
      actionPressed: actionEdge && !this.actionConsumed,
      confirmPressed: actionEdge && !this.confirmConsumed,
      attackPressed: attackEdge && !this.attackConsumed,
      skillPressed: skillEdge,
    };
    if (state.actionPressed) this.actionConsumed = true;
    if (state.confirmPressed) this.confirmConsumed = true;
    if (state.attackPressed) this.attackConsumed = true;
    return state;
  }

  // 엣지 소비 후 리셋(다음 눌름을 다시 잡기 위해).
  resetEdges(): void {
    this.actionConsumed = false;
    this.confirmConsumed = false;
    this.attackConsumed = false;
    // 소비되지 않은 action 엣지도 인터프리터 진입/종료 시점에 비운다.
    // (confirm 소비 후 남은 actionEdge가 다음 프레임에 중복 트리거되는 것 방지)
    this.runtimeKeys.clearPendingActionEdge();
  }

  // 테스트/자동화용 입력 주입. headless 환경에서는 window keydown이
  // Phaser keyboard 매니저까지 도달하지 않아 정상 입력이 안 잡힌다.
  // 테스트는 이 메서드로 action 엣지를 직접 주입할 수 있다.
  // 실제 브라우저에서는 keydown 리스너가 정상 동작하므로 이 경로를 쓰지 않는다.
  injectActionEdge(): void {
    this.runtimeKeys.keyDown("Enter");
    this.runtimeKeys.keyUp("Enter");
  }

  // 자동화용 공격 엣지 주입.
  injectAttackEdge(): void {
    this.runtimeKeys.injectAttackEdge();
  }

  // 자동화용 스킬 엣지 주입.
  injectSkillEdge(): void {
    this.runtimeKeys.injectSkillEdge();
  }

  // 액션 전투 슬롯 순환 엣지. update() 가 아니라 액션 전투 갱신이 직접 소모한다 —
  // 이동/조사 경로와 서로 엣지를 모이지 않게 나눠 둔다.
  // 입력이 닫힌 동안(인터프리터 진행) 대기한 엣지는 버린다.
  consumeSkillCycleEdge(): boolean {
    const edge = this.runtimeKeys.consumeSkillCycleEdge();
    return this.enabled ? edge : false;
  }

  // 가드 키가 누렸는가(지속). 입력이 닫힐 동안은 가드도 서지 않는다.
  isGuardHeld(): boolean {
    return this.enabled && this.runtimeKeys.isGuarding();
  }

  // 방향 지속 입력 주입(자동화용). dir을 눌린 상태로 설정한다.
  // null이면 모든 방향을 뗀다.
  // 주입된 방향은 실제 키보드 isDown과 병합되어 update에서 downSet에 포함된다.
  injectDirection(dir: Dir | null): void {
    this.injectedDir = dir;
    // 키보드와 같은 계약: 주입도 눌림 엣지를 남겨 같은 태스크 안의 dir(d)→dir(null) 이 한 걸음이 된다.
    if (dir) this.runtimeKeys.noteDirectionTap(dir);
  }

  private isDown(dir: Dir): boolean {
    const c = this.cursors;
    if (!c) return false;
    switch (dir) {
      case "up":
        return c.up.isDown || this.keyDown("W");
      case "down":
        return c.down.isDown || this.keyDown("S");
      case "left":
        return c.left.isDown || this.keyDown("A");
      case "right":
        return c.right.isDown || this.keyDown("D");
    }
  }

  private keyDown(name: string): boolean {
    return this.keys[name]?.isDown ?? false;
  }
}

// 키 판정은 전부 keyBindings 정본에 위임한다. 이 별칭은 기존 import 경로 호환용.
export { directionForKey as directionForRuntimeKey } from "@/player/keyBindings";
