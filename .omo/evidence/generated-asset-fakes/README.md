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
