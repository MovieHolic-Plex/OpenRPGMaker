# atlas 실내 100곳 — 민가·저택·상점·여관·길드·학교·공공시설·공방·성·성소·배·기후

Tibo 실내 확장 시트(`tibo_interior_expanded`) 한 장으로 만든 실내 100곳. 지형·배치 참고 사례(문 이동·NPC·상점·대사
이벤트 없음). 정본 `.oprn-projects/atlas-interiors-20260925`에 저장하고, 공용 DB 라이브러리
`oprn-atlas-interiors-20260925`에 장소 100곳으로 게시한다. 재사용 조각 54개는 `shared-objects.json`.

| 묶음 | 수 | 맵 |
|---|---|---|
| 민가·저택 (`homes`) | 15 | 가난한 오두막·농가·어부·사냥꾼·약초꾼·학자의 집, 부잣집 1·2층, 저택 현관 홀 ↔ 2층 침실·연회실·서재·응접실, 지하 창고 집 1층 ↔ 지하 |
| 상점 (`shops`) | 14 | 무기·방어구·도구·잡화·꽃·빵·정육·양복·보석·서점·골동품·마법 도구·약방·지도 |
| 여관·주점 (`taverns`) | 5 | 길가 여관 1층 ↔ 2층, 항구 선술집, 음유시인 무대 주점, 광부 주점 |
| 길드 (`guilds`) | 6 | 모험가·상인·도둑·마법사·기사단·길드장 집무실 |
| 학교 (`schools`) | 4 | 칠판 교실·학원 강당·큰 도서관·지하 문서고 |
| 공공시설 (`civic`) | 10 | 병실·진료소·은행 창구·지하 금고·극장 객석·분장실·공중 목욕탕·산골 온천·카지노·암시장 경매장 |
| 치안·관청 (`civic2`) | 6 | 경비 초소·마을 감옥·병영·시청 회의실·우체국·고아원 |
| 공방 (`crafts`) | 10 | 대장간·목공소·유리·가죽·직조·물방앗간·풍차 1층 ↔ 2층·양조장·빵 공방 |
| 성 (`castle`) | 10 | 알현실·어전 회의실·왕의 침실·왕실 서고·예배당·성 부엌 ↔ 지하 저장고·탑 꼭대기 방·왕자의 방·근위대 대기실 |
| 성소 (`sacred`) | 6 | 마을 예배당 ↔ 지하 납골당·여신 신전·산속 사당·수도원 공동 침실·필사실 |
| 배 (`ships`) | 2 | 선장실·갑판 아래 선창 |
| 기후 (`climate`) | 12 | 사막(사암 집·향신료 시장·오아시스 여관), 설원(오두막·산장 여관·모피 교역소), 화산(드워프 대장간·불의 사당·광부의 집), 가을(추수 곳간·사과주 집·추수 잔치 회관) |

층 짝(↔): 위층은 아래층 동벽/뒷벽 3칸 폭 오르막 141|111|171의 가운데 x에 1×1 내리막 474 하나(쌍으로 두지 않는다). 계단으로만
드나드는 층(2층·지하·선창)은 남쪽 문을 천장으로 닫는다.

## 새 타일 (Tibo 69~71행, 2070~2159)

0~68행은 픽셀 그대로(굽는 스크립트가 원본 SHA-256을 확인한다). 새 칸은 모두 69행 이후.

| 칸 | 물건 | 킷 |
|---|---|---|
| 2070~2077 / 2078~2083 | 뒷모습 긴 의자 4×2 / 3×2(북쪽 제단·무대를 봄) | `tibo-atlas-pew-back`, `-pew-back-3` |
| 2084~2087 | 창살 왼끝·가운데·오른끝·창살 문(막힘) | `bars()` |
| 2088~2091 | 둥근 금고 문 2×2(벽걸이) | `tibo-atlas-vault-door` |
| 2092~2097 | 칠판 3×2(벽걸이) | `tibo-atlas-blackboard` |
| 2100~2105 | 보석 진열 카운터 3×2 | `tibo-atlas-jewel-counter` |
| 2106~2109 | 룰렛 탁자 2×2 | `tibo-atlas-roulette` |
| 2110~2121 | 돌 욕조 4×3 | `tibo-atlas-bath` |
| 2122~2125 / 2126~2129 | 고기 걸이 2×2 / 가죽 건조틀 2×2 | `tibo-atlas-meat-rack`, `-hide-frame` |
| 2130~2133 | 무대 앞면 왼·가운데·오른(막힘)·무대 계단(통행) | `stage()` |
| 2134~2139 | 창살 창구 카운터 3×2 | `tibo-atlas-teller-counter` |
| 2140~2147 | 한 줄 탁자 앞면(나무·흰 천), 1칸 폭 탁자 다리 | `table()` |

## 규칙 (저작 스크립트가 멈추는 조건)

- 위층 겹침, 탁상 소품이 탁자 밖, 벽걸이가 벽면 두 줄 밖, 바닥 가구가 벽 위, 의자 곁에 탁자 없음.
- 의자 방향: 267은 탁자 북쪽(남쪽을 봄), 268은 남쪽, 297·580·584·588은 서쪽, 298은 동쪽. 걸상은 아무 쪽.
- 긴 의자는 뒷모습만(앞모습 1814~1847은 거부). 탁자는 윗면 + 다리 앞면(`table()`이 맨 아래 줄을 앞면으로 바꾼다).
- 입구에서 모든 맨바닥·목표 칸이 런타임 `canMove`로 닿아야 한다(잠긴 감방·금고 안은 `sealed`로 명시).
- 빈칸: `emptiness.txt` — `/tmp/oprn-qa/emptiness.py --kind interior --plain 42,72,73,102,103,163,222,223,192,1998,1999,12,13,43,162`
  maxSq ≤3·화면 ≤30%, 100곳 전부 통과.

| 파일 | 내용 |
|---|---|
| `catalog.json` | 계획(묶음·용도·입구·목표·놓은 소품)·맵 100장·타일셋 |
| `validation.json` | 입구에서 목표까지 닿는지, 밀폐 칸, 배치 규칙 결과 |
| `shared-objects.json` | 재사용 조각 54개(`interiors/<id>`, 소유 설명·출처 맵, 맨바닥·벽면은 -1) |
| `images/` | 앱 렌더러로 그린 원본 픽셀 그림 |
| `storage-proof.json` | 정본 저장·재오픈 증명 |
| `shared-library-proof.json` | 공용 DB 게시(원본·공용 타일셋 렌더 픽셀 동일) 증명 |
| `emptiness.txt` | 빈칸 검사 결과 |

재생성 순서(dev 서버 `npm run dev:worktree`가 떠 있어야 렌더·게시된다):

```bash
python3 scripts/content/bake-atlas-interior-tiles.py          # 시트를 69행으로 자르고(SHA 확인) 69~71행 덧붙임
node scripts/content/register-atlas-interior-tiles.mjs        # tiboRecoveredTileset.json 칸 수·통행·라벨·킷
node scripts/content/author-atlas-interiors.mjs                # 100곳 저작 + 검사 + shared-objects.json
DEV_URL=http://127.0.0.1:<port> node scripts/content/render-atlas-interiors.mjs
node scripts/content/save-atlas-interiors.mjs                  # 정본 저장·재오픈
DEV_URL=http://127.0.0.1:<port> node scripts/content/publish-atlas-interiors-library.mjs   # 공용 DB(--dry 로 먼저)
```

방 코드는 `scripts/content/atlas-interiors/*.mjs`(묶음별), 공통 문법·검사는 `kit.mjs`. 시각 QA 기록은 `verify-shots/atlas-interiors/QA.md`.
