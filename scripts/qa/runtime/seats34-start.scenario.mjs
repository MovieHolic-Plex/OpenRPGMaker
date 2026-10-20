// 앉는 기물 다시 굽기(seats34) — 이미 지은 실내 프로젝트(--project)가 출하 플레이어에서 시작 맵까지 뜨는지만 본다(그림 확인은 shot).
export default {
  id: "seats34-start",
  beats: [
    { id: "title", note: "출하 플레이어 제목 화면.", expect: { testidPresent: ["title-screen"] }, shot: true },
    { id: "start-map", note: "시작 맵이 그려지고 주인공 텍스처가 뜬다.", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }], expect: { playerSpriteTextureLoaded: true, testidAbsent: ["title-screen"] }, shot: true },
  ],
};
