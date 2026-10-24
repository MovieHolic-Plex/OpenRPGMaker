// 아스트라 인물 흉상(대사 상자 그림 칸 88x92)을 출하 플레이어에서 한 장씩 찍는다.
// 픽스처: 아스트라 프로젝트 사본에서 오프닝을 끄고, 시작 맵 자동 이벤트를 「인물·표정마다 흉상 + 대사 한 줄」로 바꾼 것(--project 로 준다).
// 줄 순서: 7명 기본 → 나루 happy/sad/angry/surprised → 주인공 happy/sad/angry/surprised.
// ASTRA_BUSTS_BASE_ONLY=1 이면 7명 기본만(표정 파일이 없는 옛 판과 비교할 때).
const LINES = ["hero", "mom", "professor", "nurse", "naru", "yurim", "muyeong"].map((c) => `${c}-base`)
  .concat(process.env.ASTRA_BUSTS_BASE_ONLY ? [] : ["happy", "sad", "angry", "surprised"].map((x) => `naru-${x}`))
  .concat(process.env.ASTRA_BUSTS_BASE_ONLY ? [] : ["happy", "sad", "angry", "surprised"].map((x) => `hero-${x}`));

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const astraBustsScenario = {
  id: "astra-busts",
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    ...LINES.map((line, i) => ({
      id: `${String(i).padStart(2, "0")}-${line}`,
      note: `${line} 흉상이 대사 상자 위 그림 칸에 1:1 로 선다`,
      // 글자 흘림이 끝나고 흉상 그림이 뜰 때까지 기다린 뒤 찍는다(Enter 한 번이 흘림 건너뛰기로 먹힐 수 있어 글이 바뀔 때까지 누른다).
      ops: [
        ...(i === 0 ? [{ kind: "pressUntil", timeoutMs: 1500, key: "Enter", testid: "dialogue-box", state: "present", maxPresses: 20 }] : []),
        { kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: `[${line.replace("-", " · ")}]`, settleMs: 1500, maxPresses: 4 },
      ],
      expect: { testidPresent: ["dialogue-box"] },
      shot: true,
    })),
  ],
};
