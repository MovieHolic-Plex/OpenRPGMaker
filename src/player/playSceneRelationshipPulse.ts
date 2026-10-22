/**
 * 관계 중심(연애) 게임에서 호감이 바뀐 순간을 화면 오른쪽 위에 짧게 알린다 — 「♥ 강지후 · 호감이 올랐다」.
 *
 * 왜: 선택지 직후 하트 이모트만으로는 무엇이 바뀌었는지 플레이어가 놓친다(첫사랑 VQA 3차).
 * 관계 메뉴를 쓰지 않는 게임(일반 RPG 의 호감 수치)은 지금처럼 조용하다. 대사 진행을 막지 않는다.
 */
import { dialogueHost } from "@/player/playSceneDom";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { usesRelationshipMenu } from "@/project/relationshipMenu";
import { friendshipDisplayName } from "@/project/friendship";
import { store } from "@/project/store";

const PULSE_MS = 3200;

export function showRelationshipPulse(scene: PlaySceneContext, npcKey: string, delta: number): void {
  if (!Number.isFinite(delta) || delta === 0) return;
  const project = store.getCurrent();
  if (!usesRelationshipMenu(project)) return;
  const host = dialogueHost(scene);
  if (!host) return;
  const name = friendshipDisplayName(project, npcKey) ?? project.characters?.[npcKey]?.displayName ?? npcKey;
  host.querySelector("[data-testid='relationship-pulse']")?.remove();
  const up = delta > 0;
  const pulse = document.createElement("div");
  pulse.className = `relationship-pulse ${up ? "is-up" : "is-down"}`;
  pulse.dataset.testid = "relationship-pulse";
  pulse.setAttribute("role", "status");
  const heart = document.createElement("span");
  heart.className = "relationship-pulse-heart";
  heart.textContent = up ? "♥" : "♡";
  const text = document.createElement("span");
  text.className = "relationship-pulse-text";
  text.textContent = `${name} · ${up ? "호감이 올랐다" : "호감이 내려갔다"}`;
  pulse.append(heart, text);
  host.append(pulse);
  window.setTimeout(() => pulse.remove(), PULSE_MS);
}
