# 런 · 일방향 분기

전투·휴식·보물·상점을 선택하며 위층으로 전진합니다. 지나간 분기는 돌아가지 않습니다.

## 실제 저작 순서

1. list_worldmap_structures로 이동 방식을 고른다.
2. author_worldmap_structure({id:"my_world",structure:"run-path",seed:7})로 실제 맵과 이벤트를 만든다. id는 영문 소문자로 시작하고 영문 소문자·숫자·밑줄·하이픈을 쓴다.
3. inspect_worldmap_structure({id})의 audit.ok, 실제 맵·출입구·착지·관문을 확인한다.
4. show_map_region으로 실제 타일을 보고 플레이에서 M으로 지도를 연다.
5. 실제 SQLite 프로젝트 저장 후 같은 저장소에서 다시 읽어 지도 정의와 맵을 확인한다.

## 정본 표본

프로젝트 8af71241-f680-4298-b051-f96544016fce. 맵 13개, 연결 19개. 해금 뒤 13/13 장소 도달. PNG는 저장소를 닫고 다시 연 프로젝트의 타일 렌더와 공용 지도 렌더러를 사용했다.

## 데이터와 그림의 계약

세계관 theme과 이동 structure는 독립이다. 현재 생성기는 여섯 구조별 고정 연결 레시피이며 완성된 상용 게임을 재현한 것은 아니다. 이 표본은 새 공용 atlas_cartography 32px 지형을 사용한다. 지형 원본은 scripts/content/build-atlas-cartography.py이며, 거점은 사람이 승인한 기존 아이콘의 원본 화소를 재사용한다. 필드의 강·호수·절벽과 굴곡 길은 실제 통행 타일이다. 방 지도는 roomShape가 가리키는 실제 방 윤곽을 쓰고 사다리에는 실제 climbable 지형 기록을 연결한다. 스테이지는 하늘과 풀 절벽 발판이 있는 횡스크롤 코스다. 특정 상용 게임의 타일을 복사한 것이 아니다. 공개 타일의 원래 참고문서는 해당 타일셋(list_tileset_references)에서 읽는다.

발견·클리어·능력·핀은 session.switches에 저장한다. 지도에 들어오거나 그림을 여는 것만으로 관문이 통과되지 않는다. stage-nodes/run-path는 열린 인접 장소만 이동한다. run-path는 이전 층과 방문한 분기를 재진입하지 않는다. region-routes/field-overview/room-network는 실제 출입구 이벤트로 왕복한다. scaled-world는 실제 대륙의 거점 입구로 출입한다. 비밀 출구는 일반 클리어와 별도 스위치다.

## 정상과 오류 확인

정상: 닿는 출구, 통행 가능한 착지 칸, 귀환 문을 밟지 않는 착지, 관문을 통과한 뒤 해금, 방의 발견/핀 저장. 오류: 겹친 문, 막힌 착지, 자기 열쇠 뒤 잠긴 관문, 월드맵 점을 아무거나 눌러 순간이동, 런에서 이전 층 재진입. inspect 도구가 좌표·연결 불일치를 보고하며 플레이 화면을 함께 확인한다.

## 표본 전체 연결 정의

```json
{
  "version": 1,
  "id": "examples_run_path",
  "name": "런 · 일방향 분기",
  "structure": "run-path",
  "seed": 7,
  "width": 120,
  "height": 90,
  "startNodeId": "examples_run_path_n0",
  "nodes": [
    {
      "id": "examples_run_path_n0",
      "name": "출발 캠프",
      "mapId": "examples_run_path_map0",
      "kind": "camp",
      "x": 55,
      "y": 75,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_run_path_visit0",
      "clearSwitchId": "examples_run_path_clear0",
      "grants": []
    },
    {
      "id": "examples_run_path_n1",
      "name": "1층 전투",
      "mapId": "examples_run_path_map1",
      "kind": "battle",
      "x": 15,
      "y": 62,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_run_path_visit1",
      "clearSwitchId": "examples_run_path_clear1",
      "grants": []
    },
    {
      "id": "examples_run_path_n2",
      "name": "1층 사건",
      "mapId": "examples_run_path_map2",
      "kind": "event",
      "x": 55,
      "y": 62,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_run_path_visit2",
      "clearSwitchId": "examples_run_path_clear2",
      "grants": []
    },
    {
      "id": "examples_run_path_n3",
      "name": "1층 전투",
      "mapId": "examples_run_path_map3",
      "kind": "battle",
      "x": 95,
      "y": 62,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_run_path_visit3",
      "clearSwitchId": "examples_run_path_clear3",
      "grants": []
    },
    {
      "id": "examples_run_path_n4",
      "name": "2층 보물",
      "mapId": "examples_run_path_map4",
      "kind": "treasure",
      "x": 15,
      "y": 49,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_run_path_visit4",
      "clearSwitchId": "examples_run_path_clear4",
      "grants": []
    },
    {
      "id": "examples_run_path_n5",
      "name": "2층 정예",
      "mapId": "examples_run_path_map5",
      "kind": "elite",
      "x": 55,
      "y": 49,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_run_path_visit5",
      "clearSwitchId": "examples_run_path_clear5",
      "grants": []
    },
    {
      "id": "examples_run_path_n6",
      "name": "2층 상점",
      "mapId": "examples_run_path_map6",
      "kind": "shop",
      "x": 95,
      "y": 49,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_run_path_visit6",
      "clearSwitchId": "examples_run_path_clear6",
      "grants": []
    },
    {
      "id": "examples_run_path_n7",
      "name": "3층 휴식",
      "mapId": "examples_run_path_map7",
      "kind": "camp",
      "x": 15,
      "y": 36,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_run_path_visit7",
      "clearSwitchId": "examples_run_path_clear7",
      "grants": []
    },
    {
      "id": "examples_run_path_n8",
      "name": "3층 전투",
      "mapId": "examples_run_path_map8",
      "kind": "battle",
      "x": 55,
      "y": 36,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_run_path_visit8",
      "clearSwitchId": "examples_run_path_clear8",
      "grants": []
    },
    {
      "id": "examples_run_path_n9",
      "name": "3층 사건",
      "mapId": "examples_run_path_map9",
      "kind": "event",
      "x": 95,
      "y": 36,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_run_path_visit9",
      "clearSwitchId": "examples_run_path_clear9",
      "grants": []
    },
    {
      "id": "examples_run_path_n10",
      "name": "4층 정예",
      "mapId": "examples_run_path_map10",
      "kind": "elite",
      "x": 35,
      "y": 23,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_run_path_visit10",
      "clearSwitchId": "examples_run_path_clear10",
      "grants": []
    },
    {
      "id": "examples_run_path_n11",
      "name": "4층 휴식",
      "mapId": "examples_run_path_map11",
      "kind": "camp",
      "x": 75,
      "y": 23,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_run_path_visit11",
      "clearSwitchId": "examples_run_path_clear11",
      "grants": []
    },
    {
      "id": "examples_run_path_n12",
      "name": "5층 최종 관문",
      "mapId": "examples_run_path_map12",
      "kind": "boss",
      "x": 55,
      "y": 10,
      "w": 6,
      "h": 6,
      "entry": {
        "x": 2,
        "y": 21
      },
      "visitSwitchId": "examples_run_path_visit12",
      "clearSwitchId": "examples_run_path_clear12",
      "grants": []
    }
  ],
  "edges": [
    {
      "id": "examples_run_path_edge0",
      "from": "examples_run_path_n0",
      "to": "examples_run_path_n1",
      "requires": [
        "examples_run_path_clear0"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge1",
      "from": "examples_run_path_n0",
      "to": "examples_run_path_n2",
      "requires": [
        "examples_run_path_clear0"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge2",
      "from": "examples_run_path_n0",
      "to": "examples_run_path_n3",
      "requires": [
        "examples_run_path_clear0"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge3",
      "from": "examples_run_path_n1",
      "to": "examples_run_path_n4",
      "requires": [
        "examples_run_path_clear1"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge4",
      "from": "examples_run_path_n1",
      "to": "examples_run_path_n5",
      "requires": [
        "examples_run_path_clear1"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge5",
      "from": "examples_run_path_n2",
      "to": "examples_run_path_n5",
      "requires": [
        "examples_run_path_clear2"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge6",
      "from": "examples_run_path_n2",
      "to": "examples_run_path_n6",
      "requires": [
        "examples_run_path_clear2"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge7",
      "from": "examples_run_path_n3",
      "to": "examples_run_path_n6",
      "requires": [
        "examples_run_path_clear3"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge8",
      "from": "examples_run_path_n4",
      "to": "examples_run_path_n7",
      "requires": [
        "examples_run_path_clear4"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge9",
      "from": "examples_run_path_n4",
      "to": "examples_run_path_n8",
      "requires": [
        "examples_run_path_clear4"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge10",
      "from": "examples_run_path_n5",
      "to": "examples_run_path_n8",
      "requires": [
        "examples_run_path_clear5"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge11",
      "from": "examples_run_path_n6",
      "to": "examples_run_path_n8",
      "requires": [
        "examples_run_path_clear6"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge12",
      "from": "examples_run_path_n6",
      "to": "examples_run_path_n9",
      "requires": [
        "examples_run_path_clear6"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge13",
      "from": "examples_run_path_n7",
      "to": "examples_run_path_n10",
      "requires": [
        "examples_run_path_clear7"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge14",
      "from": "examples_run_path_n8",
      "to": "examples_run_path_n10",
      "requires": [
        "examples_run_path_clear8"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge15",
      "from": "examples_run_path_n8",
      "to": "examples_run_path_n11",
      "requires": [
        "examples_run_path_clear8"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge16",
      "from": "examples_run_path_n9",
      "to": "examples_run_path_n11",
      "requires": [
        "examples_run_path_clear9"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge17",
      "from": "examples_run_path_n10",
      "to": "examples_run_path_n12",
      "requires": [
        "examples_run_path_clear10"
      ],
      "oneWay": true
    },
    {
      "id": "examples_run_path_edge18",
      "from": "examples_run_path_n11",
      "to": "examples_run_path_n12",
      "requires": [
        "examples_run_path_clear11"
      ],
      "oneWay": true
    }
  ],
  "abilities": [],
  "pins": [
    {
      "nodeId": "examples_run_path_n0",
      "switchId": "examples_run_path_pin0"
    },
    {
      "nodeId": "examples_run_path_n1",
      "switchId": "examples_run_path_pin1"
    },
    {
      "nodeId": "examples_run_path_n2",
      "switchId": "examples_run_path_pin2"
    },
    {
      "nodeId": "examples_run_path_n3",
      "switchId": "examples_run_path_pin3"
    },
    {
      "nodeId": "examples_run_path_n4",
      "switchId": "examples_run_path_pin4"
    },
    {
      "nodeId": "examples_run_path_n5",
      "switchId": "examples_run_path_pin5"
    },
    {
      "nodeId": "examples_run_path_n6",
      "switchId": "examples_run_path_pin6"
    },
    {
      "nodeId": "examples_run_path_n7",
      "switchId": "examples_run_path_pin7"
    },
    {
      "nodeId": "examples_run_path_n8",
      "switchId": "examples_run_path_pin8"
    },
    {
      "nodeId": "examples_run_path_n9",
      "switchId": "examples_run_path_pin9"
    },
    {
      "nodeId": "examples_run_path_n10",
      "switchId": "examples_run_path_pin10"
    },
    {
      "nodeId": "examples_run_path_n11",
      "switchId": "examples_run_path_pin11"
    },
    {
      "nodeId": "examples_run_path_n12",
      "switchId": "examples_run_path_pin12"
    }
  ]
}
```
