# Astra Horizon 적대적 시각 QA 리뷰 (`/tmp/astra-review/argon-r1.md`)

검토 대상: `/tmp/astra-review/shots/` 내 전체 46장 PNG 전수 확인 완료.

---

### 1. [blocker] 엔딩 에필로그 및 최종 종료 화면 텍스트가 암전 필터에 묻혀 판독 불가
- **분류:** text overflow or unreadable text / broken or clipped dialogue/UI
- **증거 파일:** `/tmp/astra-review/shots/ending_05-ending-epilogue.png`, `/tmp/astra-review/shots/ending_06-ending-final.png`
- **화면 위치:** 화면 정중앙 타이틀·부제 영역(`x≈250..710, y≈125..320`) 및 하단 복귀 버튼(`x≈340..640, y≈370..420`)
- **문제:** `ending_05-ending-epilogue.png`에서 어두운 밤바다 배경(`RGB ~8..20`) 위의 `"우리의 여정 / 아스트라 호라이즌 / 여명의 날개"` 문구가 최대 밝기 `RGB(85, 84, 76)`(`"우리의 여정"`은 `RGB(58, 41, 40)`, 명암비 약 1.7:1)에 불과해 육안으로 거의 읽히지 않는다. `ending_06-ending-final.png`에서도 암전 오버레이가 텍스트 위까지 덮여 `"끝"`(`RGB 135`)과 유일한 탈출 메뉴인 `"▶ 타이틀로 돌아가기"`(`RGB 104, 94, 87`)가 배경에 심각하게 묻힌다.

### 2. [major] 챔피언전 전후 대화에서 주인공 캐릭터 스프라이트 완전 실종
- **분류:** art that looks wrong / anything that looks unfinished
- **증거 파일:** `/tmp/astra-review/shots/champion_02-talk.png`, `/tmp/astra-review/shots/ending_02-talk.png`
- **화면 위치:** 화면 정중앙 챔피언 단상(`x≈465..535, y≈175..310`)
- **문제:** 챔피언 나루와의 결전 직전(`champion_02-talk.png`)과 승리 직후(`ending_02-talk.png`) 대화 장면에서 주인공 캐릭터 스프라이트가 맵 어디에도 렌더링되지 않고 완전히 사라져 있다. 나루(`y≈175..255`) 바로 아래 칸에 동료 몬스터 토리프(`y≈250..308`, 왼쪽을 향함)만 서 있어 주인공 없이 몬스터 혼자 대면하는 기괴한 구도가 된다.

### 3. [major] 박사 소개 슬라이드의 빈 파란 화면, 실내 맵 외벽 테두리 노출 짜깁기, 완전 암전 및 스타터 연출 누락
- **분류:** ugly or broken maps / bad pacing signs / anything that looks unfinished
- **증거 파일:** `/tmp/astra-review/shots/op_prof-p1-end-085792.png`, `/tmp/astra-review/shots/op_prof-p2-end-090439.png`, `/tmp/astra-review/shots/op_prof-p5-end-104481.png`, `/tmp/astra-review/shots/op_prof-p6-end-109003.png`
- **화면 위치:** `op_prof-p1-end`·`op_prof-p6-end` 전체 화면(`x=0..960, y=0..640`), `op_prof-p2-end` 상단 경계(`y=0..25`) 및 우측 접합부(`x=800..960, y=0..640`), `op_prof-p5-end` 배경 전체
- **문제:** 지역 조망 구간인 `op_prof-p1-end-085792.png`는 지형 하나 없는 파란 단색 화면만 띄우며, `op_prof-p2-end-090439.png`는 상단 나무가 잘린 야외 마을(`다우닝 시티`) 옆 바다 위에 **실내 맵(`실바나 체육관`)의 회색·흰색 방 외벽 테두리**를 사각형째 붙여 놓아 하단(`y≈555..639`)에 빈 파란 여백까지 드러난다. 이어 `op_prof-p5-end-104481.png`는 평균 밝기 31.7로 너무 어두워 마을과 캐릭터가 거의 식별되지 않고, `op_prof-p6-end-109003.png`는 건너뛰기 UI조차 없는 완전한 검은 화면(`RGB 0,0,0`)이며, 의도된 스타터 몬스터 등장 슬라이드는 전 구간에서 누락되어 있다.

### 4. [major] 이름 입력 화면에서 현재 입력 중인 이름란·안내문·조작 버튼 부재 및 확정 이펙트 비대칭 깨짐
- **분류:** broken or clipped dialogue/UI / art that looks wrong
- **증거 파일:** `/tmp/astra-review/shots/op_name-showcase-119147.png`, `/tmp/astra-review/shots/op_name-confirm-119877.png`
- **화면 위치:** 좌측 캐릭터 쇼케이스 패널 전체(`x=0..285, y=0..640`) 및 우측 글자판 좌중단(`x≈286..340, y≈200..440`)
- **문제:** 우측 글자판 잘림(기인지 이슈)을 제외하고 보더라도, 좌측 쇼케이스 영역을 포함한 화면 어디에도 현재 조합 중인 이름 문자열·입력 커서·지우기/결정 버튼이 고정 표시되지 않아 플레이어가 무엇을 입력했는지 확인할 수 없다. 또한 `op_name-confirm-119877.png`에서는 확정 연출이 캐릭터 얼굴을 하얀 원으로 완전히 가린 채 오른쪽으로만 뻗는 사다리꼴 노란 광선 4줄로 깨져 `마/바/사` 버튼 위를 침범한다.

### 5. [major] 성별 선택 이전부터 소년 스프라이트가 선노출되고 연구소에서 내 방으로 역행하는 오프닝 동선 모순
- **분류:** anything that looks unfinished
- **증거 파일:** `/tmp/astra-review/shots/op_prof-p1-083466.png`, `/tmp/astra-review/shots/op_prof-p5-end-104481.png`, `/tmp/astra-review/shots/op_choice-112764.png`, `/tmp/astra-review/shots/op_name-after-122007.png`
- **화면 위치:** 각 장면 중앙 주인공 위치(`op_prof-p1` `x≈468..532, y≈360..465`; `op_choice`·`op_name-after` `x≈400..475, y≈300..425`)
- **문제:** 성별 질문(`op_choice-112764.png`, `"너는 소년이니, 소녀니?"`)을 받기 전인 `op_prof-p1-083466.png`·`op_prof-p5-end-104481.png`와 선택 직전 방 화면까지 내내 소년 스프라이트가 서 있다가 소녀를 고른 뒤(`op_name-after-122007.png`)에야 제자리에서 소녀 도트로 뒤바뀐다. 게다가 `op_prof-p1`에서 이미 연구소 박사 코앞에 서 있었는데 `op_prof-p5`에서 `"네 방에서 모험이 시작된다. 준비가 되면 연구소로 오렴!"`이라고 안내해 연출 순서가 앞뒤가 맞지 않는다.

### 6. [major] 맵 도착 직후 동료 몬스터(`토리프`)가 주인공과 동일 타일에 겹쳐 머리에서 귀와 꼬리가 솟아남
- **분류:** art that looks wrong / ugly or broken maps
- **증거 파일:** `/tmp/astra-review/shots/first-town-grove_01-arrive.png`, `/tmp/astra-review/shots/gym-entrance_01-arrive.png`, `/tmp/astra-review/shots/temple-observatory_01-arrive.png`
- **화면 위치:** 화면 중앙 주인공 머리·모자 둘레(`first-town-grove` `x≈470..535, y≈255..305`; `gym-entrance` `x≈475..525, y≈305..355`; `temple-observatory` `x≈465..530, y≈250..305`)
- **문제:** 세 맵 모두 진입 직후(`01-arrive`) 동료 몬스터 토리프가 주인공 한 칸 뒤가 아니라 주인공과 완전히 같은 좌표에 겹쳐 스폰된다. 이 때문에 주인공의 청록색 모자 양옆과 뒤로 토리프의 초록색 귀·꽃·말린 꼬리가 기형적으로 삐져나와 캐릭터 실루엣이 훼손된다.

### 7. [major] 콜드오픈 초원의 느낌표 말풍선 허공 이탈·크기 불일치·테두리 침범 및 스타터 발 잘림
- **분류:** broken or clipped dialogue/UI / art that looks wrong
- **증거 파일:** `/tmp/astra-review/shots/op_intro-p3-050620.png`, `/tmp/astra-review/shots/op_intro-p3-052648.png`, `/tmp/astra-review/shots/op_prof-p1-083466.png`
- **화면 위치:** `op_intro-p3-050620` 좌중단 허공(`x≈202..268, y≈288..338`)·중단(`x≈476..524, y≈288..326`), `op_intro-p3-052648` 하단 경계(`x≈130..855, y≈555..575`), `op_prof-p1` 중앙(`x≈445..515, y≈155..220`)
- **문제:** `op_intro-p3-050620.png`에서 느낌표 말풍선이 세 스타터 중 우측 물 스타터에는 아예 안 뜨고, 좌측 말풍선(`54x48px`)은 초록 스타터 머리에서 약 90px 떨어진 원경 지붕 위 허공에 떠 있으며 중앙 말풍선(`48x38px`)과 스케일도 다르고, 말풍선 속 느낌표는 굵은 빨간 직사각형 블록으로 뭉개진 채 아래 점이 말풍선 하단 테두리를 뚫고 내려온다(`op_prof-p1-083466.png`도 동일). 직후 `op_intro-p3-052648.png`에서는 스타터 3마리의 뒷발과 지느러미가 하단 레터박스 경계(`y=575`)에 수평으로 잘린다.

### 8. [major] 초원·타이틀 배경에 박힌 조악한 거대 정지 동물 도트와 달리는 스타터 간 원근 비례 역전
- **분류:** art that looks wrong / anything that looks unfinished
- **증거 파일:** `/tmp/astra-review/shots/op_intro-p3-048677.png`, `/tmp/astra-review/shots/op_intro-p4-054462.png`, `/tmp/astra-review/shots/op_intro-p4-056659.png`, `/tmp/astra-review/shots/op_title-006500.png`, `/tmp/astra-review/shots/op_title-menu-079182.png`
- **화면 위치:** 우중단 나무 왼쪽 중경(`x≈565..685, y≈325..460`) 및 하단 전경 달리기 경로(`x≈370..960, y≈485..610`)
- **문제:** 오프닝 초원 및 타이틀 배경 그림 자체에 본편 몬스터와 화풍이 동떨어진 단조로운 갈색 여우/다람쥐 도트(`약 115x130px`)가 고정 이미지로 박혀 모든 프레임에서 얼어붙어 있고 `op_title-menu-079182.png`에서는 메뉴창 우상단 뒤로 어색하게 걸친다. 특히 `op_intro-p4`와 `op_title-006500.png`에서 전경을 달리는 스타터 3마리(`약 75x65px`)가 중경의 이 정지 동물보다 절반 크기로 작아 원근감이 완전히 깨지며, `p3`에만 있던 원경 집 창문 불빛(`x≈220..360`)도 `p4`와 타이틀에서는 돌연 사라진다.

### 9. [major] 실바나 체육관의 주 통로 덩굴 가로막힘, 벽 위 캐릭터 겹침 및 부조화스러운 분홍 줄무늬 벽지·이음새
- **분류:** ugly or broken maps / soft-lock / unreachable progress
- **증거 파일:** `/tmp/astra-review/shots/op_prof-p4-end-100104.png`, `/tmp/astra-review/shots/gym-entrance_01-arrive.png`, `/tmp/astra-review/shots/gym-leader_02-talk.png`
- **화면 위치:** `gym-entrance` 중앙 돌길·우측 벽(`x≈425..620, y≈175..270`), `gym-leader_02-talk` 상단 분홍 벽(`x≈120..840, y≈30..110`)·하단 중앙 벽 틈(`x≈525..565, y≈355..430`)·우상단 단상(`x≈680..820, y≈120..295`)
- **문제:** 체육관 입구 정면 돌길이 덩굴 울타리로 막혀 있는 상태에서 `op_prof-p4-end-100104.png`의 나루가 그 울타리 위에 그대로 겹쳐 서 있고 `gym-entrance_01-arrive.png`의 우측 금발 트레이너도 나무 벽면 위에 반쯤 올라타 있다(실제 플레이에서 울타리 개방·우회 가능 여부는 `not visible in screenshots`). `gym-leader_02-talk.png`에서는 풀 체육관과 동떨어진 분홍 줄무늬 벽지, 상단 경계(`y=30`)에 잘린 원형 장식, 우측 벽 수직 절단선(`x≈820`), 하단 나무 벽 사이 어색한 좁은 풀 조각, 그리고 단상·꽃 타일 위에 겹쳐 선 주인공이 한꺼번에 드러난다.

### 10. [major] 1번 도로의 절벽 타일 어긋남, 화면 가장자리 NPC·나무 반쪽 잘림 및 언덕 턱에 파묻힌 야생 몬스터
- **분류:** ugly or broken maps
- **증거 파일:** `/tmp/astra-review/shots/route-1-meadow_01-arrive.png`, `/tmp/astra-review/shots/route-trainer_02-talk.png`
- **화면 위치:** `route-1-meadow_01-arrive` 우상단 절벽·NPC(`x≈655..840, y≈30..215`) 및 좌측 경계(`x≈120..305, y≈30..510`), `route-trainer_02-talk` 좌하단 단차(`x≈345..415, y≈352..388`)
- **문제:** `route-1-meadow_01-arrive.png` 우상단 절벽의 좌측 수직면(`x≈655..685, y≈30..125`)과 하단 둥근 바위 타일이 맞물리지 않고 수평으로 끊겨 있으며, 절벽 위 NPC 상반신과 좌측 테두리 나무열 전체가 화면 경계에 반쪽으로 잘리고 좌상단 작은 나무(`x≈260..305`)는 사람보다 작다. `route-trainer_02-talk.png` 좌하단(`x≈345..415, y≈352..388`)에서는 야생 몬스터 스프라이트가 점프 단차 바로 아래 겹쳐 배치되어 파란 귀 달린 머리만 잘려 땅에 묻힌 것처럼 보인다.

### 11. [major] 콜드오픈 전설 몬스터 실루엣의 계단 현상 및 벡터 달·디더링 광선·로고 폰트 간 해상도 충돌
- **분류:** art that looks wrong / anything that looks unfinished
- **증거 파일:** `/tmp/astra-review/shots/op_intro-p1-036355.png`, `/tmp/astra-review/shots/op_intro-p1-039414.png`, `/tmp/astra-review/shots/op_intro-p2-044791.png`, `/tmp/astra-review/shots/op_intro-p2-046770.png`, `/tmp/astra-review/shots/op_intro-p5-058933.png`, `/tmp/astra-review/shots/op_intro-p5-061683.png`, `/tmp/astra-review/shots/op_title-006500.png`
- **화면 위치:** 화면 중앙 달·실루엣·광선·로고 영역(`x≈250..750, y≈64..470`) 및 `op_intro-p2-046770` 좌하단(`x≈0..125, y≈310..575`)
- **문제:** 달을 가르는 전설 몬스터 실루엣(`op_intro-p2-044791.png`, `op_intro-p5-058933.png`)이 밑변이 수평 직선으로 잘린 투박한 거대 픽셀 덩어리(`op_intro-p2-046770.png` 좌하단에서는 날개 아래 별도 검은 조각까지 분리됨)인 반면, 달·별똥별·원형 입자는 매끈한 고해상도 벡터 도형이고 X자 빛줄기는 상단(`y≈110`)에서 수평으로 끊기는 거친 디더링이라 한 화면 안에서 해상도 규격이 전부 따로 논다. 또한 `op_intro-p5-061683.png`의 매끈한 고딕체 로고가 직후 `op_title-006500.png`에서는 상하 레터박스가 사라지며 도트 폰트 로고로 급변한다.

### 12. [major] 연구소 한가운데의 가구 바리케이드, 박사 몸통을 가리는 주인공 모자, 출구를 덮는 안내창 및 스타터 외형 미표시
- **분류:** ugly or broken maps / broken or clipped dialogue/UI
- **증거 파일:** `/tmp/astra-review/shots/starter-pick_01-arrive.png`, `/tmp/astra-review/shots/starter-pick_03-talk.png`, `/tmp/astra-review/shots/starter-pick_04-to-choice.png`
- **화면 위치:** 상단 경계(`y=30..75`), 중앙 캐릭터 겹침부(`x≈475..525, y≈135..275`), 중단 가구열(`x≈175..815, y≈270..365`), 하단 출구(`x≈445..555, y≈428..493`) 및 우하단 선택창
- **문제:** 연구소 상단 가구들이 화면 천장(`y=30`)에 반토막 나 있고 방 한가운데(`y≈270..365`)에는 뒷벽 없이 책장·서버랙·책상 6개가 허공에 일렬로 놓여 1칸 통로만 남기며, 타일 대비 큰 캐릭터 비율 때문에 주인공 모자가 박사 몸통을 턱 밑까지 덮고 하단 `"Z 대화"` 배지가 출구 매트를 가린다. 더구나 첫 동료 선택창(`starter-pick_04-to-choice.png`)에는 몬스터 일러스트나 아이콘이 전혀 없이 `"토리프 풀"` 식의 띄어쓰기 문자열만 떠 외형을 보고 고를 수 없다.

### 13. [minor] 별모래 신전 출구 빛 그래픽의 비대칭 쏠림, 상단 오브젝트 잘림 및 장소 배너 가림
- **분류:** ugly or broken maps / broken or clipped dialogue/UI
- **증거 파일:** `/tmp/astra-review/shots/temple-observatory_01-arrive.png`
- **화면 위치:** 하단 중앙 출구(`x≈470..570, y≈405..455`) 및 상단 벽·좌상단 배너(`x≈120..720, y≈30..100`)
- **문제:** 하단 출구의 노란 빛 바닥은 2타일 폭(`x≈470..570`)인데 흰색 반원형 광원 아치(`x≈472..520`)는 왼쪽 1타일에만 치우쳐 양옆 대칭 제단 사이에서 중심이 어긋나 있다. 상단 경계(`y=30`)에서는 좌상단 상자와 청록색 석판 2개가 잘려 있고 `"| 별모래 신전"` 배너가 기둥 머리맡과 연기 나는 화로를 덮는다.

### 14. [minor] 최종 챔피언의 1관장 초반 벌레 몬스터(`베르카부 Lv11`) 재사용, 전투 진입 단색 암전 및 엔딩 배경 화풍 괴리
- **분류:** bad pacing signs / art that looks wrong / anything that looks unfinished
- **증거 파일:** `/tmp/astra-review/shots/gym-leader_03-battle.png`, `/tmp/astra-review/shots/gym-leader_04-command.png`, `/tmp/astra-review/shots/champion_03-battle.png`, `/tmp/astra-review/shots/champion_04-command.png`, `/tmp/astra-review/shots/ending_04-win.png`, `/tmp/astra-review/shots/route-trainer_04-command.png`
- **화면 위치:** 전투 화면 적 몬스터·정보창(`x≈140..730, y≈75..240`), `*_03-battle` 전체 스테이지(`x=120..840, y=30..510`), `ending_04-win` 전체 배경(`x=120..840, y=30..510`)
- **문제:** 최종 챔피언 나루(`champion_04-command.png`)가 1체육관 관장 유림(`gym-leader_04-command.png`, `베르카부 Lv6`)과 똑같은 미진화 초반 몬스터 `베르카부`를 `Lv11`로 내보내고 직후 전당 등록(`ending_04-win.png`)에서는 `Lv16`이던 토리프가 돌연 `Lv60`이 되어 성장 곡선이 임시 데이터처럼 보인다(체크포인트 세이브 분리 주입 여부는 `not visible in screenshots`). 또한 전투 진입 단계(`gym-leader_03-battle.png`, `champion_03-battle.png`)에는 트레이너 등장 연출 없이 단색 암전(`RGB 12,15,20`)만 찍혀 있고, `ending_04-win.png` 배경은 본편 16px 도트 세계관과 전혀 다른 고해상도 중세 유럽 풍차·산성 보라색 포털 일러스트이며, 전투 화면의 `토리프` 뒷모습 도트 입자도 적 도트보다 눈에 띄게 굵다.

### 15. [minor] 주인공 방 계단 원근 역전·바닥 방치 게임기, 해변·마을 가장자리 오브젝트 잘림 및 타이틀 메뉴 좌측 쏠림
- **분류:** ugly or broken maps / broken or clipped dialogue/UI
- **증거 파일:** `/tmp/astra-review/shots/op_choice-112764.png`, `/tmp/astra-review/shots/first-town-grove_01-arrive.png`, `/tmp/astra-review/shots/op_prof-p3-end-095329.png`, `/tmp/astra-review/shots/op_title-006500.png`, `/tmp/astra-review/shots/op_title-menu-079182.png`
- **화면 위치:** `op_choice` 우상단 계단(`x≈705..830, y≈105..255`)·바닥(`x≈580..635, y≈245..285`), `first-town-grove` 좌상단·우중단 경계(`x=120`, `x=840`), `op_prof-p3-end` 상단·우측 경계, `op_title-menu` 하단 메뉴창(`x≈353..607, y≈420..612`)
- **문제:** `op_choice-112764.png` 우상단 계단이 북쪽 벽 문틀 안으로 어둠을 향해 올라가는 듯한 역원근으로 그려져 있고 TV도 없이 게임기만 마룻바닥 한복판에 놓여 있으며, `first-town-grove_01-arrive.png` 좌측 상점(`op_prof-p2-end`에서 영문 `MART` 간판 노출)과 우측 끝 나루(`x≈828..840`), `op_prof-p3-end-095329.png` 상단 지붕과 우측 선베드 위 거대 새 스프라이트, `op_title-006500.png` 우하단 초록 스타터가 모두 화면 경계에 잘린다. 아울러 `op_title-menu-079182.png`의 메뉴 항목 텍스트는 상자 왼쪽으로 치우쳐 우측 여백이 과도하게 비어 있다.

---

### 정지 스크린샷만으로 판정 불가한 항목 (`not visible in screenshots`)
- **실제 진행 불가(소프트락) 확정 여부:** 체육관 덩굴 울타리 통과 기믹, `*_03-battle.png` 암전 지속 시간, 메뉴/대화 입력 무반응 여부는 정지 화면만으로 확정 불가(`not visible in screenshots`).
- **대사 전문 출력 시 텍스트 넘침 및 프레임 깜빡임(flicker):** `op_name-after-122007.png`, `starter-pick_03-talk.png`, `route-trainer_02-talk.png`, `gym-leader_02-talk.png`, `champion_02-talk.png`, `ending_02-talk.png`는 글자 타이핑 연출 도중에 캡처되어 문장 끝 줄바꿈·넘침 여부와 실시간 애니메이션 깜빡임은 `not visible in screenshots`.
