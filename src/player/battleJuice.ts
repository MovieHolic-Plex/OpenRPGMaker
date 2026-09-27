import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";
import type { SystemSeCue } from "@/project/systemAudioOverrides";
import { playAudioCommand } from "@/player/audio";

export type BattleAudioContext = { readonly project: Project; readonly session: PlaySession };
import { beginBattleResultAudio, playAuthoredBattleResultCue } from "@/player/battleAudio";
import { playBattleSfx as playSynthVoice, type BattleSfxKind } from "@/player/battleSfx";
import { playBattleSample, preloadBattleSamples } from "@/player/battleSeSamples";
import { HIT_INTENSITY_STYLE, hitIntensityStageVariables, type BattleHitIntensity } from "@/player/battleHitIntensity";
import { scheduleBattleTimer } from "@/player/battleTimerScope";

export type BattleJuiceEvent =
  | "command-select"
  | "command-confirm"
  | "command-cancel"
  | "attack-swing"
  | "hit-damage"
  | "hit-critical"
  | "hit-miss"
  | "hit-heal"
  | "faint"
  | "defend"
  | "escape"
  | "victory"
  | "defeat";

const BATTLE_SFX: Record<BattleJuiceEvent, string> = {
  "command-select": "easyrpg-sound-cursor1",
  "command-confirm": "easyrpg-sound-decision1",
  "command-cancel": "easyrpg-sound-cancel1",
  "attack-swing": "easyrpg-sound-attack1",
  "hit-damage": "easyrpg-sound-damage2",
  "hit-critical": "easyrpg-sound-blow4",
  "hit-miss": "easyrpg-sound-evade1",
  "hit-heal": "easyrpg-sound-recovery5",
  faint: "easyrpg-sound-collapse2",
  defend: "easyrpg-sound-barrier1",
  escape: "easyrpg-sound-escape",
  victory: "easyrpg-sound-chime1",
  defeat: "easyrpg-sound-collapse1",
};

// Some RTP builds omit alternate names; fall back to a safe click.
const SFX_FALLBACK: Partial<Record<BattleJuiceEvent, string>> = {
  "hit-miss": "easyrpg-sound-buzzer1",
  "hit-heal": "easyrpg-sound-recovery7",
  faint: "easyrpg-sound-fall1",
  escape: "easyrpg-sound-cancel2",
  victory: "easyrpg-sound-item1",
};

/**
 * 합성 보이스(battleSfx.ts)는 **샘플이 없을 때만** 우는 폴백이다.
 *
 * 예전에는 battleDom 이 사건 하나에 `playBattleSfx`(합성)와 `emitBattleJuice`(샘플)를
 * 둘 다 불러서, 한 번의 타격에 노이즈·톤·샘플이 2ms 안에 겹쳐 울렸다(실측: 26ms
 * Attack1.wav / 592 노이즈 / 593 톤 / 594 Damage2.wav). 어택 트랜지언트가 서로를
 * 마스킹해 오히려 약하게 들린다. 사건 1개 = 소리 1개가 이 파일의 계약이다.
 */
const SYNTH_VOICE: Record<BattleJuiceEvent, BattleSfxKind> = {
  "command-select": "cursor",
  "command-confirm": "confirm",
  "command-cancel": "cancel",
  "attack-swing": "cursor",
  "hit-damage": "hit",
  "hit-critical": "critical",
  "hit-miss": "miss",
  "hit-heal": "heal",
  faint: "faint",
  defend: "confirm",
  escape: "escape",
  victory: "victory",
  defeat: "defeat",
};

// 샘플과 합성 폴백의 체감 크기를 맞춘 값. 합성 마스터는 0.14(battleSfx.ts)이고
// 샘플은 원음이 커서 0.4 에서 대략 같은 라우드니스로 들린다.
const DEFAULT_VOLUME = 0.4;

/** 전투에서 져질 수 있는 샘플 SE 전부를 미리 디코드해 둔다 — 전투 진입(마운트)에서 호출한다. */
export function preloadBattleJuiceSamples(): void {
  const ids = new Set<string>();
  for (const id of Object.values(BATTLE_SFX)) ids.add(id);
  for (const id of Object.values(SFX_FALLBACK)) if (id) ids.add(id);
  preloadBattleSamples([...ids]);
}

export function emitBattleJuice(event: BattleJuiceEvent, target?: HTMLElement | null, context?: BattleAudioContext): void {
  playBattleCue(event, context);
  if (!target) return;
  const motion =
    event === "hit-critical"
      ? "battle-juice-critical"
      : event === "hit-damage"
        ? "battle-juice-hit"
        : event === "hit-miss"
          ? "battle-juice-miss"
          : event === "attack-swing"
            ? "battle-juice-swing"
            : event === "defend"
              ? "battle-juice-defend"
              : null;
  if (!motion) return;
  target.classList.remove("battle-juice-hit", "battle-juice-critical", "battle-juice-miss", "battle-juice-swing", "battle-juice-defend");
  window.requestAnimationFrame(() => {
    target.classList.add(motion);
    window.setTimeout(() => target.classList.remove(motion), event === "defend" ? 520 : 420);
  });
}

/**
 * 전투 사건 1개에 소리 1개. 프로젝트 샘플 → 대체 샘플 → 합성 보이스 순으로
 * **처음 성공한 하나만** 낸다. 호출자는 여기 말고 다른 오디오 경로를 겹치지 말 것.
 */
const SE_CUE: Record<Exclude<BattleJuiceEvent, "victory">, SystemSeCue> = {
  "command-select": "cursor", "command-confirm": "confirm", "command-cancel": "cancel",
  "attack-swing": "attack", "hit-damage": "damage", "hit-critical": "critical",
  "hit-miss": "miss", "hit-heal": "heal", faint: "faint", defend: "defend", defeat: "defeat", escape: "escape",
};

export function playBattleCue(event: BattleJuiceEvent, context?: BattleAudioContext): void {
  const project = context?.project ?? store.getCurrent();
  const result = event === "victory" || event === "defeat" || event === "escape";
  if (result) beginBattleResultAudio();
  const override = event === "victory"
    ? context?.session.systemAudioOverrides?.bgm?.victory
    : context?.session.systemAudioOverrides?.se?.[SE_CUE[event]];
  if (override) {
    if (override.resourceId) playAudioCommand({ ...override, loop: false, channel: event === "victory" ? "me" : "se" }, project);
    return;
  }
  if (result && playAuthoredBattleResultCue(project, event)) return;
  // 저작 슬롯이 비었을 때: 승리는 합성 팡파레(전투곡에 묻히지 않게 BGM 을 먼저 끊는다).
  if (event === "victory") {
    playSynthVoice("victory");
    return;
  }
  const primary = BATTLE_SFX[event];
  const fallback = SFX_FALLBACK[event];
  if (tryPlay(primary)) return;
  if (fallback && tryPlay(fallback)) return;
  playSynthVoice(SYNTH_VOICE[event]);
}

function tryPlay(soundResourceId: string): boolean {
  // 디코딩 캐시에 있으면 WebAudio 로 즉시 재생 — 요소 경로는 새 요소마다 로드를 기다리므로
  // 임팩트 발화가 그만큼 늦게 들린다. 캐시 미스면 false 로 요소 경로가 소리를 낸다.
  if (playBattleSample(soundResourceId, DEFAULT_VOLUME)) return true;
  const url = resolveAssetResourceUrl(soundResourceId, { project: store.getCurrent() });
  if (!url) return false;
  const audio = new Audio(url);
  audio.volume = DEFAULT_VOLUME;
  void audio.play().catch((error: unknown) => {
    if (error instanceof DOMException) return;
    console.warn("[battle-juice] sound playback failed", error);
  });
  return true;
}

/**
 * 무대 플래시(+흔들림). 명중한 타격은 세기와 무관하게 흔든다 — 진폭·주기는 세기가 정한다
 * (`HIT_INTENSITY_STYLE.shakePx`, battleHitIntensity.ts). 잽은 2px 를 짧게 두 번, 막타는 11px 를 네 번.
 * 세기 변수가 없는 급소는 CSS 폴백 진폭으로 흔든다.
 *
 * 흔들림은 **자기 클래스·변수**(`battle-hit-shake`, `--battle-hit-shake-*`)를 쓴다. 스킬 애니메이션 층
 * (battleAnimationDom.applyTimingEffects)이 `battle-screen-shake` 와 `--battle-shake-*` 를 프레임마다
 * 다시 쓰고 지워서, 같은 이름을 쓰면 타격 흔들림이 착탄 직후 한 프레임 만에 사라졌다(2026-09-25 실측:
 * 11px 가 설정된 뒤 184ms 시점에 변수·클래스 모두 비어 있었다). CSS: 22-hit-feel.css.
 *
 * `hurt` 는 **아군이 맞은** 타격이다. 흰 번쩍임 대신 붉은 테두리가 조여 든다(22-hit-feel.css) —
 * 정면 스킨은 아군을 그리지 않아서, 흰 막만으로는 누가 맞았는지 화면에서 읽을 수 없었다.
 */
export function flashBattleField(
  root: HTMLElement,
  kind: "hit" | "critical" | "victory" | "defeat",
  intensity?: BattleHitIntensity,
  options: { readonly hurt?: boolean } = {}
): void {
  root.classList.remove("battle-flash-hit", "battle-flash-critical", "battle-flash-victory", "battle-flash-defeat", "battle-flash-hurt", "battle-hit-shake");
  const className =
    kind === "critical"
      ? "battle-flash-critical"
      : kind === "victory"
        ? "battle-flash-victory"
        : kind === "defeat"
          ? "battle-flash-defeat"
          : "battle-flash-hit";
  const shakeVariables = intensity && HIT_INTENSITY_STYLE[intensity].shakePx > 0 ? hitIntensityStageVariables(intensity) : undefined;
  const shake = kind === "critical" || Boolean(shakeVariables);
  for (const name of HIT_SHAKE_VARIABLES) root.style.removeProperty(name);
  if (shake && shakeVariables && intensity) {
    const { period, iterations } = SHAKE_RHYTHM[intensity];
    root.style.setProperty("--battle-hit-shake-x", shakeVariables["--battle-shake-x"]!);
    root.style.setProperty("--battle-hit-shake-y", shakeVariables["--battle-shake-y"]!);
    root.style.setProperty("--battle-hit-shake-period", period);
    root.style.setProperty("--battle-hit-shake-iterations", iterations);
  }
  const hurt = options.hurt === true && (kind === "hit" || kind === "critical");
  // 착탄 프레임에 곧바로 붙인다. 예전엔 다음 rAF 에 붙여 팝업·히트스톱보다 한 프레임(실측 9~25ms) 늦게
  // 번쩍였다. 같은 클래스를 떼자마자 다시 붙이면 애니메이션이 재시작되지 않으므로 레이아웃을 한 번 읽는다.
  void root.offsetWidth;
  root.classList.add(className);
  if (hurt) root.classList.add("battle-flash-hurt");
  if (shake) root.classList.add("battle-hit-shake");
  // 전투 스코프 타이머 — teardown 이 남은 것을 끊는다(실측: 이 700ms 가 씬 파괴 뒤에 발화했다).
  scheduleBattleTimer(() => {
    root.classList.remove(className, "battle-flash-hurt", "battle-hit-shake");
  }, kind === "victory" || kind === "defeat" ? 700 : kind === "critical" || intensity === "crushing" ? 400 : 280);
}

const HIT_SHAKE_VARIABLES = ["--battle-hit-shake-x", "--battle-hit-shake-y", "--battle-hit-shake-period", "--battle-hit-shake-iterations"] as const;

/** 세기별 흔들림 리듬. 약할수록 짧고 빠르게 — 잽이 무대를 오래 흔들면 흔들림이 소음이 된다. */
const SHAKE_RHYTHM: Readonly<Record<BattleHitIntensity, { readonly period: string; readonly iterations: string }>> = {
  graze: { period: "60ms", iterations: "2" },
  normal: { period: "50ms", iterations: "3" },
  heavy: { period: "90ms", iterations: "3" },
  crushing: { period: "80ms", iterations: "4" },
};
