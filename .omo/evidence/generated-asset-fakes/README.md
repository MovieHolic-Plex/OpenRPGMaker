# 생성 아이템 아트 dry-run 가짜 (2026-09-15 실측)

## 무엇이 문제였나
`scripts/oprn-generated-assets.mjs` 의 `dry-run` 은 실제 생성 대신 `createFakePng`
(`(x*17+y*31)%251` 그라데이션)를 서 배관만 검사한다. 그 가짜가 승격돼
`public/assets/generated/starter/` 안에 **5장**이 들어가 있었다. 계획 파일에는 `status: "promoted"`.

## 증거 만드는 명령 (그대로 다시 돌릴 수 있다)
```bash
# 1) 픽셀로 직접 스캔 — 221장 중 가짜 5장
python3 - <<'PY'
from PIL import Image
import glob
def fake(x,y):
    v=(x*17+y*31)%251
    return (v,(80+v)%251,(160+v)%251,255)
for p in sorted(glob.glob("public/assets/generated/starter/**/*.png", recursive=True)):
    im=Image.open(p).convert("RGBA"); w,h=im.size
    pts=[(x,y) for y in range(0,h,max(1,h//6)) for x in range(0,w,max(1,w//6))]
    if pts and all(im.getpixel((x,y))==fake(x,y) for x,y in pts): print("FAKE", p, f"{w}x{h}")
PY

# 2) 러너 검증기에 같은 파일들을 물려 본다 — 지금은 전부 거부된다
node scripts/oprn-generated-assets.mjs validate-only \
  --manifest .omo/evidence/generated-asset-fakes/fakes-manifest.json \
  --out .omo/evidence/generated-asset-fakes/validation.json

# 3) 계약 테스트
node --test test/oprnGeneratedAssets.test.mjs
```

## 결과 (2026-09-16 재현)
- `scan.json`: 스캔 221장 · 가짜 5장
  (`potion-red-icon` · `potion-red-image` · `bronze-sword-icon` · `bronze-sword-image` · `hero-01-charset`)
- `validation.json`: 5장 모두 `ok=false` + `dry-run fake placeholder` 사유, 대조군
  `battle-icon-bag.png`  `ok=true` (승격 기록 유지)
- `contact-sheet.png`: 가짜 5장 + 정상 2장(대조군)을 3배 확대해 나란히 둔 시트
- `node --test test/oprnGeneratedAssets.test.mjs` → 2/2 pass

## 아직 안 한 것 (정직하게)
가짜 5장의 **재생성은 안 했다.** 이 파일들은 AI 생성 아트이고, 저장소 안 CC0 팩 그림으로 바꾸면
`oprnGeneratedAssetPlan.json` 의 `prompt`/`rawPath` 출처 기록이 거짓이 된다. 재생성 경로:
`scripts/oprn-generated-assets.mjs`(프롬프트는 같은 계획 파일) → 승격 → 이 검증기 통과.
**영향 범위 (실측 2026-09-16 — 처음엔 과대평가했고 바로잡는다):** 이 다섯 장은 기본 프로젝트 레코드가 **하나도 참조하지 않는다.** 기본 주인공의 맵 스프라이트는 `easyrpg-charset-actor1`(진짜 CC0 아트)이고, 네 아이템 id 도 기본 아이템 레코드에 없다. 즉 이것은 **생성 에셋 라이브러리**의 결함이다 — 리졸버(`generatedAssetResourceResolver.ts`)가 그 id 들을 제공하므로, 저작 경로에서 그 리소스를 고르면 줄무늬가 나온다. 기본 스타터 화면에는 보이지 않는다.

## 원본이 어디에도 없다 (2026-09-16 추가 확인)

복구 가능한 진짜 원본을 찾아 이력을 전부 뒤졌고, **어디에도 없다**:

| 확인한 곳 | 결과 |
|---|---|
| 현재 트리 | 가짜(fake=1.00) |
| 초기 스냅샷 `0864daf96` (2026-06-23) 및 개명 커밋 `a39762825` 전후 | 가짜 (5492/787/363 bytes 그대로) |
| Supabase 리소스 캐시 덤프 `51031f6ae` 의 `output/evidence/supabase-root-cache*/supabase-resource-cache/` | **같은 가짜 바이트** |
| 저장소 CC0 팩(`public/assets/cc0/jetrel/icons`) | `potion-red.png`·`bronze-sword.png` 는 진짜지만 **다른 계열**(생성 아트가 아님) |

즉 이 5장은 처음부터 가짜로 커밋됐고, 프로젝트 리소스 캐시에 들어간 사본도 같은 가짜다.
그래서 "원본 복원" 경로는 없고 **재생성**만이 복구다.

## 재생성 경로 상태 (2026-09-16 실측)
- 이 환경의 이미지 생성 라우트는 전부 404 다 — `gpt-image-2.5-sunburst` · `gpt-image-2` ·
  `gpt-image-2.5-flare` 모두 `source: provider-config:aliyun`, `paths: []`.
- 편집기 자체의 생성 경로도 죽어 있다(Antigravity 400 · Codex 401).
- 그래서 재생성은 **자격 복구 후** `scripts/oprn-generated-assets.mjs` 로 실행해야 한다.
  지금 상태에서 손으로 그려 갈아치우면 계획 파일의 `prompt` 출처 기록이 거짓이 된다.

## 재생성 절차 (자격이 살아난 뒤 그대로 실행)

```bash
# 1) 생성 명령을 뽑는다(모델을 부르지 않는다) — 대상은 계획 파일의 id
node scripts/oprn-generated-assets.mjs agy-command \
  --manifest src/assets/oprnGeneratedAssetPlan.json --out /tmp/regen-commands.txt
# 2) 프롬프트/치수는 계획 파일이 정본이다(예: potion-red-image = 64x64 "red healing potion item image")

# 3) 생성 결과를 raw 자리에 두고 검증+승격 기록을 만든다(가짜는 이제 거부된다)
node scripts/oprn-generated-assets.mjs validate-only \
  --manifest src/assets/oprnGeneratedAssetPlan.json --raw-root <생성물 디렉터리> --out /tmp/regen.json

# 4) 승격 후 저장소 계약이 조여진다 — 복구한 id 를 KNOWN_DAMAGED 에서 빼야 통과한다
node --test test/generatedAssetPlaceholder.test.mjs
```

주의: 이 5장의 사본은 **Supabase 리소스 캐시에도 같은 가짜 바이트**로 들어가 있다(위 표).
저장소 파일만 갈아도 프로젝트가 들고 있는 리소스는 그대로이므로, 실제 프로젝트에 반영하려면
리소스 재업로드 경로가 필요하다 — 그건 프로젝트 행을 만지는 작업이라 사용자 승인 없이 하지 않는다.


## 복구 완료 (2026-09-16)

다섯 장을 **실제 생성 파이프라인으로 다시 만들어 갈아 끼웠다.** 새 원본을 찾을 필요는 없었다 —
계획 항목의 정본 생성기(`provenance.generator`)가 `agy` CLI 이고, 그 CLI 는 이 환경에서 살아 있었다.
편집기 앱의 AI 제공자는 죽어 있었지만(400/401) 그건 다른 경로다.

재현 절차:
1. `node scripts/oprn-generated-assets.mjs agy-command --manifest src/assets/oprnGeneratedAssetPlan.json --out /tmp/agy-cmds.json`
2. 각 명령을 `--print-timeout 900s` 로 올려 실행한다 — 에이전트 이미지 생성이 기본 180초를 넘긴다
   (실측: 아이콘 1~3분, 288x256 캐릭터셋 3분). 산출물은 계획의 `rawPath` 자리에 그대로 떨어진다.
3. `validate-only` 로 검증 → 통과한 것만 `promotedPath` 로 복사하고, 계획 항목의 `sha256` 과 `provenance.createdAt` 을 갱신한다.

검증(실측):
- 러너 검증기: 다섯 장 모두 `ok=True` (치수 일치 · nonblank · dryRunFake=False).
- 계약 테스트: `test/generatedAssetPlaceholder.test.mjs` 의 KNOWN_DAMAGED 를 **0장으로 조였다** —
  저장소 어디에도 가짜가 없으면 통과, 하나라도 있으면 실패.
- 전후 대조: `repair-before-after.png` (왼쪽 가짜 줄무늬 / 오른쪽 실제 그림).
- 계획·리졸버·로컬라이제이션 계약 19 테스트 통과, `typecheck:app` exit 0.

남은 한계:
- **캐릭터셋의 옷 색이 hero-01 의 얼굴·배틀 아트와 다르다.** 계획의 프롬프트가 색을 지정하지 않아
  ("young field scout") 생성기가 초록 계열로 그렸고, 배틀·얼굴은 파란 옷 + 주황 머리다. 맞추려면 프롬프트를
  고쳐 다시 생성해야 한다(이번 작업은 "깨진 것을 살린다" 범위).
- 이 저장소 파일만 고쳤다. **Supabase 리소스 캐시에 올라간 사본은 그대로 가짜**이므로, 그 id 를 쓰는
  프로젝트는 리소스 재업로드가 있어야 화면이 바뀐다(프로젝트 행을 만지는 작업이라 별도 승인 필요).
