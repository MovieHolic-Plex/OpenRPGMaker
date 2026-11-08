import { describe, expect, it } from "vitest";
import { detectRun } from "../scripts/qa/pipeline/lib/detect.mjs";

// 왜: 폴른 스타 광범위 QA(2026-11-07)에서 스토어 판본의 지연 그림 묶음 `/packs/p003~p008.json` ERR_ABORTED 가
// 결함 후보로 올라왔다. 장면이 넘어가며 플레이어가 스스로 취소한 요청이고 전투는 정상 진행됐다(큐 B7).
// 무시는 그 이름(`packs/pNNN.json`)에만 걸어야 한다 — 다른 .json 취소는 여전히 결함이다(ultrabrain 판정).

const job = { id: "j1", slug: "fallen-star", version: "1.39", kind: "battle", input: "keyboard", viewportName: "desktop", target: { troopId: "t1" } };
const failed = (url: string, why = "net::ERR_ABORTED") => ({ kind: "failed", url, why });
const row = (net: object[]) => ({
  seq: 1, file: "1.jpg", label: "battle-turn", settled: true, darkMs: 0, lum: 60, hash: "0000000000000001",
  state: { screen: "battle", mapId: "m1" }, dom: { text: "", overflow: [] }, inputs: [], errors: [], net,
});
const claims = (net: object[]) => detectRun([{ job, summary: {}, rows: [row(net)] }]).findings
  .filter((f: { check: string }) => f.check === "asset-request").map((f: { claim: string }) => f.claim);

describe("qa pipeline: 지연 그림 묶음 취소", () => {
  it("packs/pNNN.json 의 ERR_ABORTED 는 결함이 아니다 (실측 트레이스의 p003~p008)", () => {
    const base = "http://127.0.0.1:7812/fallen-star/1.39";
    expect(claims(["p003", "p004", "p005", "p006", "p007", "p008"].map((p) => failed(`${base}/packs/${p}.json`)))).toEqual([]);
    expect(claims([failed(`${base}/packs/p012.json?v=3`)])).toEqual([]);
  });

  it("다른 .json 취소와 packs 의 HTTP 오류·다른 실패는 그대로 결함이다", () => {
    const base = "http://127.0.0.1:7812/fallen-star/1.39";
    expect(claims([
      failed(`${base}/project.json`),
      failed(`${base}/maps/fs_hub.json`),
      failed(`${base}/packs/p003.json.bak`),
      failed(`${base}/packs/extra.json`),
      failed(`${base}/packs/p003.json`, "net::ERR_FAILED"),
      { kind: "http", status: 404, url: `${base}/packs/p009.json` },
    ])).toEqual([
      "net::ERR_ABORTED /project.json",
      "net::ERR_ABORTED /maps/fs_hub.json",
      "net::ERR_ABORTED /packs/p003.json.bak",
      "net::ERR_ABORTED /packs/extra.json",
      "net::ERR_FAILED /packs/p003.json",
      "404 /packs/p009.json",
    ]);
  });
});
