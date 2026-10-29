// player/battleWalkChipBattler.ts — 전투 시트가 없는 파티원을 자기 걷기 칩으로 세운다(도트 측면 전투).
//
// 걷기 칩에 대응하는 전투 시트(charset-battler-*)도, 저작한 전투 그림도 없는 배우(예: 현대 교복 칩 oprn-charset-modern1~3)는
// 예전에는 자리 순서의 기본 도트(charset-battler-actor1-0 갈색 머리 검사 등)로 섰다 — 필드의 학생이 전투에서 낯선 검사가 됐다.
// 이제 그 배우의 걷기 칩(RM2000 CharSet 288×256, 한 사람 3패턴×4방향, 24×32 칸)을 그대로 잘라 세운다.
// 새 그림은 만들지 않는다: 왼쪽 보기 행(파티는 오른쪽에 서서 적을 본다)의 기존 세 칸과 정면 칸만 쓴다.
//  - 대기 = 가운데 칸, 걸어 나가기·돌아오기 = 0→1→2→1 걸음 순환, 때리기·시전 = 내디딘 칸
//  - 맞기 = 가운데 칸 + 기존 노드 흔들림·번쩍임, 쓰러짐 = 가운데 칸을 눕히고 흐리게, 승리 = 정면 가운데 칸
// 크기: 전투 시트 도트는 걷기 칩과 같은 화소 밀도(사람 키 약 24px)라 같은 BATTLE_ASSET_PIXEL_SCALE 배로 그리면 키가 맞는다.
// 노드 상자는 걷기 칩 전투 시트와 같은 96px 로 두어 발판·격파 조각·피해 숫자 위치가 같게 한다. 스킨 CSS 를 새로 쓰지 않도록 인라인으로만 맞춘다.
import { charsetFrameCropPosition, applyCharsetFrameCrop } from "@/assets/charsetFrameCrop";
import { CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH, type CharsetDirection } from "@/assets/easyrpgRtp";
import { BATTLE_ASSET_PIXEL_SCALE } from "@/player/battleStageScale";

/** 걷기 칩 전투 시트(48px 셀 × 2배)와 같은 노드 상자. */
const WALK_CHIP_NODE_BOX = 96;
/** 걷기 칩 전투 시트는 셀 아래 3px 여백 위에 발이 선다(actor1-0 대기 칸 실측 bbox 바닥 45/48). 같은 줄에 발을 맞춘다. */
const WALK_CHIP_FOOT_GAP = 3 * BATTLE_ASSET_PIXEL_SCALE;
/** 걸음 순환 한 칸 길이(ms). 필드 걷기와 비슷한 빠르기. */
const WALK_CHIP_STEP_MS = 140;

const walkAnimations = new WeakMap<HTMLElement, Animation>();

/** 전투 노드에 걷기 칩 스프라이트를 붙인다. url 은 이미 푼 걷기 칩 시트 주소다. */
export function appendWalkChipBattler(node: HTMLElement, name: string, characterResourceId: string, characterIndex: number, url: string): HTMLElement {
  const scale = BATTLE_ASSET_PIXEL_SCALE;
  const width = CHARSET_FRAME_WIDTH * scale;
  const height = CHARSET_FRAME_HEIGHT * scale;
  node.dataset.authoredBattler = "true";
  node.dataset.walkChipBattler = "true";
  node.dataset.battleCharsetResourceId = characterResourceId;
  node.style.width = `${WALK_CHIP_NODE_BOX}px`;
  node.style.height = `${WALK_CHIP_NODE_BOX}px`;
  const sprite = document.createElement("span");
  sprite.className = "battle-actor-sprite";
  sprite.dataset.testid = `battle-actor-walk-chip-${characterResourceId}-${characterIndex}`;
  sprite.dataset.rendering = "pixelated";
  sprite.dataset.walkChipIndex = String(characterIndex);
  sprite.setAttribute("role", "img");
  sprite.setAttribute("aria-label", `${name} 전투 캐릭터`);
  applyCharsetFrameCrop(sprite, url, { characterIndex, direction: "left", pattern: 1 }, scale);
  // 스킨 규칙(rm2000 등)이 이 변수로 상자를 잡는다 — 인라인 크기와 같은 값을 준다.
  sprite.style.setProperty("--battle-sprite-frame-width", `${width}px`);
  sprite.style.setProperty("--battle-sprite-frame-height", `${height}px`);
  // 스킨의 1.25·2/3 배율을 끄고 정수 배율 도트로 둔다. 진동·기울임은 translate·rotate 라 그대로 산다.
  sprite.style.transform = "none";
  sprite.style.scale = "1";
  sprite.style.imageRendering = "pixelated";
  // 96px 상자 아래 가운데에 발을 둔다(translate 는 맞기 진동이 쓰므로 여백으로 놓는다).
  sprite.style.margin = `${WALK_CHIP_NODE_BOX - height - WALK_CHIP_FOOT_GAP}px auto 0`;
  node.append(sprite);
  return sprite;
}

/** applyBattlerPose 가 의미 포즈를 정한 뒤 부른다. 걷기 칩 칸만 고른다. */
export function paintWalkChipBattler(node: HTMLElement, sprite: HTMLElement, pose: string): void {
  const characterIndex = Number(sprite.dataset.walkChipIndex) || 0;
  const scale = BATTLE_ASSET_PIXEL_SCALE;
  const at = (direction: CharsetDirection, pattern: number) => charsetFrameCropPosition({ characterIndex, direction, pattern }, scale);
  const beat = node.dataset.retroBeat;
  const walking = (beat === "approach" || beat === "recover") && pose !== "dead" && pose !== "hit";
  const dead = pose === "dead";
  const frame = dead ? "dead"
    : walking ? "walk"
    : pose === "victory" ? "victory"
    : pose === "attack" || pose === "skill" || pose === "defend" ? "step"
    : pose === "hit" ? "hit"
    : "idle";
  node.dataset.battlePoseFrame = `walk_chip_${frame}`;
  sprite.style.backgroundPosition = frame === "victory" ? at("down", 1)
    : frame === "step" ? at("left", 2)
    : at("left", 1);
  // 쓰러짐: 같은 칸을 옆으로 눕히고 흐리게 한다(새 그림 없음). 발 쪽 축으로 돌려 발판 위에 눕는다.
  sprite.style.rotate = dead ? "-90deg" : "";
  sprite.style.transformOrigin = dead ? "50% 100%" : "";
  sprite.style.filter = dead ? "grayscale(0.6) brightness(0.75)" : "";
  sprite.style.opacity = dead ? "0.8" : "";
  const running = walkAnimations.get(sprite);
  if (walking) {
    if (running) return;
    if (typeof sprite.animate !== "function") return;
    const steps = [at("left", 0), at("left", 1), at("left", 2), at("left", 1)];
    // 칸 사이를 미끄러지지 않게 키프레임마다 steps(1) 로 붙든다.
    const animation = sprite.animate(
      [...steps.map((backgroundPosition) => ({ backgroundPosition, easing: "steps(1, end)" })), { backgroundPosition: steps[0]! }],
      { duration: WALK_CHIP_STEP_MS * steps.length, iterations: Infinity },
    );
    walkAnimations.set(sprite, animation);
    return;
  }
  if (running) {
    running.cancel();
    walkAnimations.delete(sprite);
  }
}
