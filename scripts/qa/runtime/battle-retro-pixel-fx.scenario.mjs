// 도트 측면 전투의 일반 공격 효과가 도트 효과(pixel-fx)로 그려지는지 본다(2026-10-03).
//
// 예전에는 기록에 박힌 EasyRPG Blow·384px 생성 효과가 그대로 떴다. 지금은 battleDom.retroPixelAnimation 이
// 번들 효과를 anim_px_<key> 로 바꿔 그린다. 전투 진입까지는 battle 시나리오와 같은 픽스처·경로다.
import battleScenario from "./battle.scenario.mjs";

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const battleRetroPixelFxScenario = {
  id: "battle-retro-pixel-fx",
  beats: [
    ...battleScenario.beats.filter((beat) => beat.id !== "battle-attack"),
    {
      id: "attack-pixel-fx",
      note: "공격을 확정하면 타격 효과가 도트 시트(pixel-fx-*)로 뜬다",
      // 첫 차례 정찰병은 화살(독침) 효과라 도트 측면에서 원래 안 그린다(isTravellingEffect). 다음 차례까지 공격한다.
      ops: [
        { kind: "key", key: "z" },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 20000 },
        { kind: "key", key: "z" },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-animation", state: "present", timeoutMs: 20000 },
      ],
      expect: { testidPresent: ["battle-scene", "battle-animation"] },
      shot: true,
    },
  ],
};

export default battleRetroPixelFxScenario;
