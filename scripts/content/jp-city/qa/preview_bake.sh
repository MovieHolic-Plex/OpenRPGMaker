#!/usr/bin/env bash
# jp_city 미리보기 굽기 — 저장소 산출물은 건드리지 않고 임시 루트(--out-root)에 굽는다.
# 3/4 관문(gate_kinds.enforce)은 저장소 루트로 구울 때만 걸린다. 관문이 보정되기 전에는 이 경로로만 그림을 확인한다(우회 아님: 저장소 시트·정의는 그대로).
#   scripts/content/jp-city/qa/preview_bake.sh <미리보기 루트>
# 미리보기 루트에 번호 핀·옛 시트·옛 정의를 복사한 뒤(번호 유지·바뀐 칸 수 보고용) 굽는다. 결과: <루트>/public/assets/jp-city/jp-city-chipset.png,
# <루트>/src/assets/jpCityTileset.json, <루트>/tiledata/jp-city/bake-report.json.
set -euo pipefail
cd "$(dirname "$0")/../../../.."
OUT="${1:?미리보기 루트를 주라}"
case "$(realpath -m "$OUT")" in "$(realpath .)") echo "저장소 루트에는 굽지 않는다(관문 보정 전)" >&2; exit 2;; esac
mkdir -p "$OUT/public/assets/jp-city" "$OUT/src/assets" "$OUT/tiledata/jp-city/bake"
for f in tiledata/jp-city/pins.json public/assets/jp-city/jp-city-chipset.png src/assets/jpCityTileset.json src/assets/jpCitySheet.json; do
  [ -e "$OUT/$f" ] && [ "$(realpath "$OUT/$f")" = "$(realpath "$f")" ] && continue
  cp "$f" "$OUT/$f"
done
cp public/assets/jp-city/jp-city-chipset.png "$OUT/tiledata/jp-city/bake/base-chipset.png"     # 비교 기준 = 저장소(체크아웃) 시트
python3 scripts/content/jp-city/bake_jp.py --out-root "$OUT" > "$OUT/tiledata/jp-city/bake-stdout.json"
python3 - "$OUT" <<'PY'
import json, sys
import numpy as np
from PIL import Image
o = sys.argv[1]
r = json.load(open(o + '/tiledata/jp-city/bake-report.json'))
a = np.array(Image.open(o + '/tiledata/jp-city/bake/base-chipset.png').convert('RGBA'))
b = np.array(Image.open(o + '/public/assets/jp-city/jp-city-chipset.png').convert('RGBA'))
cols = b.shape[1] // 16; n = r['tiles']['count']
changed = [t for t in range(n) if (t // cols + 1) * 16 > a.shape[0] or not np.array_equal(a[(t // cols) * 16:(t // cols + 1) * 16, (t % cols) * 16:(t % cols + 1) * 16], b[(t // cols) * 16:(t // cols + 1) * 16, (t % cols) * 16:(t % cols + 1) * 16])]
print(json.dumps(dict(count=n, base_rows=a.shape[0] // 16, changed_cells=len(changed), changed_sample=changed[:12],
                      off_palette=r['palette'].get('cells_with_off_palette'), relayout_identical=r.get('relayout_identical')), ensure_ascii=False))
PY
