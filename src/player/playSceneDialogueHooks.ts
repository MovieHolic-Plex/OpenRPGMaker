// player/playSceneDialogueHooks.ts — 대사 창이 맵 장면에 닿는 통로.
//
// 대사 UI(player/dialogue.ts)는 DOM 만 안다. 말풍선을 붙일 머리 위 한 점, [소리:…] 효과음,
// [화면흔들] 카메라 흔들기, 표정 이모트는 장면이 가진 것이라 여기서 콜백으로 건네준다.
//
// 「누가 말하나」 고르는 순서:
//   1. 화자 이름과 표시 이름이 같은 인물 프로필을 가진 이 맵의 이벤트
//   2. 화자 이름이 파티 선두의 이름이면 플레이어
//   3. 지금 실행 중인 이벤트(말을 건 NPC)
//   4. 그래도 없으면 플레이어
// 화면 좌표는 손 슬롯 칩(PlayScene.syncHandSlotChip)과 같은 식 — (월드 − 카메라 스크롤) × 배율.

import { spriteReliefLiftPx } from "@/player/playSceneRelief";
import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import { playSoundEffect } from "@/player/audio";
import { showSceneEmote } from "@/player/playSceneEmotes";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { EmoteKind } from "@/project/emotes";
import { store } from "@/project/store";

const HEAD_GAP_PX = 2;

export type DialogueSceneHooks = {
  readonly anchor: () => { readonly x: number; readonly y: number } | undefined;
  readonly speakerKey: string;
  readonly onSound: (soundId: string) => void;
  readonly onScreenShake: () => void;
  readonly onEmote: (emote: EmoteKind) => void;
};

export function dialogueSceneHooks(
  scene: PlaySceneContext,
  line: { readonly speaker?: string; readonly currentEventId?: string },
): DialogueSceneHooks {
  const target = speakingTarget(scene, line);
  const sprite = (): Phaser.GameObjects.Sprite | undefined =>
    target === "player" ? scene.player : scene.eventSprites.get(target);
  return {
    speakerKey: target,
    anchor: () => {
      const host = sprite();
      if (!host || !host.visible) return undefined;
      const camera = scene.cameras.main;
      const height = host.displayHeight > 0 ? host.displayHeight : TILE_SIZE;
      const worldY = host.y - height * host.originY - HEAD_GAP_PX - spriteReliefLiftPx(scene.map, host);
      return {
        x: (host.x - camera.scrollX) * camera.zoom,
        y: (worldY - camera.scrollY) * camera.zoom,
      };
    },
    onSound: (soundId) => {
      playSoundEffect(soundId, store.getCurrent());
    },
    onScreenShake: () => {
      scene.cameras.main.shake(220, 0.006);
    },
    onEmote: (emote) => {
      showSceneEmote(scene, target, emote);
    },
  };
}

function speakingTarget(
  scene: PlaySceneContext,
  line: { readonly speaker?: string; readonly currentEventId?: string },
): "player" | string {
  const project = store.getCurrent();
  const speaker = line.speaker?.trim();
  if (speaker) {
    for (const event of scene.map.events ?? []) {
      const id = event.characterId?.trim();
      if (id && project.characters?.[id]?.displayName?.trim() === speaker && scene.eventSprites.has(event.id)) return event.id;
    }
    const leaderId = scene.session.partyActorIds[0];
    const leader = leaderId ? project.database.actors.find((actor) => actor.id === leaderId) : undefined;
    const leaderName = leader ? scene.session.actorNames?.[leader.id] ?? leader.name : undefined;
    if (leaderName && leaderName.trim() === speaker) return "player";
  }
  if (line.currentEventId && scene.eventSprites.has(line.currentEventId)) return line.currentEventId;
  return "player";
}
