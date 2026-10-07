# 테마 주민·조련사 · 판형 수정 v1 (theme-cast-v1)

사막·설원·해안 테마 게임에서 마을 주민과 도로 조련사가 초록 마을 사람처럼 보이던 문제를 고치기 위한 걷기 후보다.
에메랄드 원작 걷기 그림을 체형·걷기 판형으로 쓰고 머리·복장 행과 팔레트만 명시적으로 고쳤다. 9역할 × 12포즈 = 108포즈.
원작은 Nintendo / Game Freak / Creatures 작품이며 Claude(Opus 5.5)가 부분 수정을 저작했다. 독립 창작 원화가 아니다.
**모든 후보는 사용자 Allow 전까지 미결정**이며, 저작자·감독자가 대신 판정하지 않는다.

검토: http://mdc-server:18316/?wave=theme-cast-v1 · 비교 시트: http://mdc-server:18301/theme-cast-v1.html

| 테마 | 역할 id | 검토용 이름 | 판형 | 후보 ID | 수정 요지 |
|---|---|---|---|---|---|
| 사막 | `desert_resident_m` | 사이프 | `pokefan_m` | `desert_resident_m-7f34daa381a6419f` | 흰 터번+붉은 띠, 얼굴 옆 머릿수건, 황토 상의·붉은 허리띠, 청록 바지 |
| 사막 | `desert_resident_f` | 라일라 | `woman_2` | `desert_resident_f-6ca054170531e956` | 남색 머릿수건이 얼굴을 감쌈, 이마 금빛 띠, 상아색 긴 드레스·금빛 단 |
| 사막 | `desert_trainer` | 카심 | `boy_1` | `desert_trainer-b9ba30dc490f67f7` | 넓은 챙 모래빛 모자+붉은 띠, 녹슨 주황 상의, 갈색 바지·장화 |
| 설원 | `snow_resident_m` | 보리스 | `fat_man` | `snow_resident_m-71e6d6bdba1517c6` | 흰 골지 단의 둥근 남색 털모자, 흰 지퍼·흰 밑단의 붉은 파카 |
| 설원 | `snow_resident_f` | 니나 | `woman_5` | `snow_resident_f-60420446102634c2` | 흰 털 테두리 보랏빛 후드, 같은 색 긴 코트, 갈색 허리띠·장화 |
| 설원 | `snow_trainer` | 카이 | `man_4` | `snow_trainer-b1af6df88dd0952e` | 청록 털모자 위 노란 고글, 노란 반사띠 주황 재킷, 흰 플리스 |
| 해안 | `coast_resident_m` | 마루 | `fisherman` | `coast_resident_m-fc6e222b72f6cce9` | 파란 띠 넓은 챙 밀짚모자, 흰 속셔츠가 보이는 하늘색 무늬 반소매 |
| 해안 | `coast_resident_f` | 하나 | `woman_1` | `coast_resident_f-d2022bc4d64559b9` | 산호색 리본의 넓은 챙 흰 햇빛모자, 노란 허리끈 산호색 원피스 |
| 해안 | `coast_trainer` | 파도 | `youngster` | `coast_trainer-a96dc7cf5694ff19` | 남색 띠·리본 꼬리 흰 수병모, 남색·흰 줄무늬 셔츠 |

판형은 기존 full-cast-v1 16역할이 쓰지 않은 원작 9종이다(`references/sources.json`에 URL·SHA 고정). 처음 고른 `man_2`는
full-cast-v1 회사요원(`devon_employee`)과 원작 몸체가 같아 diversity 관문이 「출처가 다른 동일 몸체」로 막았고, 관문을 풀지 않고 `pokefan_m`으로 바꿨다.

## 저작과 재현

- `cast.json`: 역할별 팔레트와 규칙. 규칙은 `sub`(원작 행의 문자열을 그대로 바꾸는 literal 치환)와 `map`(지정 행·열의 팔레트 번호 바꾸기) 두 종류뿐이다.
  `rel`은 각 포즈의 맨 윗 잉크 행 기준이라 걷기 흔들림(1px 하강)에도 같은 부위에 적용된다. `side` 규칙은 왼쪽에 그대로, 오른쪽에 거울로 적용된다.
- `src/harnesses/pokemon-character-casting/node/author-theme-cast.py`: 규칙을 원작 포즈 좌표에서 펼쳐 `template.json`(전체 행 패치)을 쓰고,
  기존 `render-template.py`로 묶음을 만든 뒤 `context.png`를 테마 지면 타일 배치 모형으로 바꾸고 recipe/origin의 저작자를 바로잡는다.
  발·다리 4행(28~31)은 건드리지 않으며 `template.py`가 재생·검사한다(12포즈 모두 머리 ≥4·복장 ≥2 수정).
- 각 역할 폴더: `template.json`·`recipe.json`(재현 계약)·`template.png`/`charset.png`/`changes.png`(원작/수정본/바뀐 픽셀)·`walk.gif`·`context.png`.
- `src/harnesses/pokemon-character-casting/node/prepare-theme-cast.mjs`: 9묶음을 큐에 넣고 모두 검증되면 `waves/theme-cast-v1.json`을 원자적으로 쓴다.
  다른 묶음을 철회하지 않고 판정도 건드리지 않는다. 같은 입력은 같은 후보 ID를 다시 쓴다.

```sh
npm run harness -- pokemon-character-casting prepare-theme-cast
npm run harness -- pokemon-character-casting serve --host 0.0.0.0 --port 18316
# 미리보기만: python3 src/harnesses/pokemon-character-casting/node/author-theme-cast.py --dry --preview /tmp/theme.png
```

## 알려진 약점 (적대적 육안 검수 메모)

- 사이프: 판형이 짧은 상의 체형이라 「긴 로브」로는 읽히지 않는다. 허리띠 붉은색도 1행이라 약하다.
- 라일라: 옆모습에서 원작의 뒤로 뻗은 머리 덩어리가 그대로 남색 수건 자락으로 보인다(의도). 드레스는 연한 색이라 모래 위에서 윤곽선에 의존한다.
- 카이: 고글은 아래·옆에서 노란 점 2~3px, 위에서는 검은 끈 한 줄이라 작다. 원작의 검은 머리끝이 모자 밖으로 남는다.
- 해안 3종: 풀/모래 두 지면 모두에서 읽히지만 밀짚모자 노랑은 모래와 색이 가깝고 윤곽선 덕분에 구분된다.
- 배치 모형은 지면 타일 위 모형이며 실제 런타임 화면 검수가 아니다. 게임 반영은 사용자 Allow 후 별도 작업이다.
