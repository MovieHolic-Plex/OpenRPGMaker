# 일본 도시 — 새 건물 67종 (탑 3/4 시점) · 쓰는 법

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **28527칸**, 16px 칸, 한 줄 **96칸** — 번호 n 의 칸은 열 n%96, 행 n÷96(내림), 픽셀 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 다른 칩셋의 칸 번호와 섞지 않는다.

**무엇인가.** 탑 3/4 시점(거리에서 45도쯤 내려다봄)으로 새로 그린 건물 한 채 = 키트 하나(`jp-bldg-f-<이름>`, 굽기 블록 `scripts/content/jp-city/blocks/fable_city.py`). 지붕은 위에서 본 큰 면(기와 경사 · 평지붕 바닥과 옥상 기물 · 박공 ㅅ)이고 차양·발코니·상자는 윗면이 보인다.
옛 손 도트 건물(용도 「손 도트 건물」, `jp-bldg-hand-rules`)과 **다른 계열**이다 — 옛 건물은 양 끝에 처마 칸이 있어 x + w − 1 로 세우지만, 새 건물은 **키트 폭 = 벽 폭**이다. 한 거리에서 두 계열을 섞지 않는 편이 좋다(시점이 다르다).
**이 그림들은 3/4 관문을 통과하지 않았다 — 오너 면제**(묶음 `fable-jpbuildings-2026-11-14`, 번들·공유 출구만 열리고 스토어 출구는 막힌다).

**찍는 법(실행 순서).**
1. 바닥을 먼저 깐다(보도·생활도로·마당). 건물 키트에는 바닥(1층) 칸이 없다 — 모든 칸이 3층(위층).
2. `stamp_object` 로 `kit:jp-bldg-f-…` 를 찍는다(좌표 = 키트 왼쪽 위). 발 = 왼쪽 위 + (0, h−1).
3. **줄지어 세우기: 다음 x = x + w.** 양옆에 처마 칸이 없으니 상점가 가게는 벽을 맞대어 틈 없이 세운다. 집은 사이에 마당 1~2칸을 두고 담(2×2, 옆으로 되풀이)과 대문으로 잇는다.
4. 두 줄 이상이면 뒷줄(화면 위쪽) 건물부터 찍는다. 큰 건물(높이 12~18칸)은 지붕이 위로 길게 올라가니 뒤에 그만큼 자리를 둔다.
5. **문 열**의 맨 아래 칸이 출입구(`parts` 의 `entrance`, 막힘)이고 그 바로 아래 한 칸(`access`, 키트 밖)은 걷는 바닥으로 비운다. 실내 이동은 그 칸에 이벤트(전이)를 따로 놓는다.
6. **지나는 열**(대문·절 산문·도리이)은 그 열 전체가 `*` 이다: 사람이 그 열로 걸어 지나가고 그림이 사람 위에 그려진다. `entrance` 부품은 없고 접근칸만 있다.
7. 간판·차양·옥상 기물은 그림에 들어 있다 — 더 얹지 않는다.

**통행(`codes`).** `X` 막힘 · `*` 걸음(그림이 캐릭터 위) · `_` 빈 칸. 맨 아래 D줄(대부분 2, 담·대문·도리이는 1)만 `X`, 그 위는 `*`. 이 글자는 **정의의 통행·층 표에서 읽은 값**이다(엔진 실측 덤프가 아니다).

**없는 것(정직한 목록).** 뒷면·옆면 그림 없음 · 간판 글자는 일본어(가나 위주) 고정 · 실내 맵 없음 · 밤 조명판 없음 · 실제 상표·로고 없음 · 3/4 관문을 통과한 그림 아님 · 이 문서는 정상/오류 변조 실험을 싣지 않는다.

## 목록 (67종)
| 키트 | 이름 | 거리 역할 | 크기 급 | 폭×높이 | 막힘 줄 | 문 열 | 지나는 열 | 지붕 |
|---|---|---|---|---|---|---|---|---|
| `jp-bldg-f-yaoya` | 채소 가게 | 상점가 줄 | small | 3×7 | 2 | 1 | - | tile |
| `jp-bldg-f-furuhon` | 헌책방 | 상점가 줄 | small | 3×7 | 2 | 1 | - | flat |
| `jp-bldg-f-kissa` | 찻집 | 상점가 줄 | small | 4×7 | 2 | 2 | - | tile |
| `jp-bldg-f-machiya-gable` | 박공 마치야 | 상점가 줄 | small | 4×7 | 2 | 2 | - | gable |
| `jp-bldg-f-sakana` | 생선 가게 | 상점가 줄 | small | 3×7 | 2 | 1 | - | tile |
| `jp-bldg-f-niku` | 정육점 | 상점가 줄 | small | 3×7 | 2 | 0 | - | flat |
| `jp-bldg-f-pan` | 빵집 | 상점가 줄 | small | 4×7 | 2 | 2 | - | tile |
| `jp-bldg-f-hana` | 꽃집 | 상점가 줄 | small | 3×7 | 2 | 1 | - | flat |
| `jp-bldg-f-tofu` | 두부 가게 | 상점가 줄 | small | 3×7 | 2 | 1 | - | tile |
| `jp-bldg-f-sake` | 술 가게 | 상점가 줄 | small | 4×7 | 2 | 2 | - | gable |
| `jp-bldg-f-kome` | 쌀가게 | 상점가 줄 | small | 3×7 | 2 | 1 | - | tile |
| `jp-bldg-f-kusuri` | 약국 | 상점가 줄 | small | 3×7 | 2 | 1 | - | flat |
| `jp-bldg-f-tokoya` | 이발소 | 상점가 줄 | small | 3×7 | 2 | 1 | - | flat |
| `jp-bldg-f-ocha` | 찻잎 가게 | 상점가 줄 | small | 3×7 | 2 | 1 | - | gable |
| `jp-bldg-f-denki` | 전파상 | 상점가 줄 | small | 4×7 | 2 | 1 | - | flat |
| `jp-bldg-f-jitensha` | 자전거포 | 상점가 줄 | small | 4×7 | 2 | 2 | - | tile |
| `jp-bldg-f-kanamono` | 철물점 | 상점가 줄 | small | 3×7 | 2 | 1 | - | tile |
| `jp-bldg-f-dagashi` | 막과자 가게 | 상점가 줄 | small | 3×7 | 2 | 1 | - | tile |
| `jp-bldg-f-sentaku` | 세탁소 | 상점가 줄 | small | 3×7 | 2 | 1 | - | flat |
| `jp-bldg-f-ramen` | 라멘집 | 상점가 줄 | small | 3×7 | 2 | 1 | - | tile |
| `jp-bldg-f-sushi` | 초밥집 | 상점가 줄 | small | 4×7 | 2 | 2 | - | tile |
| `jp-bldg-f-izakaya` | 선술집 | 상점가 줄 | small | 4×7 | 2 | 1 | - | tile |
| `jp-bldg-f-yakitori` | 꼬치구이집 | 상점가 줄 | small | 3×7 | 2 | 2 | - | tile |
| `jp-bldg-f-bungu` | 문방구 | 상점가 줄 | small | 3×7 | 2 | 1 | - | flat |
| `jp-bldg-f-house-eave` | 기와 2층집 | 주택가 | small | 5×7 | 2 | 3 | - | tile |
| `jp-bldg-f-machiya-hira-a` | 마치야 | 주택가 | small | 4×7 | 2 | 1 | - | tile |
| `jp-bldg-f-machiya-hira-b` | 마치야 | 주택가 | small | 5×7 | 2 | 3 | - | tile |
| `jp-bldg-f-house-tile-b` | 기와 2층집 | 주택가 | small | 4×7 | 2 | 2 | - | tile |
| `jp-bldg-f-house-tile-c` | 기와 2층집 | 주택가 | small | 5×7 | 2 | 1 | - | tile |
| `jp-bldg-f-house-tile-d` | 차고 달린 좁은 2층집 | 주택가 | small | 4×7 | 2 | 3 | - | tile |
| `jp-bldg-f-house-old-a` | 툇마루 있는 옛 목조집 | 주택가 | small | 4×5 | 2 | 3 | - | tile |
| `jp-bldg-f-house-old-b` | 덧문 닫은 옛 목조집 | 주택가 | small | 5×5 | 2 | 1 | - | tile |
| `jp-bldg-f-house-box-a` | 흰 상자형 현대 주택 | 주택가 | small | 4×7 | 2 | 2 | - | flat |
| `jp-bldg-f-house-box-b` | 검은 금속판 상자형 주택 | 주택가 | small | 4×7 | 2 | 0 | - | flat |
| `jp-bldg-f-apart-a` | 바깥 계단 목조 연립 | 주택가 | medium | 6×7 | 2 | 0, 2 | - | tile |
| `jp-bldg-f-apart-b` | 바깥 계단 철골 연립 | 주택가 | medium | 6×7 | 2 | 1, 4 | - | tile |
| `jp-bldg-f-house-gable-a` | 박공 2층집 | 주택가 | small | 4×7 | 2 | 1 | - | gable |
| `jp-bldg-f-house-l` | 두 덩이 집 | 주택가 | medium | 7×7 | 2 | 2 | - | tile |
| `jp-bldg-f-house-porch` | 현관 지붕이 나온 2층집 | 주택가 | medium | 6×7 | 2 | 4 | - | tile |
| `jp-bldg-f-kaki-plaster` | 기와 얹은 흰 회벽 담 | 주택가 | small | 2×2 | 1 | - | - | none |
| `jp-bldg-f-kaki-block` | 블록 담 | 주택가 | small | 2×2 | 1 | - | - | none |
| `jp-bldg-f-kaki-wood` | 검은 널 판자 담 | 주택가 | small | 2×2 | 1 | - | - | none |
| `jp-bldg-f-kaki-gate-roofed` | 지붕 얹은 나무 대문 | 주택가 | small | 3×3 | 1 | - | 1 | none |
| `jp-bldg-f-kaki-gate-modern` | 기둥 대문 | 주택가 | small | 3×2 | 1 | - | 1 | none |
| `jp-bldg-f-zakkyo` | 잡거 빌딩 | 중형 | medium | 6×9 | 2 | 1, 4 | - | flat |
| `jp-bldg-f-juku` | 학원 | 중형 | medium | 6×9 | 2 | 1 | - | flat |
| `jp-bldg-f-sento` | 대중목욕탕 | 중형 | medium | 7×7 | 2 | 2, 3 | - | tile |
| `jp-bldg-f-super` | 슈퍼마켓 | 중형 | medium | 8×6 | 2 | 2, 3 | - | flat |
| `jp-bldg-f-clinic` | 의원 | 중형 | medium | 6×7 | 2 | 1 | - | flat |
| `jp-bldg-f-yubin` | 우체국 | 중형 | medium | 6×7 | 2 | 1 | - | flat |
| `jp-bldg-f-koban` | 파출소 | 중형 | small | 4×5 | 2 | 1 | - | flat |
| `jp-bldg-f-konbini` | 편의점 | 중형 | medium | 6×5 | 2 | 2 | - | flat |
| `jp-bldg-f-ginko` | 신용금고 | 중형 | medium | 7×7 | 2 | 2 | - | flat |
| `jp-bldg-f-mansion` | 맨션 | 대형·초대형 | large | 8×16 | 2 | 1, 2 | - | flat |
| `jp-bldg-f-office` | 오피스 빌딩 | 대형·초대형 | large | 8×14 | 2 | 2, 3 | - | flat |
| `jp-bldg-f-depato` | 백화점 | 대형·초대형 | large | 8×12 | 2 | 2, 3 | - | flat |
| `jp-bldg-f-hotel` | 비즈니스 호텔 | 대형·초대형 | large | 6×16 | 2 | 1, 2 | - | flat |
| `jp-bldg-f-byoin` | 병원 | 대형·초대형 | large | 8×12 | 2 | 1, 2 | - | flat |
| `jp-bldg-f-danchi` | 단지 아파트 | 대형·초대형 | large | 7×14 | 2 | 5, 6 | - | flat |
| `jp-bldg-f-ekimae` | 역 앞 상가 빌딩 | 대형·초대형 | xlarge | 12×16 | 2 | 4, 5 | - | flat |
| `jp-bldg-f-shiyakusho` | 구청 | 대형·초대형 | xlarge | 12×14 | 2 | 5, 6 | - | flat |
| `jp-bldg-f-tower` | 타워 맨션 | 대형·초대형 | xlarge | 12×18 | 2 | 4, 5 | - | flat |
| `jp-bldg-f-jinja` | 신사 본전 | 랜드마크 | medium | 7×6 | 2 | 3 | - | tile |
| `jp-bldg-f-sanmon` | 절 산문 | 랜드마크 | medium | 6×6 | 2 | - | 2, 3 | tile |
| `jp-bldg-f-torii` | 도리이 | 랜드마크 | landmark | 4×4 | 1 | - | 1, 2 | none |
| `jp-bldg-f-eki` | 역사 정면 | 랜드마크 | landmark | 10×8 | 2 | 4, 5 | - | tile |
| `jp-bldg-f-osento` | 큰 목욕탕 | 랜드마크 | landmark | 7×10 | 2 | 2, 3 | - | tile |

그림은 `jp-img-bldg-f-*`(역할마다), 칸 번호 전체는 `jp-bldg-f-dict-1` 부터.

