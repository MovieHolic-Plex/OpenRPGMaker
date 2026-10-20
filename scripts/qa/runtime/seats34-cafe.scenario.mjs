// 앉는 기물 다시 굽기(seats34) — modern_city 카페 예제 방이 출하 플레이어에서 깨지지 않고 그려지는지.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/qa/seats34-fixture.mts --out /tmp/seats34-cafe.json --stamp mci-armchair@7,9
//   npm run qa:runtime -- --scenario seats34-cafe --project /tmp/seats34-cafe.json
export default {
  id: "seats34-cafe",
  beats: [
    { id: "title", note: "출하 플레이어 제목 화면.", expect: { testidPresent: ["title-screen"] }, shot: true },
    {
      id: "cafe-start",
      note: "카페 예제 방 시작 칸 — 안락의자(남향 새 그림, 칸 10586·10587)·동서 안락의자·탁자가 그려진다.",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }],
      expect: { mapId: "mci-cafe", x: 5, y: 9, playerSpriteTextureLoaded: true, testidAbsent: ["title-screen"] },
      shot: true,
    },
  ],
};
