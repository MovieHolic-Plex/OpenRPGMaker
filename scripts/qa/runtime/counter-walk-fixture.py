#!/usr/bin/env python3
"""카운터 너머 말 걸기 · NPC 걸음 QA 픽스처 (체크포인트 세트 counter-walk).

조수가 지은 작은 여관(손 도트 실내 v5, map_small_inn — assistant-capability npc-walk-out 사례의 저장본)을
SQLite 정본에서 읽어, 두 인물을 세운 런타임 픽스처 JSON 을 만든다.
  innkeeper (2,3) 카운터 뒤(카운터 윗면 칸). (2,4) 는 카운터 발밑(막힘). 조사하면 인사.
  porter    (1,3) 스위치 sw_0001 이 켜지면 자동 실행: 「창고에 다녀올게요」 → 아래 4칸·오른쪽 3칸 걸어 나간다.

사용:
  python3 scripts/qa/runtime/counter-walk-fixture.py <project.sqlite> tmp/cw-fix/inn-counter-walk.json [--counter-off]
--counter-off 는 counterTiles=[] 로 카운터 속성을 끈 대조군(고치기 전 동작)이다.
"""
import json, pathlib, subprocess, sys

def load(db: str) -> dict:
    # 앱과 같은 읽기(차이 저장된 번들 타일셋까지 되돌림) — scripts/content/read-project-sqlite.mts
    root = pathlib.Path(__file__).resolve().parents[3]
    text = subprocess.run(["npx", "tsx", "scripts/content/read-project-sqlite.mts", str(pathlib.Path(db).resolve())],
                          cwd=root, check=True, capture_output=True, text=True).stdout
    return json.loads(text)

def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    d = load(src)
    m = d["maps"]["map_small_inn"]
    base = next(e for e in m["events"] if e["id"] == "innkeeper")
    page = base["pages"][0]
    graphic = page["graphic"]
    route = next(c for c in page["commands"] if c["kind"] == "moveEvent")["route"]
    keeper = {
        "id": "innkeeper", "name": "여관 주인", "x": 2, "y": 3, "trigger": {"kind": "action"}, "commands": [],
        "pages": [{
            "id": "innkeeper_p1", "name": "여관 주인", "conditions": [], "graphic": graphic,
            "trigger": {"kind": "action"}, "movement": {"type": "fixed", "speed": 3, "frequency": 3}, "priority": "same",
            "commands": [{"kind": "text", "speaker": "여관 주인", "body": "어서 오세요. 카운터 너머로도 잘 들려요."}],
        }],
    }
    porter_graphic = {**graphic, "pattern": graphic["pattern"] - 48}
    porter = {
        "id": "porter", "name": "짐꾼", "x": 1, "y": 3, "trigger": {"kind": "action"}, "commands": [],
        "pages": [
            {"id": "porter_idle", "name": "짐꾼 · 대기", "conditions": [], "graphic": porter_graphic,
             "trigger": {"kind": "action"}, "movement": {"type": "fixed", "speed": 3, "frequency": 3}, "priority": "same",
             "commands": [{"kind": "text", "speaker": "짐꾼", "body": "짐이 많네요."}]},
            {"id": "porter_go", "name": "짐꾼 · 창고로", "conditions": [{"kind": "switch", "switchId": "sw_0001", "value": True}],
             "graphic": porter_graphic, "trigger": {"kind": "auto"}, "movement": {"type": "fixed", "speed": 3, "frequency": 3},
             "priority": "same",
             "commands": [
                 {"kind": "text", "speaker": "짐꾼", "body": "잠깐 창고에 다녀올게요."},
                 {"kind": "moveEvent", "eventId": "porter", "route": {**route, "moves": [mv for mv in route["moves"] if mv["kind"] != "turn"]}},
                 {"kind": "setSelfSwitch", "key": "A", "value": True},
             ]},
            {"id": "porter_gone", "name": "짐꾼 · 문 앞", "conditions": [{"kind": "selfSwitch", "key": "A", "value": True}],
             "graphic": {**porter_graphic, "direction": "down"}, "trigger": {"kind": "action"},
             "movement": {"type": "fixed", "speed": 3, "frequency": 3}, "priority": "same",
             "commands": [{"kind": "text", "speaker": "짐꾼", "body": "금방 다녀올게요."}]},
        ],
    }
    m["events"] = [keeper, porter]
    if "--counter-off" in sys.argv:
        d["tilesets"][m["tilesetId"]]["counterTiles"] = []
    pathlib.Path(out).parent.mkdir(parents=True, exist_ok=True)
    json.dump(d, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
    print(out)

if __name__ == "__main__":
    main()
