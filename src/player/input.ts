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
      return { dir: null, actionPressed: false, confirmPressed: false };
    }

    // 현재 눌린 방향들 수집(우선순위: 위/아래 > 좌/우 관례 → 여기선 마지막 눌림).
    const downSet = new Set<Dir>();
    if (this.isDown("up")) downSet.add("up");
    if (this.isDown("down")) downSet.add("down");
    if (this.isDown("left")) downSet.add("left");
    if (this.isDown("right")) downSet.add("right");

    // priority에서 떼진 건 제거.
    this.priority = this.priority.filter((d) => downSet.has(d));
    // 새로 눌린 건 뒤에 추가.
    for (const d of downSet) {
      if (!this.priority.includes(d)) this.priority.push(d);
    }
    const dir = this.priority.length > 0 ? this.priority[this.priority.length - 1] : null;

    // action/confirm 엣지.
    const actionDown = this.justDown("SPACE") || this.justDown("ENTER") || this.justDown("E");
    const confirmDown = actionDown; // 동일 키.

    const state: InputState = {
      dir,
      actionPressed: actionDown && !this.actionConsumed,
      confirmPressed: confirmDown && !this.confirmConsumed,
    };
    if (state.actionPressed) this.actionConsumed = true;
    if (state.confirmPressed) this.confirmConsumed = true;
    return state;
  }

  // 엣지 소비 후 리셋(다음 눌름을 다시 잡기 위해).
  resetEdges(): void {
    this.actionConsumed = false;
    this.confirmConsumed = false;
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

  private justDown(name: string): boolean {
    const key = this.keys[name];
    return key ? this.PhaserRuntime.Input.Keyboard.JustDown(key) : false;
  }
}
