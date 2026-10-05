# Pokémon-like Field Kit

에디터에서 독립된 **필드 몬스터·UI·음악 후보 검토 도구**입니다. 게임 완성본이나 런타임 교체 패키지가 아닙니다.
그림, UI, 음악의 현재 파일 해시에 대해 각각 사람이 Allow/Deny 합니다. 자동 적용은 없습니다.

## 실행

Node 24+, Python 3.10+, Pillow 12.1.1이 필요합니다. npm 설치, 에디터, API 키, 프로젝트 DB가 필요 없습니다.

```sh
python3 render.py
node compose.mjs
node package.mjs
node server.mjs --host 0.0.0.0 --port 18327
```

이미 구워진 파일은 `node server.mjs`만으로 검토할 수 있습니다. 코드/미디어를 고쳤으면 manifest를 다시 만들고 서버를 재시작합니다.
다른 곳에 복사할 때는 `.data`, `__pycache__`, `evidence`를 빼고 이 디렉토리를 통째로 복사합니다.
판정도 옮길 경우 `.data`를 별도로 보존합니다. `--data /path/to/reviews`로 저장 위치를 지정할 수 있습니다.

## 이번 후보

- **눈송냥**: 원작 포챠나의 네발 보행을 판형으로 삼은 32×32 파생 그림. 9개 원본 포즈에서 머리·귀·눈·털을 직접 수정. 원본 발 픽셀 배열 보존. 정면/좌/우/후면, `stepA→idle→stepB→idle`, 150ms씩. 이미지 축소 없음.
- **UI 시안**: 240×160의 정수 확대, Galmuri9, 민트/크림색 창. 필드, Esc 메뉴, 6칸 파티, 가방, 상점. 회복약·구매는 이 페이지의 임시 상태만 바꿉니다. 실제 게임 저장·전투·도감 기능을 구현한 것으로 보고하지 않습니다.
- **음악**: 공통 D장조 모티프를 마을 88BPM/16마디와 길 124BPM/16마디로 편곡. 플루트·벨·베이스·화음·타악기. 오리지널 악보를 결정론적 PCM으로 합성. 커서130ms, 확인/취소240ms. 현재 게임 마을곡과 A/B 가능.

## 저작 / 검토 계약

1. `references/source.json`의 실제 그림을 먼저 본다. `recipes/flurrykit.py`의 명시적 픽셀 행·좌표를 고친다. 16×32 사람 판형 검사로 몬스터를 억지로 맞추지 않는다.
2. `render.py`: 소스SHA, 규격, 색수, 발 보호, 실제 GIF 디코드 검사를 수행한다. `site/assets/decoded.png`와 `comparison.gif`를 직접 확인한다.
3. `compose.mjs`: 실제 음표·박자·편곡 원본. `lib/musicScore.ts`는 에디터 소스에서 분리한 독립 렌더러 사본. 실제 WAV와 음량/루프 경계 측정값을 보존한다. 모델은 음원을 들었다고 주장하지 않는다.
4. `package.mjs`: 원본·레시피·렌더러·UI·최종 미디어를 해시로 묶는다. 변경되면 기존 판정은 현재 후보에 적용되지 않는다.
5. 서버는 같은 출처의 브라우저 POST만 받고, Allow의 확인란 2개와 Deny의 의견을 확인한다. `.data/review-*.json`에 개별 영수증을 배타적으로 생성한다. CLI 자동 승인 금지.
6. `node package.mjs export /new/output [review-data-directory]`: 현재 세 패키지 모두 실제 Allow일 때만 검토 패키지를 내보낸다. 이 결과가 게임 적용이나 에디터 정본 저장의 증거는 아니다.
7. 실제 게임 연결은 별도 어댑터 작업이다. 승인된 `sprite.json`의 크기/방향/앵커를 유지하고, 음악 리소스·메뉴 설정은 실제 프로젝트 저장 서비스로 저장한 후 재로드한다.

## 브라우저 근거

`browser-evidence.mjs`는 Playwright 경로를 `FIELD_KIT_PLAYWRIGHT`로 받습니다. 외부 프로젝트 패키지에 종속된 런타임 의존성은 아닙니다.
상주 서버에 대한 검사는 읽기·조작만 합니다. 합성 Allow/Deny의 서버 검사는 **별도 임시 데이터 디렉토리**에서만 수행해야 합니다.
브라우저 검사 근거는 `evidence/`에 남기며, 사람이 실제 화면/소리를 평가한 기록과 구분합니다.

## 출처

- 원작 판형: Nintendo / Game Freak / Creatures, [pret/pokeemerald의 포챠나 필드 그림](https://github.com/pret/pokeemerald/blob/master/graphics/object_events/pics/pokemon/poochyena.png). 다운로드 URL·SHA는 `references/source.json`.
- 글꼴: Galmuri9, SIL Open Font License. `references/Galmuri-LICENSE.txt`.
- 기존 마을곡: 별빛섬 몬스터 원정의 `mx_audio_town`에서 비교 목적으로 추출. 게임 프로젝트의 현행 곡이며 이번 새 편곡이 아니다.
- 이번 악보·픽셀 수정·검토 UI: Codex 저작. 원작 판형에서 파생한 그림을 독립 창작 원화로 표시하지 않는다.
