import { BattleAdmissionError } from "@/project/battleAdmission";
import type { Project } from "@/project/types";
import { getPlayerPreferences } from "@/player/playerPreferences";
import { playCinematicSequence } from "@/player/cinematicSequence";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import { gameOverOutcome, resolveGameOverSettings, type GameOverSettings, DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID } from "@/project/cinematicSettings";
import { createTerminalScene, type TerminalScene } from "@/player/terminalScene";
import type { EndingPresentation } from "@/project/cinematicSettings";
import { isCancelKey, isCinematicAdvanceKey, normalizeKey } from "@/player/keyBindings";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { dialogueHost, dialogueUi } from "@/player/playSceneDom";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import { usesRelationshipMenu } from "@/project/relationshipMenu";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { monsterMenuIconResourceId, monsterUiEntry } from "@/player/playerMonsterPartyModel";
import { resolveEndingCouplePortraits } from "@/player/dialogue";
import { ANY_FRIENDSHIP_KEY } from "@/project/session";
import type { FaceGraphic } from "@/project/types";
import { sharedPortraitRendering } from "@/assets/sharedPortraitAssets";
import { vnUiText, type VnUiKey } from "@/player/vnExtrasStrings";
import { vnExtrasLanguage } from "@/project/vnExtras";

/** 엔딩 화면 글자 — 게임 언어(편집기 언어가 아니다: 저작 vnExtras·대사 시스템 언어, 없으면 ko)로 고른다. */
function endingText(key: VnUiKey, ...args: readonly (string | number)[]): string {
  return vnUiText(vnExtrasLanguage(store.getCurrent()), key, ...args);
}

/** 막·장 끝 엔딩 id(end_fs_act1·chapter2_end 등)의 종류와 번호. 이야기가 이어지는 엔딩이다. */
export function endingSegmentOf(endingId: string | undefined): { readonly kind: "act" | "chapter"; readonly number: number } | undefined {
  const match = /(?:^|_)(act|chapter)(\d+)/iu.exec(endingId ?? "");
  if (!match) return undefined;
  return { kind: match[1]!.toLowerCase() === "act" ? "act" : "chapter", number: Number(match[2]) };
}

/** Credits read at roughly 24 px/s; holding a confirm key fast-forwards 4x. */
const CREDITS_SPEED_PX_PER_SEC = 24;
const CREDITS_FAST_RATE = 4;

export function showRuntimeOverlay(
  scene: PlaySceneContext,
  testId: string,
  text: string
): void {
  const host = dialogueHost(scene);
  if (!host) return;
  const prior = host.querySelector(`[data-testid='${testId}']`) as (HTMLElement & { __oprnDisposeCursor?: () => void }) | null;
  prior?.__oprnDisposeCursor?.();
  if (prior) prior.__oprnDisposeCursor = undefined;
  prior?.remove();
  const overlay = document.createElement("div");
  overlay.className = "runtime-overlay";
  overlay.dataset.testid = testId;
  overlay.textContent = text;
  host.append(overlay);
}

export function clearRuntimeOverlay(scene: PlaySceneContext, testId: string): void {
  const host = dialogueHost(scene);
  const overlay = host?.querySelector(`[data-testid='${testId}']`) as (HTMLElement & { __oprnDisposeCursor?: () => void }) | null | undefined;
  if (!overlay) return;
  // Date-error (and any overlay) may own a cursor-menu disposer; release before detach.
  overlay.__oprnDisposeCursor?.();
  overlay.__oprnDisposeCursor = undefined;
  overlay.remove();
}

/** 파티가 비어 싸울 수 없을 때 플레이어가 듣는 말 — 게임 대사창 문장(시스템 토스트가 아니다). */
const EMPTY_PARTY_NOTICE = "몬스터가 한 마리도 없어서 승부할 수 없다.\n먼저 박사님께 스타터를 받아 오자.";

/**
 * 전투 입장 거부를 보여 준다. 몬스터 파티가 빈 경우는 어두운 시스템 토스트 대신 게임 대사창으로 **한 번** 말하고 닫는다(D30).
 * 그 밖의 입장 오류(적 그룹 없음 등)는 저작 오류라 기존처럼 runtime-error 오버레이로 남긴다.
 * 대사창을 기다리는 동안 호출부의 입력 잠금이 유지되므로, 닫힌 뒤에야 걷기·조사가 돌아온다.
 */
export async function showBattleAdmissionError(scene: PlaySceneContext, error: unknown): Promise<void> {
  if (error instanceof BattleAdmissionError && error.code === 'BATTLE_MONSTER_PARTY_EMPTY') {
    const dialogue = dialogueUi(scene);
    if (dialogue) {
      try {
        await dialogue.showText({
          body: EMPTY_PARTY_NOTICE,
          textContext: { session: scene.session, project: store.getCurrent() },
          playerTileY: scene.tileY,
          mapHeight: scene.map.height,
        });
      } catch (dialogueError) {
        // 씬이 닫히거나 교체되며 대사가 취소된 경우 — 조용히 끝낸다.
        if (!(dialogueError instanceof DOMException && dialogueError.name === 'AbortError')) throw dialogueError;
      } finally {
        dialogue.close();
      }
      return;
    }
    scene.showRuntimeOverlay('runtime-error', error.message);
    dialogueHost(scene)?.querySelector<HTMLElement>("[data-testid='runtime-error']")?.setAttribute('data-recovery', 'monster-party');
    return;
  }
  scene.showRuntimeOverlay('runtime-error', error instanceof Error ? error.message : '전투를 시작할 수 없습니다. 전투 설정을 확인하세요.');
}

/** A rejected empty-party battle is recoverable; keep other runtime errors intact. */
export function clearRecoveredMonsterPartyError(scene: PlaySceneContext): void {
  if (!(scene.session.monsterParty ?? []).some(id => scene.session.monsterInstances?.[id])) return;
  const overlay = dialogueHost(scene)?.querySelector<HTMLElement>("[data-testid='runtime-error'][data-recovery='monster-party']");
  if (overlay) clearRuntimeOverlay(scene, 'runtime-error');
}

export function returnToTitle(scene: PlaySceneContext): void {
  const callback: unknown = scene.game.registry.get("returnToTitle");
  if (typeof callback === "function") {
    callback();
    return;
  }
  scene.showRuntimeOverlay("title-scene", "타이틀");
}

/** 엔딩 클리어를 호스트(플레이어)에 알린다. 저장은 호스트가 한다 — 인터프리터는 저장소를 모른다. */
export function reportEndingClear(scene: PlaySceneContext, clear: { readonly endingId: string } | undefined): void {
  if (!clear) return;
  const callback: unknown = scene.game.registry.get("recordEndingClear");
  if (typeof callback === "function") callback(clear.endingId, scene.session);
}

function textNode(tag: string, className: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function addBackground(terminal: TerminalScene, resourceId: string | undefined, fallback?: HTMLElement, project = store.getCurrent()): void {
  if (!resourceId) return;
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) { if (fallback) fallback.hidden = false; return; }
  const image = document.createElement("img");
  image.className = "cinematic-background";
  image.alt = "";
  image.draggable = false;
  image.addEventListener("error", () => { image.remove(); if (fallback) fallback.hidden = false; }, { once: true, signal: terminal.signal });
  image.src = url;
  terminal.root.prepend(image);
}

function terminalButton(testId: string, label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "game-over-choice";
  button.dataset.testid = testId;
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

/** Exit covers the stage before changing the underlying session/title. */
async function exitTerminal(terminal: TerminalScene, action: () => void): Promise<void> {
  terminal.lock();
  terminal.phase("exit");
  const music = terminal.root.querySelector<HTMLAudioElement>('audio[data-terminal-music]');
  if (music) {
    const volume = music.volume, started = performance.now();
    const fade = window.setInterval(() => { music.volume = Math.max(0, volume * (1 - (performance.now() - started) / 380)); }, 30);
    terminal.signal.addEventListener("abort", () => window.clearInterval(fade), { once: true });
  }
  if (!await terminal.wait(terminal.reducedMotion ? 0 : 380)) return;
  terminal.cleanup();
  action();
}

export function showGameOverScreen(scene: PlaySceneContext, message?: string, gameOverId?: string): void {
  const project = store.getCurrent();
  const settings = resolveGameOverSettings(project.system, gameOverId);
  const terminal = createTerminalScene(scene, "game-over", settings?.title || "게임 오버");
  if (!terminal) return;
  playGameOverPresentation(terminal, project, settings, {
    hasCheckpoint: () => scene.hasCheckpoint(),
    restoreCheckpoint: () => scene.restoreCheckpoint(),
    returnToTitle: () => scene.returnToTitle(),
    recoverFromDefeat: () => scene.recoverFromDefeat(settings),
  }, message);
}

export type GameOverPresentationActions = {
  hasCheckpoint(): boolean;
  restoreCheckpoint(): void;
  returnToTitle(): void;
  recoverFromDefeat(): boolean;
};

/** Pure presentation seam: editor previews use the exact player flow with simulated outcomes. */
export function playGameOverPresentation(terminal: TerminalScene, project: Project, settings: GameOverSettings | undefined, scene: GameOverPresentationActions, message?: string): void {
  const style = settings?.presentation ?? "classic";
  const outcome = gameOverOutcome(settings);
  const timing = settings?.timing;
  terminal.root.style.setProperty("--terminal-fade-ms", `${timing?.fadeOutMs ?? 900}ms`);
  terminal.root.dataset.presentation = style;
  const run = async (): Promise<void> => {
    if (!await terminal.wait(terminal.reducedMotion ? 0 : (timing?.fadeOutMs ?? 900))) return;
    terminal.phase("silence");
    if (!await terminal.wait(timing?.silenceMs ?? (style === "horror" ? 750 : 180))) return;
    if (settings?.sequence?.enabled && settings.sequence.scenes.length) {
      // The cinematic owns keys while active; the terminal resumes ownership on completion.
      terminal.menu(() => () => undefined);
      const result = await playCinematicSequence({ host: terminal.root, project, sequence: settings.sequence, signal: terminal.signal }).done;
      if (result === "aborted" || terminal.signal.aborted) return;
      terminal.lock();
    }
    playTerminalMusic(terminal, project, settings?.musicResourceId, "game-over-music");
    if (outcome === "recover" || outcome === "title") {
      terminal.phase("blackout-message");
      addBackground(terminal, settings?.backgroundResourceId, undefined, project);
      const body = textNode("div", "blackout-message", message ?? settings?.message ?? (outcome === "recover" ? "더는 싸울 수 없었다.\n눈앞이 캄캄해졌다…" : settings?.title ?? "이야기가 끝났습니다."));
      const emerald = isEmeraldMonsterStyle(project);
      // 에메랄드 몬스터 게임(D31): 검은 바탕 위 시스템 글꼴 한 줄이 아니라 필드 대사창과 같은 문장창 + Galmuri9 18px 격자 글꼴,
      // 그 위에 「다시 시작할 수 있어」 제목. 창은 화면 아래 80px(논리 40px)로 대사창과 같은 자리·같은 격자다.
      if (emerald) {
        terminal.root.dataset.monsterStyle = "emerald";
        const heading = settings?.title && outcome === "recover" ? textNode("div", "blackout-title", settings.title) : undefined;
        if (heading) terminal.root.append(heading);
      }
      terminal.root.append(body);
      // Readable beat before automatic recovery; no GAME OVER or retry menu.
      if (!await terminal.wait(timing?.messageHoldMs ?? 2200)) return;
      terminal.phase("silence");
      body.remove();
      terminal.root.querySelector(".blackout-title")?.remove();
      if (!await terminal.wait(500)) return;
      if (outcome === "title") { await exitTerminal(terminal, () => scene.returnToTitle()); return; }
      terminal.root.querySelector<HTMLAudioElement>("audio[data-terminal-music]")?.pause();
      if (scene.recoverFromDefeat()) {
        terminal.phase("wake");
        if (await terminal.wait(terminal.reducedMotion ? 0 : 800)) terminal.cleanup();
        return;
      }
      // Deleted/blocked recovery locations must not leave an unplayable black screen.
      renderDefeatMenu(terminal, scene, project, settings, "귀환할 장소를 찾을 수 없습니다.");
      return;
    }
    renderDefeatMenu(terminal, scene, project, settings, message);
  };
  void run();
}

function renderDefeatMenu(terminal: TerminalScene, scene: GameOverPresentationActions, project: Project, settings: GameOverSettings | undefined, message?: string): void {
  const style = settings?.presentation ?? "classic";
  terminal.phase("reveal");
  const overlay = textNode("div", "game-over-content", "");
  const title = textNode("h1", "runtime-overlay-title game-over-heading", settings?.title ?? (style === "horror" ? "돌아오지 못했다" : "게임 오버"));
  const backgroundId = settings?.backgroundResourceId ?? (style === "classic" ? DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID : undefined);
  title.hidden = backgroundId === DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID && settings?.title === undefined;
  addBackground(terminal, backgroundId, title, project);
  overlay.append(title);
  const resolvedMessage = message ?? settings?.message;
  if (resolvedMessage) overlay.append(textNode("div", "runtime-overlay-message game-over-message", resolvedMessage));
  terminal.root.append(overlay);
  void terminal.wait(settings?.timing?.menuDelayMs ?? (style === "horror" ? 1500 : 650)).then(alive => {
    if (!alive) return;
    const actions = textNode("div", "game-over-actions", "");
    const buttons: HTMLButtonElement[] = [];
    if (scene.hasCheckpoint()) buttons.push(terminalButton("checkpoint-retry", settings?.retryLabel ?? "체크포인트에서 다시 시작", () => { void exitTerminal(terminal, () => scene.restoreCheckpoint()); }));
    const titleButton = terminalButton("return-title", settings?.titleLabel ?? "타이틀로 돌아가기", () => { void exitTerminal(terminal, () => scene.returnToTitle()); });
    buttons.push(titleButton);
    actions.append(...buttons);
    overlay.append(actions);
    const hint = textNode("div", "game-over-hint", "↑↓ 선택   ·   Z / Enter 결정");
    overlay.append(hint);
    const messageBody = overlay.querySelector<HTMLElement>(".game-over-message");
    if (messageBody && messageBody.scrollHeight > messageBody.clientHeight) {
      hint.textContent += "   ·   PgUp/PgDn 본문";
      window.addEventListener("keydown", event => {
        if (event.isComposing || !["PageUp", "PageDown"].includes(event.key)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        messageBody.scrollTop += (event.key === "PageUp" ? -1 : 1) * messageBody.clientHeight * 0.9;
      }, { capture: true, signal: terminal.signal });
    }
    terminal.phase("choices");
    terminal.menu(() => attachCursorMenu(overlay, { items: buttons, cancelEl: titleButton }));
  });
}

/**
 * 에메랄드 몬스터 게임의 전당 등록 쪽(D04). 챔피언을 이긴 직후 내 파티를 한 줄씩 소개한다 — 3세대 엔딩의 「전당 등록!」.
 * 파티 몬스터가 없으면 만들지 않는다.
 */
function emeraldHallOfFame(scene: PlaySceneContext): HTMLElement | undefined {
  const project = store.getCurrent();
  if (!isEmeraldMonsterStyle(project)) return undefined;
  const session = scene.session;
  const cards = (session.monsterParty ?? []).slice(0, 6).flatMap((id) => {
    const raw = session.monsterInstances?.[id];
    if (!raw) return [];
    const entry = monsterUiEntry(project, raw);
    const url = resolveAssetResourceUrl(monsterMenuIconResourceId(project, entry.species?.graphic.monsterResourceId) ?? "", { project });
    const card = textNode("div", "ending-hall-card", "");
    card.dataset.testid = "ending-hall-card";
    const face = textNode("span", "ending-hall-face", "");
    if (url) face.style.backgroundImage = `url("${url}")`;
    card.append(face, textNode("span", "ending-hall-name", entry.name), textNode("span", "ending-hall-level", `Lv${entry.instance.level}`));
    return [card];
  });
  if (cards.length === 0) return undefined;
  const hall = textNode("div", "ending-hall", "");
  hall.dataset.testid = "ending-hall";
  hall.append(textNode("div", "ending-hall-title", endingText("ending.hallOfFame")));
  const grid = textNode("div", "ending-hall-grid", "");
  grid.append(...cards);
  hall.append(grid);
  return hall;
}

function endingKicker(presentation?: EndingPresentation): string {
  const own = presentation?.kicker?.trim();
  if (own) return own;
  if (presentation?.tone === "dark") return endingText("ending.kicker.dark");
  return endingText(usesRelationshipMenu(store.getCurrent()) ? "ending.kicker.couple" : "ending.kicker.journey");
}

/** 마지막 장의 큰 글자. 저작한 finalTitle → 막·장 끝이면 「제1막 끝」 → 「끝」(게임 언어). */
function endingFinalTitle(presentation: EndingPresentation | undefined, endingId: string | undefined): string {
  const own = presentation?.finalTitle?.trim();
  if (own) return own;
  const segment = endingSegmentOf(endingId);
  if (segment) return endingText(segment.kind === "act" ? "ending.actEnd" : "ending.chapterEnd", segment.number);
  return endingText("ending.theEnd");
}

type EndingCg = { readonly layer: HTMLElement; readonly mode: "couple" | "scene"; readonly badge: string; readonly epilogue: string };

const ENDING_PETAL_COUNT = 14;

/** 엔딩이 고른 장면 그림: 엔딩 자신의 배경 → 타이틀 그림 → 오프닝 마지막 스틸. 모두 이 게임이 가진 그림이다. */
function endingBackdropResourceId(project: Project, presentation?: EndingPresentation): string | undefined {
  const openingStill = (project.system.opening?.scenes ?? []).flatMap((scene) => (scene.kind === "image" ? [scene.resourceId] : [])).at(-1);
  return presentation?.backgroundResourceId ?? project.system.titleScreen?.backgroundResourceId ?? project.system.titleResourceId ?? openingStill;
}

function endingBadge(endingId: string | undefined, hasPartner: boolean, presentation?: EndingPresentation): string {
  const own = presentation?.badge?.trim();
  if (own) return own;
  if (hasPartner) return endingText("ending.badge.character");
  if (/bad/iu.test(endingId ?? "")) return endingText("ending.badge.bad");
  if (/normal|segment/iu.test(endingId ?? "")) return endingText("ending.badge.normal");
  // 막·장 끝(end_fs_act1 등)은 이야기가 이어진다 — 「해피 엔딩」이라 부르지 않는다(폴른 스타 감사 2차).
  if (endingSegmentOf(endingId)) return endingText("ending.badge.continued");
  return endingText(presentation?.tone === "dark" ? "ending.badge.plain" : "ending.badge.happy");
}

function endingFigure(project: Project, face: FaceGraphic, role: "hero" | "partner"): HTMLElement | undefined {
  const url = resolveAssetResourceUrl(face.resourceId, { project });
  if (!url) return undefined;
  const figure = textNode("div", `ending-cg-figure ending-cg-${role}`, "");
  figure.dataset.testid = `ending-cg-${role}`;
  figure.dataset.resourceId = face.resourceId;
  figure.dataset.portraitRender = sharedPortraitRendering(face.resourceId);
  figure.style.backgroundImage = `url("${url}")`;
  return figure;
}

/**
 * 검은 화면에 글만 남던 엔딩을 한 장의 엔딩 CG로 세운다: 게임의 장면 그림 위에 따뜻한 비네트·빛망울·꽃잎,
 * 캐릭터 엔딩이면 엔딩 상대와 주인공이 서로 마주 보는 커플 일러스트, 그리고 배지·제목·에필로그 문장.
 */
function buildEndingCg(terminal: TerminalScene, project: Project, presentation: EndingPresentation | undefined, endingId: string | undefined): EndingCg | undefined {
  const ending = endingId ? project.endings?.find((entry) => entry.id === endingId) : undefined;
  const partnerKey = ending?.conditions.find((condition) => condition.kind === "friendshipAtLeast" && condition.npcKey !== ANY_FRIENDSHIP_KEY);
  const couple = presentation?.portraits === "none" ? {} as ReturnType<typeof resolveEndingCouplePortraits> : resolveEndingCouplePortraits(project, partnerKey?.kind === "friendshipAtLeast" ? partnerKey.npcKey : undefined);
  const backdropId = endingBackdropResourceId(project, presentation);
  const backdropUrl = backdropId ? resolveAssetResourceUrl(backdropId, { project }) : null;
  const partnerFigure = couple.partner && endingFigure(project, couple.partner, "partner");
  const heroFigure = couple.hero && partnerFigure ? endingFigure(project, couple.hero, "hero") : undefined;
  if (!backdropUrl && !partnerFigure) return undefined;
  const layer = textNode("div", "ending-cg", "");
  layer.dataset.testid = "ending-cg";
  if (backdropUrl) {
    const image = document.createElement("img");
    image.className = "ending-cg-backdrop";
    image.alt = "";
    image.draggable = false;
    image.addEventListener("error", () => image.remove(), { once: true, signal: terminal.signal });
    image.src = backdropUrl;
    layer.append(image);
  }
  layer.append(textNode("div", "ending-cg-grade", ""), textNode("div", "ending-cg-bokeh", ""));
  const petals = textNode("div", "ending-cg-petals", "");
  for (let i = 0; i < ENDING_PETAL_COUNT; i += 1) {
    const petal = textNode("span", "ending-cg-petal", "");
    petal.style.setProperty("--petal-x", `${(i * 37 + 11) % 100}%`);
    petal.style.setProperty("--petal-y", `${(i * 53 + 7) % 90}%`);
    petal.style.setProperty("--petal-delay", `-${((i * 1.7) % 11).toFixed(1)}s`);
    petal.style.setProperty("--petal-scale", `${0.6 + ((i * 7) % 5) / 10}`);
    petals.append(petal);
  }
  layer.append(petals);
  if (partnerFigure) {
    const pair = textNode("div", "ending-cg-couple", "");
    pair.dataset.testid = "ending-cg-couple";
    pair.append(partnerFigure);
    if (heroFigure) pair.append(heroFigure);
    layer.append(pair);
  }
  layer.append(textNode("div", "ending-cg-frame", ""));
  const epilogue = (ending?.epilogue ?? [])
    // 말한 사람이 있는 줄은 이름을 붙인다 — 이름 없이 존댓말·반말 두 줄이 붙으면 누가 한 말인지 모른다.
    .map((beat) => {
      const text = typeof beat.text === "string" ? beat.text.trim() : "";
      const speaker = "speaker" in beat && typeof beat.speaker === "string" ? beat.speaker.trim() : "";
      return text && speaker ? `${speaker}: ${text}` : text;
    })
    .filter(Boolean)
    .join("\n");
  return { layer, mode: partnerFigure ? "couple" : "scene", badge: endingBadge(endingId, Boolean(partnerFigure), presentation), epilogue };
}

/**
 * 엔딩 그림 카드의 요약 글을 판에 맞는 가장 큰 크기로 — 고정 3.4cqh 는 다섯 줄 요약이 1배 화면에서 8px 로 작았고(첫사랑 VQA r34),
 * 키우면 여섯 줄 요약이 판 아래로 잘렸다(r31). 큰 크기부터 판(.ending-epilogue)에 다 들어갈 때까지 줄인다. 잴 수 없으면(레이아웃 없음) CSS 값 그대로.
 */
function fitEndingMessage(epilogue: HTMLElement): void {
  const message = epilogue.querySelector<HTMLElement>(".ending-message");
  if (!message || epilogue.clientHeight <= 0) return;
  // 요약 글 상자는 자기 max-height 안에서 스크롤하므로 판만 재면 늘 «들어간다» 로 읽혔다 — 마지막 줄이 상자 안에서 잘렸다(첫사랑 VQA r35).
  // 판과 글 상자 둘 다 넘치지 않는 가장 큰 크기를 고른다.
  const fits = (): boolean => epilogue.scrollHeight <= epilogue.clientHeight + 1 && message.scrollHeight <= message.clientHeight + 1;
  const tryMessage = (from: number, to: number): boolean => {
    for (let size = from; size >= to - 0.01; size -= 0.2) {
      message.style.fontSize = `${size.toFixed(1)}cqh`;
      if (fits()) return true;
    }
    return false;
  };
  if (tryMessage(4.6, 3.4)) return;
  // 제목이 두 줄이고 요약이 길면 3cqh 에서도 마지막 줄이 잘렸다(장난감 가게 엔딩, 2026-10-25 G52·심판 J3).
  // 글자를 더 줄이기 전에 판을 넓히고, 그다음 제목을 줄이고, 마지막에만 요약을 2.6cqh 까지 내린다.
  epilogue.classList.add("ending-epilogue--long");
  if (tryMessage(3.4, 3)) return;
  const heading = epilogue.querySelector<HTMLElement>(".ending-heading");
  for (let size = 6.2; heading && size >= 4.6; size -= 0.8) {
    heading.style.fontSize = `${size.toFixed(1)}cqh`;
    if (tryMessage(3.4, 3)) return;
  }
  tryMessage(2.8, 2.6);
}

/**
 * 마지막 화면의 큰 제목·작은 제목은 따로 절대 위치라 큰 제목이 두 줄로 넘어가면 둘째 줄이 작은 제목을 덮었다
 * (「마지막 태엽을 감고 끝」의 「끝」, 2026-10-25 G52). 한 줄에 들어갈 때까지 글자를 줄이고, 최소 크기에서도 넘치면 줄바꿈을 허용한다.
 */
function fitOneLine(element: HTMLElement, from: number, to: number, unit: string): void {
  if (element.clientWidth <= 0) return;
  element.style.whiteSpace = "nowrap";
  for (let size = from; size >= to - 0.01; size -= from > 20 ? 1 : 0.4) {
    element.style.fontSize = `${size.toFixed(1)}${unit}`;
    if (element.scrollWidth <= element.clientWidth + 1) return;
  }
  element.style.whiteSpace = "";
}

export function showEndingScreen(scene: PlaySceneContext, title: string, message: string, presentation?: EndingPresentation, endingId?: string): void {
  const terminal = createTerminalScene(scene, "ending", title || endingText("ending.heading"));
  if (!terminal) return;
  terminal.root.dataset.tone = presentation?.tone ?? "warm";
  if (isEmeraldMonsterStyle(store.getCurrent())) terminal.root.dataset.monsterStyle = "emerald";
  const run = async (): Promise<void> => {
    if (!await terminal.wait(terminal.reducedMotion ? 0 : 900)) return;
    terminal.phase("silence");
    if (!await terminal.wait(600)) return;
    const cg = isEmeraldMonsterStyle(store.getCurrent()) ? undefined : buildEndingCg(terminal, store.getCurrent(), presentation, endingId);
    if (cg) {
      terminal.root.dataset.endingCg = cg.mode;
      terminal.root.prepend(cg.layer);
    } else addBackground(terminal, presentation?.backgroundResourceId);
    playTerminalMusic(terminal, store.getCurrent(), presentation?.musicResourceId, "ending-music");
    const hall = emeraldHallOfFame(scene);
    if (hall) {
      terminal.root.append(hall);
      terminal.phase("hall");
      if (!await terminal.wait(terminal.reducedMotion ? 0 : 1400)) return;
      const hallHint = textNode("div", "game-over-hint", endingText("ending.continue"));
      terminal.root.append(hallHint);
      const advanced = await new Promise<boolean>((resolve) => {
        terminal.signal.addEventListener("abort", () => resolve(false), { once: true });
        terminal.keys((event) => { if (isCinematicAdvanceKey(normalizeKey(event.key))) { terminal.keys(); resolve(true); } });
      });
      if (!advanced) return;
      hall.remove(); hallHint.remove();
      if (!await terminal.wait(400)) return;
    }
    const epilogue = textNode("div", "ending-epilogue", "");
    if (cg) {
      const badge = textNode("div", "ending-badge", cg.badge);
      badge.dataset.testid = "ending-badge";
      epilogue.append(badge);
    }
    epilogue.append(textNode("div", "ending-kicker", endingKicker(presentation)));
    // 「본제 · 부제」 이름은 구분점에서 줄을 나눈다 — 점이 줄 끝에 매달리지 않게 점은 빼고 부제를 둘째 줄로 보낸다.
    const heading = textNode("h1", "ending-heading", "");
    (title || endingText("ending.heading")).split(/\s+[·・•]\s+/).forEach((part, index) => {
      if (index > 0) heading.append(document.createElement("br"));
      heading.append(document.createTextNode(part));
    });
    epilogue.append(heading);
    const body = message || cg?.epilogue;
    if (body) epilogue.append(textNode("div", "ending-message", body));
    terminal.root.append(epilogue);
    if (cg) {
      fitEndingMessage(epilogue);
      // 글꼴이 늦게 들어오면 줄 높이가 바뀐다 — 들어온 뒤 한 번 더 맞춘다.
      void document.fonts?.ready.then(() => { if (epilogue.isConnected) fitEndingMessage(epilogue); });
    }
    terminal.phase("epilogue");
    if (!await terminal.wait(1800)) return;
    const hint = textNode("div", "game-over-hint", endingText("ending.continue"));
    terminal.root.append(hint);
    terminal.keys(event => {
      const body = epilogue.querySelector<HTMLElement>(".ending-message");
      if (body && ["PageDown", "PageUp"].includes(event.key)) body.scrollTop += (event.key === "PageUp" ? -1 : 1) * body.clientHeight * .9;
      if (isCinematicAdvanceKey(normalizeKey(event.key))) { terminal.keys(); hint.remove(); void credits(); }
    });
  };
  const finish = (): void => {
    terminal.root.querySelector(".ending-epilogue")?.remove();
    terminal.root.querySelector(".ending-credits")?.remove();
    terminal.root.querySelector(".game-over-hint")?.remove();
    terminal.phase("final");
    const final = textNode("div", "ending-final game-over-content", "");
    const finalTitle = textNode("div", "ending-final-title", endingFinalTitle(presentation, endingId));
    finalTitle.dataset.testid = "ending-final-title";
    final.append(finalTitle);
    // 부제와 요약 줄은 한 기둥 안에 흐른다 — 둘 다 절대 위치(55%·63%)였을 때 두 줄로 넘어간 엔딩 이름이
    // 「플레이 시간」 줄과 겹쳤다(시타마치 VQA before 12-ending-final).
    const meta = textNode("div", "ending-final-meta", "");
    meta.append(textNode("div", "ending-final-caption", title));
    const summary = endingSummaryLine(scene);
    if (summary) meta.append(textNode("div", "ending-final-summary", summary));
    final.append(meta);
    const actions = textNode("div", "game-over-actions", "");
    const button = terminalButton("return-title", endingText("ending.returnTitle"), () => { void exitTerminal(terminal, () => scene.returnToTitle()); });
    actions.append(button); final.append(actions); terminal.root.append(final);
    const fitFinal = (): void => {
      if (!final.isConnected || terminal.root.dataset.monsterStyle === "emerald") return;
      const scaled = terminal.root.dataset.endingCg !== undefined;
      fitOneLine(finalTitle, scaled ? 11 : 23, scaled ? 6 : 14, scaled ? "cqh" : "px");
      const caption = final.querySelector<HTMLElement>(".ending-final-caption");
      if (caption) fitOneLine(caption, scaled ? 6.4 : 9, scaled ? 3.6 : 7, scaled ? "cqh" : "px");
    };
    fitFinal();
    void document.fonts?.ready.then(fitFinal);
    terminal.menu(() => attachCursorMenu(final, { items: [button], cancelEl: button }));
  };
  const credits = async (): Promise<void> => {
    terminal.phase("credits-transition");
    if (!await terminal.wait(terminal.reducedMotion ? 0 : 500)) return;
    terminal.root.querySelector(".ending-epilogue")?.remove();
    // 조수가 줄바꿈을 글자 「\n」로 저장한 크레딧(2026-10-25 G50·심판 J2)도 줄로 보인다.
    const copy = presentation?.credits?.replace(/(?:\\r)?\\n/gu, "\n").trim();
    if (!copy) { finish(); return; }
    terminal.phase("credits");
    const viewport = textNode("div", "ending-credits", "");
    const roll = textNode("div", "ending-credits-roll", copy);
    viewport.append(roll); terminal.root.append(viewport);
    // 롤 첫 줄이 0초부터 마스크가 불투명한 구간 안에 보이게 아래 가장자리 밖이 아니라 위쪽 1/3 지점에서 출발한다(VQA R8).
    const startOffset = Math.round(viewport.clientHeight * .3);
    const distance = startOffset + roll.scrollHeight;
    const duration = Math.max(8000, distance / CREDITS_SPEED_PX_PER_SEC * 1000);
    terminal.root.style.setProperty("--credits-duration", `${duration}ms`);
    terminal.root.style.setProperty("--credits-start", `${startOffset}px`);
    terminal.root.style.setProperty("--credits-end", `${-roll.scrollHeight}px`);
    const hint = textNode("div", "game-over-hint", endingText(terminal.reducedMotion ? "ending.creditsRead" : "ending.creditsSkip"));
    terminal.root.append(hint);
    let finished = false;
    const finishOnce = (): void => { if (finished || terminal.signal.aborted) return; finished = true; terminal.keys(); finish(); };
    const rollAnimation = terminal.reducedMotion ? undefined : roll.getAnimations()[0];
    if (rollAnimation) void rollAnimation.finished.then(() => finishOnce(), () => undefined);
    else if (!terminal.reducedMotion) void terminal.wait(duration).then(alive => { if (alive) finishOnce(); });
    // Holding a confirm key fast-forwards the roll; releasing it returns to reading speed.
    const setFast = (fast: boolean): void => { if (rollAnimation && rollAnimation.playState === "running") rollAnimation.playbackRate = fast ? CREDITS_FAST_RATE : 1; };
    terminal.root.ownerDocument.addEventListener("keyup", event => { if (isCinematicAdvanceKey(normalizeKey(event.key))) setFast(false); }, { signal: terminal.signal });
    if (!await terminal.wait(800)) return;
    terminal.keys(event => {
      if (["PageDown", "PageUp"].includes(event.key) && terminal.reducedMotion) viewport.scrollTop += (event.key === "PageUp" ? -1 : 1) * viewport.clientHeight * .9;
      const key = normalizeKey(event.key);
      if (terminal.reducedMotion) { if (isCinematicAdvanceKey(key)) finishOnce(); return; }
      if (isCancelKey(key)) finishOnce();
      else if (isCinematicAdvanceKey(key)) setFast(true);
    });
  };
  void run();
}

function playTerminalMusic(terminal: TerminalScene, project: Project, resourceId: string | undefined, testId: string): void {
  if (!resourceId) return;
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) return;
  const music = document.createElement("audio");
  music.dataset.testid = testId;
  music.dataset.terminalMusic = "true";
  music.src = url; music.loop = true; music.volume = getPlayerPreferences().bgm;
  terminal.root.append(music);
  terminal.signal.addEventListener("abort", () => { music.pause(); music.removeAttribute("src"); music.load(); music.remove(); }, { once: true });
  void music.play().catch(() => { /* Unavailable media must not prevent the terminal outcome. */ });
}

/**
 * 마지막 카드 아래 한 줄 요약 — 함께한 동료와 플레이 시간. 제목 두 줄만 남던 끝 화면이 여운 없이 끊겼다(폴른 스타 가혹 검수 r5).
 * 몬스터 파티 게임은 배우 파티가 비어 동료 칸을 빼고 시간만 말한다.
 */
function endingSummaryLine(scene: { session: { partyActorIds?: readonly string[]; playTimeSeconds?: number } }): string {
  const project = store.getCurrent();
  const names = (scene.session.partyActorIds ?? [])
    .map((id) => project.database.actors.find((actor) => actor.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const seconds = Math.max(0, Math.floor(scene.session.playTimeSeconds ?? 0));
  // 「0:07」(시:분)은 7초로 읽혔다(첫사랑 VQA r26) — 단위를 붙여 쓴다.
  const hours = Math.floor(seconds / 3600), minutes = Math.max(1, Math.floor((seconds % 3600) / 60));
  const time = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
  // 혼자인 파티(주인공 하나)는 「함께한 이: 주인공」이 된다 — 함께한 사람이 아니라 자기 이름이다(첫사랑 VQA r23). 둘 이상일 때만 쓴다.
  const parts = [names.length > 1 ? `함께한 이: ${names.join(" · ")}` : "", seconds > 0 ? `플레이 시간: ${time}` : ""].filter(Boolean);
  return parts.join("   ·   ");
}
