# 단계 B 증거 목록 (직접 열어 본 것만 적는다)

모든 녹화는 실제 `player.html?e2eVitals=1` 을 `scripts/qa/runtime/retro2003-skills-gif.mjs` 로 돌린 것이다.
편집기 캡처(g)는 `?freshProject=1` 메모리 세션이라 **정본 저장 증거가 아니다**.

| 파일 | 무엇 | 직접 본 것 |
|---|---|---|
| `tint-sheet.png` | 색조 프리셋 9종 견본 | 9종이 서로 다른 색으로 구분됨 |
| `a-tint.gif`, `a-tint-hit-frames.png` | a. 색조: 원본/얼음/번개/독 | 주황 → 파랑 → 노랑 → 초록. 계산된 filter 는 얼음 `hue-rotate(148deg) saturate(3.4) …`, 번개 `hue-rotate(6deg) saturate(4.6) …`, 독 `hue-rotate(58deg) saturate(3.6) …`, 원본 `none`. 프레임은 타격 시점에 정렬된 것이 아니다 |
| `b-speed.gif`, `b-speed-frames.png` | b. 속도 0.6 / 1 / 1.6 | 같은 스킬이 느림/기본/빠름으로 재생됨. 수치는 아래 |
| `c-weight.gif`, `c-weight-frames.png` | c. 무게 light / normal / heavy | 프레임은 시간 정렬이 아니다 — 근거는 hitstop ms 수치 |
| `d-screen-frames.png` | d. 화면 효과 | flash: 최고 휘도 243(중앙값 127). dim: 최저 휘도 56. cutIn: 파란 띠와 배우 이름. shake 는 정지 화면에서 안 보임 — 수치(dx 7~10px, dy 2~3px, 약 1.13~1.47s)만 있음 |
| `abcd-measurements.json` | a~d 원수치 | |
| `e-recommend-table.json` | 자동 추천 표 | |
| `e-auto-frames.png`, `e-auto-runtime.json`, `e-auto-fire3.gif`, `e-auto-ice.gif`, `e-auto-massheal.gif` | e. 계약·레코드 없는 스킬 8종의 자동 추천 재생 | 8종 모두 이펙트가 재생됨(표는 SUMMARY). ice 는 얼음 filter 로 파랗게 렌더. **poison 은 파랑-흰 베기이고 filter 가 `none`(초록 아님)** |
| `f-auras-frames.png`(1800x1336, 3x3) | f. 상태 오라 8종 + 5중 상태 | freeze 회색 몸, berserk 붉은 윤곽, shield 큰 반투명 방울, wet 파란 물방울, poison 초록 고리, dark 검은 안개+어두운 몸, petrify 갈색 돌빛, regen 초록 반짝임(**가장 약함**). 8종이 서로 구분됨 |
| `f-aura-poison.gif`, `f-aura-wet.gif`, `f-aura-shield.gif` | 오라 움직임 | 고리·물방울·방울이 움직임 |
| `f-results.json` | 오라 실행별 상태 칩 + 상한 검사 | 단일 상태 실행마다 적 3마리의 상태 칩이 해당 상태와 일치 |
| `g0-handles-before.png`, `g1-handles-after.png`, `g-results.json` | g. 편집기 손잡이 카드 | 카드(속도·무게·색조·화면)가 보이고, 조작 뒤 레코드에 weight=heavy·tint=ice 가 들어감(g-results.json) |

## 측정값

- 속도(첫 자세 기준): approach 216 / 131 / 82 ms, 첫 hitstop 시작 720 / 438 / 281 ms, 전체 1572 / 941 / 587 ms (0.6 / 1 / 1.6).
- hitstop: light 없음, normal ≈112 ms, heavy ≈211 ms(3타 211·217·211, 기준 110 × 1.9).

## 알려진 한계

- cap-3(상태 오라 최대 3개)는 5중 상태 화면에서 상태 칩이 4개만 떠 DOM 으로 못 셌다. `resolveBattlerAuras` 를 직접 호출해 `["poison-bubble","shield-shimmer","berserk-pulse"]`, 중복 `[state_poison, state_deep_poison]` → `["poison-bubble"]` 로 증명했다.
- 녹화에서 DOM `data-battle-aura` 값을 따로 캡처하지 않았다(화면으로만 확인).
- sweep 자동 추천 행은 뒤쪽 샘플 프레임이 적 턴에 걸린다.
