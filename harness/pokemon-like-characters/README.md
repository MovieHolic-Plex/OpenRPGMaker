# Pokémon-like Character Harness

**이 폴더만 복사해서 사용합니다. 에디터, 게임 DB, API 키, Node 패키지 설치 없이 실행됩니다.**
필요한 실행 환경은 **Node.js 24+ · Python 3.10+ · Pillow 12.1.1**입니다.

잘 나온 원작의 몸·얼굴·걸음걸이를 판형으로 유지하고, 머리·옷·장신구의 **명시적 픽셀 행**을 수정합니다.
큰 그림을 축소하거나 랜덤하게 캐릭터를 합성하지 않습니다. 자동 검사는 규격을 확인하고, 외형 승인은 사람이 합니다.

## 바로 실행

```bash
cd /path/to/harness/pokemon-like-characters
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
export POKEMON_HARNESS_PYTHON="$PWD/.venv/bin/python"
node cli.mjs doctor
node cli.mjs prepare
node cli.mjs serve --port 18317
```

브라우저: **http://127.0.0.1:18317/?wave=full-cast-v1**
포트가 사용 중이면 `--port`로 다른 포트를 고릅니다. 기존 프로세스를 종료하지 않습니다.
Windows는 `.venv/Scripts/python.exe`, PowerShell 환경 변수는 `$env:POKEMON_HARNESS_PYTHON`을 사용합니다.
이미 지정 버전의 Pillow가 설치되어 있으면 venv 설치 단계 없이 실행할 수 있습니다.

`prepare`는 포함된 **16역할 / 192포즈** 예제를 실제 원본 판형과 수정 내역으로부터 다시 굽고 검사를 거쳐 등록합니다.
같은 입력으로 반복하면 같은 후보 ID를 재사용하고 판정은 보존합니다. 예제 파일에 자동 생성 AI나 네트워크 호출은 없습니다.

## 다음 캐릭터 만들기

```bash
node cli.mjs templates
node cli.mjs new --from explorer --name '탐험가 두 번째 안' --out /path/to/drafts/explorer-v3
```

초안에 다음 네 파일이 생깁니다.

| 파일 | 용도 |
|---|---|
| `original.png` | 실제 원작 판형 12포즈. 먼저 이미지로 확인 |
| `original-grid.json` | 원본 팔레트와 포즈별 16자×32행 좌표 |
| `template.json` | 명시적인 팔레트·행 수정. 이것을 AI/저작자가 편집 |
| `candidate.json` | 역할, 버전, 외형 설명, 출처 |

**`new`는 출발용 수정안을 복사합니다. 이름만 바꿔 새 그림을 만들지는 않습니다.**
`template.json`의 `paletteOverrides`, `patches`와 `candidate.json`의 외형 설명을 직접 수정합니다.
다음 작업을 AI에게 맡길 때는 [AGENTS.md](AGENTS.md)와 [저작 절차](docs/AUTHORING.md)를 함께 읽게 하세요.

```bash
node cli.mjs render --draft /path/to/drafts/explorer-v3 --out /path/to/bundles/explorer-v3
node cli.mjs serve --port 18317
```

새 후보는 검토 화면의 **묶음 → 모든 후보**에서 확인합니다. `full-cast-v1`은 기존 16종을 묶어 보여주는 필터입니다.
`render`는 PNG·GIF·수정 위치·출처 재현·발 보존·모션·유사성을 검사한 뒤 미결정으로 등록합니다.
동일한 몸통을 재사용해도 출처와 실제 수정이 재현돼야 하며, 색만 바꾸는 후보는 새 캐릭터로 통과하지 않습니다.
실패한 수정안의 출력은 고쳐서 새 경로로 렌더합니다. 이미 만들어진 후보 패키지는 덮어쓰지 않습니다.

## 사람이 검토하고 내보내기

화면에서 원작/수정본/차이, 원본 크기/4배 GIF, 프레임 이동, 12포즈, 밝은/어두운/초록 배경을 확인합니다.
다섯 검토 항목을 확인하면 **Allow**, 수정 이유를 쓰면 **Deny**할 수 있습니다.
같은 역할의 새 안을 Allow하면 현재 선택이 바뀝니다. Deny는 이전 승인을 취소합니다.
승인은 후보 파일과 검사 구현의 해시에 묶입니다. 파일이 바뀌면 `stale`이 되어 내보내기가 차단됩니다.

```bash
node cli.mjs status
node cli.mjs verify
node cli.mjs export --id explorer-실제후보ID --out /path/to/exports/explorer
```

또는 승인된 후보의 **승인 결과 다운로드**를 누릅니다.
내보내기는 `charset.png`, `walk.gif`, `sprite.json`, 원본/수정 차이와 출처, 승인 영수증을 제공합니다.
`48×128` 시트, `16×32` 프레임, 행 `up/right/down/left`, 열 `stepA/idle/stepB`, 재생 `0→1→2→1`, **130ms**입니다.
어떤 엔진에서든 `sprite.json`을 읽어 사용할 수 있습니다. 특정 게임의 slot/DB/asset ID는 포함하지 않습니다.

## 저장·이동

기본 저장소는 폴더 내부 `.data/`입니다. 모든 관련 명령에 `--data /path/to/store` 또는
`POKEMON_HARNESS_DATA`로 저장소를 지정할 수 있습니다. 서로 다른 게임/작업은 별도 저장소를 사용하세요.

- `casting.sqlite`: 후보와 Allow/Deny 이력
- `candidates/`: 변경 불가 PNG/GIF/검사/출처 패키지
- `receipts/`: 판정 영수증
- `waves/`: 검토 묶음

**서버를 정상 종료한 뒤 저장소 전체를 함께 복사**하면 후보와 승인 이력이 이동합니다. 폴더 위치가 바뀌어도 사용할 수 있습니다.
`prepare`는 이전 에디터 하네스의 판정을 가져오지 않습니다. 기존 화면과 이 도구의 검토 저장소는 별도입니다.

## 작동 검증

에디터 없는 임시 폴더로 도구 전체를 복사해 생성·재실행·파일 검사·HTTP 판정·승인/거절·내보내기·재시작·저장소 이동·위변조를 검사합니다.
테스트의 Allow/Deny는 **삭제되는 임시 QA 저장소**에서만 실행됩니다.

```bash
node tests/verify.mjs --out /path/to/evidence
```

실제 브라우저 조작 검사만 개발 의존성이 필요합니다.

```bash
npm ci
npx playwright install chromium
node tests/browser.mjs --data /path/to/store --out /path/to/browser-evidence
```

`tests/browser.mjs`도 전달된 저장소를 SQLite 백업 API로 복사해 별도 서버에서 조작합니다. 원본 판정은 수정하지 않습니다.
Linux에서 브라우저 시스템 라이브러리가 없으면 Playwright 설치 안내에 따라 추가하세요.

## 구조와 수정

- `cli.mjs`: 독립 실행 입구
- `examples/`: 16종의 사람이 읽을 수 있는 수정안
- `references/`: 원본 칩셋, 출처 URL, SHA-256
- `lib/`: 렌더러, 승인 서버, 검수 UI, SQLite, 실행 가능한 검사 번들
- `core/`: 기존 모션 검사의 독립된 원본 소스
- `docs/`: 다음 AI/저작자를 위한 규칙
- `tests/`: 격리 검증과 브라우저 검증

보통 작업은 `template.json`을 편집하면 됩니다. 검사 구현을 바꾸면 기존 승인과 패키지의 검수 상태가 무효화됩니다.
`core/`를 수정할 때는 `npm ci && npm run build:core`로 `lib/native.cjs`를 다시 만드세요.
이 번들에는 pngjs가 포함되어 실행 시 npm 설치가 필요 없습니다. 빌드 의존성은 lockfile로 고정되어 있습니다.

범위는 **필드 걷기 캐릭터**입니다. 전투 초상화·스토리 이벤트·게임 배치 작업은 포함하지 않습니다.
원작 그림은 Nintendo / Game Freak / Creatures의 자산이며, 포함된 후보는 판형을 부분 수정한 파생 그림입니다.
독립 창작 원화로 표시하지 않습니다. 자세한 출처는 [ATTRIBUTION](references/ATTRIBUTION.md), pngjs는 [라이선스](core/PNGJS-LICENSE.txt)에 있습니다.

## 다른 작업 폴더로 배포

```bash
node scripts/copy.mjs --out /another/project/harness/pokemon-like-characters
```

코드·원본·수정안·문서만 복사하고 파일별 SHA-256을 `distribution.json`에 남깁니다.
의존성 폴더와 사용자 저장소·승인은 복사하지 않습니다. 검토 이력을 함께 이동하려면 위 저장·이동 절차를 별도로 따르세요.
