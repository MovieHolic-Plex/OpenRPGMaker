# 성채·요새 도시의 공간 구조와 16px 3/4 탑뷰 타일셋 생성기 설계 자료

조사 기준일: 2026-10-22. 모든 URL은 이번 세션에서 실제로 응답을 받은 것만 적었다.
Tolkien Gateway는 Cloudflare 챌린지로 본문을 받지 못했으므로, 톨킨 1차 자료는 Wikipedia와 lotr.fandom으로 대체했다(이 한계는 문서 끝에 다시 적는다).

이 문서는 16px 3/4 탑뷰(지붕 윗면이 면으로 보이는 시점) 생성기를 전제한다. 프로젝트 규약상 **측면 입면은 필수 조건이 아니고 지붕 윗면·윤곽·도트 질감이 판독의 핵심**이므로, 아래 "16px 단서"는 모두 **평면 footprint + 지붕 실루엣**으로 읽히도록 적었다. 단서 문장은 내 설계 추론이고, 근거는 각 행의 출처가 서술하는 실제 형태다.

---

## 0. 먼저: 이 문서에서 쓰는 6개 좌표계

성채·도시를 절차 생성하려면 "무엇을 변수로 둘 것인가"를 먼저 정해야 한다. 조사한 사례에서 반복적으로 나타난 축은 다음 여섯 개다.

| 축 | 값의 범위 | 근거 |
|---|---|---|
| **링/단(tier)** | 1링(민가+성벽) ~ 7링(미나스 티리스) | 미나스 티리스 7겹 성벽·7개 문, 각 단 30m 상승, 성문이 번갈아 북/남을 향함 (https://en.wikipedia.org/wiki/Minas_Tirith) |
| **문 배치** | 정문 1개 / 정문+측문 / 링마다 어긋난 문 | 미나스 티리스의 지그재그 큰길, 스톰베일의 정문 vs 서쪽 틈, 라야 루카리아의 봉인 정문+열쇠 |
| **주로(主路) 상승 방식** | 직선 계단 / 지그재그 램프 / 나선 / 리프트·사다리 / 외곽 우회로 | 미나스 티리스 "main street zigzagged up the eastern hill-face", 레인델의 엘리베이터·지붕 경로, 언데드 버그의 사다리 지름길 |
| **수직 레이어 수** | 지하 1 + 지상 1~2 + 상층 1 = 실용적 3~4 | Level Design Book은 한 구역의 floor plane을 3개 이상 쓰지 말라고 권고 (https://book.leveldesignbook.com/process/layout/flow/verticality) |
| **초크포인트 밀도** | 다리 1개 / 성문+교량+계단 3중 | 헬름스 딥(둑→성벽→성채), 언데드 버그(다리 위 다리) |
| **시선축(landmark)** | 탑 1개가 도시 전체를 지배 | 미나스 티리스 백색탑, 킹스랜딩 레드킵(에이건 언덕), 마르카스의 Understone Keep |

---

## Part 1 — 성채·요새 도시의 공간 구조

### 1-A. 톨킨: 링·계단·문의 원형

#### 미나스 티리스 (Minas Tirith)
- **구조**: 민돌루인 산줄기(spur)에 붙은 7겹 성벽 도시. 각 성벽마다 문이 하나씩 있고, **각 문은 이웃 문과 다른 방향(번갈아 북/남)을 향한다**. 단마다 약 30m씩 올라가고, 1단 성벽만 검은 돌(오르상크와 같은 재질), 바깥 성벽이 가장 높고 길고 강하다. 큰길은 **동쪽 산면을 지그재그로 올라 각 문과 중앙 암릉을 통과**해 7번 문으로 성채에 닿는다. 성채 안 백색탑(엑텔리온 탑)은 91m, 꼭대기는 평지에서 약 300m. 탑 정문은 동쪽으로 **분수 광장(Court of the Fountain)** 을 향하고, 탑 뒤 6단에서 이어지는 안부( saddle)에 왕과 섭정의 묘역 **라스 디넨(Rath Dínen)** 이 있다. 성문 앞 넓은 포장지 **Gateway**에서 북로·남로·오스길리아스 길이 갈린다. 주변은 성벽으로 둘린 농경지 펠렌노르. (https://en.wikipedia.org/wiki/Minas_Tirith)
- **톱다운 차용**: ① 링을 **동심원이 아니라 산등성이에 붙은 초승달 조각**으로 그린다 — 생성기가 부채꼴 띠를 쌓고 각 띠의 문을 좌/우 교대로 배치하면 "올라가는 느낌"이 지도에서 바로 읽힌다. ② 성문을 지날 때마다 길이 **좌우로 꺾이게** 강제하면 플레이어가 방향을 잃고 랜드마크(탑)를 다시 찾게 된다. ③ 최상단은 성벽 1겹 + 광장 1칸 + 탑 1개로 **압축**한다(16px에서 7링은 7×3타일 띠 ≈ 21타일 높이).

#### 에도라스 / 메두셀드 (Edoras / Meduseld)
- **구조**: 하로우데일 골짜기 입구의 **언덕 위 요새 도시**, **목책(high wall of timber)** 으로 보호. 언덕 꼭대기 중앙에 황금 홀 메두셀드가 있고, 왕과 친족의 거처이자 회의장·연회장. 왕가의 두 계보가 홀 아래 봉분 두 줄로 묻혀 있다(감라 웁살라·서턴 후 부류). (https://en.wikipedia.org/wiki/Rohan,_Middle-earth)
- **톱다운 차용**: **나선형 언덕 + 목책 1겹 + 꼭대기 대형 홀 1동**이 최소 구성. 성벽 재질을 목책으로 바꾸는 것만으로 "석성 vs 목책 마을"이 구분된다. 홀 앞 빈 마당을 3~4타일 비워 두면 군집 연출(말·군대) 공간이 생긴다.

#### 헬름스 딥 (Helm's Deep / Hornburg)
- **구조**: 3중 방어. ① 골짜기 입구를 가로지르는 **딥 월(Deeping Wall)**: 높이 6.1m, 4명이 나란히 설 수 있는 폭, **딥 스트림이 흐르는 암거(culvert)** 가 뚫려 있다. ② 성벽 한쪽 끝 산줄기 위의 **혼버그 성채**: 뒤쪽 문으로 이어지는 긴 계단, 정문에서 앞으로 내려가는 긴 둑길(causeway). ③ 성문에서 약 400m 아래 골짜기를 가로지르는 **헬름스 다이크(외곽 참호+토루)**. 배후에는 빛나는 동굴 아글라론드. (https://en.wikipedia.org/wiki/Battle_of_Helm%27s_Deep)
- **톱다운 차용**: **"선형 3단 초크"의 교과서**. 16px 맵에서는 ① 외곽 토루(1타일 폭 흙색) → ② 긴 성벽 + 중앙 암거(물 1타일이 성벽을 뚫고 지나감) → ③ 성벽 끝의 성채(2×2 타일)로 배치한다. 암거는 "뚫린 벽" 타일 1개로 표현하고, 그 1칸이 함락 지점이 된다 — 지도만 봐도 약점이 보인다.

#### 리벤델 (Rivendell)
- **구조**: 좁은 협곡(Bruinen 강)에 숨은 계곡 도시, 큰길이 골짜기를 통과하지 않는다(의도적 외딴길). 계곡으로 **내려가는** 지형이 진입 의식이고, 진입로에 **난간 없는 좁은 돌다리**가 있다. (https://en.wikipedia.org/wiki/Rivendell)
- **톱다운 차용**: **"계단식 테라스 + 다리 1개 + 숨은 입구"**. 성벽이 없는 요새의 대조군으로 쓰면 좋다. 절벽면에 테라스를 2~3단 붙이고, 각 테라스를 폭 1타일 다리로 잇는다. 지붕은 전부 곡선·녹색(엘프)으로 통일해 석성과 색으로 구분.

#### 오스길리아스 (Osgiliath)
- **구조**: 안두인 강 **양안에 걸친 도시**, 중심에 **큰 돌다리**, 다리 위에 **별의 돔(Dome of Stars)** 을 얹은 탑(팔란티르 보관). 왕좌의 큰 회랑. 전쟁 중 다리가 끊기고 폐허가 되며, 이후 전략 가치는 "군대가 배 없이 강을 건널 수 있는 몇 안 되는 지점"이라는 점 하나로 남는다. (https://lotr.fandom.com/wiki/Osgiliath)
- **톱다운 차용**: **폐허 도시 = 다리 + 끊긴 다리 + 양안 대칭 블록**. 같은 타일셋의 "온전한 다리 / 끊긴 다리 / 임시 부교" 3종만 있으면 시대 변화(번성→폐허→재건)를 지도 하나로 표현할 수 있다.

#### 바라드두르 / 키리스 웅골 (Barad-dûr / Cirith Ungol) — 어두운 대조군
- **구조**: 바라드두르는 **화산석 벽 + 수백 기 투석기 + 성벽을 두른 거대 용암 해자 + 서쪽의 거대 철교**, 내부에 대규모 주둔·감옥·용광로. (https://lotr.fandom.com/wiki/Barad-d%C3%BBr) 키리스 웅골은 **절벽면 계단 → 터널 → 탑**의 1자형 관문이며, 입구에 **감시 석상(Two Watchers)** 이 서서 통과를 막는다. (https://lotr.fandom.com/wiki/Cirith_Ungol) 미나스 모르굴은 같은 쌍둥이 도시가 타락한 형태다. (https://en.wikipedia.org/wiki/Nazg%C3%BBl)
- **톱다운 차용**: 선한 도시와 **같은 골격을 재질만 바꿔 재사용**한다. 미나스 티리스의 링·문·탑을 그대로 두고 돌 색을 흑/적, 지붕을 뾰족 가시, 길을 1타일 좁히면 "타락 버전"이 된다. 키리스 웅골은 **계단→터널→탑**의 3칸 폭 회랑으로 만들고, 문 앞에 감시 석상 1개를 세워 초크를 만든다.

### 1-B. 엘든 링: 레거시 던전의 "경로 분기 + 수직 단락"

#### 스톰베일 성 (Stormveil Castle)
- **구조**: 절벽 위 성. **정문(문지기 초소)** 과 **왼쪽 담장 틈(측문)** 이 갈리고, 측문은 절벽길→매의 둥지→경사로→성벽 위로 이어진다. 내부는 **포도주 저장고(2~3층 + 사다리 + 잠긴 문)** → **성벽 탑(Rampart Tower, 2·3층 + 옥상)** → **성벽 위 발코니 점프** → **성벽 안뜰** → **Liftside Chamber의 리프트로 상부** → **Secluded Cell** → 보스. 성벽·옥상·발코니가 **지상 경로와 평행한 두 번째 길**을 만든다. (https://eldenring.wiki.fextralife.com/Stormveil_Castle)
- **톱다운 차용**: ① **정문과 측문을 같은 성벽의 서로 다른 면**에 두고, 측문 쪽에 절벽 1~2타일을 붙인다. ② 성벽을 **1타일 폭 통행 가능 타일**로 그려 "벽 위 길"을 만든다(벽 타일과 벽 위 길 타일을 분리). ③ 옥상-발코니-성벽을 잇는 **점프/단차 타일 2~3개**로 지상 경로를 우회하게 한다.

#### 레인델 왕도 (Leyndell, Royal Capital)
- **구조**: 성문 밖 **외곽 성벽(East/West Capital Rampart)** → **대로(Avenue Balcony)** → **지붕 길** → **엘리베이터로 지하 수도·묘지** → **용의 날개를 타고 성벽으로** → **에르드트리 성역**. 즉 **지상 대로 / 지붕 / 지하 수로**의 3개 평면이 같은 footprint에 겹쳐 있다. 대로에는 마차·분수·가제보·성벽 탑이 랜드마크로 반복된다. (https://eldenring.wiki.fextralife.com/Leyndell_Royal_Capital_(Legacy_Dungeon))
- **톱다운 차용**: **"같은 블록, 세 개의 층"**. 생성기는 블록마다 (a) 대로 레이어, (b) 지붕 레이어, (c) 지하 레이어를 만들고 **엘리베이터·사다리·수로 입구 타일로만 연결**한다. 16px에서는 층 전환을 "구멍 타일 + 사다리 1칸"으로 표시하면 충분하다.

#### 라야 루카리아 아카데미 (Raya Lucaria)
- **구조**: **봉인된 정문**(열쇠 필요) 하나뿐 — 측문 없음. 문 밖 **아카데미 관문 마을**(바리케이드·계단·화염차) → 승강기 → **쿠쿠 교회** → **묘지**(나무다리) → **회전 승강기** → **교실(강당) 3층** → **토론장(보스)** → **안뜰(분수)** → **옥상**. 내부는 층마다 **환영벽(illusory wall)** 으로 숨은 방. (https://eldenring.wiki.fextralife.com/Raya_Lucaria_Academy)
- **톱다운 차용**: **"문 하나 + 내부 나선"**. 성벽 대신 **건물 자체가 요새**인 유형. 16px에서는 큰 지붕 4~6개를 ㄷ자로 배치하고 중앙에 안뜰(분수 1타일)을 둔다. 회전 승강기는 "원형 계단 타일 2×2"로 대체.

#### 볼케이노 저택 (Volcano Manor)
- **구조**: 저택 로비 → **대연회장** → **서쪽 복도 + 잠긴 방들(열쇠)** → **그림 뒤 환영벽** → 뱀 달팽이 방 → **감옥 마을 교회** → **용암에 잠긴 마을**(지붕 타고 이동, 철거된 다리를 레버로 복구) → **객실 홀** → **새장 리프트 2기** → **에이글레이 신전**. (https://eldenring.wiki.fextralife.com/Volcano_Manor)
- **톱다운 차용**: **"용암/물에 잠긴 하층 + 지붕 상층"**. 지면 타일을 용암/물로 깔고, 건물 지붕만 통행 가능 타일로 두면 "지붕 길" 도시가 된다. **레버로 복구되는 다리**는 스위치 1개 + 다리 타일 2개로 구현.

#### 카슬 모른 (Castle Morne) / 카리아 저택 (Caria Manor)
- **구조(모른)**: **리프트로 성 안 진입** → 안뜰 → 사다리·계단으로 성벽 → 감옥 → **좁은 나무다리** → 해자 쪽 보스. (https://eldenring.wiki.fextralife.com/Castle_Morne)
- **구조(카리아)**: 접근로부터 **유도탄(빛나는 화살) 세례** → 정문 → **정원(손가락 기어다니는 적)** → **예배당(상층 성벽 산책로의 시작)** → 탑 리프트 → **상층** → **긴 계단(트롤+마법사)** → **원형 투기장**. (https://eldenring.wiki.fextralife.com/Caria_Manor)
- **톱다운 차용**: 모른은 "**리프트 1개 = 유일한 입구**"인 소형 성. 카리아는 "**정원 → 예배당 → 성벽 산책로 → 상층**"의 나선 상승. 16px에서는 성벽 산책로를 **예배당 지붕과 같은 높이의 길 타일**로 이어 붙이면 "벽 위로 올라갔다"는 인식이 생긴다.

### 1-C. 다크 소울·블러드본: 도시 자체가 층

#### 아노르 론도 (Anor Londo)
- **구조**: 성문 앞 **거대 계단** → 성벽·첨탑 → **날개형 부벽(flying buttress)** 을 걸어 측면 발코니로 진입 → 성당 내부(긴 직사각형, 양측 열주) → 보스. 디자이너는 **밀라노 대성당**을 실제 답사해 참고했고, **나선계단은 "삶"을 상징**하도록 만들었다. 명확한 길을 주지 않고 측면 경로(부벽 오르기)를 강제한다. (https://en.wikipedia.org/wiki/Anor_Londo)
- **톱다운 차용**: **"정문이 아니라 부벽으로 들어간다"** — 16px에서 성당 측면에 폭 1타일 부벽 3~4개를 붙이고, 그 위를 걷는 길을 만들면 정면 공략을 우회하는 루트가 생긴다.

#### 언데드 버그 / 언데드 파리시 (Undead Burg / Parish)
- **구조**: 옥상 → **작은 나무다리(초크)** → 안개문 → 계단 → **성벽 산책로** → 탑 → 사다리 지름길 → **용 다리**. Level Design Book의 분석에 따르면 이 다리는 ① **초크포인트**(뒤에서 적이 끼어들어 샌드위치), ② **매복 은폐**(왼쪽 어두운 문간의 적이 보이지 않게 각도 조정), ③ **일방통행 낙하**(내려가면 되돌아올 수 없음)의 세 가지를 동시에 한다. (https://book.leveldesignbook.com/studies/sp/undead-burg)
- **톱다운 차용**: **다리 1개에 3가지 기능을 겹친다.** 16px에서는 다리 양 끝에 문간 1칸, 다리 중간 폭 1타일, 다리 아래로 떨어지는 낙차 1단을 두면 같은 효과가 난다.

#### 로스릭 성 (Lothric Castle) / 이리시르 (Irithyll)
- **구조(로스릭)**: 입구 홀 → 성벽 탑 → **용 두 마리가 지키는 돌다리** → 용의 발톱이 뚫린 방 → **교회** → **덮인 다리** → 태양 제단 → 보스 다리. 리프트로 초기 진입점 단축. (https://darksouls3.wiki.fextralife.com/Lothric_Castle)
- **구조(이리시르)**: **입구 다리 + 봉인 장벽** → 안뜰(회전 교차로) → 교회 → **좁은 지붕 능선(은기사 궁수 저격)** → **회전 승강 플랫폼** → 아노르 론도. (https://darksouls3.wiki.fextralife.com/Irithyll_of_the_Boreal_Valley)
- **톱다운 차용**: **"지붕 능선 = 저격 시선"**. 지붕을 폭 1타일 능선으로 만들고 그 위에 궁수 1기를 두면, 지상 길이 위험해진다. 회전 승강 플랫폼은 "원형 발판 + 레버"로 표현.

#### 야남 (Yharnam)
- **구조**: 도시 대부분이 **수직으로 층층이 쌓여** 있고, **신도시가 옛 도시 위에 지어졌다**. 최하층 **올드 야남**(화재로 버려짐) → **센트럴 야남**(주거 중심) → **대성당 구역**(치유 교회 본부) → 최상층 **어퍼 대성당 구역**(성가대). (https://en.wikipedia.org/wiki/Yharnam)
- **톱다운 차용**: **"층층이 겹친 도시"를 지도 한 장에 담는 법**: 각 구역을 서로 다른 고도 밴드(예: y=0/1/2)에 두고, 연결은 **계단·다리·골목 아치**로만 한다. 16px에서는 고도별로 지붕 색을 한 단계씩 밝게/어둡게 하면 층이 읽힌다.

### 1-D. 그 밖의 강한 참조 10선

| 사례 | 구조 핵심 | 톱다운 차용 |
|---|---|---|
| **젤다: 야생의 숨결 / 왕국의 눈물 하이랄 성** | 해자로 완전히 둘러싸임. 육로 진입은 남쪽 **성문 하나**뿐이고, 그 문에서 **성을 한 바퀴 감는 구불구불한 길**이 성소(Sanctum)까지 이어진다. 북쪽 **부두(Docks)**, **감옥(Lockup)**, 지하 통로, 도서관 옥상 구멍 등 다중 입구. 성소는 4개 층(왕좌실→관측실→용사들의 홀→종탑). (https://zelda.fandom.com/wiki/Hyrule_Castle_(Breath_of_the_Wild)) | **"나선 외곽로 + 다중 침투구"**. 성벽 안쪽에 폭 1~2타일의 나선 길을 깔고, 부두·감옥·지하 입구를 각각 1개씩 붙인다. |
| **젤다: 신들의 트라이포스 하이랄 성 (톱다운 원형)** | 해자 + 정문. 정문은 막혀 있고 **덤불 밑 구멍 → 비밀 통로**로 정원에 진입. 내부는 미로형 방 + 열쇠, 상층은 마법 장벽으로 차단(마스터 소드로 파괴). (https://zelda.fandom.com/wiki/Hyrule_Castle_(A_Link_to_the_Past)) | 16px 톱다운의 **직접적 선례**. "정문 잠김 + 덤불 1칸 뒤 숨은 입구"는 타일 2개로 구현된다. |
| **킹스랜딩 (왕좌의 게임)** | 성벽 도시, 지형은 **세 언덕**(에이건·라에니스·비세냐). **레드킵은 에이건 언덕 위**, 도시 성벽은 gold cloaks가 지킴. 가난한 이들은 **성벽 밖 판자촌**, 안쪽은 **플리 바텀** 슬럼. (https://en.wikipedia.org/wiki/World_of_A_Song_of_Ice_and_Fire) | **"언덕 3개 + 성벽 + 성벽 밖 슬럼"**. 생성기에서 성벽 밖 링에 밀도 낮은 판자촌을 자동 생성. |
| **윈터펠 (Winterfell)** | 온천 위에 지은 성 — 뜨거운 물이 **성벽 안으로 흘러** 홀과 유리정원을 덥힌다. 지하에 **크립트(묘역)**. (같은 문서) | **"지열/수로가 성벽 안을 관통"** — 물 타일이 성벽을 지나며 건물 사이를 흐르게 하면 독특한 도시가 된다. |
| **이리 (The Eyrie)** | **문의 성(Gates of the Moon) → 상부 마당 → 노새길 → Stone/Snow/Sky 3개 소성 → 180m 위 본성**. 본성은 **가느다란 탑 7개**가 밀집, 마구간·대장간 없음, 보급은 **6개 대형 권양기(winch)** 로 아래에서 끌어올림. 감옥은 한쪽이 뚫린 **하늘 감방**, 처형은 **문 도어(600피트 낙하)**. (같은 문서) | **"수직 1자 도시"**: 아래 마을 → 3단 관문 → 절벽 위 탑 군집. 16px에서는 절벽 8~12타일 위에 탑 3~4개만 얹으면 된다. |
| **호그와트** | 7층, **계단 142개**, 지하 감옥, 대회당, 중정, 시계탑, **움직이는 계단 + 변하는 평면**. (https://harrypotter.fandom.com/wiki/Hogwarts_Castle) | **"계단이 곧 지도"**. 계단 타일을 방향별로 4종 두고, 같은 층 두 지점을 계단으로 직접 연결해 "지도가 안 맞는" 느낌을 만든다. |
| **드라큘라 성 (캐슬바니아)** | 방 목록이 곧 요새 기능 목록: 입구·외벽·아성(keep)·시계탑·대계단·예배당·왕좌실·지하묘지·수로·도서관·실험실·투기장. (https://castlevania.fandom.com/wiki/Dracula%27s_Castle) | **부품 체크리스트로 그대로 사용**. "성 = 입구+외벽+대계단+예배당+시계탑+왕좌실+지하 3종"의 9~12개 모듈. |
| **이슈가르드 (FFXIV)** | 도시가 **재단(Foundation) → 기둥(Pillars) → 피르망(Firmament) → 엠피레움(Empyreum)** 의 고도 구역으로 나뉜다. (https://ffxiv.consolegameswiki.com/wiki/Ishgard) | **구역 = 고도**. 같은 도시 안에서 4개 고도 밴드를 쓰는 모범. |
| **발더스 게이트** | **어퍼 시티(성벽 안 북쪽, 귀족) / 로어 시티(초승달, 절벽 위, 상업) / 아우터 시티(성벽 밖 판자촌)**. 문이 6개 이상(Sea/Manor/Gond/Baldur's/Heap/Basilisk), 항구, 지하 **언더셀러**. (https://forgottenrealms.fandom.com/wiki/Baldur%27s_Gate) | **"성벽 안 2층 + 성벽 밖 1층"**의 3분할. 문 이름을 붙이는 것만으로 지도가 읽힌다. |
| **마르카스 (스카이림)** | 드워프 유적으로, **하이사이드 / 크래그 / 리버사이드** 3개 구역. **Understone Keep은 산을 깎아 만든 성**, **The Warrens는 절벽을 파낸 빈민굴**, **Cidhna Mine은 성벽 안의 감옥 광산**. (https://en.uesp.net/wiki/Skyrim:Markarth) | **"성벽 안에 광산·감옥"**. 산을 깎은 도시는 지붕 대신 **암벽 상면**을 쓴다 — 16px에서 회색 바위 면 + 입구 구멍 2~3개. |
| **노비그라드 (위쳐 3)** | 11개 구역(The Bits, Farcorners, Fish Market, Glory Lane, Gildorf, Harborside, Hierarch Square, Lacehalls, Putrid Grove, Silverton, Temple Isle) + 10개 성문 + 하수도. 성벽은 한 번도 뚫린 적 없음. (https://witcher.fandom.com/wiki/Novigrad) | **구역 이름 목록이 곧 생성기 파라미터**. 시장·항구·성전 섬·빈민 구역을 이름으로 고정하면 배치가 자연스러워진다. |

### 1-E. 실재 요새 도시 (형태 검증용)

| 사례 | 구조 | 차용 |
|---|---|---|
| **카르카손 (Carcassonne)** | **동심 2겹 성벽 + 52개 탑 + 바비칸**. 성 자체에 **별도 도개교·해자·중앙 아성**. 성벽 상부에 **사각 구멍**이 있어 목재 방호판(hoarding)을 임시로 끼워 돌·끓는 물을 아래로 던졌다. (https://en.wikipedia.org/wiki/Carcassonne) | 성벽 상단에 **1타일 간격 구멍 타일**을 규칙적으로 넣으면 "호딩 설치 가능"이 시각적으로 읽힌다. |
| **크라크 데 슈발리에** | 13세기 2차 공사로 **동심 성**(외벽 + 내부 성채), 2,000명 주둔. (https://en.wikipedia.org/wiki/Krak_des_Chevaliers) | 동심 성의 최소형: 외벽 1겹 + 내벽 1겹 + 중앙 홀. |
| **몽생미셸** | 조수섬. **밀물이 공격자를 고립**시키는 자연 방어, 100년 전쟁 중 함락되지 않음. (https://en.wikipedia.org/wiki/Mont-Saint-Michel) | **"조수 타일"**: 물 타일을 주기적으로 덮는 지형. 톱다운에서 물/모래 경계 2종으로 표현. |
| **두브로브니크 / 코토르** | 성벽 도시, 항구·해안 절벽. (https://en.wikipedia.org/wiki/Dubrovnik, https://en.wikipedia.org/wiki/Kotor) | 해안 성벽 = **바다 타일 바로 옆 성벽 타일**. |
| **로카마두르** | **절벽에 수직으로 붙은 성지 마을** — 강가 마을(최저) → 성지 건물군(중간) → 성(최상). (https://en.wikipedia.org/wiki/Rocamadour) | 16px에서 "절벽면에 층층" 표현의 표본. |
| **노이슈반슈타인** | 3개 날개(three-winged) 복합, 65m로 세계 최고 높이 성. (https://en.wikipedia.org/wiki/Neuschwanstein_Castle) | 3익 구조 = ㄷ자 또는 Y자 footprint. |
| **히메지 성** | 83동, **텐슈(천수각)** + **야구라(망루)** + 다중 해자. 평시엔 창고, 전시엔 방어탑. (https://en.wikipedia.org/wiki/Himeji_Castle) | **"성 = 해자 링 + 야구라 링 + 텐슈 1개"**. 16px에서 해자 폭 1~2타일, 야구라 1×1 타일 반복. |
| **므디나** | 성벽이 도시 확장을 막아 **면적이 고정**됨, 인구 242명. (https://en.wikipedia.org/wiki/Mdina) | "성벽이 도시 성장을 멈춘" 사례 — 생성기에서 성벽 밖 성장을 금지하는 파라미터. |
| **에든버러 성** | 성벽이 아니라 **화산암 봉우리**가 주 방어. 1,100년간 26회 공성. (https://en.wikipedia.org/wiki/Edinburgh_Castle) | 지형 방어 우선형: 성벽 1겹 + 절벽 3면. |
| **프라하 성** | 약 **70,000㎡**, 길이 570m — "성"이 도시 블록 크기. (https://en.wikipedia.org/wiki/Prague_Castle) | 대형 성 = 성벽 안에 **거리·광장·성당·궁**을 모두 넣는 "성 안의 도시". |
| **탈린 / 로텐부르크** | 중세 성벽 도시 보존, 로텐부르크는 **성벽 위를 걸을 수 있는** 몇 안 되는 도시. (https://en.wikipedia.org/wiki/Tallinn, https://en.wikipedia.org/wiki/Rothenburg_ob_der_Tauber) | **성벽 위 보행로**는 반드시 타일셋에 포함해야 한다(위 1-B의 성벽 산책로와 동일 부품). |

### 1-F. Part 1 종합: 생성기 규약으로 압축

조사한 20여 사례에서 **반복되는 8개 규칙**만 남기면 다음과 같다.

1. **링은 3~7개, 3개면 충분하다.** 7링(미나스 티리스)은 미학적 최대치이고, 플레이어가 실제로 구분하는 것은 보통 3개다(Level Design Book의 "floor plane 3개" 권고와 일치: https://book.leveldesignbook.com/process/layout/flow/verticality).
2. **문은 서로 마주보지 않게.** 미나스 티리스의 교대 문, 스톰베일의 정문/측문, 라야 루카리아의 단일 문 — 셋 다 "정면 돌파를 막는" 같은 해법이다.
3. **주로는 최소 한 번 꺾인다.** 직선 대로는 성에서 거의 없다(레인델 대로는 예외이나 지붕·지하 우회로가 있음).
4. **성벽은 길이다.** 스톰베일·언데드 버그·로텐부르크·히메지 모두 성벽 위 통행이 핵심 동선이다.
5. **초크는 3중이면 충분하다.** 외곽 토루 → 성벽/문 → 내부 계단(헬름스 딥).
6. **랜드마크는 하나.** 백색탑·레드킵·텐슈·Understone Keep — 도시 어디서나 보이는 1개가 방향 감각을 책임진다.
7. **성벽 밖은 밀도가 낮다.** 킹스랜딩 판자촌, 발더스 게이트 아우터 시티 — 성벽 안팎의 밀도 차가 "도시"를 만든다.
8. **부품은 9~12개 모듈로 닫힌다.** 캐슬바니아의 방 목록(입구·외벽·대계단·예배당·시계탑·왕좌실·묘지·수로·도서관·투기장)이 그대로 생성기 모듈 목록이 된다.

---

## Part 2 — 추가 건축·구조물 56종

기존 61종(민가·열집·롱하우스·T/L/U자 집·길드홀·여관·대장간·방앗간·예배당·문루·아성·영주 저택·Wealden hall·십일조 헛간·곡물 창고·비둘기집·리치게이트·자선원·시장 홀·시청·버기지 열·운하 가옥·창고·longère·트룰로·탑하우스·바스티드 아케이드·샬레·스타브 교회·stabbur·rorbu·물레방아·포스트 밀·타워 밀·오스트 하우스·양조장·빵집·우물집·지붕 있는 다리·통행료소·등대·원형탑 교회·웨스트워크 교회·십자형 교회·회랑·모트앤베일리·조가비 아성·동심 성·사각 성·물의 성·Z플랜 탑하우스·필 탑·성문 탑)에 더할 56종.

표의 "출처"는 그 유형의 **일반 형태**를 서술하는 문서다. "16px 단서"는 그 형태에서 뽑은 **내 설계 추론**이며, 3/4 탑뷰에서 지붕 윗면만으로 구분되도록 적었다.

### 2-A. 성당·종탑·군사 시설 (1–14)

| # | 유형 | 평면 · 층수 | 지붕 구성 | 16px 3/4 실루엣 단서 | 쓰임 | 출처 |
|---|---|---|---|---|---|---|
| 1 | **대성당 (flying buttress)** | 라틴 십자(신랑+양 익랑+후진), 3~5랑, 층고 3~4 | 본랑 높은 박공 + 측랑 낮은 단사 + 후진 반원 | **측면에 1타일 폭 부벽이 3~5개 늘어선 톱니** — 이 톱니가 대성당의 유일한 실루엣 표식 | 도시 최대 랜드마크, 광장 축 | https://en.wikipedia.org/wiki/Cathedral, https://en.wikipedia.org/wiki/Flying_buttress |
| 2 | **종탑 / 캄파닐레** | 정사각 1실, 4~6층, 개방 아치 | 평평한 상면 + 4면 아치 개구부 + 난간 | **정사각 상면 + 중앙 구멍 1개(종)**; 주변 건물보다 1.5배 높이 | 시간·경보·시민 결집 | https://en.wikipedia.org/wiki/Bell_tower |
| 3 | **바비칸 (외문 방어군)** | 성문 앞 ㄷ자 또는 U자 이중문 | 문루 2개 + 연결 성벽 상면 | **문 앞에 ㄷ자로 감싸는 낮은 벽 2줄** — 성문보다 넓은 footprint | 성문 앞 초크, 대기 공간 | https://en.wikipedia.org/wiki/Barbican |
| 4 | **호딩 붙은 커튼월 구간** | 직선 벽 5~9타일 | 상면 통행로 + 외팔보 목조 방호판 | **벽 바깥으로 1px 튀어나온 목재 돌출부가 2타일마다 반복** | 성벽 상시 방어 | https://en.wikipedia.org/wiki/Hoarding_(castle) |
| 5 | **바스티온 / 별형 요새 모서리** | 오각형 돌출 + 2면 사격 | 낮고 두꺼운 상면, 총안 | **성벽 선에서 바깥으로 뾰족하게 튀어나온 5각형** — 각도가 곧 표식 | 화기 시대 각도 방어 | https://en.wikipedia.org/wiki/Bastion_fort |
| 6 | **성곽 예배당 (castle chapel)** | 단랑 3~5베이 + 후진 | 단사 지붕 + 서쪽 작은 종탑 | **성 안에 있으나 규모가 작은 십자/장방형**, 지붕 색만 성당과 동일 | 성 안의 종교 공간 | https://en.wikipedia.org/wiki/Castle_chapel |
| 7 | **대연회장 (great hall)** | 장방형 5~8×2~3, 측면 부엌 연결 | 높은 단일 박공, 중앙 난로 굴뚝 | **가장 긴 지붕 + 중앙 굴뚝 1개**; 문 쪽에 현관 돌출 | 연회·재판·집회 | https://en.wikipedia.org/wiki/Great_hall |
| 8 | **부엌 블록** | 대연회장 뒤 ㄱ자, 1층 + 다락 | 낮은 단사 + 굴뚝 2~3 | **연회장에 붙은 낮은 지붕 + 굴뚝 다발** | 급식·저장 | https://en.wikipedia.org/wiki/Kitchen |
| 9 | **마구간** | 긴 1랑 + 마당, 1층 | 낮은 단사, 마구간 문 반복 | **문이 3~5개 규칙적으로 난 긴 낮은 지붕** | 기병·사역 | https://en.wikipedia.org/wiki/Stable |
| 10 | **병영 (barracks)** | 2~3동 병렬 + 연병장 | 단사 또는 맞배, 균일 | **같은 지붕 3동이 나란히 + 앞 빈 마당** | 상비군 숙소 | https://en.wikipedia.org/wiki/Barracks |
| 11 | **무기고 (armoury/arsenal)** | 두꺼운 벽 1실 + 창 없음 | 낮은 맞배, 환기 굴뚝 | **창문 0개, 벽 두께 2px** — 다른 건물과 달리 개구부가 없다 | 무기·화약 저장 | https://en.wikipedia.org/wiki/Arsenal |
| 12 | **보물탑 (treasury tower)** | 원형 또는 8각, 3~4층, 단일 출입 | 원뿔 또는 평평한 상면 | **원형 footprint + 문 1개뿐인 벽** | 재정·왕관 보관 | https://en.wikipedia.org/wiki/Treasury |
| 13 | **감옥 / 던전 입구** | 지하 1~2층, 계단 하강 | 지상은 작은 문루만 | **계단이 지면으로 내려가는 구멍 1개 + 경비 초소** | 구금·심문 | https://en.wikipedia.org/wiki/Dungeon |
| 14 | **성문 탑 (gate tower)** | 성벽에 붙은 사각/원형 탑 | 평평한 상면 + 총안 | **성벽 선에서 위로 솟은 1~2타일 사각** | 문 통제·현수 | https://en.wikipedia.org/wiki/Portcullis |

### 2-B. 학술·마법·관측 (15–23)

| # | 유형 | 평면 · 층수 | 지붕 구성 | 16px 3/4 실루엣 단서 | 쓰임 | 출처 |
|---|---|---|---|---|---|---|
| 15 | **도서관** | 장방형 3~5×2, 서가 벽 | 맞배 + 채광창(천창) | **지붕에 유리 사각 2~3개** | 기록·연구 | https://en.wikipedia.org/wiki/Library |
| 16 | **아카데미 / 학교** | 4각 중정형(회랑+강의실) | 회랑 낮은 단사 + 본관 맞배 | **중정(빈 사각)을 감싸는 ㄷ/ㅁ자 지붕** | 교육 | https://en.wikipedia.org/wiki/Academy |
| 17 | **마법사 탑** | 원형 1실/층, 5~8층, 나선계단 | 원뿔(마녀 모자) 또는 다면 첨탑 | **가장 가는 원형 + 뾰족 원뿔**, 주변보다 2배 높이 | 마법 연구·거처 | https://en.wikipedia.org/wiki/Tower (마법사 탑 전용 문서는 없음 — 일반 탑 형태로 대체) [추정] |
| 18 | **천문대** | 원형 돔 1실 + 부속 1동 | **반구 돔 + 중앙 슬릿(개방 틈)** | **반구 지붕 + 위에서 본 1px 틈** — 유일하게 둥근 지붕 | 천문·항해 | https://en.wikipedia.org/wiki/Observatory |
| 19 | **마법 학교 (기숙+강의+대회당)** | 3~4개 동 + 중정 + 지하 | 혼합(첨탑 다수 + 긴 박공) | **첨탑 4~6개가 한 블록에 밀집** — "성"과 구분되는 다탑 실루엣 | 마법 교육 | https://en.wikipedia.org/wiki/Magical_organization |
| 20 | **연금술 실험실** | 지하 1실 + 굴뚝 | 평평, 굴뚝 1 | **지붕 없는(또는 평평한) 작은 블록 + 굴뚝** | 제조·연구 | (아카데미·실험실의 부속; 전용 문서 없음) [추정] |
| 21 | **사당 (shrine)** | 1~2칸 소형, 신상 1 | 작은 맞배 또는 개방 | **1×2타일, 문 대신 개방된 앞면** | 개인 기도 | https://en.wikipedia.org/wiki/Shrine |
| 22 | **신전 (temple)** | 주랑 + 내부 성소(2~3랑) | 박공 + 앞면 열주 | **앞면에 기둥 4~6개가 1px 점으로 보이는 열주** | 공적 제례 | https://en.wikipedia.org/wiki/Temple |
| 23 | **은둔처 (hermitage)** | 1실 + 작은 예배소 | 초가/이끼 낀 단사 | **가장 작은 지붕 + 주변에 나무 1~2그루만** | 은자·순례 | https://en.wikipedia.org/wiki/Hermit (은둔처 전용 문서는 없음) [추정] |

### 2-C. 위생·여가·공공 (24–33)

| # | 유형 | 평면 · 층수 | 지붕 구성 | 16px 3/4 실루엣 단서 | 쓰임 | 출처 |
|---|---|---|---|---|---|---|
| 24 | **목욕탕 (bathhouse)** | 중앙 탕 + 주변 탈의실, 1층 | 낮은 단사 + 중앙 채광 돔 | **지붕 중앙에 작은 원형 개구부** | 위생·사교 | https://en.wikipedia.org/wiki/Bathhouse |
| 25 | **극장** | 반원/말발굽 객석 + 무대 | 무대 위 높은 박공 + 객석 개방 | **한쪽이 잘린 반원** — 지붕이 반달 | 공연 | https://en.wikipedia.org/wiki/Theatre |
| 26 | **투기장 (arena)** | 타원/원형 + 관중석 링 | 링형 지붕 또는 완전 개방 | **가운데 구멍이 뚫린 도넛 지붕** | 경기·투기 | https://en.wikipedia.org/wiki/Arena |
| 27 | **콜로세움 폐허** | 타원, 외벽 일부 붕괴 | 부분만 남은 링 | **도넛의 1/3이 결손** — 결손 방향이 폐허 표식 | 유적·랜드마크 | https://en.wikipedia.org/wiki/Colosseum |
| 28 | **수도교 (aqueduct)** | 직선 아치 5~20경간 | 없음(상면 수로) | **1타일 폭 직선 + 아치 그림자 점이 규칙 반복** | 급수 | https://en.wikipedia.org/wiki/Aqueduct_(water_supply) |
| 29 | **분수 광장** | 원형/8각 수반 + 광장 | 없음 | **포장 광장 중앙의 원형 물 1~2타일** | 집결·급수 | https://en.wikipedia.org/wiki/Fountain |
| 30 | **정자 (pavilion)** | 4각/6각 개방, 1층 | 다면 지붕 + 첨탑 | **기둥만 보이고 벽이 없는 작은 다면 지붕** | 휴게 | https://en.wikipedia.org/wiki/Pavilion |
| 31 | **가제보** | 6각/8각, 정원 내 | 육각 지붕 | **정원 안의 작은 육각 점** | 정원 휴게 | https://en.wikipedia.org/wiki/Gazebo |
| 32 | **개선문** | 1~3 아치, 폭 3~5타일 | 평평한 상면 + 조각 | **직선 벽에 뚫린 아치 1~3개** | 기념·도시 입구 | https://en.wikipedia.org/wiki/Triumphal_arch |
| 33 | **오벨리스크 / 조각상 대좌** | 정사각 기단 + 기둥/상 | 없음 | **1×1 또는 2×2 받침 + 위 1px 점** | 기념·광장 중심 | https://en.wikipedia.org/wiki/Obelisk, https://en.wikipedia.org/wiki/Pedestal |

### 2-D. 항만·산업·생산 (34–46)

| # | 유형 | 평면 · 층수 | 지붕 구성 | 16px 3/4 실루엣 단서 | 쓰임 | 출처 |
|---|---|---|---|---|---|---|
| 34 | **항만 크레인 (트레드휠)** | 부두 위 목조 1기 | 없음(지붕 있는 경우 단사) | **부두 끝 1×1 목조 + 위로 뻗은 1px 붐** | 하역 | https://en.wikipedia.org/wiki/Treadwheel_crane |
| 35 | **조선소** | 해안 슬립웨이 2~4 + 작업장 | 작업장만 단사 | **물가에 수직으로 뻗은 1타일 폭 슬립 2~4개** | 건조·수리 | https://en.wikipedia.org/wiki/Shipyard |
| 36 | **어시장** | 개방 홀 + 좌판 열 | 큰 단사 또는 천막 | **지붕 아래 좌판 점이 줄지어** | 수산 유통 | https://en.wikipedia.org/wiki/Fish_market |
| 37 | **길드 창고** | 장방형 4~6×2, 2층 | 맞배 + 외부 계단 | **긴 지붕 + 측면 외부 계단 1개** | 보관·검수 | https://en.wikipedia.org/wiki/Warehouse |
| 38 | **무두질 공방 (tannery)** | 물가 1랑 + 작업장 | 낮은 단사, 냄새 환기 | **물가에 붙은 낮은 긴 지붕 + 통 2~3개** | 가죽 | https://en.wikipedia.org/wiki/Tanning_(leather) |
| 39 | **채석장** | 계단식 절개지 | 없음 | **지면이 계단처럼 파인 회색 사각 2~3단** | 석재 | https://en.wikipedia.org/wiki/Quarry |
| 40 | **광산 입구** | 갱구 + 갱차 레일 | 작은 문루 | **암벽에 뚫린 검은 사각 1개 + 레일 1px** | 광물 | https://en.wikipedia.org/wiki/Mining |
| 41 | **농장 복합** | 주거 + 헛간 + 외양간 + 타작마당 | 각각 맞배/단사, 재질 혼합 | **지붕 3~4동이 흩어지고 사이에 빈 마당** | 식량 생산 | https://en.wikipedia.org/wiki/Farm |
| 42 | **포도주 압착소** | 이랑 옆 1랑 + 압착조 | 낮은 단사 | **줄지은 포도 이랑 + 작은 창고 1동** | 포도주 | https://en.wikipedia.org/wiki/Vineyard |
| 43 | **양봉장** | 벌통 6~12개 + 작은 창고 | 창고만 단사 | **작은 상자 점이 규칙 격자로 늘어선 구역** | 꿀·밀랍 | https://en.wikipedia.org/wiki/Apiary |
| 44 | **제분 언덕 (풍차군)** | 언덕 위 풍차 1~3기 | 원뿔 + 회전 날개 | **원형 위 4개 날개(십자)** — 16px에서 가장 강한 표식 | 제분 | (기존 61종의 포스트/타워 밀과 중복되므로 **군집 배치**만 추가) [추정] |
| 45 | **도살장 / 정육 공방** | 물가 1랑 + 냉혈실 | 낮은 단사 | **물가 + 작은 굴뚝** | 육류 가공 | (창고·부엌의 파생) [추정] |
| 46 | **제염소** | 해안 염전 + 창고 | 창고 단사 | **물가의 얕은 사각 물웅덩이 격자** | 소금 | (어시장·항만 파생) [추정] |

### 2-E. 종교·장례·처형 (47–52)

| # | 유형 | 평면 · 층수 | 지붕 구성 | 16px 3/4 실루엣 단서 | 쓰임 | 출처 |
|---|---|---|---|---|---|---|
| 47 | **묘지·영묘 (mausoleum)** | 지상 1실 + 지하 납골 | 돔 또는 피라미드 지붕 | **작은 정사각 + 둥근/피라미드 지붕 1개** | 매장 | https://en.wikipedia.org/wiki/Mausoleum |
| 48 | **카타콤 입구** | 지하 회랑 + 계단 | 지상은 작은 문루 | **지면의 계단 구멍 + 주변에 십자 표식** | 지하 매장 | https://en.wikipedia.org/wiki/Catacombs |
| 49 | **교수대** | 3~4 기둥 + 단 | 없음 | **1×1 목조 + 위 1px 가로대** | 처형 | https://en.wikipedia.org/wiki/Gallows |
| 50 | **형틀 (stocks)** | 광장 1칸 | 없음 | **광장 한가운데 작은 목조 1px** | 공개 처벌 | https://en.wikipedia.org/wiki/Stocks |
| 51 | **순례자 숙소 (hospice)** | 회랑 + 병실 + 예배소 | 회랑 단사 | **예배당에 붙은 긴 낮은 지붕** | 순례·치료 | (예배당·자선원 파생) [추정] |
| 52 | **성지 광장 (sacred way)** | 계단 + 문 + 제단 | 없음 | **계단이 이어지다 문 1개, 끝에 제단 1칸** | 의례 동선 | (신전·계단 파생) [추정] |

### 2-F. 궁정·정원·기념 (53–56)

| # | 유형 | 평면 · 층수 | 지붕 구성 | 16px 3/4 실루엣 단서 | 쓰임 | 출처 |
|---|---|---|---|---|---|---|
| 53 | **궁전 (palace)** | 3~4익 + 중정, 3층 | 익마다 맞배, 모서리 탑 | **ㅁ자 또는 ㄷ자 큰 지붕 + 모서리 첨탑 4개** | 왕거·행정 | (대연회장·영주 저택의 상위형) [추정] |
| 54 | **왕좌실** | 장방형 3×6, 측면 회랑 | 높은 박공 + 천창 | **가장 긴 단일 지붕 + 끝에 단(壇) 1타일** | 알현·재판 | (대연회장 파생) [추정] |
| 55 | **왕실 정원 정자 / 연못** | 기하학 정원 + 수로 + 정자 | 정자만 | **직선 수로 + 사각 연못 + 정자 1개** | 휴식·의례 | https://en.wikipedia.org/wiki/Gazebo, https://en.wikipedia.org/wiki/Fountain |
| 56 | **도시 계단 (city stairs)** | 폭 2~4타일, 높이 3~10단 | 없음 | **지면에 새겨진 평행선 3~5줄** — 고도 변화의 유일한 표식 | 구역 연결 | https://en.wikipedia.org/wiki/Stairs |

**부속 부품(건물 아님, 타일로만 필요):** 사주문(postern, https://en.wikipedia.org/wiki/Postern), 출격문(sallyport, https://en.wikipedia.org/wiki/Sallyport), 도개교(https://en.wikipedia.org/wiki/Drawbridge), 공성탑(https://en.wikipedia.org/wiki/Siege_tower), 성벽 위 보행로·총안. 이 5종은 Part 1의 성벽·문 규약과 직접 연결되므로 건물 목록과 별도로 **성벽 키트**에 넣는다.

---

## Part 3 — 이 부품들로 도시 전체를 절차 생성하기

### 3-A. 검증된 생성기 3개의 실제 알고리즘

**1) Watabou의 Medieval Fantasy City Generator (오픈소스, GPL-3.0)**
소스가 공개되어 있어 알고리즘을 직접 인용할 수 있다. 저장소: https://github.com/watabou/TownGeneratorOS (기준 커밋 `7fbc87a9398cc508af24de93f79cf2ad027f352b`).

- **구역 = 보로노이 패치.** `Model.buildPatches()`는 중심에서 바깥으로 나선형으로 점을 뿌려 보로노이를 만들고, **중심부 3개 패치를 relax**해 광장이 들어갈 여유를 만든다. 점을 중심 거리순으로 정렬해 **가장 안쪽 = 광장, nPatches번째 = 성채(citadel)** 로 고정한다. (https://github.com/watabou/TownGeneratorOS/blob/7fbc87a9398cc508af24de93f79cf2ad027f352b/Source/com/watabou/towngenerator/building/Model.hx)
- **성벽 = 패치 외곽선의 스무딩 + 문 + 탑.** `CurtainWall`은 여러 패치의 외곽선을 이어 성벽 폴리곤을 만들고, **"안쪽 구역 2개 이상이 만나는 꼭짓점"만 문 후보**로 삼는다. 문끼리 너무 가깝지 않도록 선택 후 이웃 후보를 제거하며, 문이 없는 성벽 구간의 꼭짓점마다 탑을 세운다. (https://github.com/watabou/TownGeneratorOS/blob/7fbc87a9398cc508af24de93f79cf2ad027f352b/Source/com/watabou/towngenerator/building/CurtainWall.hx)
- **도로 = 문에서 광장/중심으로.** `buildStreets()`는 **모든 문에 대해 성문→광장(없으면 중심 교차점) 경로를 만들고**, 성벽 문이면 바깥쪽 도로도 하나 더 만든다. 즉 **도로는 "문에서 안으로" 자라며, 도시 밖 도로는 성문에서 밖으로** 자란다. (같은 `Model.hx`)
- **구역 성격 = 가중치 함수.** `WARDS` 배열이 구역 순서를 정하고(장인·상인·성당·행정·빈민·귀족·시장·군사·공원), 각 구역 클래스의 `rateLocation()`이 패치별 점수를 낸다. 예: `Slum.rateLocation`은 **중심에서 멀수록 좋은 점수**(-distance)를 준다. `Market`은 다른 시장과 인접하면 탈락. (https://github.com/watabou/TownGeneratorOS/blob/7fbc87a9398cc508af24de93f79cf2ad027f352b/Source/com/watabou/towngenerator/wards/Slum.hx, https://github.com/watabou/TownGeneratorOS/blob/7fbc87a9398cc508af24de93f79cf2ad027f352b/Source/com/watabou/towngenerator/wards/Market.hx)
- **밀도 기울기 = 건물 필터.** `Ward.filterOutskirts()`는 각 건물에서 "도시 경계/도로까지의 거리"를 계산해, **도시 안쪽·간선로에 가까울수록 남기고 바깥으로 갈수록 확률적으로 지운다**. 이것이 성벽 밖으로 갈수록 건물이 드문드문해지는 시각적 밀도 기울기의 구현이다. (https://github.com/watabou/TownGeneratorOS/blob/7fbc87a9398cc508af24de93f79cf2ad027f352b/Source/com/watabou/towngenerator/wards/Ward.hx)
- **골목 = 재귀 이등분 + 도로 폭 3단.** `createAlleys()`는 블록의 가장 긴 변을 잡아 재귀적으로 반으로 자르며, **도로 폭을 `MAIN_STREET=2.0`, `REGULAR_STREET=1.0`, `ALLEY=0.6`** 세 값으로만 쓴다. 즉 "대로/골목/샛길"이 3단 위계로 고정되어 있다. (같은 `Ward.hx`)
- **성채 = 성벽 안의 성벽.** `Castle` 구역은 자기 패치를 `MAIN_STREET*2` 만큼 안쪽으로 줄인 뒤, 그 안에서 직교 분할로 건물 덩어리를 만든다 — **성 안의 성**이 코드로 명시돼 있다. (https://github.com/watabou/TownGeneratorOS/blob/7fbc87a9398cc508af24de93f79cf2ad027f352b/Source/com/watabou/towngenerator/wards/Castle.hx)
- 저자 본인의 설명: "생성 방식은 다소 임의적이며, 목표는 도시의 정확한 모델이 아니라 **보기 좋은 지도**"라고 명시한다. (https://watabou.itch.io/medieval-fantasy-city-generator)

**2) Parish & Müller, "Procedural Modeling of Cities" (SIGGRAPH 2001)**
- 요지: **L-system으로 도로망(highway→street→lot)을 생성**하고, 인구 밀도·지형(육수 경계)을 입력으로 받아 **도로가 밀도를 따르게** 한다. 이후 lot마다 적절한 건물 지오메트리를 배정하고, 텍스처도 L-system으로 합성한다. (초록: https://api.openalex.org/works/doi:10.1145/383259.383292, DOI: https://doi.org/10.1145/383259.383292)
- 이 논문이 우리에게 주는 것은 **"도로를 먼저, 건물은 나중"** 이라는 순서다. Part 1의 성문·대로·골목 위계와 정확히 같은 순서다.

**3) Townscaper (Oskar Stålberg)**
- **"크게 왜곡된 격자(distorted grid)"** 위에서 동작해, 규칙 격자 게임보다 유기적인 마을이 나온다. 블록을 놓으면 **주변 상황에 따라 첨탑·발코니·아치·계단이 규칙 기반으로 자동 결정**된다 — 사용자가 하나하나 지정하지 않는다. (https://en.wikipedia.org/wiki/Townscaper)
- 시사점: 16px 타일셋 생성기에서도 **"건물 종류를 직접 고르지 말고, 이웃·도로·고도 조건으로 고르게"** 해야 도시가 자연스럽다.

**보조: Red Blob Games의 보로노이 섬 생성** — 육수 경계·고도·습도를 보로노이 다각형에 부여하는 표준 레퍼런스. 지형(섬/해안/산)을 먼저 만들고 도시를 얹는 순서에 그대로 쓸 수 있다. (https://www.redblobgames.com/maps/mapgen2/, 소스: https://github.com/redblobgames/mapgen2)

### 3-B. 구역(district) 설계

조사한 실제 도시들의 구역 목록을 그대로 파라미터로 쓰는 것이 가장 빠르다.

| 구역 | 필수 부품 | 배치 규칙 | 근거 |
|---|---|---|---|
| **성채 (castle)** | 성벽 1겹 + 아성 + 대연회장 + 예배당 + 병영 + 마구간 + 우물 | 도시에서 **가장 높은 지점 또는 가장 안쪽 패치 1개**에 고정. 성벽 안에 또 성벽 | Watabou `Castle.hx`의 "성 안의 성", 프라하 성 |
| **성전 구역 (temple)** | 대성당 + 종탑 + 사당 + 성지 광장 + 순례 숙소 | 성채 다음으로 높은 지점, **광장과 축으로 연결** | 노비그라드 Temple Isle, 발더스 게이트 Temples District |
| **시장 구역 (market)** | 시장 홀 + 분수 광장 + 어시장 + 길드 창고 | **모든 성문에서 가장 가까운 광장**, 다른 시장과 인접 금지 | Watabou `Market.rateLocation`, 노비그라드 Hierarch Square |
| **장인 구역 (craft)** | 대장간 + 양조장 + 빵집 + 무두질 + 제분 | 시장 인접, **물·바람 자원 근처** | Watabou `CraftsmenWard`가 배열의 다수를 차지 |
| **빈민 구역 (slum)** | 민가 밀집 + 판자집 + 우물 + 형틀 | **중심에서 가장 먼 패치**, 성벽 밖으로도 확장 | Watabou `Slum.rateLocation`, 킹스랜딩 Flea Bottom, 발더스 게이트 Outer City |
| **항구 구역 (harbour)** | 부두 + 크레인 + 조선소 + 어시장 + 창고 + 등대 | **물가 + 성문 1개**, 도시에서 가장 낮은 고도 | 발더스 게이트 Gray Harbor, 노비그라드 Harborside |
| **군사 구역 (military)** | 병영 + 무기고 + 연병장 + 마구간 | 성문 인접, **성벽 안쪽** | Watabou `MilitaryWard` |
| **행정 구역 (administration)** | 궁전 + 시청 + 보물탑 + 도서관 | 성채와 시장 사이 | Watabou `AdministrationWard` |
| **공원·정원** | 정원 + 정자 + 가제보 + 연못 | 성채·귀족가 인접 | Watabou `Park`, `PatriciateWard` |

### 3-C. 도로 위계

조사 결과 **3단이면 충분하고, 4단은 과잉**이다.

| 위계 | 폭 | 연결 | 16px 표현 |
|---|---|---|---|
| **대로 (main street)** | 2타일 | 모든 성문 ↔ 광장/성채 | 밝은 포석 2타일 폭, 중앙에 배수 1px |
| **골목 (regular street)** | 1타일 | 구역 내부 순환 | 흙/포석 1타일 |
| **샛길 (alley)** | 1타일(반 칸 시각) | 블록 내부, 막다른 길 허용 | 어두운 1타일, 끝에 문 1개 |

근거: Watabou는 `MAIN_STREET=2.0 / REGULAR_STREET=1.0 / ALLEY=0.6` 세 값만 쓴다(Ward.hx). Parish & Müller도 highway→street→lot의 3단 L-system이다. Level Design Book은 멀티플레이 맵에서 **레인 1~3개**를 권고하며, 그 이상은 미로가 된다고 적는다 (https://book.leveldesignbook.com/process/layout/flow/circulation).

**도로 생성 순서(권장):**
1. 지형(물·절벽·경사)을 먼저 깐다.
2. 성벽 폴리곤을 정하고 **문 후보를 "구역 2개 이상이 만나는 꼭짓점"으로 뽑는다** (Watabou 방식).
3. 각 문에서 광장까지 **최단 경로를 대로로** 깐다.
4. 대로에서 갈라지는 골목을 **재귀 이등분**으로 채운다.
5. 남은 블록 안에 샛길을 확률적으로 넣는다.

### 3-D. 지형 (언덕·강·해안)

| 지형 | 도시 형태 | 근거 |
|---|---|---|
| **산등성이/언덕** | 링 또는 초승달 띠, 문이 번갈아 방향 | 미나스 티리스, 에도라스, 로카마두르 |
| **강** | 양안 + 다리 1~3개, 다리 위 탑 | 오스길리아스, 리버런, 쌍둥이 성 |
| **해안** | 성벽이 바다까지 내려옴, 항구 성문 1개 | 두브로브니크, 코토르, 발더스 게이트 |
| **조수/호수** | 물이 주기적으로 지형을 끊음 | 몽생미셸 |
| **절벽** | 성벽 대신 절벽 3면 + 1면만 성문 | 에든버러, 이리 |
| **평지** | 동심 성벽 + 해자 링 | 카르카손, 크라크 데 슈발리에 |

### 3-E. 성벽과 문

- **성벽은 반드시 "길"로 만든다.** 스톰베일·언데드 버그·로텐부르크 모두 성벽 위 통행이 동선의 핵심이다. 타일셋에 `wall_top_walk`(통행 가능)와 `wall`(불가)을 분리한다.
- **문은 2~4개.** Watabou는 문 후보를 뽑을 때 **서로 너무 가까운 후보를 제거**한다(CurtainWall.buildGates). 이 규칙 하나로 "문이 한쪽에 몰리는" 실패가 사라진다.
- **문 앞에는 항상 바비칸 또는 다리.** 헬름스 딥의 둑길, 카르카손의 바비칸, 언데드 버그의 다리 — 문 앞 1~2타일은 반드시 좁아야 한다.
- **사주문(postern) 1개**를 성벽 뒤쪽에 둔다. 스톰베일의 측문, 하이랄 성의 부두가 같은 역할이다.

### 3-F. 랜드마크와 시선축

Level Design Book의 wayfinding 정리에 따르면 사람은 **경로(path)·경계(edge)·구역(district)·결절(node)·랜드마크(landmark)** 로 공간을 기억한다(케빈 린치의 도시 이미지). 그리고 "플레이어는 움직이는 방향을 보고, 대비(색·형태·조명·움직임)에 집중하며, 무언가가 눈을 끌지 않으면 위를 보지 않는다"는 세 규칙을 제시한다. (https://book.leveldesignbook.com/process/blockout/wayfinding)

16px 생성기에 그대로 옮기면:

1. **랜드마크는 도시당 1~2개.** 성채 탑 또는 대성당 첨탑. 나머지 건물은 랜드마크보다 **높이 1~2px 낮게** 제한한다.
2. **대로의 끝은 항상 랜드마크.** 문에서 광장으로, 광장에서 탑으로 — 시선축이 도로와 일치해야 지도가 읽힌다.
3. **색 대비로 구역을 구분.** 성전=밝은 석재, 빈민=갈색 목재, 항구=회청색, 성채=백색. 야남의 고도별 색 구분과 같은 원리.
4. **랜드마크가 보이는 곳에만 광장을 둔다.** 광장은 "탑이 보이는 지점"에 배치하면 자연스러운 결절이 된다.

### 3-G. 밀도 기울기

- **중심→외곽으로 갈수록 건물이 성기게.** Watabou의 `filterOutskirts()`가 정확히 이 일을 한다(도시 안쪽·간선로에 가까울수록 남김).
- **성벽 밖은 밀도 30~50%.** 킹스랜딩 판자촌, 발더스 게이트 아우터 시티가 실례다.
- **구역별 밀도 상한을 다르게.** 빈민 90%, 장인 70%, 시장 50%(광장 때문), 성전 40%, 성채 30%.
- **16px에서 밀도는 "지붕 사이 빈칸 수"로 읽힌다.** 같은 블록 크기에서 지붕 타일 비율을 조절하는 것이 가장 빠르다.

### 3-H. 생성 파이프라인 (권장 순서)

```
1. 지형      : 물/절벽/경사/해안 → 보로노이 또는 격자
2. 성벽      : 도시 외곽선 스무딩 → 문 후보(구역 경계 꼭짓점) → 문 간 최소거리 → 탑
3. 대로      : 각 문 → 광장/성채 최단경로
4. 구역      : rateLocation 가중치로 패치에 성격 배정 (성채·성전·시장·장인·빈민·항구·군사)
5. 골목      : 블록 재귀 이등분 (2.0 / 1.0 / 0.6 폭)
6. 건물      : 구역별 부품 표에서 선택, 지붕 높이·색을 구역 규칙으로 고정
7. 밀도 필터 : 중심·대로에서 먼 건물 확률 제거
8. 랜드마크  : 최고 고도 1~2개만 허용, 나머지 높이 상한
9. 검증      : 문에서 랜드마크까지 도보 경로 존재, 모든 구역이 대로에 접속, 고립 블록 0
```

9번이 중요하다. Level Design Book은 "잠금(lock)을 먼저 보여주고 열쇠를 나중에" 주라고 조언하는데(https://book.leveldesignbook.com/process/layout/typology/gates), 절차 생성에서 이는 **"모든 문이 실제로 어딘가로 이어지는지"를 기계적으로 검사**하는 것과 같다. 끊긴 문은 생성 실패로 처리한다.

---

## 부록 A — 이번 조사에서 확인하지 못한 것

- **Tolkien Gateway**(tolkiengateway.net)는 Cloudflare 챌린지로 본문·API 모두 차단되어 인용하지 못했다. 미나스 티리스·헬름스 딥·리벤델은 Wikipedia와 lotr.fandom으로 대체했다. Tolkien Gateway의 도해(단면도)는 이 문서에 반영되지 않았다.
- **Parish & Müller 논문 원문 PDF**는 ACM DL Cloudflare 차단과 출력 크기 제한으로 받지 못했다. 인용한 것은 OpenAlex의 초록(색인된 역색인 텍스트)과 서지 정보뿐이며, 세부 알고리즘 수치는 원문 대조가 필요하다.
- **Castlevania·Hogwarts·Novigrad·Baldur's Gate의 방/구역 목록**은 팬 위키 기준이다. 원작 1차 자료(게임 데이터·소설)와 대조하지 않았다.
- **"16px 단서" 열 전체는 내 설계 추론**이다. 각 유형의 실제 형태는 출처가 서술하지만, "이 형태를 16px 3/4에서 어떻게 읽히게 할지"는 어떤 출처에도 없는 판단이다.
- **와타보우 생성기의 시각 결과물**은 소스 코드로만 확인했고, 실제 렌더를 직접 돌려보지 않았다(이 세션은 읽기 전용이며 로컬 실행·클론 불가).
- 마법사 탑·은둔처·연금술 실험실·도살장·제염소·순례자 숙소 등 6종은 **전용 위키백과 문서가 없어** 일반 탑/건물 문서로 대체했고, 해당 행에 [추정]으로 표시했다.

## 부록 B — 출처 색인

**1차(게임·소설 위키)**
- Wikipedia: https://en.wikipedia.org/wiki/Minas_Tirith · https://en.wikipedia.org/wiki/Gondor · https://en.wikipedia.org/wiki/Battle_of_Helm%27s_Deep · https://en.wikipedia.org/wiki/Rohan,_Middle-earth · https://en.wikipedia.org/wiki/Rivendell · https://en.wikipedia.org/wiki/Mordor · https://en.wikipedia.org/wiki/Nazg%C3%BBl · https://en.wikipedia.org/wiki/Anor_Londo · https://en.wikipedia.org/wiki/Yharnam · https://en.wikipedia.org/wiki/World_of_A_Song_of_Ice_and_Fire · https://en.wikipedia.org/wiki/Townscaper
- lotr.fandom: https://lotr.fandom.com/wiki/Osgiliath · https://lotr.fandom.com/wiki/Cirith_Ungol · https://lotr.fandom.com/wiki/Barad-d%C3%BBr
- Fextralife: https://eldenring.wiki.fextralife.com/Stormveil_Castle · https://eldenring.wiki.fextralife.com/Leyndell_Royal_Capital_(Legacy_Dungeon) · https://eldenring.wiki.fextralife.com/Raya_Lucaria_Academy · https://eldenring.wiki.fextralife.com/Volcano_Manor · https://eldenring.wiki.fextralife.com/Castle_Morne · https://eldenring.wiki.fextralife.com/Caria_Manor · https://darksouls.wiki.fextralife.com/Undead_Burg · https://darksouls3.wiki.fextralife.com/Lothric_Castle · https://darksouls3.wiki.fextralife.com/Irithyll_of_the_Boreal_Valley
- zelda.fandom: https://zelda.fandom.com/wiki/Hyrule_Castle_(Breath_of_the_Wild) · https://zelda.fandom.com/wiki/Hyrule_Castle_(A_Link_to_the_Past)
- 기타: https://castlevania.fandom.com/wiki/Dracula%27s_Castle · https://harrypotter.fandom.com/wiki/Hogwarts_Castle · https://ffxiv.consolegameswiki.com/wiki/Ishgard · https://witcher.fandom.com/wiki/Novigrad · https://forgottenrealms.fandom.com/wiki/Baldur%27s_Gate · https://en.uesp.net/wiki/Skyrim:Markarth

**실재 유적(위키백과)**
https://en.wikipedia.org/wiki/Carcassonne · https://en.wikipedia.org/wiki/Krak_des_Chevaliers · https://en.wikipedia.org/wiki/Mont-Saint-Michel · https://en.wikipedia.org/wiki/Dubrovnik · https://en.wikipedia.org/wiki/Kotor · https://en.wikipedia.org/wiki/Rocamadour · https://en.wikipedia.org/wiki/Neuschwanstein_Castle · https://en.wikipedia.org/wiki/Himeji_Castle · https://en.wikipedia.org/wiki/Mdina · https://en.wikipedia.org/wiki/Edinburgh_Castle · https://en.wikipedia.org/wiki/Prague_Castle · https://en.wikipedia.org/wiki/Tallinn · https://en.wikipedia.org/wiki/Rothenburg_ob_der_Tauber

**레벨 디자인 이론**
https://book.leveldesignbook.com/process/layout/flow/circulation · https://book.leveldesignbook.com/process/layout/flow/verticality · https://book.leveldesignbook.com/process/layout/typology/gates · https://book.leveldesignbook.com/process/blockout/wayfinding · https://book.leveldesignbook.com/studies/sp/undead-burg

**절차 생성**
https://github.com/watabou/TownGeneratorOS (GPL-3.0, 커밋 `7fbc87a9`) · https://watabou.itch.io/medieval-fantasy-city-generator · https://doi.org/10.1145/383259.383292 · https://www.redblobgames.com/maps/mapgen2/ · https://github.com/redblobgames/mapgen2

**건축 유형(위키백과)**
Cathedral · Flying buttress · Bell tower · Barbican · Hoarding (castle) · Bastion fort · Castle chapel · Great hall · Kitchen · Stable · Barracks · Arsenal · Treasury · Dungeon · Portcullis · Postern · Sallyport · Drawbridge · Siege tower · Library · Academy · Tower · Observatory · Magical organization · Shrine · Temple · Hermit · Bathhouse · Theatre · Arena · Colosseum · Aqueduct (water supply) · Fountain · Pavilion · Gazebo · Triumphal arch · Obelisk · Pedestal · Treadwheel crane · Shipyard · Fish market · Warehouse · Tanning (leather) · Quarry · Mining · Farm · Vineyard · Apiary · Mausoleum · Catacombs · Gallows · Stocks · Stairs · Ruins
(모두 `https://en.wikipedia.org/wiki/<제목>` 형식으로 접근 가능함을 이번 세션에서 확인했다.)
