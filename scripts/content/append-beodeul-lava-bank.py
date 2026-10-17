#!/usr/bin/env python3
"""버들항 자연 덧그림(beodeul_nature)에 «용암 둑(bankLava)» 덧그림을 덧붙인다.

배경(2026-10-16 JRPG 파일럿): 용암 못은 2×2 용암 키트를 칸 단위로 칠한 것이라 가장자리가 전부 직각이라 심판이 «네모난 패치» 로
감점했다(15차 연속 45~52점). 늪 물에는 둥근 이끼 둑(bankBog, 이웃 비트 256)이 있는데 용암에는 없다.
이 스크립트는 bankBog 의 256 비트 모양(윤곽·두께·모서리)을 그대로 쓰되 색만 흑요석·불씨로 바꿔 bankLava 로 덧붙인다 —
새 모양을 만들지 않고, 원본 도트 윤곽을 보존하며, 기존 1552칸 번호는 그대로다. 멱등: 여러 번 돌려도 1552칸 뒤만 다시 쓴다.

  python3 scripts/content/append-beodeul-lava-bank.py

같은 스크립트가 «성검 꽂힌 바위»(swordStone, 1×2칸 손 도트)도 덧붙인다 — 18차에서 심판이 «성검이 식별되지 않는다» 로 감점했다.
"""
import json, math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PNG = ROOT / "public/assets/beodeul-nature/chipset.png"
CAT = ROOT / "src/assets/beodeulNatureCatalog.json"
BASE = 1552
COLS = 16
T = 16

# 이끼 색 → 흑요석·불씨 색 (알파는 그대로 두되 부드러운 그림자·물 번짐만 용암 불빛으로)
RECOLOR = {
    (104, 138, 56): (66, 56, 58),   # 둑 몸통
    (85, 113, 45): (78, 66, 66),
    (71, 104, 42): (58, 49, 52),
    (58, 85, 34): (46, 40, 44),
    (74, 70, 40): (50, 42, 46),
    (62, 58, 34): (38, 32, 38),
    (40, 38, 24): (24, 20, 26),     # 가장 바깥 윤곽
}

def main():
    cat = json.loads(CAT.read_text(encoding="utf-8"))
    sheet = Image.open(PNG).convert("RGBA")
    rows_base = BASE // COLS
    sheet = sheet.crop((0, 0, sheet.width, rows_base * T))
    uniq = sorted({n for n in cat["bankBog"] if n >= 0})
    slot = {n: BASE + i for i, n in enumerate(uniq)}
    total = BASE + math.ceil(len(uniq) / COLS) * COLS
    out = Image.new("RGBA", (sheet.width, (total // COLS) * T), (0, 0, 0, 0))
    out.paste(sheet, (0, 0))
    for n, s in slot.items():
        tile = sheet.crop(((n % COLS) * T, (n // COLS) * T, (n % COLS) * T + T, (n // COLS) * T + T)).copy()
        px = tile.load()
        for y in range(T):
            for x in range(T):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if a == 255:
                    px[x, y] = (*RECOLOR.get((r, g, b), (50, 42, 46)), 255)
                elif a >= 100:          # 안쪽 그림자 → 불그스름한 용암 불빛
                    px[x, y] = (150, 36, 6, 130)
                else:                   # 가장 옅은 번짐 → 주황 불씨
                    px[x, y] = (255, 130, 24, 56)
        out.paste(tile, ((s % COLS) * T, (s // COLS) * T))
    # --- 성검 꽂힌 바위 1×2 (위칸 = 칼자루·날, 아래칸 = 바위) — 행 문자열 손 도트
    sword_top = [
        "................",
        ".......yy.......",
        "......yYYy......",
        ".......yy.......",
        ".......gg.......",
        ".......gg.......",
        ".......gg.......",
        "..yyyyyyyyyyyy..",
        ".yYYYYYYYYYYYYy.",
        "..yyyyyyyyyyyy..",
        ".......ww.......",
        ".......wW.......",
        ".......wW.......",
        ".......wW.......",
        ".......wW.......",
        ".......wW.......",
    ]
    sword_bottom = [
        ".......wW.......",
        ".......wW.......",
        "......kwWk......",
        ".....kssSSsk....",
        "....kssSSSSsk...",
        "...kssSSSSSSsk..",
        "..kssSSttSSSssk.",
        ".kssSSSttSSSSssk",
        ".kssSSSSSSSSSSsk",
        "kssSSSSSSSSSSSsk",
        "ksSSSSSSSSSSSSsk",
        "ksSSSSSSSSSSSSdk",
        "kdSSSSSSSSSSSddk",
        "kddddSSSSSSdddkk",
        ".kkdddddddddkkk.",
        "...kkkkkkkkkk...",
    ]
    ink = {
        "y": (255, 214, 64, 255), "Y": (255, 244, 170, 255), "g": (160, 112, 40, 255),
        "w": (150, 164, 188, 255), "W": (226, 234, 246, 255),
        "k": (30, 26, 40, 255), "s": (132, 130, 140, 255), "S": (104, 102, 114, 255),
        "t": (150, 148, 158, 255), "d": (70, 68, 80, 255),
    }
    sword_slots = [total, total + 1]
    total2 = total + COLS
    out2 = Image.new("RGBA", (out.width, (total2 // COLS) * T), (0, 0, 0, 0))
    out2.paste(out, (0, 0))
    for slot_n, rows in zip(sword_slots, (sword_top, sword_bottom)):
        for yy, row in enumerate(rows):
            for xx, ch in enumerate(row):
                if ch in ink:
                    out2.putpixel(((slot_n % COLS) * T + xx, (slot_n // COLS) * T + yy), ink[ch])
        # 금빛 후광(칼자루 둘레 옅은 알파) — 윤곽 밖 빈 화소에만
    for yy in range(0, 12):
        for xx in range(2, 14):
            px = (sword_slots[0] % COLS) * T + xx, (sword_slots[0] // COLS) * T + yy
            if out2.getpixel(px)[3] == 0 and abs(xx - 7.5) + abs(yy - 7) < 7:
                out2.putpixel(px, (255, 226, 110, 46))
    out = out2
    total = total2
    out.save(PNG, optimize=True)
    cat["swordStone"] = sword_slots
    cat["bankLava"] = [slot.get(n, -1) if n >= 0 else -1 for n in cat["bankBog"]]
    cat["count"] = total
    CAT.write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"bankLava {len(uniq)}칸 덧붙임: count {BASE} -> {total}, png {out.size}")

if __name__ == "__main__":
    main()
