# 공용 표정 세트 흉상·전신 생성 (2026-10-01)

`public/assets/shared/faceset/*-expressions` 76종마다 대화용 흉상(bust)과 전신(full)을
얼굴 16칸과 같은 16표정으로 만든 파이프라인이다(처음 5표정, 같은 날 나머지 11표정 추가). 결과는
`public/assets/shared/portraits/<stem>/{bust,full}-<표정>.png`.

## 순서

```bash
# 1) 기본 시트(전신+흉상 한 장) → 2) 표정 시트(기본 시트를 표정만 바꿔 편집)
python3 scripts/content/portraits/portraits2.py --out3 --phase all --workers 12 [--only <slug>-expressions,...]
# 3) 눈 검수: 머리 등분선(노란 선)으로 N등신, 얼굴·칩과 나란히
python3 scripts/content/portraits/review.py base        # rev-base-*.png
python3 scripts/content/portraits/rev_emo.py            # rev-emo-*.png (5표정 한 줄)
# 4) 저장소용 정리: 분홍 테두리 제거·여백 자르기·128색
python3 scripts/content/portraits/finalize.py
```

생성 원본·로그는 `.omo/asset-gen-tmp/portraits/`(무시 폴더)에 쌓인다. 이미 있는 파일은 건너뛰므로,
한 장만 다시 뽑으려면 그 `sheet-/full-/bust-<표정>.png` 를 지우고 `--only` 로 다시 돌린다.

## 계약 (어기면 사용자에게 지적받은 실패가 돌아온다)

- **한 장에 전신과 흉상을 같이 그린다.** 따로 뽑으면 옷·얼굴이 서로 달라진다. 시트는 가로, 왼쪽=전신, 오른쪽=흉상.
  `split_sheet` 는 가로 순서로 자른다(비율로 고르면 가로로 긴 동물 전신이 흉상과 뒤바뀐다).
- **걷기 칩이 정답이다.** 참조 패널에 얼굴과 함께 칩(앞·옆, 배경색 (0,147,146) 제거)을 넣는다.
  얼굴만 보고 쓴 설명은 틀린다(모자를 고양이 귀로, 데몬에게 머리카락·조끼를 더했다).
- **얼굴 컷은 정수리가 잘려 있다.** 모델이 대머리·탈모로 추측한다. 칩을 눈으로 보고 적은
  머리 윗부분 설명 `head_notes.py` 의 `HEAD` 를 프롬프트에 넣는다. 새 세트를 더하면 여기에도 한 줄 더한다.
- **등신 고정.** 성인 8, 아이 6, 노인 7–7.5, 땅딸막한 몸 6.5–7.5(`KIDS`·`ELDERS`·`STOCKY`).
  번호 띠 마네킹 패널과 "다리 = 전체 높이의 절반" 문구가 같이 있어야 대두가 안 나온다.
- **동물·슬라임은 사람처럼 세우지 않는다**(`NATURAL`). 표정 편집에서도 몸짓 허용 문구를 빼야 슬라임에 다리가 안 생긴다.
- 얼굴 칸 대응: `portraits.py` 의 `EMO_CELL`(happy=02, surprised=04, angry=09, sad=10 … wink=15). 표정 이름은 `src/assets/sharedPortraitAssets.ts` 와 같아야 한다.
- 얼굴↔칩: Actor1 0–7→Actor1, 8–15→Actor2 / Actor2 0–7→Actor3, 8–15→Actor4 /
  People1 0–7→People1, **8–15→People2 0–7** / People2 사람→People3, 동물→Animal / Monster→Monster1·2 (`charset-map.json`, `portraits.py` `chip_map`).
