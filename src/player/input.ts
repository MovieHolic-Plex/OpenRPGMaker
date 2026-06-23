// player/input.ts
// 플레이어 키보드 입력 추상화. 이동(4방향) + 조사/확인 + UI 확인.
// 눌림 상태(지속)와 "방금 누름"(엣지)을 구분.

import type Phaser from "phaser";
import { getLoadedPhaser } from "@/app/phaserRuntime";

export type Dir = "down" | "left" | "right" | "up";

export interface InputState {
  dir: Dir | null; // 현재 눌린 방향(우선순위: 마지막 눌린 것)
  actionPressed: boolean; // 이번 프레임에 action(조사) 엣지
  confirmPressed: boolean; // 이번 프레임에 confirm(대사 진행) 엣지
}

export class Input {
  private readonly PhaserRuntime = getLoadedPhaser();
  private keys: Partial<Record<string, Phaser.Input.Keyboard.Key>> = {};
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private priority: Dir[] = []; // 눌린 순서
  private actionConsumed = false;
  private confirmConsumed = false;

  // action/confirm 엣지를 이벤트 기반으로 추적.
  // Phaser의 JustDown(폴링)은 headless/프레임 타이밍에 따라 keydown↔update
  // 정렬이 어긋나 엣지를 놓칠 수 있다. keydown 리스너로 직접 엣지를 잡아
  // 큐에 담고 update에서 소비하면 타이밍에 강해진다.
  private pendingActionEdge = false;
  // 자동화용 주입 방향(실제 키보드와 병합).
  private injectedDir: Dir | null = null;

  // 활성/비활성 토글(인터프리터 실행 중엔 입력 차단).
  private enabled = true;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys("W,A,S,D,SPACE,ENTER,E") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    // action/confirm 키의 keydown을 이벤트로 직접 잡는다.
    // JustDown 폴링의 프레임 정렬 문제를 회피하기 위함.
    const actionCodes = new Set([
      this.PhaserRuntime.Input.Keyboard.KeyCodes.SPACE,
      this.PhaserRuntime.Input.Keyboard.KeyCodes.ENTER,
      this.PhaserRuntime.Input.Keyboard.KeyCodes.E,
    ]);
    kb.on("keydown", (event: KeyboardEvent) => {
      if (actionCodes.has(event.keyCode)) {
        this.pendingActionEdge = true;
      }
    });
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) {
      this.priority = [];
    }
  }

  // 매 프레임 호출. 엣지 이벤트 갱신.
  update(): InputState {
    if (!this.enabled) {
      this.pendingActionEdge = false;
      return { dir: null, actionPressed: false, confirmPressed: false };
    }

    // 현재 눌린 방향들 수집(우선순위: 위/아래 > 좌/우 관례 → 여기선 마지막 눌림).
    const downSet = new Set<Dir>();
    if (this.isDown("up")) downSet.add("up");
    if (this.isDown("down")) downSet.add("down");
    if (this.isDown("left")) downSet.add("left");
    if (this.isDown("right")) downSet.add("right");
    // 자동화 주입 방향 병합.
    if (this.injectedDir) downSet.add(this.injectedDir);

    // priority에서 떼진 건 제거.
    this.priority = this.priority.filter((d) => downSet.has(d));
    // 새로 눌린 건 뒤에 추가.
    for (const d of downSet) {
      if (!this.priority.includes(d)) this.priority.push(d);
    }
    const dir = this.priority.length > 0 ? this.priority[this.priority.length - 1] : null;

    // action/confirm 엣지: 이벤트 기반(keydown 리스너) 큐에서 소비.
    // JustDown(폴링)은 headless/프레임 타이밍에 취약하므로 직접 잡은 엣지를 쓴다.
    const actionEdge = this.pendingActionEdge;
    this.pendingActionEdge = false;

    const state: InputState = {
      dir,
      actionPressed: actionEdge && !this.actionConsumed,
      confirmPressed: actionEdge && !this.confirmConsumed,
    };
    if (state.actionPressed) this.actionConsumed = true;
    if (state.confirmPressed) this.confirmConsumed = true;
    return state;
  }

  // 엣지 소비 후 리셋(다음 눌름을 다시 잡기 위해).
  resetEdges(): void {
    this.actionConsumed = false;
    this.confirmConsumed = false;
    // 소비되지 않은 action 엣지도 인터프리터 진입/종료 시점에 비운다.
    // (confirm 소비 후 남은 actionEdge가 다음 프레임에 중복 트리거되는 것 방지)
    this.pendingActionEdge = false;
  }

  // 테스트/자동화용 입력 주입. headless 환경에서는 window keydown이
  // Phaser keyboard 매니저까지 도달하지 않아 정상 입력이 안 잡힌다.
  // 테스트는 이 메서드로 action 엣지를 직접 주입할 수 있다.
  // 실제 브라우저에서는 keydown 리스너가 정상 동작하므로 이 경로를 쓰지 않는다.
  injectActionEdge(): void {
    this.pendingActionEdge = true;
  }

  // 방향 지속 입력 주입(자동화용). dir을 눌린 상태로 설정한다.
  // null이면 모든 방향을 뗀다.
  // 주입된 방향은 실제 키보드 isDown과 병합되어 update에서 downSet에 포함된다.
  injectDirection(dir: Dir | null): void {
    this.injectedDir = dir;
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
