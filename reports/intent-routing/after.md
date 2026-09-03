# 의도 라우팅 전후 실측 (2026-09-03)

auto 모드(기본), 빈 프로젝트, 같은 모델(gemini-3.7-flash), 같은 스펙 `test/e2e/_intent-router-cases.spec.ts`.
「전」은 키워드 분류기 7종 시절의 감사(메모리 「의도 라우터 실측 감사」), 「후」는 의도 선언(LLM 한 번) 구조.

| 문장 | 전: 소요 / LLM / 툴(실패) / 맵 | 전: 결과 | 후: 소요 / LLM / 툴 / 맵 / 퀘스트 | 후: 선언 | 후: 결과 |
|---|---|---|---|---|---|
| 대장간 지어줘 | 47.7s / 11 / 17(6) / 1 | 야외 author_house 외장 + NPC(실내 없음) | 14.7s / 3 / 2 / 2 / 0 | mode=create space=interior facility=대장간 | place_concept 실내 → 대장간 |
| 민가 한 채 지어줘 | 4.5s / 1 / 0 / 1 | 모델이 야외/실내 되물음 | 13.2s / 3 / 2 / 2 / 0 | mode=create space=interior facility=민가 | place_concept 실내 → 민가 |
| 교회 지어줘 | 4.3s / 1 / 0 / 1 | 모델이 야외/실내 되물음 | 11.4s / 2 / 1 / 2 / 0 | mode=create space=interior facility=교회 | place_concept 실내 → 교회 |
| 술집 지어줘 | 4.3s / 1 / 0 / 1 | 모델이 야외/실내 되물음 | 13.1s / 3 / 2 / 2 / 0 | mode=create space=interior facility=술집 | place_concept 실내 → 술집 |
| 길드 지어줘 | 4.7s / 1 / 0 / 1 | 모델이 야외/실내 되물음 | 10.5s / 3 / 2 / 2 / 0 | mode=create space=interior facility=길드 | place_concept 실내 → 길드 |
| 이 마을에 상인 하나 추가해줘 | 93.4s / 22 / 26(8) / 3 | 플래너 direct 를 코드가 거부 → 마을 통째 + 실내 2장 | 19.0s / 6 / 5 / 1 / 0 | mode=modify space=none target=map_blank_start | 상인 NPC 1명(make_villager, 상점 재고) |
| 마을은 만들지 말고 여관만 지어줘 | 72.9s / 22 / 32(11) / 4 | 볼륨 강제: 마을·집·NPC 덤, 여관 2번 | 11.3s / 3 / 2 / 2 / 0 | mode=create space=interior facility=여관 | place_concept 실내 → 여관 |
| 퀘스트 말고 상점만 만들어줘 | 149.8s / 53 / 47(14) / 2 | 금지한 퀘스트 1개 강제 등록 | 7.3s / 2 / 1 / 2 / 0 | mode=create space=interior facility=상점 | place_concept 실내 → 상점 |
| 마을에 여관 하나 지어줘 | 85.9s / 21 / 50(24) / 5 | author_village 6회, 48×48 확장, 여관 2번 | 21.5s / 6 / 5 / 1 / 0 | mode=create space=outdoor facility=여관 | 야외 author_house 여관 외장 + 흙길(맵 1장) |
| 프로젝트 저장해줘 | 7.3s / 3 / 2 / 1 | 정상(export_game) | 6.3s / 2 / 1 / 1 / 0 | mode=other space=none single | export_game 안내 |
| 여관이 뭐야 | 4.5s / 1 / 0 / 1 | 정상 답변 | 5.6s / 1 / 0 / 1 / 0 | mode=question space=none single | 정상 답변 |
| 적당히 꾸며줘 | 3.8s / 1 / 0 / 1 | 테마 되물음 | 5.9s / 1 / 0 / 1 / 0 | mode=modify space=none target=map_blank_start | 테마 되물음 |

## 읽는 법

- 「맵」은 런 뒤 프로젝트의 맵 수(시작 맵 포함). 전에는 요청과 무관한 허브 맵·집 실내가 덤으로 생겼다.
- 「후: 선언」은 감사 로그의 `intent:llm mode=… space=… facility=…` 첫 세 필드. 선언 자체는 1.4~2.3초(마을에 여관 하나 5.2초).
- 「마을에 여관 하나 지어줘」는 선언이 `space=outdoor`(마을 맵 위 여관 건물)로 읽어 author_house 외장을 지었다 — 문장의 「마을에」를 장소로 본 해석이고, 실내를 원하면 「여관 실내」「여관 맵」이라고 말하면 된다. 전에는 마을 통째(5장)를 지었다.
- chat 모드 별건: 「나무 몇 그루 추가해줘」 0.5초 오답 되묻기 → 13초 침엽수 6그루 배치, 「대장간 지어줘」 0.7초 오답 되묻기 → 13초 place_concept 실내.

원본 JSON·감사 로그: `/tmp/intent-cases-after/NN.json`, `NN.audit.json`(이 기록은 커밋하지 않는다).
