# 최종 HTML 직접 검증

## 대상과 범위

- 파일: `reports/life-audit-2026-09-05/index.html`.
- 작업 브랜치: `agent/life-audit-p2`.
- 기반: Phase 1 승인 후 병합 커밋 `7aedf828a9daeb676fddc6a049c28d36bceb90eb`.
- 검사자는 감독자 세션이다. 구현자의 자체 검사와 독립 내용 검증을 대체하지 않고 추가했다.
- 기존 감사의 기준 소스는 `32ef1bcd`이며 HTML 작업은 제품 코드나 원격 데이터를 수정하지 않는다.

## 실제 브라우저 검사

저장소에 이미 설치된 Playwright Chromium을 `headless: true`,
`--no-sandbox`, `--disable-dev-shm-usage`로 실행했다.
각 화면 폭마다 별도 페이지를 만들었으며 JavaScript를 비활성화했다.

```text
file:///home/main/z-project/rpg-zzu-life-audit-p2/reports/life-audit-2026-09-05/index.html
viewport: 375×960, 768×960, 1280×960
javaScriptEnabled: false
```

모든 이미지의 `loading`을 검사 중 `eager`로 전환한 뒤 각각 `decode()` 완료를 확인했다.
이는 이미지 로드 검증이며 네트워크 성능 또는 원래 지연 로딩 성능을 측정한 것이 아니다.

각 페이지에서 다음을 직접 실행했다.

1. `Tab → Enter`로 본문 건너뛰기 링크를 사용하고 목적지 `#main`을 확인했다.
2. `#C1 summary`에 키보드 초점을 놓고 Enter로 펼침·접힘을 확인했다.
3. 기본 접힘 상태의 실제 문서 폭, 이미지 수, 기능·발견사항 수를 읽었다.
4. 표제, 증거 범례, 발견사항, 실측, 7개 탭 개요, 저장·날짜 경계, 검증 절을 캡처했다.
5. `details.feature` 51개의 summary를 각각 클릭하여 실제 네이티브 펼침을 실행했다.
6. 펼침 후 153개 상세 필드가 크기를 갖고 보이는지, 본문 요소가 화면 좌우를 벗어나는지 검사했다.
7. 펼쳐진 7개 탭 상세를 각각 추가 캡처했다.
8. 고유 내부 목적지 31개를 실제 링크로 이동했다. 건너뛰기 링크는 키보드 경로로 검사했다.
9. 원본 이미지 링크를 열어 PNG URL로 이동하는 것을 확인했다.

### 결과

| 화면 폭 | 접힘/펼침 문서 폭 | 이미지 decode | 기능/발견사항 | 펼침/상세 필드 | 본문 가로 돌출 | 잘못된 내부 목적지 | 외부 요청/페이지 오류 |
|---|---|---|---|---|---|---|---|
| 375 | 375 / 375 | 31/31 | 51 / 13 | 51 / 153 | 0 | 0/31 | 0 / 0 |
| 768 | 768 / 768 | 31/31 | 51 / 13 | 51 / 153 | 0 | 0/31 | 0 / 0 |
| 1280 | 1280 / 1280 | 31/31 | 51 / 13 | 51 / 153 | 0 | 0/31 | 0 / 0 |

세 폭 모두 키보드 건너뛰기·상세 펼침과 원본 이미지 열기가 통과했다.
돌출 검사 대상은 실제 크기를 가진 `p, li, dt, dd, th, td, h1, h2, h3, h4,
summary, pre, figure, img`이며 `left < -0.5` 또는 `right > innerWidth + 0.5`를 검출했다.
문서의 넘침을 숨겨 검사를 통과시키지 않았다.

### 캡처

검증용 임시 이미지 위치: `/tmp/life-audit-html-qa-20260905/`.
폭마다 14장, 총 **42장**이다. 보고서에 싣는 기존 증거 PNG 31장과 구별한다.
임시 QA 이미지 자체를 배포용 보고서 의존성으로 사용하지 않는다.

폭 접두사 `375-`, `768-`, `1280-`에 다음 이름이 붙는다.

```text
hero.png
evidence.png
findings.png
runtime.png
tabs.png
boundaries.png
verification.png
tab-crops-expanded.png
tab-characters-expanded.png
tab-life-crafting-expanded.png
tab-daily-weather-expanded.png
tab-farm-animals-expanded.png
tab-farm-spatial-expanded.png
tab-life-collections-expanded.png
```

## 독립 내용 검증과 수정

mass-ulw Phase 2 그래프:
`dag_5b276bdc-3bd8-44e9-a18a-964be07d9c08`.

최초 검증은 HTML 재편집 전 절 번호와 누락된 호출 검색 안내를 지적했다.
내부 안내를 실제 `#runtime`, `#storage-j`, `#storage-p`, `#checks` 목적지로 고치고
승인 원장 6.2절의 검색 명령·결과·귀속·정적 증거 한계를 HTML에 추가했다.
기능 내용·기존 이미지·제품 코드는 변경하지 않았다.

수정본의 독립 검증자 `st_01a072cf`는 **PASS**를 반환했다.
7개 탭, 51개 상세의 제목/저작/소비자/조건/저장 값과 소스 링크 차이 0건,
13개 발견사항, 고유 소스/테스트 인용 191개, 원본 PNG 31개, 설명 도식 2개를 확인했다.
이 PASS는 내용·정적 HTML 동작 검증이며 ultrabrain 최종 승인과 다르다.

## 정적 검사와 한계

- `git diff 7aedf828 --stat -- src test scripts package.json`: 출력 없음, 종료 코드 0.
- `git diff --check`: 종료 코드 0.
- HTML LSP 요청: Biome 실행 파일이 없어 실행 불가. 제품 의존성을 추가하지 않았다.
- 단일 정적 HTML이므로 프레임워크 빌드나 새 산문 고정 테스트는 만들지 않았다.
- 제품 감사의 집중 테스트 406 통과/4 실패와 전체 게이트 30분 timeout은 그대로 공개한다.
  HTML의 DOM 검증 통과를 제품 테스트 통과나 생활 시스템 완주로 바꾸어 쓰지 않는다.
- 기본 텍스트 추출 도구는 모바일 표제·판정·필드 캡션과 박물관 150G·기부 메시지를 읽었다.
  이는 기본 내용 확인이며 정밀한 시각 검수 또는 미적 품질 판정이 아니다.
- Read 이미지 도구의 모델 경로가 픽셀을 제공하지 않는 한계는 남아 있다.
  위 결과는 실제 Chromium의 로드·기하·탐색 및 캡처 증거다. 한글 글리프의 픽셀 품질,
  원래 게임 그래픽의 미적 품질, 인쇄 페이지의 조판 품질을 독립 승인했다고 주장하지 않는다.

## 전달 범위

`index.html`은 외부 서버 없이 로컬 파일로 열린다. 이미지는 같은 디렉터리의
`images/`를 사용하므로 보고서를 다른 위치로 옮길 때 이 디렉터리도 함께 옮긴다.
7개 탭의 전체 51개 상세는 HTML 안에 있으며 Markdown 파일을 따로 열 필요가 없다.
