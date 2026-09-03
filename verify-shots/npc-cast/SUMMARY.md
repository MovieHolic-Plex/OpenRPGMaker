# NPC 캐스트 라이터 — 보조 표면 증거 (2026-09-03)

시나리오: `AssistantSession` 에 대본 chat 을 주입 — 모델이 `set_build_spec` → `place_npc` ×3(대사 없음) → 최종 응답. 세션 훅이 턴 끝에
캐스트 라이터 요청(`response_format: json_object`, 시스템 프롬프트 표지 "캐스트 라이터")을 1회 보내고 시트를 `author_npc_cast` 로 적용했다.
프롬프트 원문: `cast-writer-prompt.txt`, 결과 덤프: `cast-dump.json`.

## 결과
| NPC | 이름 | 대사 |
|---|---|---|
| ev_cast_a | 은호 | 다래 아주머니 가게에 오늘 잡은 은어를 넘겼어요. / 강물지기단이 상류를 막은 뒤로 물고기가 줄었지요. |
| ev_cast_b | 다래 | 은호가 가져온 은어가 오늘의 특산이에요. / 무영 영감은 강물지기단 얘기만 나오면 입을 닫아요. |
| ev_cast_c | 무영 | 다래 가게 앞 벤치가 내 자리지. |

- 상호 언급: 은호→다래, 다래→은호·무영, 무영→다래 (3/3)
- 세계관 언급: `강물지기단`(사용자 faction 개체) 2줄
- 세계관 등록: character 3개 + place 1개, 관계 5개 (knows, locatedIn)
- 제안: ['place_npc', 'place_npc', 'place_npc', 'author_npc_cast'] — author_npc_cast diff eventsModified=3, worldEntitiesAdded=4
- 감사: ['npc-cast:applied map=map_blank_start residents=은호,다래,무영']

## 한계
실제 lite 모델을 호출한 증거가 아니다(대본 응답). 실기 확인은 편집기에서 「강가 어촌 마을 지어줘」 뒤 주민 대사·DB「세계」탭의 character 개체를 본다.
