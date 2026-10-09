# 전체 필드 캐릭터 · 판형 수정 v1

원작 캐릭터를 체형·걷기 판형으로 사용하고 머리·복장·장식의 일부 픽셀과 팔레트를 명시적으로 수정했다. 16역할 × 12포즈 = 192포즈. 이번에 새로 만든 파생 캐릭터15개와 이미 검토 중인 나루 v2 한 개다. 원작은 Nintendo / Game Freak / Creatures 작품이며, Codex GPT-6가 부분 수정을 저작했다. 독립 창작 원화라고 표시하지 않는다.

검토: http://mdc-server:18316/?wave=full-cast-v1

| 역할 | 검토용 이름 | 판형 | 후보 ID |
|---|---|---|---|
| 주인공 | 해솔 | `brendan-walking` | `hero-168b3d414498bda6` |
| 라이벌 | 시온 | `wally` | `rival-fd2a10bcfe84619a` |
| 박사 | 해명 | `prof_birch` | `professor-23390ef500822b88` |
| 간호사 | 이솔 | `woman_3` | `nurse-77d0672d59345549` |
| 상인 | 도윤 | `mart_employee` | `merchant-ec70dc333c7b98dd` |
| 어머니 | 유나 | `mom` | `mother-474d0899b3986e9b` |
| 주민 | 준서 | `man_3` | `resident-4bbbb57bf10f45e2` |
| 체육관장 | 태강 | `black_belt` | `gym_leader-75e583cd3aa1ce3c` |
| 회사요원 | 서진 | `devon_employee` | `company_agent-80dae8233ee815ed` |
| 선장 | 해준 | `sailor` | `captain-0bef85153d58f6f8` |
| 작업자 | 석호 | `man_1` | `worker-150dbd26f91d726f` |
| 탐험가 | 나루 v2 | `camper` | `explorer-2fe0ce80a94b963f` |
| 학생 | 민재 | `school_kid_m` | `student-fba78495cdb9764f` |
| 레인저 | 솔찬 | `bug_catcher` | `ranger-50b2b5f2e2d288fd` |
| 월영단장 | 백야 | `gentleman` | `moon_leader-462fc7f3210ffa6b` |
| 등산가 | 산호 | `hiker` | `hiker-1df7ff968271184c` |

## 저작과 재현

- `src/harnesses/pokemon-character-casting/node/author-cast-wave.py`: 역할별 팔레트 선택과 직접 고른 픽셀 문자열 교체. 원작 프레임에서 해당 행을 찾아 명시된 문자열만 바꾸고 `template.json`의 좌표 행으로 펼친다. 오른쪽은 원작의 좌우 반전 계약을 따라 같은 수정을 반영한다. 새로운 포즈를 자동 합성하지 않는다.
- 각 역할 폴더의 `template.json`: 원작 SHA·수정 행·팔레트·발 보호 규칙. `recipe.json`에는 재현 가능한 전체 수정 계약이 들어 있다. `replayed.px.json`은 수정 결과를 문자로 옮긴 기계적 중간 파일이다.
- `template.png` / `charset.png` / `changes.png`: 원작 / 수정본 / RGBA 수정 위치. `walk.gif`는 원본 픽셀 그대로4프레임130ms 걷기. `context.png`는 크기 비교 모형이다.
- 원작 간호사는 걷기 전체가 없는64×32 원본이므로 간호사 이솔은 걷기가 갖춰진 `woman_3`에 모자·제복을 수정했다. 정지 간호사 그림을 억지로 늘리지 않았다.
- 작업자는 처음 수정에서 안전모가 머리처럼 보여 모자 윤곽·넓은 챙을 추가했다. 일부 역할의 옆모습에서 복장 수정이 빠진 것은 모든 방향의 수정 검사로 찾아 보완했다.
- 16개 모두 1배와 확대 그림, GIF에서 추출한 네 방향 연속 프레임을 검토했다. 체형·표정·발 교대는 원작에서 유지된다. 역할별 미감의 최종 판정은 사용자 Allow/Deny다.

```sh
npm run harness -- pokemon-character-casting prepare-cast
npm run harness -- pokemon-character-casting serve --host 0.0.0.0 --port 18316
```

`prepare-cast`는15파생안을 재생성하고 기존 나루 v2 묶음을 등록한 뒤16역할이 모두 유효할 때만 `waves/full-cast-v1.json`을 원자적으로 저장한다. 같은 입력은 같은 후보 ID를 재사용한다. 기존 판정은 유지하며 자동 승인·실제 게임 반영은 하지 않는다. 걷기 승인에 전투 초상화 승인을 포함시키지 않는다.

영구 저장: `~/.local/share/oprn/pokemon-character-casting/casting.sqlite`와 `candidates/<id>/`, `waves/full-cast-v1.json`.
검증 증거: `verify-shots/pokemon-character-casting-full-cast/SUMMARY.md`.
