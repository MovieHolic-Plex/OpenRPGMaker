#!/usr/bin/env python3
"""
easyrpg_batch.py — Batch Seeder, Gate Verifier, and RM2000 Sheet/GIF Packer
for the `easyrpg-charset-batch` skill.

Subcommands:
  seed             --spec <batch.json> --out <dir>
  verify           --out <dir>
  pack             --out <dir> [--ids id1,id2,...]
  doll-check       --dir <slot_dir>
  face-check       --sheet <sheet.png> --out <face_check_12x.png> [--label ...]
  kinematics-check --sheet <sheet.png> --base <Base:Idx> --out <kinematics_check_8x.png> [--label ...]
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw

REPO_ROOT = Path(os.environ.get("OPRN_REPO_ROOT") or Path(__file__).resolve().parents[3]).resolve()
HARNESS_DIR = REPO_ROOT / "src" / "harnesses" / "charset-actor"
CHARSET_DIR = REPO_ROOT / "public" / "assets" / "easyrpg" / "charset"
sys.path.insert(0, str(HARNESS_DIR))

import argon_part as AP  # noqa: E402
import chr as C          # noqa: E402
import harness as H      # noqa: E402
import motion as M       # noqa: E402
import partedit as P     # noqa: E402


RECOMMENDED_LLM_RE = re.compile(r"(?:^|[^a-z])(carbon|fable)(?:$|[^a-z])", re.IGNORECASE)
LLM_COMPAT_WARNING_BANNER_KO = (
    "⚠️ [권장 LLM 제한 — Carbon · Fable 전용 경고] "
    "이 파이프라인(easyrpg-charset-batch / easyrpg-charset)은 **Carbon (`gemini-4-carbon` 계열)** 과 **Fable (`fable` 계열)** 전용입니다. "
    "이외의 LLM에서는 24×32 12프레임 보행 역학·옆얼굴 C구역(귀+볼살)·목 수축(ey+3)·중심축 대칭이 무너져 잘 작동하지 않습니다!"
)


def is_recommended_charset_llm(model: str | None) -> bool:
    if not model or not model.strip():
        return False
    return bool(RECOMMENDED_LLM_RE.search(model.strip()))


def check_and_warn_llm(model: str | None, stage: str, strict: bool = False) -> str | None:
    resolved = (model or os.environ.get("OPRN_CHARSET_MODEL") or "").strip()
    if not resolved:
        if stage in ("seed", "check-model"):
            msg = (
                "[주의: 모델 미지정] 권장 도트 저작 LLM은 Carbon(gemini-4-carbon 계열)과 Fable(fable 계열)뿐입니다. "
                "이외의 LLM에서는 24x32 12프레임 보행 역학·옆모습 C구역·목 수축(ey+3)·중심축 대칭이 무너져 잘 작동하지 않습니다."
            )
            print(msg, file=sys.stderr)
            if strict and stage == "check-model":
                sys.exit(2)
            return msg
        return None
    if is_recommended_charset_llm(resolved):
        if stage == "check-model":
            print(f"[OK] 권장 LLM 확인됨: {resolved} (Carbon / Fable 계열)")
        return None
    warn = (
        f"[경고: 비권장 LLM '{resolved}'] easyrpg-charset 파이프라인은 Carbon(gemini-4-carbon 계열) · Fable(fable 계열) 전용입니다! "
        "이외의 LLM에서는 24x32 12프레임 보행 역학·옆얼굴 C구역·턱밑 분리선·중심축 대칭에서 오작동 및 관문 탈락이 발생합니다."
    )
    print(warn, file=sys.stderr)
    if strict:
        sys.exit(2)
    return warn


STYLE_LAWS_KO = """[EasyRPG RTP 화풍 & 실패 방지 7대 철칙 — 반드시 준수!]
1. **모던 인디풍(차가운 회청색 직선·좌우대칭 블록) 절대 금지**: `rtp_style_4x.png`와 동일한 따뜻한 적갈/흑갈 어둠(`#290800`, `#1a0c07`, `#4d2222`, `#64150e`)과 재질별 유색 윤곽선(셀아웃), 좌상단 광원 3~5단 면 명암을 유지한다(체스판 디더링 금지).
2. **백색 뭉침(명도 과다) 금지**: 밝은 은발/백발과 밝은 흰 상의를 동시에 붙여 상체가 하얀 덩어리로 뜨게 하지 않는다. 밝은 머리엔 어두운 상의/망토를, 밝은 상의엔 어두운 머리나 선명한 속깃·조끼·오비 대비를 넣는다.
3. **대두 헬멧 착시(머리 소품 2중 중첩) 금지**: 모자 위에 헤드폰 등을 겹쳐 머리 폭이 비대해지지 않게 한다(일반 머리 폭 14~16px 유지, 보조 소품은 목 둘레·허리에 배치).
4. **단색 큰 면 상의 금지**: 단색 후드티/통짜 셔츠 대신 오픈 재킷+이너티, 조끼, 크로스벨트, 칼라·타이, 머플러 등으로 작은 몸통 면을 2~3개로 쪼개 밀도를 높인다.
5. **안경/선글라스/가면 가독성**: 눈 크기 2x2 검은 점 금지. 이마 살색 1~2줄 노출 + 가로 브로우 바·브릿지 + 3x2 렌즈 반사광 + 옆모습 귀까지 이어지는 안경다리로 그린다.
6. **좌우 비대칭 철저 구분**: 안대·가르마·한쪽 견갑·허리 포션·오른손 무기는 `right`와 `left`에서 단순 거울 복사가 아니라 실제 3D 방향에 맞게 각각 그린다.
7. **기술 계약**: 총 48색 이하, `#009392` 각 채널 ±8 범위 색상 사용 금지, 몸 내부 투명 구멍 0건.
8. **머리 · 눈썹 · 눈 3위일체 초정밀 조형 철칙 (`rtp_eyes_12x.png` & `face_check_12x.png` 4방향 전수 대조!)**:
   - **앞머리·옆머리 볼륨 & 이마 머리띠/서클릿 법칙 (대머리 헤어라인·짱구 이마 혹 절대 금지!)**: 맨머리 캐릭터는 `doll_outline.chr.txt`의 `H`(보라색 두개골 영역)를 살색 대머리로 남기지 말고 두상 위·양옆으로 볼륨(`14~16px` 폭)을 주어 **앞머리(bangs) 다발이 눈썹 줄(`y=14`) 바로 위까지 내려오게** 조형한다. 이마 서클릿·하치마키·머리띠(`Actor1:0`·`Actor3:3` 표준)도 정수리(`y=10..11`)에 높이 얹고 그 아래 `2줄` 살색 대머리 이마를 드러내지 말고, **반드시 눈썹 바로 윗줄(`y=12..13`)에 밀착시키되 앞머리 다발이 머리띠 위/옆을 비대칭으로 자연스럽게 덮어 내려오게** 그린다(옆모습에서 이마 살이 머리띠보다 앞으로 `1px` 볼록 튀어나오는 '이마 혹' 절대 금지!).
   - **눈썹·윗속눈썹 색상 조화 (시커먼 `#000000` 짱구 눈썹 절대 금지!)**: 이마 살색이 드러난 상태에서 금발·갈발·은발·연보라·주황 머리 아래에 순검정 `#000000` 2px 블록을 박으면 시커먼 송충이/짱구 눈썹이 된다! 공식 `Actor4:1`·`Actor2:1`·`Actor4:6`처럼 눈 바로 윗줄 2px은 **반드시 그 캐릭터 머리카락의 가장 어두운 그림자 색(`hair_dark`, 예: 금발 `#875a33`/`#997a41`, 갈발 `#612712`/`#6e4b2d`, 보라 `#2c223b`, 은발 `#4a5268`)** 또는 **`[안쪽 1px #290800 + 바깥쪽 1px hair_dark]`** 로 찍어 머리색·앞머리 그늘과 자연스럽게 녹아들게 한다 (`#000000` 2px은 앞머리가 눈 위를 깊게 덮거나 흑발/투구 챙 그늘일 때만 사용).
   - **4방향(`DOWN·RIGHT·LEFT·UP`) 머리카락 다발(Locks) 입체 결 & 포니테일 중력 낙하 (매끈한 밤톨·공중부양 망치 머리 금지!)**: 정면·옆면·**특히 `UP` 뒷머리** 모두 민무늬 구형 공처럼 칠하지 말고, **어두운 가르마/골(`hair_dark` 세로·사선 줄)로 3~5개의 굵직한 머리카락 다발을 분리**해 다발마다 하이라이트·중간톤·그림자를 넣는다. 리본·머리끈·별핀은 4방향에서 **동일한 `y` 높이(및 실제 3D 좌/우 위치)** 에 맞춰 그리고, 옆모습(`right`/`left`) 포니테일·땋은 머리는 정수리 옆(`y=6..7`)에 수평 망치처럼 붕 띄우지 말고 **뒤통수 매듭(`y=9..10`)에서 어깨/망토 쪽(`y=9..16`)으로 자연스럽게 아래로 흘러내리게** 그리며 두상과 `1px` 어두운 윤곽 골로 분리한다.
   - **옆모습(`right`/`left`) 1px 코 vs 턱 `-1px` 후퇴 & 정면 턱 브이 테이퍼 (돌출 주걱턱·사각턱 절대 금지!)**:
     - 옆모습에서 앞으로 `+1px` 나오는 줄은 **눈 아랫줄(코끝 줄) 단 1줄(`높이 1px`)뿐**이다! 그 바로 아랫줄인 **턱 줄(`chin row`)은 반드시 코끝보다 `-1px` 안쪽(눈 윗줄과 같은 `x`선)으로 쏙 들어가야** 한다. 코 줄과 턱 줄 2줄(`높이 2px`)을 같이 앞으로 내밀면 원숭이 입매/돌출 주걱턱이 되므로 절대 금지!
     - 정면(`down`)에서도 눈 아랫줄 양볼 폭(`8px`) 대비 그 아래 **턱 줄(`ey+2`, 성인 `y=17`)은 반드시 따뜻한 살색(`S/s`)이 `4~6px` 살아있는 둥근 턱선(`10~12px` 폭)** 으로 깎고(회색 수염그늘이나 높은 코트 깃으로 턱을 통째로 삼키기 절대 금지!), **목/옷깃 줄(`ey+3`, 성인 `y=18`)은 어깨가 벌어지기 전 반드시 폭 `10~12px`(`x=7..16` 또는 `x=6..17`, 옆모습은 `8~9px` — 긴 생머리 다발 제외)로 잘록하게 수축(Neck Pinch)** 시켜 목과 턱선을 또렷이 분리한 뒤 `ey+4`(`y=19`)부터 어깨를 펼쳐라! `y=18` 목 줄에 `14px` 이상 코트/갑옷 어깨뽕을 바로 붙여 목이 사라진 '거북목/목 실종' 실루엣은 즉시 `FAIL` 처리된다.
   - **정면·옆모습 흰자·홍채 수직 대칭 & 2px 콧대 잠금 (`check_front_face_and_head_lock` 강제 관문 — 짝짝이 눈·찌그러진 얼굴·들쭉날쭉 두상 절대 금지!)**:
     - 정면(`down 0·1·2`) 눈 6칸(`x=9..14`)은 반드시 윗줄 **`[x=9 흰자(m) | x=10 홍채상(E) | x=11..12 살색콧대 2px | x=13 홍채상(E) | x=14 흰자(m)]`**, 아랫줄 **`[x=9 흰자(W) | x=10 홍채하(e) | x=11..12 코하이라이트 2px | x=13 홍채하(e) | x=14 흰자(W)]`** 거울 대칭으로 고정한다! 우측 눈 윗줄을 `mE`로 잘못 찍는 **짝짝이 사시 오타(`mE..mE` 금지, 반드시 `mE..Em`!)**, 윗줄과 아랫줄 눈 `x`좌표가 `1~2px` 어긋나는 전단 기형, 콧대를 `3~4px`로 늘려 얼굴이 옆으로 찌그러지거나 턱에 `3~4px` 순백색 마스크 블록(`WWWW`)을 칠하는 오류는 모두 즉시 `FAIL` 처리된다.
     - **`DOWN · RIGHT · LEFT` 3방향 눈 `y`높이 100% 일치 & 보행 두상 강체 `+1px` 바운스**: 정면과 옆모습 눈 높이가 `1px`이라도 다르거나, 4방향(`DOWN·RIGHT·LEFT·UP`) 보행 `step 0·2`에서 정수리~눈 두상 블록이 `idle 1` 대비 정확히 `+1px` 평행이동하지 않으면(`idle 1`에만 머리 줄을 추가해 걸을 때 머리가 고무줄처럼 늘었다 줄거나 눈이 고정되는 오류) 즉시 `FAIL` 처리된다.
     - 옆모습은 `[귀 쪽 1px = 흰자] + [코 쪽 1px = 2단 홍채]` 수직 일직선 정렬이며, 주황·황색 홍채 대신 청·녹·진홍·자수정·흑갈 등 피부색 대비가 뚜렷한 2단 홍채를 쓰고 코 중앙에 어두운 점을 절대 찍지 않는다.
9. **12프레임 보행 역학(손·팔·배·소품) 철칙 (`kinematics_check_8x.png` 필수 대조!)**:
   - **원본 12프레임 팔·손·배·다리 뼈대 보존 (`고치기` 대원칙)**: `base.chr.txt`는 인간 도트 작가가 완성한 `0(왼발) · 1(정지) · 2(오른발)` 보행 역학 정본이다. **`0`·`2`의 팔 스윙 궤적, 손 위치, 다리 보폭, 몸통 외벽을 백지에서 임의 창작하지 말고**, 원본 뼈대의 픽셀 움직임 위에 새 의상·앞치마·로브·소품의 색과 결만 입혀라!
   - **양손 밝기·소매 명도 유지 & 시소 팔 금지 (`check_walk_kinematics_12frame` 강제 관문!)**: 정면(`down`)·뒷모습(`up`)의 `0 · 1 · 2` 세 프레임 모두 **양손(`2x2px` 밝은 살색 `S`/`s` 또는 동일 장갑색)과 좌우 소매 색·명도를 일정하게 유지**하면서 양손 높이 교대는 최대 `±1px` 이내로만 준다! 뒤로 간 손을 진갈색(`d`/`g`)이나 어두운 회색으로 칠해 걸을 때마다 손이 깜빡거리거나, 좌우 소매 전체를 걸음마다 밝은색↔어두운색으로 뒤바꾸거나, 한쪽 손을 겨드랑이(`2~3px` 위)로 치켜올리는 시소 날개짓은 즉시 `FAIL` 처리된다!
   - **옆모습(`right`·`left`) 양방향 팔 스윙 & `y=30` 지면 접지 철칙 (등 뒤 대왕주먹·양팔 동시 돌출·공중부양 게걸음 절대 금지!)**: `right`·`left` 보행 두 걸음(`0`·`2`) 중 **한 걸음은 팔이 등 뒤로 `1~2px`만 빠지고 앞가슴(`x=15`/`x=8`)은 평평하게 고정**하며, **반대 걸음은 등 뒤를 평평하게 두고 앞손(`2x2`)이 앞허리(`x=15..16` / `x=7..8`)로 `1px` 앞으로 스윙**해야 한다(등 뒤로 `3~4px` 거대 주먹이 튀어나오거나 한 프레임에 앞뒤로 팔이 동시에 돋아나거나 앞 스윙이 실종되는 기형 즉시 `FAIL`!). 또한 12프레임 전부의 디딤발 밑창은 반드시 `idle 1`과 동일한 **`y=30` 지면에 접지**해야 한다(`0`·`2`에서 두 발이 `y=29`로 동시에 떠오르는 개구리 점프/게걸음 즉시 `FAIL`!).
   - **정면 복부 뒤틀림·게걸음 금지 & 소품 고정 바운스**: `down`·`up`에서 어깨 외곽 폭을 걸음마다 넓혔다 좁히거나 다리 사이를 `4px` 이상 벌려 게걸음/개구리 스쿼트를 시키지 마라(`Template:1` 사용 시 특히 주의! 다리 사이는 `2px` 간격 유지 + `0`·`2`에서 좌우 발 `1px` 교대 들림, 옆모습 보폭은 `10~12px` 이내로 안정화하고 주먹을 가슴/수염 높이로 수평 펀치하지 말 것). 벨트·버클·단추·등 소품은 상체와 똑같이 `+1px` 수직 바운스만 유지한다.
10. **옆모습(`RIGHT`·`LEFT`) 4대 인체·의상 비례 철칙 (대두 막대기 몸·볼살 실종 외눈·등꼬리 팔·절벽 발 절대 금지!)**:
    - **(1) 귀(`2px`) + 구레나룻(`1px`) + 볼살(`1~2px`) 필수 노출 (`C` 구역)**: 옆모습에서 머리카락 벽을 흰자위(`W`/`m`, `RIGHT x=13` · `LEFT x=10`) 바로 옆까지 밀어 채우면 볼살·귀가 사라져 눈알만 튀어나온 납작 옆얼굴이 된다! 반드시 눈 두 줄 모두 흰자 바로 뒤에 살색 볼살(`x=12` / `x=11`)과 귀(`x=9..10` / `x=13..14`)를 살려 두어라.
    - **(2) 옆눈 `1×2` 수직 일직선 정렬 + `+1px` 코끝**: 옆모습 흰자(`x=13`/`x=10`)와 홍채(`x=14`/`x=9`)는 위아래 두 줄이 반드시 같은 `x`열에 수직 정렬되어야 하며(대각선 어긋남 금지!), 눈 윗줄 홍채 앞 `1px` 콧대 살색을 두고 눈 아랫줄만 `+1px` 코끝(`x=16..17` / `x=6..7`)을 내민 뒤 턱은 `-1px` 안으로 넣는다.
    - **(3) 턱 밑 수직 가슴벽 + `8~10px` 의상 상체 두께 + 어깨 안쪽 팔 정렬**: 알몸 마네킹처럼 상체를 `5~6px` 막대기로 그리거나 윗가슴(`y=19..21`)이 턱보다 `2~3px` 뒤로 푹 꺼지게 그리지 마라! 성인 의상 상체는 윗가슴 `7~9px`·몸통 `8~10px`(`RIGHT x=7..15` · `LEFT x=8..16`, 아동 `Template:2`는 `7~8px` `x=8..15`) 두께로 채워 앞가슴 외벽(`x=15`/`x=8`)이 턱 밑을 탄탄히 받치게 하고, 정지(`1`) 팔은 등 뒤 꼬리처럼 삐져나오지 않게 어깨/코트 외곽 안쪽에 정렬한다.
    - **(4) 진행 방향 앞코 `6~7px` 신발**: 옆모습 정지(`1`) 발(`y=28..30`)은 진행 방향(`RIGHT x=15` · `LEFT x=8`)으로 `1~2px` 신발 앞코가 나온 `7px`(`Template:2` 아동은 `6px`) 구두/부츠로 마감한다."""


def make_rtp_eyes_12x(dst: Path):
    """10x 4-direction (DOWN, RIGHT, LEFT, UP) full-head master reference showing Hair Locks + Eyebrow Harmony + Eyes + UP Back Hair."""
    refs = [
        ("Actor1:0 (Spiky)", "Actor1.png", 0),
        ("Actor4:1 (Blonde Brow)", "Actor4.png", 1),
        ("People1:1 (Tied Hair)", "People1.png", 1),
        ("Actor2:1 (Bob Cut)", "Actor2.png", 1),
        ("Actor4:6 (Long Wave)", "Actor4.png", 6),
    ]
    sc = 9
    cw, ch = 22 * sc, 19 * sc  # full head x=1..22, y=3..21 across ALL 4 directions including UP!
    row_dirs = [(64, "DOWN"), (32, "RIGHT"), (96, "LEFT"), (0, "UP (Back)")]
    board = Image.new("RGBA", (len(refs) * (cw + 8) + 8, 4 * (ch + 16) + 28), (26, 30, 38, 255))
    dr = ImageDraw.Draw(board)
    dr.text((8, 6), "Official RTP Full-Head Master Reference (9x, ALL 4 DIRS: Hair Clumps + Hair-Toned Brows + Eyes + UP Back Hair)",
            fill=(245, 232, 165, 255))
    for i, (lbl, fn, idx) in enumerate(refs):
        sh = load_rtp_ref(fn, idx)
        ox = 8 + i * (cw + 8)
        for ri, (sy, d_lbl) in enumerate(row_dirs):
            oy = 28 + ri * (ch + 16)
            dr.text((ox + 2, oy - 13), f"{lbl} · {d_lbl}", fill=(165, 215, 255, 255))
            dr.rectangle([ox, oy, ox + cw - 1, oy + ch - 1], fill=(74, 142, 56, 255))
            cell = sh.crop((24, sy, 48, sy + 32))
            ys = [y for y in range(32) for x in range(24) if cell.getpixel((x, y))[3] > 0]
            y0 = max(0, min(13, (min(ys) - 1) if ys else 3))
            crop = sh.crop((24 + 1, sy + y0, 24 + 23, sy + y0 + 19)).resize((cw, ch), Image.NEAREST)
            board.paste(crop, (ox, oy), crop)
    board.save(dst)


def make_face_check_12x(sheet_rgba: Image.Image, dst: Path, label: str = "Yours"):
    """10x 4-direction (DOWN, RIGHT, LEFT, UP) full-head & hair comparison so crown, sidelocks, brows, nose & UP back-hair are never clipped!"""
    refs = [
        ("RTP Actor1:0 (Spiky)", load_rtp_ref("Actor1.png", 0)),
        ("RTP Actor4:1 (Blonde Brow)", load_rtp_ref("Actor4.png", 1)),
        ("RTP People1:1 (Tied/Bun)", load_rtp_ref("People1.png", 1)),
        ("RTP Actor2:1 (Bob Cut)", load_rtp_ref("Actor2.png", 1)),
        (label, unkey_rgba(sheet_rgba)),
    ]
    sc = 10
    cw, ch = 22 * sc, 19 * sc
    row_dirs = [(64, "DOWN (front)"), (32, "RIGHT (side)"), (96, "LEFT (side)"), (0, "UP (back hair!)")]
    board = Image.new("RGBA", (len(refs) * (cw + 8) + 8, 4 * (ch + 16) + 28), (26, 30, 38, 255))
    dr = ImageDraw.Draw(board)
    dr.text((8, 6), "10x Full-Head, Hair, Eyebrow & Eye Check — ALL 4 DIRECTIONS [DOWN | RIGHT | LEFT | UP]",
            fill=(245, 232, 165, 255))
    for i, (lbl, sh) in enumerate(refs):
        ox = 8 + i * (cw + 8)
        col_txt = (165, 215, 255, 255) if i < 4 else (255, 232, 142, 255)
        for ri, (sy, d_lbl) in enumerate(row_dirs):
            oy = 28 + ri * (ch + 16)
            dr.text((ox + 2, oy - 13), f"{lbl} · {d_lbl}", fill=col_txt)
            dr.rectangle([ox, oy, ox + cw - 1, oy + ch - 1], fill=(74, 142, 56, 255))
            cell = sh.crop((24, sy, 48, sy + 32))
            ys = [y for y in range(32) for x in range(24) if cell.getpixel((x, y))[3] > 0]
            y0 = max(0, min(13, (min(ys) - 1) if ys else 3))
            crop = sh.crop((24 + 1, sy + y0, 24 + 23, sy + y0 + 19)).resize((cw, ch), Image.NEAREST)
            board.paste(crop, (ox, oy), crop)
    board.save(dst)


def _set_px(rows: list[str], y: int, x: int, ch: str):
    if 0 <= y < len(rows) and 0 <= x < len(rows[y]):
        lst = list(rows[y])
        lst[x] = ch
        rows[y] = "".join(lst)


def _upgrade_chibi_doll_side_profiles(kind: str, pal: dict, fr0: dict) -> dict:
    """Upgrade raw unclothed `Template:0` / `Template:2` side profiles (`right` & `left`, steps 0..2) so:
    1) Lower eye row has genuine RTP `+1px` nose tip protrusion (`x=17` in RIGHT, `x=6` in LEFT),
    2) Clothed-proportion side torso aligns front chest (`x=15` RIGHT / `x=8` LEFT) directly beneath the chin
       (`8-9px` wide instead of naked `5-6px` stick, fixing `Template:2`'s `4px` toothpick legs/body too),
    3) Idle side foot has a `6-7px` forward-pointing shoe silhouette (`x=9..15` RIGHT, `x=8..14` LEFT)."""
    fr = {k: list(v) for k, v in fr0.items()}
    if kind in ("Template:0", "Template:broad"):
        for step in (0, 1, 2):
            ys = 0 if step == 1 else 1
            # RIGHT: +1px nose tip at y=16+ys (x=16='n', x=17='a'), widen upper chest/shoulder y=19..21+ys to x=7..15, sole y=30
            r = fr[("right", step)]
            _set_px(r, 16 + ys, 16, "h")
            _set_px(r, 16 + ys, 17, "a")
            if step == 1:
                r[19] = ".......ennkkkkke........"
                r[20] = ".......enkkkkkke........"
                r[21] = ".......ekkegkkke........"
                r[30] = ".........aaaaee........."
            elif step == 0:
                # Rear arm swing (1-2px back x=5..6), FLAT front chest at x=15 (no x=16 double-arm nub!)
                r[20] = ".......eknnkkkke........"
                r[21] = "......ekknkkkkke........"
                r[22] = ".....bkngeeghkke........"
                r[23] = ".....enneaeghhhe........"
                r[24] = ".....enkaagghhge........"
            else:
                # Forward arm swing (+1px hand at x=14..16), FLUSH rear back at x=7..8!
                r[20] = ".......eknnkkkke........"
                r[21] = ".......ekkankkke........"
                r[22] = ".......ekngkehkke......."
                r[23] = ".......ennaehhhae......."
                r[24] = "........eaabhhgaa......."
            # LEFT: mirror nose tip at y=16+ys (x=6='a', x=7='h'), widen upper chest/shoulder y=19..21+ys to x=8..16, sole y=30
            l = fr[("left", step)]
            _set_px(l, 16 + ys, 7, "h")
            _set_px(l, 16 + ys, 6, "a")
            if step == 1:
                l[19] = "........ekkkkkne........"
                l[20] = "........ekkkkkkne......."
                l[21] = "........ekkkgekke......."
                l[30] = ".........eeaaaa........."
            elif step == 0:
                # Forward arm swing (+1px hand at x=7..9), FLUSH rear back at x=15..16!
                l[20] = "........ekkkknke........"
                l[21] = "........ekkknaeke......."[:24]
                l[21] = "........ekkknkke........"
                l[22] = ".......ekkhekgnke......."
                l[23] = ".......eahhheaenne......"[:24]
                l[23] = ".......eahhheanne......."
                l[24] = ".......aaghhbaae........"
            else:
                # Rear arm swing (1-2px back x=17..18), FLAT front chest at x=8 (no x=7 double-arm nub!)
                l[20] = "........ekkkknke........"
                l[21] = "........ekkkkknkke......"
                l[22] = "........ekkhhgeegnkb...."[:24]
                l[22] = "........ekkhgeegnkb....."
                l[23] = "........ehhhgeaenne....."
                l[24] = "........eghhggaakne....."
    elif kind == "Template:2":
        # Fix Template:2's 6px stick ribcage (x=9..14) and 4px toothpick legs (x=10..13) -> 8px child torso (x=8..15) + 6px boots!
        for step in (0, 1, 2):
            ys = 0 if step == 1 else 1
            r = fr[("right", step)]
            _set_px(r, 18 + ys, 16, "k")
            _set_px(r, 18 + ys, 17, "a")
            if step == 1:
                r[21] = "........ejjkkkb........."
                r[22] = "........ekojkoe........."
                r[23] = "........ekogkoe........."
                r[24] = "........ekogkoe........."
                r[25] = "........ekoekke........."
                r[26] = ".........eeekoe........."
                r[27] = ".........eekoe.........."
                r[28] = ".........ekooee........."
                r[29] = ".........ejooee........."
                r[30] = ".........eeeee.........."
            else:
                for ty in range(22, 26):
                    if r[ty][15] == ".":
                        _set_px(r, ty, 14, "k")
                        _set_px(r, ty, 15, "e")
            l = fr[("left", step)]
            _set_px(l, 18 + ys, 7, "k")
            _set_px(l, 18 + ys, 6, "a")
            if step == 1:
                l[21] = ".........bkkkjjbe......."[:24]
                l[21] = ".........bkkkjje........"
                l[22] = ".........eokjoke........"
                l[23] = ".........eokgoke........"
                l[24] = ".........eokgoke........"
                l[25] = ".........ekkeoke........"
                l[26] = ".........eokeee........."
                l[27] = "..........ekokee........"
                l[28] = ".........eeooke........."
                l[29] = ".........eeooje........."
                l[30] = "..........eeeee........."
            else:
                for ty in range(22, 26):
                    if l[ty][8] == ".":
                        _set_px(l, ty, 9, "k")
                        _set_px(l, ty, 8, "e")
    return fr


def _build_chibi_broad_doll():
    """Synthesize `Template:broad` — True 2-Head RM2000 Chibi Muscular/Dwarf Nude-Doll (eyes y=15..16, h=23px, 18px shoulders)
    from upgraded `Template:0`, avoiding `Template:1`'s non-chibi 29px Giant/Ogre proportions (eyes y=9..10)."""
    pal, _, fr_raw = C.from_actor(CHARSET_DIR / "Template.png", 0)
    fr0 = _upgrade_chibi_doll_side_profiles("Template:broad", pal, fr_raw)
    fr = {}
    for (d, step), rows in fr0.items():
        new_rows = list(rows)
        y_shift = 0 if step == 1 else 1
        if d in ("down", "up"):
            # Widen shoulders/biceps/fists (y=19..24 idle, y=20..25 step) by +1px on each outer side -> sturdy 18px chibi warrior!
            for ry in range(19 + y_shift, 25 + y_shift):
                r = new_rows[ry]
                nz = [x for x, ch in enumerate(r) if ch != "."]
                if nz:
                    x0, x1 = min(nz), max(nz)
                    if x0 >= 1 and x1 <= C.FW - 2:
                        lst = list(r)
                        lst[x0 - 1] = lst[x0]
                        lst[x0] = lst[x0 + 1]
                        lst[x1 + 1] = lst[x1]
                        lst[x1] = lst[x1 - 1]
                        new_rows[ry] = "".join(lst)
        elif d == "right":
            # Thicken rear muscular deltoid/tricep by +1px on y=19..23
            for ry in range(19 + y_shift, 24 + y_shift):
                r = new_rows[ry]
                nz = [x for x, ch in enumerate(r) if ch != "."]
                if nz and min(nz) >= 1:
                    x0 = min(nz)
                    lst = list(r)
                    lst[x0 - 1] = lst[x0]
                    lst[x0] = lst[x0 + 1]
                    new_rows[ry] = "".join(lst)
        elif d == "left":
            for ry in range(19 + y_shift, 24 + y_shift):
                r = new_rows[ry]
                nz = [x for x, ch in enumerate(r) if ch != "."]
                if nz and max(nz) <= C.FW - 2:
                    x1 = max(nz)
                    lst = list(r)
                    lst[x1 + 1] = lst[x1]
                    lst[x1] = lst[x1 - 1]
                    new_rows[ry] = "".join(lst)
        fr[(d, step)] = new_rows
    return "Template:broad", pal, fr


def resolve_base_sheet(base_key: str) -> tuple[Path, int, str]:
    raw = base_key.split("@")[0].strip()
    if raw.lower() == "template:broad":
        return CHARSET_DIR / "Template.png", 0, "Template:broad"
    if raw.lower().startswith("template:"):
        slot = int(raw.split(":", 1)[1])
        if slot not in (0, 1, 2):
            raise ValueError(f"Template nude-doll slot must be 0, 1, 2, or broad (got {slot})")
        return CHARSET_DIR / "Template.png", slot, f"Template:{slot}"
    base_nk = H.norm_base(raw)
    png_p, slot = H.base_sheet(base_nk)
    return png_p, slot, base_nk


def load_any_base(base_key: str):
    raw = base_key.split("@")[0].strip()
    if raw.lower() == "template:broad":
        return _build_chibi_broad_doll()
    png_p, slot, base_nk = resolve_base_sheet(base_key)
    pal, _, frames = C.from_actor(png_p, slot)
    if base_nk in ("Template:0", "Template:2"):
        frames = _upgrade_chibi_doll_side_profiles(base_nk, pal, frames)
    return base_nk, pal, frames


def make_doll_outline_assets(base_pal: dict, base_frames: dict, slot_dir: Path, base_nk: str):
    """Build 10-symbol semantic Nude-Doll Outline ASCII (`doll_outline.chr.txt`) + 8x parchment blueprint (`doll_outline_8x.png`)."""
    out_pal = {
        ".": None,
        "O": (33, 11, 11),     # Outer body silhouette outline
        "I": (100, 21, 14),    # Inner anatomical separation crease (arm-vs-torso, chin, leg split)
        "H": (125, 85, 130),   # Upper skull HAIR/BANGS MUST-COVER ZONE (never leave as bald forehead!)
        "C": (255, 150, 175),  # Side-profile EAR + CHEEK MUST-EXPOSE SKIN ZONE (never bury in solid hair!)
        "L": (0, 0, 0),        # 2px brow / upper eyelash slot
        "W": (255, 255, 255),  # Eye sclera + center nose highlight
        "E": (0, 19, 117),     # Upper deep iris
        "e": (19, 78, 235),    # Lower bright iris
        "S": (252, 194, 155),  # Lit mannequin body & forward-swinging limbs/hands
        "s": (189, 98, 59),    # Shaded mannequin body & back-swinging limbs/hands
    }
    out_notes = {
        "O": "외곽 실루엣 윤곽선",
        "I": "내부 관절·팔/몸통/다리 분리선(중요!)",
        "H": "필수 앞머리·뒷머리 덮음 두개골 구역(대머리 살색 노출 금지!)",
        "C": "옆모습 필수 귀(2px)·볼살(1~2px) 피부 노출 구역(머리카락으로 덮어 외눈 괴물 만들지 말 것!)",
        "L": "2px 눈썹/윗속눈썹 자리(머리 어두운 색으로 변경!)",
        "W": "흰자위 / 코 중앙 하이라이트",
        "E": "홍채 상단",
        "e": "홍채 하단",
        "S": "밝은 마네킹 피부 / 앞 스윙 팔·손 / 8~9px 의상 가슴벽",
        "s": "그늘 마네킹 피부 / 뒤 스윙 팔·손",
    }
    out_frames = {}
    for (d, step), rows in base_frames.items():
        eye_ys = [
            y for y in range(C.FH) for x in range(C.FW)
            if base_pal.get(rows[y][x]) is not None and base_pal[rows[y][x]][2] > base_pal[rows[y][x]][0] + 35
        ]
        if eye_ys:
            eye_y_min, eye_y_max = min(eye_ys), max(eye_ys)
            hair_cap_max_y = eye_y_min - 2  # Everything strictly above the brow row is MUST-COVER HAIR ZONE!
        else:
            eye_y_min, eye_y_max = -1, -1
            # UP view: entire skull cap above the neck crease is MUST-COVER BACK-HAIR ZONE!
            nz_ys = [y for y in range(C.FH) if any(base_pal.get(rows[y][x]) is not None for x in range(C.FW))]
            hair_cap_max_y = (min(nz_ys) + 8) if nz_ys else 16

        grid = []
        for y in range(C.FH):
            line = []
            for x in range(C.FW):
                ch = rows[y][x]
                rgb = base_pal.get(ch)
                if rgb is None:
                    line.append(".")
                    continue
                r, g, b = rgb
                lum = 0.299 * r + 0.587 * g + 0.114 * b
                touches_bg = any(
                    not (0 <= x + dx < C.FW and 0 <= y + dy < C.FH) or base_pal.get(rows[y + dy][x + dx]) is None
                    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))
                )
                if b > r + 35:
                    line.append("E" if lum < 60 else "e")
                elif r >= 175 and b >= 245:
                    line.append("W")
                elif r >= 250 and g >= 230 and b >= 210 and 15 <= y <= 18 and d == "down":
                    line.append("W")
                elif r == 0 and g == 0 and b == 0 and 8 <= y <= 17 and not touches_bg:
                    line.append("L")
                elif lum < 95:
                    line.append("O" if touches_bg else "I")
                elif y <= hair_cap_max_y:
                    line.append("H")
                elif d == "right" and eye_y_min <= y <= eye_y_max and x in (9, 10, 12):
                    line.append("C")
                elif d == "left" and eye_y_min <= y <= eye_y_max and x in (11, 13, 14):
                    line.append("C")
                elif lum < 168:
                    line.append("s")
                else:
                    line.append("S")
            grid.append("".join(line))
        out_frames[(d, step)] = grid

    header = (
        f"Nude-Doll Anatomical Outline Blueprint ({base_nk})\n"
        "O=외곽윤곽, I=팔↔몸통/턱/다리 분리선, H=필수 헤어 덮음 구역, C=옆모습 필수 귀·볼살 노출 구역(머리 덮음 금지!), L=눈썹자리, W=흰자/코하이라이트, E/e=홍채, S/s=앞/뒤 팔손·8~9px 몸통"
    )
    (slot_dir / "doll_outline.chr.txt").write_text(C.dump(out_pal, out_notes, out_frames, header), encoding="utf-8")

    # Render 8x side-by-side blueprint: Raw Nude Doll vs Semantic Outline Map
    raw_sh = C.sheet_rgba(base_pal, base_frames)
    sem_sh = C.sheet_rgba(out_pal, out_frames)
    sc = 8
    bw = 16 + 2 * (72 * sc) + 20 + 16
    bh = 42 + 128 * sc + 14
    board = Image.new("RGBA", (bw, bh), (26, 29, 36, 255))
    dr = ImageDraw.Draw(board)
    dr.text((14, 8), f"Nude-Doll Base & Anatomical Limb-Separation Outlines ({base_nk}, 8x)", fill=(245, 232, 165, 255))
    dr.text((14, 24), "Left: Official RTP Nude Doll [0 | 1 | 2] (Grass)", fill=(145, 215, 255, 255))
    dr.text((14 + 72 * sc + 20, 24), "Right: Semantic Outline Blueprint (O=Outer, I=Arm/Torso/Leg Creases)", fill=(255, 220, 145, 255))
    for k, sh_im in enumerate((raw_sh, sem_sh)):
        ox = 14 + k * (72 * sc + 20)
        for rr in range(4):
            for cc in range(3):
                if k == 0:
                    bgc = (56, 112, 46, 255) if cc == 1 else (72, 138, 56, 255)
                else:
                    bgc = (238, 233, 222, 255) if (rr + cc) % 2 == 0 else (225, 219, 206, 255)
                dr.rectangle([ox + cc * 24 * sc, 42 + rr * 32 * sc,
                              ox + (cc + 1) * 24 * sc - 1, 42 + (rr + 1) * 32 * sc - 1], fill=bgc)
        up = sh_im.resize((72 * sc, 128 * sc), Image.NEAREST)
        board.paste(up, (ox, 42), up)
    board.save(slot_dir / "doll_outline_8x.png")
    return out_pal, out_frames


def make_kinematics_check_8x(sheet_rgba: Image.Image, base_key: str, dst: Path, label: str = "Yours"):
    base_nk, b_pal, b_fr = load_any_base(base_key)
    base_rgba = C.sheet_rgba(b_pal, b_fr)
    cand_rgba = unkey_rgba(sheet_rgba)

    sc = 8
    cw, ch = 24 * sc, 20 * sc  # y=12..31 slice (neck, shoulders, arms, hands, belly, legs)
    gap = 4
    grp_gap = 16
    row_order = [(2, "DOWN (front)"), (1, "RIGHT (side)"), (3, "LEFT (side)"), (0, "UP (back)")]
    bw = 12 + (3 * cw + 2 * gap) + grp_gap + (3 * cw + 2 * gap) + grp_gap + cw + 12
    bh = 44 + len(row_order) * (ch + 24) + 10
    board = Image.new("RGBA", (bw, bh), (24, 27, 34, 255))
    dr = ImageDraw.Draw(board)

    x_base = 12
    x_cand = x_base + 3 * cw + 2 * gap + grp_gap
    x_diff = x_cand + 3 * cw + 2 * gap + grp_gap

    dr.text((12, 8),
            f"8x Walk Kinematics Check (y=12..31) — Cyan lines = idle(1) belly/torso walls | Gold band = idle(1) hand level",
            fill=(245, 232, 165, 255))
    dr.text((x_base, 25), f"Official RTP Base ({base_nk}) [step 0 | idle 1 | step 2]", fill=(135, 210, 255, 255))
    dr.text((x_cand, 25), f"{label} [step 0 | idle 1 | step 2]", fill=(255, 228, 135, 255))
    dr.text((x_diff, 25), "0<->2 Swing(Red)/Belly(Yel)", fill=(255, 165, 165, 255))

    def draw_triplet(src_sh: Image.Image, ox0: int, oy: int, r_idx: int):
        crops = [src_sh.crop((c * 24, r_idx * 32 + 12, (c + 1) * 24, (r_idx + 1) * 32)) for c in range(3)]
        belly_xs = [x for ly in range(9, 13) for x in range(24) if crops[1].getpixel((x, ly))[3] > 0]
        bx0, bx1 = (min(belly_xs), max(belly_xs)) if belly_xs else (7, 16)
        for c in range(3):
            ox = ox0 + c * (cw + gap)
            bgc = (54, 108, 44, 255) if c == 1 else (70, 136, 56, 255)
            dr.rectangle([ox, oy, ox + cw - 1, oy + ch - 1], fill=bgc)
            up = crops[c].resize((cw, ch), Image.NEAREST)
            board.paste(up, (ox, oy), up)
            # Gold horizontal hand-band guide (sheet y=24..25 -> local y=12..13)
            for gy in (oy + 12 * sc, oy + 14 * sc - 1):
                for gx in range(ox, ox + cw, 4):
                    dr.line([(gx, gy), (min(gx + 1, ox + cw - 1), gy)], fill=(255, 225, 90, 190))
            # Cyan vertical belly-wall guides from idle(1)
            for gx in (ox + bx0 * sc, ox + (bx1 + 1) * sc - 1):
                for gy in range(oy + 6 * sc, oy + 16 * sc, 4):
                    dr.line([(gx, gy), (gx, min(gy + 1, oy + ch - 1))], fill=(90, 245, 255, 215))
        return crops

    for ri, (r_idx, r_lbl) in enumerate(row_order):
        oy = 46 + ri * (ch + 24)
        dr.text((x_base, oy - 13), r_lbl, fill=(195, 205, 220, 255))
        draw_triplet(base_rgba, x_base, oy, r_idx)
        c_crops = draw_triplet(cand_rgba, x_cand, oy, r_idx)

        # 0 <-> 2 delta map
        d_cell = Image.new("RGBA", (24, 20), (36, 40, 50, 255))
        dp = d_cell.load()
        for ly in range(20):
            for x in range(24):
                p0 = c_crops[0].getpixel((x, ly))
                p1 = c_crops[1].getpixel((x, ly))
                p2 = c_crops[2].getpixel((x, ly))
                if p1[3] > 0:
                    dp[x, ly] = (76, 84, 102, 255)
                if p0 != p2:
                    if 9 <= x <= 14 and 8 <= ly <= 12:
                        dp[x, ly] = (255, 216, 64, 255)  # Central belly/vest core changing between 0 and 2!
                    else:
                        dp[x, ly] = (255, 102, 102, 255)  # Outer arm/hand/leg swing
        board.paste(d_cell.resize((cw, ch), Image.NEAREST), (x_diff, oy))

    board.save(dst)


def ensure_style_png(dst: Path):
    style = H.HDATA / "rtp_style_4x.png"
    if not style.exists():
        import argon_chip as AC
        style.parent.mkdir(parents=True, exist_ok=True)
        AC.make_style_sheet(style)
    shutil.copy(style, dst)


def build_partedit_prompt(slot_dir: Path, item: dict, free_letters: str) -> str:
    must = "\n".join(f"  - {m}" for m in item.get("must_have", []))
    avoid = "\n".join(f"  - {a}" for a in item.get("avoid", []))
    extra = ""
    if must:
        extra += f"\n- 필수 표현 포인트:\n{must}"
    if avoid:
        extra += f"\n- 피해야 할 것:\n{avoid}"
    robot_note = (
        "\n- (`@robot` 특수 규칙): 머리 맨살 칸도 `H` 부위라 황동·구리·철 금속으로 칠할 수 있으며 고정된 `F` 눈 줄은 어두운 바이저 슬릿으로 감싸 기계 센서처럼 읽히게 한다."
        if "@robot" in item["base"] else ""
    )
    return f"""{LLM_COMPAT_WARNING_BANNER_KO}

너는 RPG Maker 2000 / EasyRPG RTP (24x32) 16비트 도트 작가다. 서브에이전트나 이미지 생성 도구(image-generator 등)는 절대 쓰지 말고 네가 직접 작업한다. 도형·수식·노이즈 합성 코드도 금지다.

작업 폴더(이 폴더 안에서만 읽고 쓴다):
`{slot_dir}`

[과제 — `{item['id']}` ({item.get('label', item['id'])})]
베이스 `{item['base']}` 에 마스크 기반 `partedit.py` 편집(`edit.json`)만 적용하여 24x32 x 12프레임 걷기 칩을 완성해라!
- 컨셉: {item['concept']}{robot_note}{extra}
- 사용 가능한 새 팔레트 글자: `{free_letters}`

{STYLE_LAWS_KO}

[작업 및 자가검수 순서]
1. 작업 폴더의 `rtp_style_4x.png`, `base_6x.png`, `masks_4x.png`, `anchors_6x.png`, `anchors.txt`, `palette.json`, `base_*_1.txt`, `mask_*_1.txt` 를 먼저 읽는다.
2. `edit.json`(`palette`, `recolor`, `paint`, 필요시 `gear`)을 작성하고 아래 명령으로 검증한다:
   `python3 {HARNESS_DIR / 'partedit.py'} apply {slot_dir}`
3. 검증 오류 0건 달성 후 `preview.png`(6배)를 이미지 읽기 도구로 **반드시 직접 열어서** `rtp_style_4x.png`와 나란히 대조하고 최소 2회 이상 세밀하게 다듬는다.
4. 완료 후 원본 크기 `chip.png`(72x128 RGBA 투명 배경)와 5배 확대 4방향 걷기 GIF `walk_4dir.gif` 를 같은 작업 폴더에 저장하고 요약과 절대경로를 답해라.
"""


def build_full12_prompt(slot_dir: Path, item: dict, base_nk: str) -> str:
    must = "\n".join(f"  - {m}" for m in item.get("must_have", []))
    avoid = "\n".join(f"  - {a}" for a in item.get("avoid", []))
    extra = ""
    if must:
        extra += f"\n- 필수 표현 포인트:\n{must}"
    if avoid:
        extra += f"\n- 피해야 할 것:\n{avoid}"
    return f"""{LLM_COMPAT_WARNING_BANNER_KO}

너는 RPG Maker 2000 / EasyRPG RTP (24x32) 16비트 도트 작가다. 서브에이전트나 이미지 생성 도구(image-generator 등)는 절대 쓰지 말고 네가 직접 작업한다. 도형·수식·노이즈 합성 코드도 금지다.

작업 폴더(이 폴더 안에서만 읽고 쓴다):
`{slot_dir}`

[과제 — `{item['id']}` ({item.get('label', item['id'])})]
공식 EasyRPG 베이스 `{base_nk}` (`base.chr.txt`, `base_6x.png`)를 뼈대로 삼아 EasyRPG RTP 화풍을 100% 유지한 12프레임(`out.chr.txt`, 24x32 x 4방향 x 3걸음)을 직접 도트로 완성해라!
- 컨셉: {item['concept']}{extra}

{STYLE_LAWS_KO}

[검증 및 시각 자가검수 순서]
1. `rtp_style_4x.png`, `base_6x.png`, `base.chr.txt` 를 먼저 열어 원본의 비율·보행 바운스·팔레트를 확인한다.
2. `out.chr.txt` 12프레임 전부를 직접 저작한다 (`propagate` 자동 합성 금지).
3. 아래 하네스 검사 3종을 실행해 무결점(`ok: true`, `fails: []`, `warns: []`)을 확인한다:
   `python3 {HARNESS_DIR / 'harness.py'} check {slot_dir / 'out.chr.txt'} --base {base_nk} --strength strong`
   `python3 {HARNESS_DIR / 'harness.py'} motion-check {slot_dir / 'out.chr.txt'} --base {base_nk}`
   `python3 {HARNESS_DIR / 'harness.py'} views {slot_dir / 'out.chr.txt'} {slot_dir / 'views'} --base {base_nk} --strength strong`
4. `views/sheet_x8.png`, `views/context.png`, 그리고 아래 두 명령으로 생성한 **12배 얼굴/눈 확대 비교판(`face_check_12x.png`)** 과 **8배 보행 역학 비교판(`kinematics_check_8x.png`)** 을 이미지 읽기 도구로 **반드시 둘 다 직접 열어서** 공식 RTP와 1:1 대조하고 최소 2회 이상 정밀 보정한다:
   `python3 {Path(__file__).resolve()} face-check --sheet {slot_dir / 'views' / 'sheet.png'} --out {slot_dir / 'face_check_12x.png'}`
   `python3 {Path(__file__).resolve()} kinematics-check --sheet {slot_dir / 'views' / 'sheet.png'} --base {base_nk} --out {slot_dir / 'kinematics_check_8x.png'}`
   - `face_check_12x.png` 점검: 윗속눈썹·정면 외곽흰자/안쪽홍채·옆모습 앞쪽홍채 시선·코 중앙 순백 하이라이트.
   - `kinematics_check_8x.png` 점검: (a) `DOWN`/`UP`의 `0·1·2` 내내 양손(`2x2` 살색/장갑)이 증발하거나 한쪽 손만 3px 위로 튀지 않는가, (b) `RIGHT`/`LEFT`에서 앞배/앞치마 수직 외벽이 청록 가이드선(Cyan line) 안에 일직선으로 고정되고 앞으로 흔드는 팔/손만 한 걸음에서만 선 밖으로 나가는가(배 꿀렁임 0건), (c) `DOWN` 중앙 배/벨트/단추가 대각선으로 찢어지거나 춤추지 않는가, (d) 등·허리 소품이 `+1px`만 바운스하고 `UP` 양팔 스윙이 살아 있는가.
5. 완료 후 `views/sheet.png`(72x128), `face_check_12x.png`, `kinematics_check_8x.png`, 그리고 5배 확대 `walk_4dir.gif` 생성을 확인하고 요약과 절대경로를 답해라.
"""


def make_hair_ref_assets(hair_ref_key: str, slot_dir: Path):
    """Extract official RTP hair/head donor (`y=0..19` across all 12 frames) as `hair_ref_head.chr.txt` + 8x `hair_ref_8x.png`."""
    ref_nk, r_pal, r_frames = load_any_base(hair_ref_key)
    head_frames = {}
    for k, rows in r_frames.items():
        head_frames[k] = [rows[y] if y <= 19 else ("." * C.FW) for y in range(C.FH)]
    header = (
        f"Official RTP Hair/Brow/Face Donor Head ({ref_nk}, y=0..19 only)\n"
        "이 파일에서 공식 RTP의 앞머리 다발·어두운 가르마 골·볼 옆 구레나룻·눈썹 색조·옆모습 1px 코·UP 뒷머리 세로 다발 결을 참고해 Nude-Doll 목 위에 얹어라!"
    )
    (slot_dir / "hair_ref_head.chr.txt").write_text(C.dump(r_pal, {}, head_frames, header), encoding="utf-8")

    sh = C.sheet_rgba(r_pal, r_frames)
    sc = 8
    cw, ch = 24 * sc, 20 * sc
    board = Image.new("RGBA", (16 + 3 * (cw + 4) + 12, 36 + 4 * (ch + 18) + 8), (24, 27, 34, 255))
    dr = ImageDraw.Draw(board)
    dr.text((12, 8), f"Official RTP Hair & Eyebrow Donor ({ref_nk}) — 8x Head & Hair [step 0 | idle 1 | step 2]",
            fill=(245, 232, 165, 255))
    for ri, (r_idx, d_lbl) in enumerate([(2, "DOWN (front)"), (1, "RIGHT (side)"), (3, "LEFT (side)"), (0, "UP (back hair!)")]):
        oy = 36 + ri * (ch + 18)
        dr.text((12, oy - 13), d_lbl, fill=(165, 215, 255, 255))
        for cc in range(3):
            ox = 12 + cc * (cw + 4)
            dr.rectangle([ox, oy, ox + cw - 1, oy + ch - 1], fill=(56, 112, 46, 255) if cc == 1 else (72, 138, 56, 255))
            crop = sh.crop((cc * 24, r_idx * 32 + 2, (cc + 1) * 24, r_idx * 32 + 22)).resize((cw, ch), Image.NEAREST)
            board.paste(crop, (ox, oy), crop)
    board.save(slot_dir / "hair_ref_8x.png")
    return ref_nk


def build_doll12_prompt(slot_dir: Path, item: dict, base_nk: str, hair_ref_nk: str = "") -> str:
    must = "\n".join(f"  - {m}" for m in item.get("must_have", []))
    avoid = "\n".join(f"  - {a}" for a in item.get("avoid", []))
    extra = ""
    if must:
        extra += f"\n- 필수 표현 포인트:\n{must}"
    if avoid:
        extra += f"\n- 피해야 할 것:\n{avoid}"
    hair_note = (
        f"\n- **공식 RTP 헤어·눈썹 원형 가이드 (`{hair_ref_nk}`)**: 작업 폴더의 `hair_ref_8x.png` 와 `hair_ref_head.chr.txt` 에 공식 `{hair_ref_nk}` 의 4방향 앞머리·구레나룻·머리톤 눈썹·옆모습 1px 코·`UP` 뒷머리 다발 구조가 준비되어 있다. 민머리 두개골에 페인트칠만 하거나 민무늬 밤톨 공을 씌우지 말고 반드시 이 RTP 헤어 다발 구조를 참고해 머리를 조형해라!"
        if hair_ref_nk else ""
    )
    return f"""{LLM_COMPAT_WARNING_BANNER_KO}

너는 RPG Maker 2000 / EasyRPG RTP (24x32) 16비트 수석 도트 작가다. 서브에이전트나 이미지 생성 도구(image-generator 등)는 절대 쓰지 말고 네가 직접 작업한다. 도형·수식·노이즈 합성 코드도 금지다.

작업 폴더(이 폴더 안에서만 읽고 쓴다):
`{slot_dir}`

[과제 — `{item['id']}` ({item.get('label', item['id'])}) — 하이브리드 Nude-Doll `{base_nk}` + RTP 헤어/눈썹 조형]
이 작업은 헌 옷 간섭이 없는 **공식 EasyRPG 마네킹(`{base_nk}`, `doll_outline.chr.txt`, `doll_outline_8x.png`)** 위에 몸통·의상을 입히고, 머리는 **`rtp_eyes_12x.png`(4방향 공식 RTP 두상 교본){f' 및 `hair_ref_8x.png`(`{hair_ref_nk}`)' if hair_ref_nk else ''}** 의 실제 RTP 헤어 다발·머리톤 눈썹·눈 일체형 문법으로 완성하는 최상위 정밀 모드다!
- 컨셉: {item['concept']}{hair_note}{extra}

[Nude-Doll 바디 + RTP 헤어·눈썹·눈 결합 핵심 기법]
- `doll_outline.chr.txt` 기호 의미:
  - `O` = 신체 외곽 윤곽선 / `I` = **팔↔몸통, 턱↔목, 좌우 다리 내부 관절 분리선**
  - `H` = **보라색 두개골 영역(필수 앞머리·옆머리·뒷머리/모자 덮음 구역 — 절대 대머리 살색으로 남기지 말 것!)**
  - `L` = 눈 위 2px 눈썹/속눈썹 자리 (**주의!** 금발·갈발·은발·밝은 머리에서 여기를 `#000000` 통검정으로 두면 시커먼 짱구 눈썹이 된다! 반드시 캐릭터 머리색의 가장 어두운 그림자 톤 `hair_dark` 또는 `[내측 1px #290800 + 외측 1px hair_dark]` 로 바꾸고, 앞머리 다발이 눈썹 위까지 자연스럽게 내려오게 덮어라!)
  - `W` = 흰자위 및 코 중앙 하이라이트 / `E`,`e` = 2단 원색 홍채(정면 양눈 `[m E | 코2px | E m]` / `[W e | 코2px | e W]` 수직 정렬 필수! 대각선 엇갈림 금지!) / `S`,`s` = 앞·뒤 마네킹 몸·팔다리
- 두상 위(`1~2px`)·양옆(`1~2px`, 폭 `14~16px`)으로 **어두운 골로 나뉜 3~5개 머리카락 다발(앞머리·구레나룻 옆머리·`UP` 뒷머리 다발)**, 정면 **눈 아랫줄 양옆 살색 볼 1px씩 포함 `8px` 볼살 → 그 아래 `6px` 갸름한 턱 테이퍼**, 그리고 옆모습 **`1px` 코끝 돌출 직후 턱 줄 `-1px` 안쪽 후퇴(돌출 주걱턱 금지!)** 를 반드시 지켜라.

{STYLE_LAWS_KO}

[검증 및 시각 자가검수 순서]
1. `rtp_style_4x.png`, **`rtp_eyes_12x.png`(4방향 공식 RTP 헤어·눈썹·눈·뒷머리 교본)**, {('**`hair_ref_8x.png`**, **`hair_ref_head.chr.txt`**, ' if hair_ref_nk else '')}**`doll_outline_8x.png`**, `doll_outline.chr.txt` 를 먼저 열어서 확인한다.
2. `out.chr.txt` 12프레임 전부에 헤어·눈썹·눈·의상·신발·소품을 직접 도트로 완성한다.
3. 아래 통합 검증 명령 1줄을 실행한다 (`ok: true`, `strict_ok: true`, `fails: []`, `warns: []` 필수!):
   `python3 {Path(__file__).resolve()} doll-check --dir {slot_dir}`
4. 생성된 **`face_check_12x.png`(10배 `DOWN·RIGHT·LEFT·UP` 4방향 전체 두상·뒷머리 대조판)**, **`kinematics_check_8x.png`**, `views/context.png` 세 장을 이미지 읽기 도구로 **반드시 직접 열어서** 최소 2회 이상 정밀 보정한다:
   - `face_check_12x.png`: (a) 이마 대머리/수영모 느낌 없이 앞머리·옆머리 다발이 얼굴을 감싸는가, (b) 눈썹 2px이 시커먼 `#000000` 짱구 눈썹이 아니라 머리 어두운 톤(`hair_dark`)과 조화되는가, (c) 옆모습 `1px` 코 돌출과 정면 시선 홍채가 살아 있는가, (d) **`UP` 뒷머리**가 민무늬 밤톨 공이나 포니테일 실종 없이 공식 RTP처럼 3~5개 다발 결로 입체감 있게 그려졌는가!
   - `kinematics_check_8x.png`: 양손 `2x2` 유지, `RIGHT`/`LEFT` 앞배 수직선 고정, `0<->2` 복부 뒤틀림 노란 픽셀 최소화.
5. 최종 무결점 통과 후 `chip.png`, `face_check_12x.png`, `kinematics_check_8x.png`, `walk_4dir.gif` 절대경로와 요약만 간결히 답해라.
"""


def check_side_profile_anatomy(pal: dict, frames: dict, base_nk: str, meta: dict) -> tuple[list[str], list[str]]:
    """Mechanical Side-Profile 4-Point Gate catching:
    1) Diagonal/staggered side sclera-iris (`S1 Priestess` bug),
    2) Popsicle-stick side ribcage or concave chest recessed >=2px behind chin (`W2 Herbalist` / `W2 Sleuth` / `S1 PlagueDoc` bug),
    3) Backward-jutting tail arm behind narrow upper back (`S1 Chef` bug),
    4) Amputated stump feet without forward shoe toe."""
    fails: list[str] = []
    warns: list[str] = []
    is_child = base_nk == "Template:2"
    torso_y0, torso_y1 = (21, 25) if is_child else (19, 24)
    chin_y = 19 if is_child else 17
    min_torso_w = 7 if is_child else 8
    min_foot_w = 6 if is_child else 7

    id_txt = (meta.get("id", "") + " " + meta.get("label", "")).lower()
    is_masked_or_nonhuman = any(
        kw in id_txt for kw in ("plague", "wolf", "dragon", "dark_knight", "necromancer", "robot", "vampire", "corsair")
    )

    def _is_sclera(rgb):
        if rgb is None:
            return False
        r, g, b = rgb
        return r >= 170 and g >= 205 and b >= 240 and min(r, g, b) >= 170

    def _is_warm_skin(rgb):
        if rgb is None:
            return False
        r, g, b = rgb
        return r >= 180 and g >= 95 and b >= 55 and r > g >= b and (r - b) >= 32

    for d in ("right", "left"):
        rows = frames[(d, 1)]
        # 1) Torso width & front chest alignment under chin (row-by-row upper & mid ribcage check!)
        row_ws = []
        for ty in range(torso_y0 + 1, torso_y1 + 1):
            rxs = [x for x in range(C.FW) if pal.get(rows[ty][x]) is not None]
            if rxs:
                row_ws.append(max(rxs) - min(rxs) + 1)
        upper_t_xs = [x for y in range(torso_y0, torso_y0 + 2) for x in range(C.FW) if pal.get(rows[y][x]) is not None]
        chin_xs = [x for x in range(C.FW) if pal.get(rows[chin_y][x]) is not None]
        if row_ws:
            min_rw = min(row_ws[:3])
            target_rw = 6 if is_child else 7
            if min_rw < target_rw - 1:
                fails.append(f"{d} 1: skinny stick ribcage ({min_rw}px < {target_rw}px on upper torso)")
            elif min_rw < target_rw or max(row_ws) < min_torso_w:
                warns.append(f"{d} 1: narrow side ribcage (min={min_rw}px, max={max(row_ws)}px; target >={min_torso_w}px clothed)")
        if upper_t_xs and chin_xs and "plague" not in id_txt and "wolf" not in id_txt:
            if d == "right":
                recess = max(chin_xs) - max(upper_t_xs)
            else:
                recess = min(upper_t_xs) - min(chin_xs)
            if recess >= 3:
                fails.append(f"{d} 1: upper chest recessed {recess}px behind chin (concave stick chest)")
            elif recess >= 2:
                warns.append(f"{d} 1: upper chest recessed {recess}px behind chin (align chest to x=15 RIGHT / x=8 LEFT)")

        # Check backward-jutting tail arm (`S1 Chef` defect: lower forearm juts >=2px behind upper shoulder back without backpack/cape)
        if not is_child and "peddler" not in id_txt and "herbalist" not in id_txt and "alchemist" not in id_txt:
            sh_xs = [x for y in range(torso_y0, torso_y0 + 2) for x in range(C.FW) if pal.get(rows[y][x]) is not None]
            arm_xs = [x for y in range(torso_y0 + 3, torso_y0 + 6) for x in range(C.FW) if pal.get(rows[y][x]) is not None]
            if sh_xs and arm_xs:
                jut = (min(sh_xs) - min(arm_xs)) if d == "right" else (max(arm_xs) - max(sh_xs))
                if jut >= 2:
                    warns.append(f"{d} 1: forearm/hand juts {jut}px behind shoulder back (widen shoulder/coat back or center arm)")

        # 2) Check side sclera vertical alignment & exposed cheek skin behind eye on BOTH eye rows
        ey0, ey1 = (17, 18) if is_child else (15, 16)
        x_eye_rng = range(11, 16) if d == "right" else range(8, 13)
        step_f = 1 if d == "right" else -1
        for cand_y in ([17, 16, 15, 14] if is_child else [15, 14, 16]):
            if any(
                _is_sclera(pal.get(rows[cand_y][sx])) and _is_sclera(pal.get(rows[cand_y + 1][sx]))
                and pal.get(rows[cand_y][sx + step_f]) is not None
                and pal.get(rows[cand_y + 1][sx + step_f]) is not None
                and not _is_sclera(pal.get(rows[cand_y][sx + step_f]))
                and not _is_sclera(pal.get(rows[cand_y + 1][sx + step_f]))
                and not _is_warm_skin(pal.get(rows[cand_y][sx + step_f]))
                and (0.299 * pal[rows[cand_y][sx + step_f]][0] + 0.587 * pal[rows[cand_y][sx + step_f]][1] + 0.114 * pal[rows[cand_y][sx + step_f]][2]) < 175
                for sx in x_eye_rng if 0 <= sx + step_f < C.FW
            ):
                ey0, ey1 = cand_y, cand_y + 1
                break
        sc0 = [x for x in x_eye_rng if _is_sclera(pal.get(rows[ey0][x]))]
        sc1 = [x for x in x_eye_rng if _is_sclera(pal.get(rows[ey1][x]))]
        if sc0 and sc1:
            sx0 = min(sc0) if d == "right" else max(sc0)
            sx1 = min(sc1) if d == "right" else max(sc1)
            if sx0 != sx1:
                fails.append(f"{d} 1: diagonal/misaligned side sclera (y={ey0} x={sx0} vs y={ey1} x={sx1})")
            elif not is_masked_or_nonhuman:
                cheek_x = sx0 - 1 if d == "right" else sx0 + 1
                if 0 <= cheek_x < C.FW:
                    c0 = _is_warm_skin(pal.get(rows[ey0][cheek_x]))
                    c1 = _is_warm_skin(pal.get(rows[ey1][cheek_x]))
                    if not (c0 and c1):
                        warns.append(f"{d} 1: hair/outline touching side sclera at x={cheek_x} (keep warm cheek skin on both eye rows!)")

        # 3) Forward-pointing shoe width & toe
        foot_xs = [x for y in range(28, 31) for x in range(C.FW) if pal.get(rows[y][x]) is not None]
        if foot_xs:
            fw = max(foot_xs) - min(foot_xs) + 1
            if fw < 6:
                warns.append(f"{d} 1: stump side foot ({fw}px < {min_foot_w}px, add 1-2px forward shoe toe)")
            elif not is_child and fw < min_foot_w:
                warns.append(f"{d} 1: short side shoe ({fw}px < {min_foot_w}px, extend forward toe to x=15 RIGHT / x=8 LEFT)")

    return fails, warns


def check_front_face_and_head_lock(pal: dict, frames: dict, base_nk: str, meta: dict) -> tuple[list[str], list[str]]:
    """Mechanical Front-Face Symmetry, 4-Dir Eye-Y Sync & Rigid +1px Head-Bob Gate catching:
    1) Mismatched/crossed front irises (`mE..mE` typo instead of `mE..Em` on #09, #10, #19, #20),
    2) Vertically sheared eye rows (`#04` 2px right shift on lower eye row, `#12` 1px upper eye shift),
    3) Squashed/wide-set 3-4px nose bridges & 4px surgical-mask white chins (`#13`, `#14`),
    4) Front-vs-side eye row height mismatch (`#03`, `#13`, `Runesmith`),
    5) Rubber-accordion head height stretching or frozen head/eye bob across steps 0, 1, 2 (`#12`, `Priestess`)."""
    fails: list[str] = []
    warns: list[str] = []
    if base_nk == "Template:1":
        return fails, warns

    is_child = base_nk == "Template:2"
    id_txt = (meta.get("id", "") + " " + meta.get("label", "")).lower()
    is_masked = any(kw in id_txt for kw in ("plague", "robot"))
    is_one_eyed = "corsair" in id_txt

    def _is_sclera(rgb):
        if rgb is None:
            return False
        r, g, b = rgb
        return r >= 155 and g >= 200 and b >= 235 and min(r, g, b) >= 155

    def _is_warm_skin(rgb):
        if rgb is None:
            return False
        r, g, b = rgb
        return r >= 180 and g >= 95 and b >= 55 and r > g >= b and (r - b) >= 28

    def _find_front_eye_y(rows):
        order = [17, 16, 18, 15, 14] if is_child else [15, 14, 16, 17]
        for ey in order:
            sc0 = [x for x in range(8, 16) if _is_sclera(pal.get(rows[ey][x]))]
            sc1 = [x for x in range(8, 16) if _is_sclera(pal.get(rows[ey + 1][x]))]
            ir0 = [
                x for x in range(9, 15)
                if pal.get(rows[ey][x]) is not None
                and not _is_sclera(pal.get(rows[ey][x]))
                and not _is_warm_skin(pal.get(rows[ey][x]))
            ]
            if sc0 and sc1 and ir0:
                return ey
        return None

    def _find_side_eye_y(rows, d, prefer_step: bool = False):
        xrng = range(11, 16) if d == "right" else range(8, 13)
        step_f = 1 if d == "right" else -1
        if is_child:
            y_order = [18, 17, 19, 16, 15] if prefer_step else [17, 16, 18, 15, 14]
        else:
            y_order = [16, 15, 17, 14] if prefer_step else [15, 14, 16, 17]
        for sy in y_order:
            for sx in xrng:
                ix = sx + step_f
                if not (0 <= ix < C.FW):
                    continue
                if _is_sclera(pal.get(rows[sy][sx])) and _is_sclera(pal.get(rows[sy + 1][sx])):
                    p0, p1 = pal.get(rows[sy][ix]), pal.get(rows[sy + 1][ix])
                    if (
                        p0 and p1
                        and not _is_sclera(p0) and not _is_sclera(p1)
                        and not _is_warm_skin(p0)
                        and (0.299 * p0[0] + 0.587 * p0[1] + 0.114 * p0[2]) < 175
                    ):
                        return sy
        return None

    # 1) Rigid +1px top_y bob & upper-crown stability across ALL 4 directions
    idle_tops: dict[str, int] = {}
    for d in ("down", "right", "left", "up"):
        tys = [
            min((y for y in range(C.FH) if any(pal.get(frames[(d, st)][y][x]) is not None for x in range(C.FW))), default=31)
            for st in (0, 1, 2)
        ]
        idle_tops[d] = tys[1]
        if not (tys[0] == tys[1] + 1 and tys[2] == tys[1] + 1):
            fails.append(
                f"{d}: head crown top_y={tys} fails rigid +1px walk bob (step 0 & 2 must be idle_top+1 = {tys[1] + 1})"
            )
        else:
            ty1 = tys[1]
            for st in (0, 2):
                crown_diffs = sum(
                    1 for dy in range(5) for x in range(C.FW)
                    if ty1 + dy + 1 < C.FH and frames[(d, 1)][ty1 + dy][x] != frames[(d, st)][ty1 + dy + 1][x]
                )
                if crown_diffs > 4:
                    fails.append(
                        f"{d} {st}: upper skull/crown morphs by {crown_diffs}px vs idle+1px shift (do not add/remove hair rows between steps!)"
                    )

    if max(idle_tops.values()) - min(idle_tops.values()) > 1:
        fails.append(
            f"head crown height varies >1px across directions {idle_tops} (keep 4-direction top_y within <=1px)"
        )

    if is_masked:
        return fails, warns

    # 2) Front `DOWN` eye symmetry, exact x=9..14 column lock, 2px nose bridge & chin blowout check
    d1 = frames[("down", 1)]
    ey_d1 = _find_front_eye_y(d1)
    valid_eys = (16, 17) if is_child else (14, 15)
    if ey_d1 is None:
        fails.append("down 1: missing readable 2-row sclera+iris front eyes")
        return fails, warns
    if ey_d1 not in valid_eys:
        fails.append(f"down 1: front eyes at y={ey_d1}..{ey_d1 + 1} outside valid {base_nk} rows {valid_eys}")

    r0, r1 = d1[ey_d1], d1[ey_d1 + 1]
    if is_one_eyed:
        if not (_is_sclera(pal.get(r0[14])) and _is_sclera(pal.get(r1[14]))):
            fails.append(f"down 1: one-eyed character missing vertical sclera at x=14 on y={ey_d1}..{ey_d1 + 1}")
    else:
        ok_sclera = (
            _is_sclera(pal.get(r0[9]))
            and _is_sclera(pal.get(r1[9]))
            and _is_sclera(pal.get(r0[14]))
            and _is_sclera(pal.get(r1[14]))
        )
        outer_bleed = any(_is_sclera(pal.get(r0[x])) or _is_sclera(pal.get(r1[x])) for x in (8, 15))
        p_ir0_l, p_ir0_r = pal.get(r0[10]), pal.get(r0[13])
        p_ir1_l, p_ir1_r = pal.get(r1[10]), pal.get(r1[13])
        ok_iris = (
            r0[10] == r0[13]
            and r1[10] == r1[13]
            and p_ir0_l is not None
            and p_ir1_l is not None
            and not _is_sclera(p_ir0_l)
            and not _is_sclera(p_ir1_l)
            and not _is_warm_skin(p_ir0_l)
            and not _is_warm_skin(p_ir1_l)
        )
        # Ensure 2px nose bridge x=11..12 is open skin/highlight, not dark iris/outline
        ok_bridge = all(
            pal.get(rx[bx]) is not None
            and (0.299 * pal[rx[bx]][0] + 0.587 * pal[rx[bx]][1] + 0.114 * pal[rx[bx]][2]) >= 120
            for rx in (r0, r1) for bx in (11, 12)
        )
        if not (ok_sclera and ok_iris and ok_bridge) or outer_bleed:
            fails.append(
                f"down 1: broken/asymmetric front eyes at y={ey_d1}..{ey_d1 + 1} "
                f"(got '{r0[8:16]}' / '{r1[8:16]}' at x=8..15; MUST be mirror-symmetric [sclera x=9, iris x=10, 2px nose x=11..12, iris x=13, sclera x=14], e.g. 'mESSEm'/'WeWWeW'!)"
            )
        for st in (0, 2):
            dst = frames[("down", st)]
            if dst[ey_d1 + 1][9:15] != r0[9:15] or dst[ey_d1 + 2][9:15] != r1[9:15]:
                fails.append(
                    f"down {st}: front eyes fail +1px rigid bob at y={ey_d1 + 1}..{ey_d1 + 2} "
                    f"(got '{dst[ey_d1 + 1][9:15]}'/'{dst[ey_d1 + 2][9:15]}', expected '{r0[9:15]}'/'{r1[9:15]}')"
                )

    # Check surgical-mask pure-white chin blowout (`#11`, `#12`, `#13` defect: even 2px #ffffff WW on skin chin creates a white mask!)
    chin_row = d1[ey_d1 + 2]
    white_chin_px = sum(1 for x in range(9, 15) if pal.get(chin_row[x]) == (255, 255, 255))
    if white_chin_px >= 2 and any(_is_warm_skin(pal.get(chin_row[x])) for x in (8, 9, 10, 13, 14, 15)):
        fails.append(
            f"down 1: {white_chin_px}px pure-white #ffffff on skin chin row y={ey_d1 + 2} ('{chin_row[8:16]}' creates a surgical-mask stripe; use warm peach #fcc29b/#ffebd9!)"
        )

    # 3) Sync `RIGHT` & `LEFT` eye y with `DOWN` eye y AND verify side eye +1px walk bob in steps 0 & 2!
    for d in ("right", "left"):
        if is_one_eyed and d == "right":
            continue
        sy1 = _find_side_eye_y(frames[(d, 1)], d)
        if sy1 is None:
            fails.append(f"{d} 1: missing readable vertical 1x2 [sclera, iris] side eye")
            continue
        if sy1 != ey_d1:
            fails.append(f"{d} 1: side eye y={sy1}..{sy1 + 1} misaligned with front down 1 eye y={ey_d1}..{ey_d1 + 1}")
        for st in (0, 2):
            syst = _find_side_eye_y(frames[(d, st)], d, prefer_step=True)
            if syst != sy1 + 1:
                fails.append(
                    f"{d} {st}: side eye y={syst} fails +1px walk bob (expected y={sy1 + 1}..{sy1 + 2} to match {d} 1 y={sy1}..{sy1 + 1}; check extra/missing hair rows!)"
                )

    return fails, warns


def chr_sha256_of(slot_dir: Path) -> str:
    p = slot_dir / "out.chr.txt"
    if not p.exists():
        p = slot_dir / "edit.json"
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else ""


def check_proportion_and_symmetry_qa(pal: dict, frames: dict, base_nk: str, meta: dict) -> tuple[list[str], list[str]]:
    """Stage-1B Anatomical Proportion, Center-Axis & Outline Gate catching:
    1) Bald receding forehead (`>= 3` bare skin rows above eyebrows, `#04` 4-row forehead tower),
    2) Off-center lopsided torso / dress / skirt (`|x0 + x1 - 23| >= 2` relative to x=11.5 axis, `#02`/`#04` bug),
    3) Unoutlined near-white pixels (`lum >= 230`) on top silhouette edge (`#04` raw white Q tiara pixel)."""
    fails: list[str] = []
    warns: list[str] = []
    if base_nk == "Template:1":
        return fails, warns

    is_child = base_nk == "Template:2"
    id_txt = (meta.get("id", "") + " " + meta.get("label", "")).lower()
    is_masked = any(kw in id_txt for kw in ("plague", "robot"))
    has_asym_gear = any(kw in id_txt for kw in ("sentry", "halberd", "corsair", "duelist", "samurai", "lancer", "hunter"))

    d1 = frames[("down", 1)]

    def _is_sclera(rgb):
        if rgb is None:
            return False
        r, g, b = rgb
        return r >= 155 and g >= 200 and b >= 235 and min(r, g, b) >= 155

    ey = 17 if is_child else (14 if _is_sclera(pal.get(d1[14][9])) else 15)

    # 1) Anti-Bald-Forehead Gate (max 2 bare skin rows strictly above brow row ey-1)
    if not is_masked:
        cand_pos = [(ey, 11), (ey, 12), (ey + 1, 8), (ey + 1, 15), (ey + 2, 10), (ey + 2, 11), (ey + 2, 12), (ey + 2, 13)]
        skin_chars = {
            d1[y][x] for (y, x) in cand_pos
            if 0 <= y < C.FH and pal.get(d1[y][x]) is not None
            and pal[d1[y][x]] != (255, 255, 255)
            and (0.299 * pal[d1[y][x]][0] + 0.587 * pal[d1[y][x]][1] + 0.114 * pal[d1[y][x]][2]) >= 125
            and pal[d1[y][x]][0] > pal[d1[y][x]][1] > pal[d1[y][x]][2]
        }
        fh_rows = [y for y in range(6, ey - 1) if sum(1 for x in range(8, 16) if d1[y][x] in skin_chars) >= 2]
        if len(fh_rows) >= 3:
            fails.append(
                f"down 1: bald receding forehead ({len(fh_rows)} bare skin rows y={fh_rows} above brow y={ey - 1}; cover upper forehead with swept bangs/headgear so <=2 rows show!)"
            )

    # 2) Horizontal Center-Axis Symmetry Lock (eyes & feet sit at x=11.5 -> x0 + x1 == 23!)
    if not has_asym_gear:
        torso_off = []
        for y in range(ey + 4, min(C.FH, ey + 9)):
            nz = [x for x in range(C.FW) if pal.get(d1[y][x]) is not None]
            if nz and abs((min(nz) + max(nz)) - 23) >= 2:
                torso_off.append((y, min(nz), max(nz)))
        if len(torso_off) >= 2:
            fails.append(
                f"down 1: off-center lopsided torso/arms {torso_off} (must center symmetrically on 24px axis x0+x1==23, e.g. x=5..18 or x=4..19!)"
            )
        hem_off = []
        for y in range(25, 28):
            nz = [x for x in range(C.FW) if pal.get(d1[y][x]) is not None]
            if nz and abs((min(nz) + max(nz)) - 23) >= 2:
                hem_off.append((y, min(nz), max(nz)))
        if len(hem_off) >= 2:
            fails.append(
                f"down 1: off-center lopsided skirt/legs {hem_off} (must center symmetrically on 24px axis x0+x1==23, e.g. x=6..17 or x=7..16!)"
            )

    # 3) Top-Edge Unoutlined White Pixel Gate (`lum >= 230` touching transparent above on crown/tiara/head)
    bright_top = []
    for d in ("down", "right", "left", "up"):
        rows = frames[(d, 1)]
        for y in range(18):
            for x in range(C.FW):
                rgb = pal.get(rows[y][x])
                if rgb is None:
                    continue
                lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
                if lum >= 230 and (y == 0 or pal.get(rows[y - 1][x]) is None):
                    bright_top.append(f"{d}:({x},{y})='{rows[y][x]}'")
    if bright_top:
        fails.append(
            f"unoutlined near-white pixels touching top background {bright_top[:4]} (wrap crowns/tiaras/horns in warm dark/gold sel-out!)"
        )

    # 4) Chin Readability & Neck-Pinch Separation Gate (`#04`, `#14` "목 실종 / 거북목" & chin-bleed catcher!)
    # - Row ey+2 (`x=9..14`) MUST have readable warm peach chin (or explicit full silver/gold beard on `king`/`mayor`/`elder`/`vizier`), NEVER dark mud/coat/stubble swallowing the chin right under the eyelids!
    # - Row ey+3 (`y=18` when `ey=15`) is the **NECK / COLLAR PINCH ROW**: coat/armor shoulders MUST NOT flare to >=14px on `ey+3` (only upper-head hair colors from `y=ey-3..ey` may appear at `x<=5` / `x>=18` for long-haired characters), AND in `RIGHT 1` / `LEFT 1` non-hair neck width at `ey+3` must stay `<=9px`!
    has_full_beard = any(kw in id_txt for kw in ("king", "mayor", "elder", "dwarf", "santa"))
    if not is_masked and ey + 4 < C.FH:
        chin_row = d1[ey + 2]
        warm_chin_px = sum(
            1 for x in range(9, 15)
            if pal.get(chin_row[x]) is not None
            and pal[chin_row[x]][0] >= 180 and pal[chin_row[x]][1] >= 95
            and pal[chin_row[x]][0] > pal[chin_row[x]][1] >= pal[chin_row[x]][2]
            and (pal[chin_row[x]][0] - pal[chin_row[x]][2]) >= 22
        )
        if not has_full_beard and warm_chin_px < 2:
            fails.append(
                f"down 1: missing readable warm peach chin at y={ey + 2} ('{chin_row[7:17]}' has only {warm_chin_px} skin px; "
                "do not swallow the chin with grey stubble or high coat collars right under the eyes!)"
            )
        if warm_chin_px >= 3:
            neck_lums = [
                0.299 * pal[d1[ey + 3][x]][0] + 0.587 * pal[d1[ey + 3][x]][1] + 0.114 * pal[d1[ey + 3][x]][2]
                for x in range(10, 14) if pal.get(d1[ey + 3][x]) is not None
            ]
            if neck_lums and (sum(neck_lums) / len(neck_lums)) > 135:
                fails.append(
                    f"down 1: missing dark chin-shadow separator at y={ey + 3} ('{d1[ey + 3][8:16]}' avg_lum={sum(neck_lums)/len(neck_lums):.0f} > 135; "
                    "separate peach chin from bright collar using #64150e/dark crease so chin doesn't bleed into chest at 1x/2x!)"
                )

        # Neck-Pinch Silhouette Check (`ey+3` in `DOWN 1`, `UP 1`, `RIGHT 1`, `LEFT 1`)
        hair_chars = {
            d1[hy][hx]
            for hy in range(max(0, ey - 4), ey + 1)
            for hx in range(3, 21)
            if (hx <= 8 or hx >= 15) and pal.get(d1[hy][hx]) is not None
        }
        neck_nonhair_xs = [
            x for x in range(C.FW)
            if pal.get(d1[ey + 3][x]) is not None and d1[ey + 3][x] not in hair_chars
        ]
        neck_all_xs = [x for x in range(C.FW) if pal.get(d1[ey + 3][x]) is not None]
        if neck_all_xs and (max(neck_all_xs) - min(neck_all_xs) + 1) >= 14:
            # Allowed ONLY if outer pixels x<=6 and x>=17 are long flowing hair (or dark outline wrapping long hair)!
            def _is_hair_or_hair_outline(row_s, idx, hset):
                ch = row_s[idx]
                if ch in hset:
                    return True
                rgb = pal.get(ch)
                if rgb and (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) < 35:
                    adj = (idx + 1) if idx < 12 else (idx - 1)
                    return 0 <= adj < C.FW and row_s[adj] in hset
                return False

            outer_nonhair = [
                x for x in neck_all_xs
                if (x <= 6 or x >= 17) and not _is_hair_or_hair_outline(d1[ey + 3], x, hair_chars)
            ]
            if outer_nonhair:
                fails.append(
                    f"down 1: no-neck turtle silhouette at y={ey + 3} ('{d1[ey + 3][4:20]}' spans {max(neck_all_xs)-min(neck_all_xs)+1}px with non-hair shoulder pixels at x={outer_nonhair}; "
                    f"pinch neck/collar row y={ey + 3} to <=12px (x=6..17 or x=7..16) before shoulders flare at y={ey + 4}!)"
                )
        # Also check UP 1 neck pinch (at least one row in `ey+2..ey+3` must pinch nape/collar to <=12px without >=14px coat shoulders!)
        u1 = frames[("up", 1)]
        u_hair_chars = {
            u1[hy][hx]
            for hy in range(max(0, ey - 4), ey + 2)
            for hx in range(3, 21)
            if pal.get(u1[hy][hx]) is not None
            and (0.299 * pal[u1[hy][hx]][0] + 0.587 * pal[u1[hy][hx]][1] + 0.114 * pal[u1[hy][hx]][2]) >= 35
        }
        def _u_row_has_wide_coat(ry):
            uxs = [x for x in range(C.FW) if pal.get(u1[ry][x]) is not None]
            if not uxs or (max(uxs) - min(uxs) + 1) < 14:
                return False
            bad = [
                x for x in uxs
                if (x <= 6 or x >= 17) and not (
                    u1[ry][x] in u_hair_chars
                    or (
                        pal.get(u1[ry][x]) is not None
                        and (0.299 * pal[u1[ry][x]][0] + 0.587 * pal[u1[ry][x]][1] + 0.114 * pal[u1[ry][x]][2]) < 35
                        and u1[ry][(x + 1) if x < 12 else (x - 1)] in u_hair_chars
                    )
                )
            ]
            return len(bad) > 0

        if _u_row_has_wide_coat(ey + 2) and _u_row_has_wide_coat(ey + 3):
            fails.append(
                f"up 1: no-neck rear shoulder slam across y={ey + 2}..{ey + 3} (pinch nape/collar to <=12px on at least one row before shoulders flare!)"
            )
        # Check Side Profile (`RIGHT 1` & `LEFT 1`) neck pinch at `ey+3`: non-hair collar width must be <=9px!
        for sd in ("right", "left"):
            sr = frames[(sd, 1)]
            s_hair = {
                sr[hy][hx]
                for hy in range(max(0, ey - 4), ey + 1)
                for hx in range(C.FW)
                if pal.get(sr[hy][hx]) is not None
                and (0.299 * pal[sr[hy][hx]][0] + 0.587 * pal[sr[hy][hx]][1] + 0.114 * pal[sr[hy][hx]][2]) >= 35
            }
            s_neck_xs = [x for x in range(C.FW) if pal.get(sr[ey + 3][x]) is not None]
            if s_neck_xs and (max(s_neck_xs) - min(s_neck_xs) + 1) >= 10:
                inner_back_x = (min(s_neck_xs) + 1) if sd == "right" else (max(s_neck_xs) - 1)
                if sr[ey + 3][inner_back_x] not in s_hair:
                    fails.append(
                        f"{sd} 1: thick shoulder eating neck at y={ey + 3} (width={max(s_neck_xs)-min(s_neck_xs)+1}px > 9px max; pinch side neck/collar to 8-9px before torso flares at y={ey + 4}!)"
                    )

    # 5) Anti-Frog-Shoulder / T-Pose Idle Arm Expansion Gate (`#02`, `#11`, `#12`, `#13`, `#14`, `#19` catcher!)
    d0, d2 = frames[("down", 0)], frames[("down", 2)]
    idle_spans = [
        max(x for x in range(C.FW) if pal.get(d1[y][x]) is not None) - min(x for x in range(C.FW) if pal.get(d1[y][x]) is not None) + 1
        for y in range(ey + 4, min(C.FH, ey + 9))
        if any(pal.get(d1[y][x]) is not None for x in range(C.FW))
    ]
    step_spans = [
        max(
            max(x for x in range(C.FW) if pal.get(dst[y + 1][x]) is not None) - min(x for x in range(C.FW) if pal.get(dst[y + 1][x]) is not None) + 1
            for dst in (d0, d2) if any(pal.get(dst[y + 1][x]) is not None for x in range(C.FW))
        )
        for y in range(ey + 4, min(C.FH - 1, ey + 9))
        if any(pal.get(d0[y + 1][x]) is not None for x in range(C.FW)) or any(pal.get(d2[y + 1][x]) is not None for x in range(C.FW))
    ]
    max_allowed_span = 14 if is_child else (18 if base_nk == "Template:broad" else 16)
    if idle_spans and max(idle_spans) > max_allowed_span and not has_asym_gear:
        fails.append(
            f"down 1: excessive T-pose/frog-arm width {max(idle_spans)}px > {max_allowed_span}px max for {base_nk}"
        )
    elif idle_spans and step_spans and (max(idle_spans) - max(step_spans)) >= 3:
        fails.append(
            f"down: frog-shoulder width pumping (idle max={max(idle_spans)}px vs walk step max={max(step_spans)}px; keep arm width steady!)"
        )

    return fails, warns


def check_walk_kinematics_12frame(pal: dict, frames: dict, base_nk: str, meta: dict) -> tuple[list[str], list[str]]:
    """Stage-1C 12-Frame Walk Kinematics Gate catching:
    1) Floating step feet (`#17`, `#18` frog-squat/crab-shuffle where step 0/2 feet lift off y=30 to y=29),
    2) Flashing sleeve/hand colors & mud-brown vanishing back hands (`#14` pink<->maroon sleeve swap & mud hand),
    3) Chicken-wing >=2px vertical arm seesaw in DOWN/UP (`#17`, `#18`, `#02`, `#03`, `#05`),
    4) Side-profile >=3px giant rear flying fist (`#14`, `#11`, `#18`) & simultaneous front+back double-arm sprout (`#17`)."""
    fails: list[str] = []
    warns: list[str] = []
    if base_nk == "Template:1":
        return fails, warns

    id_txt = (meta.get("id", "") + " " + meta.get("label", "")).lower()
    # Only exempt held polearm if an actual external weapon shaft rises into head/upper rows (x<=4 or x>=19 at y<=16)
    d1_probe = frames[("down", 1)]
    has_external_shaft = any(
        pal.get(d1_probe[y][x]) is not None
        for y in range(8, 17)
        for x in (0, 1, 2, 3, 20, 21, 22, 23)
    )
    has_held_polearm = has_external_shaft and any(kw in id_txt for kw in ("sentry", "halberd", "lancer"))

    def _lum(rgb):
        return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]

    def _is_bright_hand(rgb):
        if rgb is None:
            return False
        r, g, b = rgb
        return (r >= 188 and g >= 110 and b >= 65 and r > g) or (r >= 195 and g >= 195 and b >= 195)

    # 1) Ground Contact Lock & Planted Foot Width (>=3px): planted foot in step 0 & step 2 MUST reach same ground row as idle 1!
    for d in ("down", "right", "left", "up"):
        max_ys = []
        for st in (0, 1, 2):
            ys = [y for y in range(25, C.FH) for x in range(C.FW) if pal.get(frames[(d, st)][y][x]) is not None]
            gy = max(ys) if ys else 0
            max_ys.append(gy)
            g_cnt = sum(1 for x in range(C.FW) if gy > 0 and pal.get(frames[(d, st)][gy][x]) is not None)
            if g_cnt < 3:
                fails.append(
                    f"{d} {st}: pointy peg-foot ground contact ({g_cnt}px < 3px at y={gy}; draw a solid >=3-4px shoe sole!)"
                )
        if max_ys[0] != max_ys[1] or max_ys[2] != max_ys[1]:
            fails.append(
                f"{d}: floating/bouncing step feet max_y={max_ys} (planted foot in step 0 & 2 must touch ground row y={max_ys[1]}!)"
            )

    # 2) DOWN & UP: Anti-Arm-Flash, Anti-Mud-Hand, Width Stability, and Anti-Seesaw (`|L_max_y - R_max_y| <= 1`)
    for d in ("down", "up"):
        d0, d1, d2 = frames[(d, 0)], frames[(d, 1)], frames[(d, 2)]
        w_spans = []
        for st, rows in ((0, d0), (1, d1), (2, d2)):
            xs = [x for y in range(19, 25) for x in range(C.FW) if pal.get(rows[y][x]) is not None]
            if xs:
                w_spans.append((min(xs), max(xs)))
                if not has_held_polearm and abs((min(xs) + max(xs)) - 23) > 1:
                    fails.append(
                        f"{d} {st}: off-center torso/arm span x={min(xs)}..{max(xs)} (must balance around x=11.5!)"
                    )
        if len(w_spans) == 3:
            w1 = w_spans[1][1] - w_spans[1][0]
            for st in (0, 2):
                wst = w_spans[st][1] - w_spans[st][0]
                if abs(wst - w1) >= 2:
                    fails.append(
                        f"{d}: torso/shoulder width jumps between idle ({w1+1}px) and step {st} ({wst+1}px) — keep shoulder silhouette steady!"
                    )
        l_lum0 = [_lum(pal[d0[y][x]]) for y in range(20, 26) for x in range(3, 8) if pal.get(d0[y][x]) and _lum(pal[d0[y][x]]) > 45]
        r_lum0 = [_lum(pal[d0[y][x]]) for y in range(20, 26) for x in range(16, 21) if pal.get(d0[y][x]) and _lum(pal[d0[y][x]]) > 45]
        l_lum2 = [_lum(pal[d2[y][x]]) for y in range(20, 26) for x in range(3, 8) if pal.get(d2[y][x]) and _lum(pal[d2[y][x]]) > 45]
        r_lum2 = [_lum(pal[d2[y][x]]) for y in range(20, 26) for x in range(16, 21) if pal.get(d2[y][x]) and _lum(pal[d2[y][x]]) > 45]
        if not has_held_polearm:
            if l_lum0 and l_lum2 and abs(sum(l_lum0) / len(l_lum0) - sum(l_lum2) / len(l_lum2)) > 26:
                fails.append(
                    f"{d}: left arm/hand flashes brightness between step 0 ({sum(l_lum0)/len(l_lum0):.0f}) and step 2 ({sum(l_lum2)/len(l_lum2):.0f}) — keep sleeve color & bright peach/glove hand steady!"
                )
            if r_lum0 and r_lum2 and abs(sum(r_lum0) / len(r_lum0) - sum(r_lum2) / len(r_lum2)) > 26:
                fails.append(
                    f"{d}: right arm/hand flashes brightness between step 0 ({sum(r_lum0)/len(r_lum0):.0f}) and step 2 ({sum(r_lum2)/len(r_lum2):.0f}) — keep sleeve color & bright peach/glove hand steady!"
                )
            for st, rows in ((0, d0), (1, d1), (2, d2)):
                lh_m = max((_lum(pal[rows[y][x]]) for y in range(21, 26) for x in range(3, 8) if pal.get(rows[y][x]) and _lum(pal[rows[y][x]]) > 55), default=0)
                rh_m = max((_lum(pal[rows[y][x]]) for y in range(21, 26) for x in range(16, 21) if pal.get(rows[y][x]) and _lum(pal[rows[y][x]]) > 55), default=0)
                if lh_m > 0 and rh_m > 0 and abs(lh_m - rh_m) > 40:
                    fails.append(
                        f"{d} {st}: mismatched left/right hand brightness (L_max={lh_m:.0f} vs R_max={rh_m:.0f}) — paint BOTH hands with the same warm skin/glove tone!"
                    )
            # Ensure bright skin/glove hand pixels don't vanish into mud-brown on back swing!
            lh1 = sum(1 for y in range(21, 26) for x in range(3, 8) if _is_bright_hand(pal.get(d1[y][x])))
            rh1 = sum(1 for y in range(21, 26) for x in range(16, 21) if _is_bright_hand(pal.get(d1[y][x])))
            if lh1 >= 3 and rh1 >= 3:
                for st, rows in ((0, d0), (2, d2)):
                    lh_st = sum(1 for y in range(21, 26) for x in range(3, 8) if _is_bright_hand(pal.get(rows[y][x])))
                    rh_st = sum(1 for y in range(21, 26) for x in range(16, 21) if _is_bright_hand(pal.get(rows[y][x])))
                    if lh_st < 2 or rh_st < 2:
                        fails.append(
                            f"{d} {st}: vanishing/mud-darkened hand (bright hand px L={lh_st}, R={rh_st}; keep >=2px readable skin/glove on BOTH hands in all 3 frames!)"
                        )
        # Check vertical arm seesaw (`|L_max_y - R_max_y| <= 1`)
        for st, rows in ((0, d0), (2, d2)):
            lys = [y for y in range(20, 27) for x in range(3, 7) if pal.get(rows[y][x]) is not None]
            rys = [y for y in range(20, 27) for x in range(17, 21) if pal.get(rows[y][x]) is not None]
            if lys and rys and abs(max(lys) - max(rys)) >= 2:
                fails.append(
                    f"{d} {st}: chicken-wing arm y-seesaw (left outer arm ends y={max(lys)} vs right y={max(rys)}; keep within <=1px!)"
                )

    # 3) RIGHT & LEFT: Chest-to-Shoe Alignment, Anti-Giant-Back-Fist (`1..2px`), Anti-Double-Arm, & Mandatory +1px Forward Hand Swing!
    for d in ("right", "left"):
        r0, r1, r2 = frames[(d, 0)], frames[(d, 1)], frames[(d, 2)]
        tx1 = [x for y in range(19, 25) for x in range(C.FW) if pal.get(r1[y][x]) is not None]
        sx1 = [x for y in range(28, C.FH) for x in range(C.FW) if pal.get(r1[y][x]) is not None]
        if tx1 and sx1:
            if d == "right" and max(tx1) > max(sx1):
                fails.append(
                    f"right 1: front chest/belly (x={max(tx1)}) overhangs past idle shoe toe (x={max(sx1)}) — tuck idle chest to x<={max(sx1)}!"
                )
            if d == "left" and min(tx1) < min(sx1):
                fails.append(
                    f"left 1: front chest/belly (x={min(tx1)}) overhangs past idle shoe toe (x={min(sx1)}) — tuck idle chest to x>={min(sx1)}!"
                )
        # Check against internal empty pixel gaps splitting rear arm from torso on y=21..24
        for st, rows in ((0, r0), (2, r2)):
            for y in range(21, 25):
                xs = [x for x in range(C.FW) if pal.get(rows[y][x]) is not None]
                if xs and (max(xs) - min(xs) + 1) > len(xs):
                    fails.append(
                        f"{d} {st}: detached arm/torso gap on y={y} (x={min(xs)}..{max(xs)} has transparent hole inside silhouette!)"
                    )
                    break

        b_xs, f_xs = [], []
        for rows in (r0, r1, r2):
            axs = [x for y in range(21, 26) for x in range(C.FW) if pal.get(rows[y][x]) is not None]
            b_xs.append(min(axs) if d == "right" else max(axs))
            f_xs.append(max(axs) if d == "right" else min(axs))
        back_jut0 = (b_xs[1] - b_xs[0]) if d == "right" else (b_xs[0] - b_xs[1])
        back_jut2 = (b_xs[1] - b_xs[2]) if d == "right" else (b_xs[2] - b_xs[1])
        front_jut0 = (f_xs[0] - f_xs[1]) if d == "right" else (f_xs[1] - f_xs[0])
        front_jut2 = (f_xs[2] - f_xs[1]) if d == "right" else (f_xs[1] - f_xs[2])

        if max(back_jut0, back_jut2) >= 3:
            fails.append(
                f"{d}: giant flying fist behind back (back_jut=[{back_jut0},{back_jut2}]px > 2px max; keep rear swing compact 1-2px!)"
            )
        if not has_held_polearm and max(back_jut0, back_jut2) < 1:
            fails.append(
                f"{d}: missing rear arm swing (back_jut=[{back_jut0},{back_jut2}]; rear-swing step must extend 1-2px behind idle back!)"
            )
        if (back_jut0 >= 1 and front_jut0 >= 1) or (back_jut2 >= 1 and front_jut2 >= 1):
            fails.append(
                f"{d}: double-arm sprout in single step (back_jut=[{back_jut0},{back_jut2}], front_jut=[{front_jut0},{front_jut2}]; one step swings back, the other swings forward!)"
            )
        if not has_held_polearm and max(front_jut0, front_jut2) < 1:
            fails.append(
                f"{d}: missing forward hand swing (front_jut=[{front_jut0},{front_jut2}]; forward-swing step must extend hand +1px past idle chest!)"
            )

    return fails, warns


def run_doll_check_slot(slot_dir: Path) -> bool:
    meta = json.loads((slot_dir / "slot_meta.json").read_text(encoding="utf-8"))
    base_nk, b_pal, b_frames = load_any_base(meta["base"])
    pal, _, frames = C.load(slot_dir / "out.chr.txt")

    # 1) Structural + Nude-Doll deep-core hole protection + RTP humanoid strong gate + 12-frame motion gate + Side/Front/Proportion/Walk12 Gates
    se = C.structural_errors(pal, frames)
    if se:
        print(json.dumps({"ok": False, "fails": se, "warns": []}))
        return False
    hole_defects = C.opacity_defects(pal, frames, (b_pal, b_frames))
    g_res = C.gate(pal, frames, None, check_changed=False, strength="strong")
    m_res = M.analyze(pal, frames, (b_pal, b_frames))
    s_fails, s_warns = check_side_profile_anatomy(pal, frames, base_nk, meta)
    f_fails, f_warns = check_front_face_and_head_lock(pal, frames, base_nk, meta)
    p_fails, p_warns = check_proportion_and_symmetry_qa(pal, frames, base_nk, meta)
    k_fails, k_warns = check_walk_kinematics_12frame(pal, frames, base_nk, meta)

    fails = [d["what"] for d in hole_defects] + list(g_res.get("fails", [])) + list(m_res.get("fails", [])) + s_fails + f_fails + p_fails + k_fails
    warns = list(g_res.get("warns", [])) + s_warns + f_warns + p_warns + k_warns

    vdir = slot_dir / "views"
    vdir.mkdir(parents=True, exist_ok=True)
    rgba = C.sheet_rgba(pal, frames)
    rgba.save(vdir / "sheet.png")
    rgba.save(slot_dir / "chip.png")
    C.sheet_big(pal, frames, 8).save(vdir / "sheet_x8.png")
    C.strip(pal, frames, 6, base=(b_pal, b_frames)).save(vdir / "strip.png")
    C.context(pal, frames, CHARSET_DIR / "Actor1.png", scale=4, others=(0, 1, 2, 4)).save(vdir / "context.png")

    lbl = meta.get("label", meta["id"])
    make_face_check_12x(rgba, slot_dir / "face_check_12x.png", label=lbl)
    make_kinematics_check_8x(rgba, base_nk, slot_dir / "kinematics_check_8x.png", label=lbl)
    make_walk_4dir_gif(rgba, slot_dir / "walk_4dir.gif")

    report = {
        "ok": len(fails) == 0,
        "strict_ok": len(fails) == 0 and len(warns) == 0,
        "chr_sha256": chr_sha256_of(slot_dir),
        "base": base_nk,
        "fails": fails,
        "warns": warns,
        "metrics": g_res.get("metrics", {}),
    }
    (vdir / "gate.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return len(fails) == 0 and len(warns) == 0


def cmd_seed(args):
    llm_warn = check_and_warn_llm(getattr(args, "model", ""), "seed")
    resolved_model = (getattr(args, "model", "") or os.environ.get("OPRN_CHARSET_MODEL") or "").strip()
    spec_path = Path(args.spec).resolve()
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    items = json.loads(spec_path.read_text(encoding="utf-8"))
    manifest = []

    for i, item in enumerate(items, start=1):
        cid = item["id"]
        mode = item.get("mode", "full12")
        base_key = item["base"]
        slot_dir = out_dir / f"{i:02d}_{cid}"
        if slot_dir.exists() and args.clean:
            shutil.rmtree(slot_dir)
        slot_dir.mkdir(parents=True, exist_ok=True)

        if mode == "partedit":
            pal, info = AP.seed_workdir(slot_dir, base_key)
            free = " ".join(c for c in AP.LETTERS if c not in pal)
            (slot_dir / "free_letters.txt").write_text(free + "\n", encoding="utf-8")
            prompt_txt = build_partedit_prompt(slot_dir, item, free)
            base_nk = base_key
        elif mode == "doll12":
            base_nk, pal, frames = load_any_base(base_key)
            txt = C.dump(pal, {}, frames, base_nk)
            (slot_dir / "base.chr.txt").write_text(txt, encoding="utf-8")
            make_doll_outline_assets(pal, frames, slot_dir, base_nk)
            if args.clean or not (slot_dir / "out.chr.txt").exists():
                shutil.copy(slot_dir / "doll_outline.chr.txt", slot_dir / "out.chr.txt")
            hair_ref_nk = make_hair_ref_assets(item["hair_ref"], slot_dir) if item.get("hair_ref") else ""
            ensure_style_png(slot_dir / "rtp_style_4x.png")
            plain = Image.new("RGBA", (72, 128), (44, 49, 62, 255))
            plain.alpha_composite(C.sheet_rgba(pal, frames))
            plain.resize((72 * 6, 128 * 6), Image.NEAREST).convert("RGB").save(slot_dir / "base_6x.png")
            prompt_txt = build_doll12_prompt(slot_dir, item, base_nk, hair_ref_nk)
        elif mode == "full12":
            base_nk = H.norm_base(base_key)
            pal, frames = H.base_of(base_nk)
            txt = C.dump(pal, {}, frames, base_nk)
            (slot_dir / "base.chr.txt").write_text(txt, encoding="utf-8")
            shutil.copy(slot_dir / "base.chr.txt", slot_dir / "out.chr.txt")
            ensure_style_png(slot_dir / "rtp_style_4x.png")
            plain = Image.new("RGBA", (72, 128), (44, 49, 62, 255))
            plain.alpha_composite(C.sheet_rgba(pal, frames))
            plain.resize((72 * 6, 128 * 6), Image.NEAREST).convert("RGB").save(slot_dir / "base_6x.png")
            prompt_txt = build_full12_prompt(slot_dir, item, base_nk)
        else:
            raise ValueError(f"Unknown mode '{mode}' for {cid}")

        (slot_dir / "prompt.md").write_text(prompt_txt, encoding="utf-8")
        make_rtp_eyes_12x(slot_dir / "rtp_eyes_12x.png")
        entry = {
            "index": i,
            "id": cid,
            "label": item.get("label", cid),
            "mode": mode,
            "base": base_nk,
            "dir": str(slot_dir),
            "prompt": str(slot_dir / "prompt.md"),
            "recommended_llms": ["carbon", "fable"],
            **({"model": resolved_model} if resolved_model else {}),
            **({"llm_warning": llm_warn} if (resolved_model and llm_warn) else {}),
        }
        (slot_dir / "slot_meta.json").write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")
        manifest.append(entry)
        print(f"[SEEDED] {i:02d}_{cid} ({mode} on {base_nk}) -> {slot_dir / 'prompt.md'}")

    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved manifest with {len(manifest)} slots: {out_dir / 'manifest.json'}")


def unkey_rgba(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA").copy()
    key = im.getpixel((0, 0))
    if key[3] == 0:
        return im
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y] == key:
                px[x, y] = (0, 0, 0, 0)
    return im


def make_walk_4dir_gif(sheet_rgba: Image.Image, out_gif: Path, scale: int = 5):
    dirs = {dn: [sheet_rgba.crop((c * 24, r * 32, (c + 1) * 24, (r + 1) * 32)) for c in range(3)]
            for r, dn in enumerate(["UP", "RIGHT", "DOWN", "LEFT"])}
    cw, ch = 24 * scale, 32 * scale
    w, h = 4 * cw, ch
    frames = []
    for step in [0, 1, 2, 1]:
        f = Image.new("RGBA", (w, h), (76, 146, 56, 255))
        d = ImageDraw.Draw(f)
        for i, dn in enumerate(["DOWN", "LEFT", "RIGHT", "UP"]):
            ox = i * cw
            d.ellipse([ox + 26, ch - 14, ox + cw - 26, ch - 2], fill=(42, 86, 32, 180))
            spr = dirs[dn][step].resize((cw, ch), Image.NEAREST)
            f.paste(spr, (ox, 0), spr)
        frames.append(f.convert("P", palette=Image.ADAPTIVE, colors=256))
    frames[0].save(out_gif, save_all=True, append_images=frames[1:], duration=165, loop=0, disposal=2)


def cmd_verify(args):
    check_and_warn_llm(getattr(args, "model", ""), "verify")
    out_dir = Path(args.out).resolve()
    manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
    all_ok = True
    for m in manifest:
        sdir = Path(m["dir"])
        mode = m["mode"]
        cid = m["id"]
        if mode == "partedit":
            r = subprocess.run([sys.executable, str(HARNESS_DIR / "partedit.py"), "apply", str(sdir)],
                               capture_output=True, text=True)
            ok = r.returncode == 0
            # Ensure chip.png exists if chip.chr.txt or edit.json succeeded
            chip_png = sdir / "chip.png"
            if ok and not chip_png.exists() and (sdir / "edit.json").exists():
                ed = json.loads((sdir / "edit.json").read_text(encoding="utf-8"))
                pal2, frames2, errs = P.apply_edit(m["base"], ed)
                if not errs:
                    C.sheet_rgba(pal2, frames2).save(chip_png)
            if chip_png.exists() and not (sdir / "walk_4dir.gif").exists():
                make_walk_4dir_gif(unkey_rgba(Image.open(chip_png)), sdir / "walk_4dir.gif")
            status = "PASS" if (ok and chip_png.exists()) else "FAIL"
            print(f"[{status}] {m['index']:02d}_{cid} (partedit) {r.stdout.strip()[:120]}")
            if status != "PASS":
                all_ok = False
        elif mode == "doll12":
            ok = run_doll_check_slot(sdir)
            status = "PASS" if ok else "FAIL"
            print(f"[{status}] {m['index']:02d}_{cid} (doll12 on {m['base']})")
            if not ok:
                all_ok = False
        else:
            out_chr = sdir / "out.chr.txt"
            r1 = subprocess.run([sys.executable, str(HARNESS_DIR / "harness.py"), "check", str(out_chr),
                                 "--base", m["base"], "--strength", "strong"], capture_output=True, text=True)
            r2 = subprocess.run([sys.executable, str(HARNESS_DIR / "harness.py"), "motion-check", str(out_chr),
                                 "--base", m["base"]], capture_output=True, text=True)
            subprocess.run([sys.executable, str(HARNESS_DIR / "harness.py"), "views", str(out_chr),
                            str(sdir / "views"), "--base", m["base"], "--strength", "strong"],
                           capture_output=True, text=True)
            sheet_png = sdir / "views" / "sheet.png"
            chip_png = sdir / "chip.png"
            if sheet_png.exists():
                rgba = unkey_rgba(Image.open(sheet_png))
                rgba.save(chip_png)
                make_walk_4dir_gif(rgba, sdir / "walk_4dir.gif")
                make_face_check_12x(rgba, sdir / "face_check_12x.png", label=m.get("label", cid))
                make_kinematics_check_8x(rgba, m["base"], sdir / "kinematics_check_8x.png", label=m.get("label", cid))
            ok = r1.returncode == 0 and r2.returncode == 0 and chip_png.exists()
            status = "PASS" if ok else "FAIL"
            print(f"[{status}] {m['index']:02d}_{cid} (full12) check={r1.returncode} motion={r2.returncode}")
            if not ok:
                all_ok = False
    sys.exit(0 if all_ok else 1)


def load_rtp_ref(fn: str, idx: int) -> Image.Image:
    im = Image.open(CHARSET_DIR / fn)
    sx, sy = (idx % 4) * 72, (idx // 4) * 128
    return unkey_rgba(im.crop((sx, sy, sx + 72, sy + 128)))


def check_slot_qa_lock(sdir: Path) -> tuple[bool, str]:
    cur_sha = chr_sha256_of(sdir)
    gate_p = sdir / "views" / "gate.json"
    if not gate_p.exists():
        return False, "missing views/gate.json (run `verify` / `doll-check` first)"
    gate = json.loads(gate_p.read_text(encoding="utf-8"))
    if not gate.get("strict_ok"):
        return False, f"mechanical gate not strict_ok (fails={gate.get('fails')}, warns={gate.get('warns')})"
    if gate.get("chr_sha256") != cur_sha:
        return False, "stale views/gate.json (out.chr.txt changed after last doll-check!)"
    qa_p = sdir / "views" / "qa_verdict.json"
    if not qa_p.exists():
        return False, "missing views/qa_verdict.json (run `qa-prep` -> Independent QA Critic -> `qa-verdict` first!)"
    qa = json.loads(qa_p.read_text(encoding="utf-8"))
    if qa.get("verdict") != "PASS":
        return False, f"final Visual QA verdict={qa.get('verdict')} ({qa.get('notes', '')})"
    if qa.get("chr_sha256") != cur_sha:
        return False, "stale views/qa_verdict.json (out.chr.txt modified after QA verdict!)"
    if not str(qa.get("by", "")).strip():
        return False, "views/qa_verdict.json missing critic identifier `by`"
    return True, "OK"


def cmd_qa_prep(args):
    check_and_warn_llm(getattr(args, "model", ""), "qa-prep")
    out_dir = Path(args.out).resolve()
    manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
    qa_dir = out_dir / "qa_sheets"
    qa_dir.mkdir(parents=True, exist_ok=True)

    # Ensure every slot passed Stage-1 mechanical gate with current hash first
    mech_errors = []
    for m in manifest:
        sdir = Path(m["dir"])
        cur_sha = chr_sha256_of(sdir)
        gp = sdir / "views" / "gate.json"
        if not gp.exists():
            mech_errors.append(f"{m['index']:02d}_{m['id']}: missing views/gate.json")
            continue
        g = json.loads(gp.read_text(encoding="utf-8"))
        if not g.get("strict_ok") or g.get("chr_sha256") != cur_sha:
            mech_errors.append(f"{m['index']:02d}_{m['id']}: mechanical gate not current/strict_ok")
    if mech_errors:
        print("ABORT qa-prep — fix Stage-1 mechanical gates first:\n  " + "\n  ".join(mech_errors))
        sys.exit(1)

    # Render Full 12-Frame Final Adversarial Visual QA Sheets (5 slots per sheet, ALL 12 FRAMES [DOWN 0·1·2 | RIGHT 0·1·2 | LEFT 0·1·2 | UP 0·1·2] + 1x/2x!)
    refs = [
        ("RTP Actor1:0", load_rtp_ref("Actor1.png", 0)),
        ("RTP Actor4:1", load_rtp_ref("Actor4.png", 1)),
        ("RTP People1:1", load_rtp_ref("People1.png", 1)),
        ("RTP Actor2:1", load_rtp_ref("Actor2.png", 1)),
    ]
    sc = 5
    cw, ch = 24 * sc, 32 * sc
    poses = [
        ("D0", 0, 2), ("D1", 1, 2), ("D2", 2, 2),
        ("R0", 0, 1), ("R1", 1, 1), ("R2", 2, 1),
        ("L0", 0, 3), ("L1", 1, 3), ("L2", 2, 3),
        ("U0", 0, 0), ("U1", 1, 0), ("U2", 2, 0),
    ]
    sheet_paths = []
    for g_idx, start in enumerate(range(0, len(manifest), 5), start=1):
        chunk = manifest[start:start + 5]
        bw = 14 + 12 * (cw + 4) + 3 * 8 + 84
        bh = 34 + (1 + len(chunk)) * (ch + 22) + 10
        im = Image.new("RGBA", (bw, bh), (20, 24, 32, 255))
        dr = ImageDraw.Draw(im)
        dr.text((12, 8), f"FINAL 12-FRAME ADVERSARIAL VISUAL QA BOARD #{g_idx:02d} (5x ALL 12 FRAMES [D0·1·2 | R0·1·2 | L0·1·2 | U0·1·2] + x=11.5 Axis + 1x/2x)",
                fill=(255, 232, 145, 255))

        # Top row: Official EasyRPG RTP Masters — show Actor1:0 FULL 12 FRAMES so critic compares every walk frame directly!
        ry0 = 34
        dr.text((14, ry0 - 14), "OFFICIAL RTP Actor1:0 FULL 12-FRAME WALK REFERENCE [D0·D1·D2 | R0·R1·R2 | L0·L1·L2 | U0·U1·U2] + People1:1 (Right)",
                fill=(140, 215, 255, 255))
        r_a1 = refs[0][1]
        for pi, (plbl, col_c, row_r) in enumerate(poses):
            ox = 14 + pi * (cw + 4) + (pi // 3) * 8
            bgc = (56, 114, 46, 255) if col_c == 1 else (72, 138, 56, 255)
            dr.rectangle([ox, ry0, ox + cw - 1, ry0 + ch - 1], fill=bgc)
            spr = r_a1.crop((col_c * 24, row_r * 32, (col_c + 1) * 24, (row_r + 1) * 32)).resize((cw, ch), Image.NEAREST)
            im.paste(spr, (ox, ry0), spr)
            dr.text((ox + 3, ry0 + 2), f"RTP {plbl}", fill=(255, 255, 255, 220))
        # People1:1 1x/2x reference on far right
        nx0 = 14 + 12 * (cw + 4) + 3 * 8 + 6
        dr.rectangle([nx0, ry0, nx0 + 68, ry0 + ch - 1], fill=(72, 138, 56, 255))
        p1_1x = refs[2][1].crop((24, 64, 48, 96))
        p1_2x = p1_1x.resize((48, 64), Image.NEAREST)
        im.paste(p1_1x, (nx0 + 22, ry0 + 14), p1_1x)
        im.paste(p1_2x, (nx0 + 10, ry0 + 62), p1_2x)

        for ci, m in enumerate(chunk):
            oy = 34 + (ci + 1) * (ch + 22)
            sdir = Path(m["dir"])
            sh = unkey_rgba(Image.open(sdir / "chip.png"))
            dr.text((14, oy - 14), f"#{m['index']:02d} {m['id']} ({m.get('label', '')}, base={m['base']})",
                    fill=(255, 226, 130, 255))
            for pi, (plbl, col_c, row_r) in enumerate(poses):
                ox = 14 + pi * (cw + 4) + (pi // 3) * 8
                bgc = (56, 114, 46, 255) if col_c == 1 else (74, 140, 58, 255)
                dr.rectangle([ox, oy, ox + cw - 1, oy + ch - 1], fill=bgc)
                spr = sh.crop((col_c * 24, row_r * 32, (col_c + 1) * 24, (row_r + 1) * 32)).resize((cw, ch), Image.NEAREST)
                im.paste(spr, (ox, oy), spr)
                if plbl in ("D1", "U1"):
                    cx = ox + 12 * sc
                    for gy in range(oy, oy + ch, 6):
                        dr.line([(cx, gy), (cx, gy + 2)], fill=(255, 85, 85, 185))
                dr.text((ox + 3, oy + 2), plbl, fill=(255, 255, 255, 210))

            # 1x and 2x native-scale check on the far right
            nx = 14 + 12 * (cw + 4) + 3 * 8 + 6
            dr.rectangle([nx, oy, nx + 68, oy + ch - 1], fill=(72, 138, 56, 255))
            d1_1x = sh.crop((24, 64, 48, 96))
            d1_2x = d1_1x.resize((48, 64), Image.NEAREST)
            im.paste(d1_1x, (nx + 22, oy + 14), d1_1x)
            im.paste(d1_2x, (nx + 10, oy + 62), d1_2x)
            dr.text((nx + 6, oy + 2), "1x / 2x", fill=(255, 255, 255, 210))

        sp = qa_dir / f"qa_group_{g_idx:02d}.png"
        im.save(sp)
        sheet_paths.append(sp)
        print("Saved Final 12-Frame QA sheet:", sp)

    critic_md = f"""# Independent Adversarial Visual QA Critic Brief (`{out_dir.name}`)

You are an **independent, adversarial RPG Maker 2000 / EasyRPG RTP (24x32) Lead Art Director**.
You did **NOT** draw these sprites. Your job is to **find every visual defect** so zero awkward sprites ever reach the user!

Read EVERY QA sheet below using `read_file`:
{chr(10).join(f"- `{p}`" for p in sheet_paths)}

Compare every candidate row against the **Official EasyRPG RTP Master (`Actor1:0` FULL 12-FRAME WALK + `People1:1` 1x/2x)** at the top of each board (`[D0·D1·D2 | R0·R1·R2 | L0·L1·L2 | U0·U1·U2]` at `5x` + `1x/2x`), checking ALL 7 criteria:
1. **Hair, Bangs & Forehead Balance**: No receding/bald 3–4 row foreheads, no swim-cap flat skulls, no jagged stair-step spikes, and `UP 0·1·2` back-hair must have 3–5 shaded clumps (not a flat sphere).
2. **Eyes, Nose, Chin & Neck-Pinch Separation (`5x` AND `1x/2x`!)**: Both front eyes crisp & symmetric, readable warm peach chin at `ey+2` (never swallowed by grey stubble or high coat lapels right under the eyes!), dark chin-shadow separator at `ey+3`, **a distinct pinched neck/collar row (`10–12px` in `D/U`, `8–9px` in `R/L` before shoulders flare at `ey+4` — ZERO 'no-neck' turtle/hunchback silhouettes where wide coat/armor shoulders jam straight into the eyes, ears, or skull base!)**, and **no collar jewel/pixel directly under the chin that mimics a weird open green/red mouth or pacifier at 1x/2x**!
3. **Red Center-Axis Alignment (`x=11.5` on `D1` & `U1`)**: Head, nose, collar cameo/tie, torso/corset, skirt/legs, and feet must sit balanced on the red dashed center line (no lopsided `+1px` shifted dresses/skirts!).
4. **Front & Back Walk Kinematics (`D0·D1·D2` & `U0·U1·U2`)**: Both hands stay consistent in color/brightness across `0 -> 1 -> 2` (NO sleeve/hand color flashing or mud-brown hidden hands!), no chicken-wing hand height seesaw, shoulders don't explode wider in `D1`, and grounded feet reach `y=30` on every frame.
5. **Side Profile & Side Walk Kinematics (`R0·R1·R2` & `L0·L1·L2`)**: Ear + warm cheek visible behind the eye (`C` zone), `1px` nose tip with `-1px` tucked chin, `8-10px` clothed side torso aligned under chin, `7px` forward-toed shoes, AND **clean bidirectional side arm swing** (`R0/L2` compact `1-2px` rear arm swing without giant flying fists or double front+back arms; `R2/L0` visible `+1px` forward hand swing; `L0·1·2` symmetric to `R2·1·0`; no floating frog-squat feet!).
6. **Head Walk Bob (`+1px` Rigid Lock)**: Across `0/2` vs `1` in all 4 directions, the head & eyes bob rigidly by `+1px` without squashing or stretching.
7. **Warm RTP Palette & Contrast**: Warm reddish-brown dark anchors, no white-on-white blowout, torso split into 2–3 readable planes.

Return a JSON array of objects `[ {{"index": 1, "id": "...", "verdict": "PASS"|"FAIL", "notes": "concise reason"}} ]` covering all {len(manifest)} slots. When in doubt, `FAIL`!
"""
    (qa_dir / "critic_prompt.md").write_text(critic_md, encoding="utf-8")
    print("Saved Independent QA Critic prompt:", qa_dir / "critic_prompt.md")


def cmd_qa_verdict(args):
    if args.json:
        out_dir = Path(args.out).resolve()
        manifest = {m["id"]: Path(m["dir"]) for m in json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))}
        items = json.loads(Path(args.json).read_text(encoding="utf-8"))
        for it in items:
            sdir = manifest[it["id"]]
            rec = {
                "id": it["id"],
                "verdict": it["verdict"],
                "by": args.by,
                "notes": it.get("notes", ""),
                "chr_sha256": chr_sha256_of(sdir),
            }
            (sdir / "views" / "qa_verdict.json").write_text(json.dumps(rec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"[QA {rec['verdict']}] {it['id']} (sha256={rec['chr_sha256'][:12]}...)")
        return

    sdir = Path(args.dir).resolve()
    meta = json.loads((sdir / "slot_meta.json").read_text(encoding="utf-8"))
    rec = {
        "id": meta["id"],
        "verdict": args.verdict,
        "by": args.by,
        "notes": args.notes,
        "chr_sha256": chr_sha256_of(sdir),
    }
    (sdir / "views" / "qa_verdict.json").write_text(json.dumps(rec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[QA {rec['verdict']}] {meta['id']} -> {sdir / 'views' / 'qa_verdict.json'}")


def cmd_pack(args):
    check_and_warn_llm(getattr(args, "model", ""), "pack")
    out_dir = Path(args.out).resolve()
    manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
    filter_ids = [x.strip() for x in args.ids.split(",") if x.strip()] if args.ids else None
    selected = []
    gate_failures = []
    for m in manifest:
        if filter_ids and m["id"] not in filter_ids:
            continue
        sdir = Path(m["dir"])
        if not getattr(args, "skip_qa_gate", False):
            ok_lock, reason = check_slot_qa_lock(sdir)
            if not ok_lock:
                gate_failures.append(f"  - #{m['index']:02d} {m['id']}: {reason}")
                continue
        chip_p = sdir / "chip.png"
        if not chip_p.exists() and (sdir / "views" / "sheet.png").exists():
            unkey_rgba(Image.open(sdir / "views" / "sheet.png")).save(chip_p)
        if chip_p.exists():
            selected.append((m["label"], unkey_rgba(Image.open(chip_p))))

    if gate_failures:
        raise SystemExit(
            "PACK BLOCKED BY FINAL QA / MECHANICAL GATE LOCK:\n"
            + "\n".join(gate_failures)
            + "\nRun `verify` -> `qa-prep` -> Independent Critic Subagent -> `qa-verdict` before `pack`!"
        )
    if not selected:
        raise SystemExit("No completed character sheets found to pack.")

    # 1) Pack into native 288x256 RM2000 8-slot sheets
    for p_idx in range(0, len(selected), 8):
        chunk = selected[p_idx:p_idx + 8]
        pack = Image.new("RGBA", (288, 256), (0, 0, 0, 0))
        for i, (_, sh) in enumerate(chunk):
            pack.paste(sh, ((i % 4) * 72, (i // 4) * 128))
        pack_p = out_dir / f"rm2k_pack_{(p_idx // 8) + 1:02d}_288x256.png"
        pack.save(pack_p)
        print("Saved RM2000 8-slot pack:", pack_p)

    # 2) 3x Full 12-frame grass board
    cols = min(4, len(selected))
    rows = (len(selected) + cols - 1) // cols
    sc, pad = 3, 12
    bw = cols * (72 * sc) + (cols + 1) * pad
    bh = rows * (128 * sc + 24) + (rows + 1) * pad
    board = Image.new("RGBA", (bw, bh), (26, 32, 28, 255))
    dr = ImageDraw.Draw(board)
    for i, (lbl, sh) in enumerate(selected):
        c_i, r_i = i % cols, i // cols
        ox = pad + c_i * (72 * sc + pad)
        oy = pad + r_i * (128 * sc + 24 + pad) + 22
        for rr in range(4):
            for cc in range(3):
                bgc = (78, 148, 58, 255) if (rr + cc) % 2 == 0 else (70, 138, 52, 255)
                dr.rectangle([ox + cc * 24 * sc, oy + rr * 32 * sc,
                              ox + (cc + 1) * 24 * sc - 1, oy + (rr + 1) * 32 * sc - 1], fill=bgc)
        s_im = sh.resize((72 * sc, 128 * sc), Image.NEAREST)
        board.paste(s_im, (ox, oy), s_im)
        dr.text((ox + 8, oy - 16), lbl, fill=(255, 232, 148, 255))
    board_p = out_dir / "showcase_3x.png"
    board.save(board_p)
    print("Saved 3x showcase board:", board_p)

    # 3) Grand Grass Parade GIF alongside official EasyRPG Actor1 & People1
    ref_a1 = load_rtp_ref("Actor1.png", 0)
    ref_p1 = load_rtp_ref("People1.png", 0)

    def split_dirs(sh):
        return {dn: [sh.crop((c * 24, r * 32, (c + 1) * 24, (r + 1) * 32)) for c in range(3)]
                for r, dn in enumerate(["UP", "RIGHT", "DOWN", "LEFT"])}

    per_row = 4
    rows_data = []
    for r_idx, chunk_start in enumerate(range(0, len(selected), per_row)):
        ref = ("REF: Actor1", split_dirs(ref_a1), True) if r_idx % 2 == 0 else ("REF: People1", split_dirs(ref_p1), True)
        row_items = [ref] + [(l, split_dirs(s), False) for l, s in selected[chunk_start:chunk_start + per_row]]
        rows_data.append(row_items)

    gs = 4
    cw, ch = 24 * gs, 32 * gs
    gap_x = 16
    row_h = ch + 30
    max_cols = max(len(r) for r in rows_data)
    gw = gap_x + max_cols * (cw + gap_x)
    gh = 30 + len(rows_data) * row_h + 10

    gif_frames = []
    for dn in ["DOWN", "LEFT", "UP", "RIGHT"]:
        for step in [0, 1, 2, 1, 0, 1, 2, 1]:
            f = Image.new("RGBA", (gw, gh), (76, 146, 56, 255))
            d = ImageDraw.Draw(f)
            for ty in range(0, gh, 32):
                for tx in range(0, gw, 32):
                    if ((tx // 32) + (ty // 32)) % 2 == 0:
                        d.rectangle([tx, ty, tx + 31, ty + 31], fill=(84, 156, 62, 255))
            d.rectangle([0, 0, gw, 26], fill=(20, 26, 22, 255))
            d.text((14, 7), f"EasyRPG Refs (Left) + {len(selected)} Custom Characters - Walking {dn} (4x)",
                   fill=(242, 250, 242, 255))
            for ri, rlist in enumerate(rows_data):
                oy = 30 + ri * row_h
                d.rectangle([0, oy + ch + 2, gw, oy + ch + 24], fill=(24, 32, 26, 215))
                for ci, (lbl, fset, is_r) in enumerate(rlist):
                    ox = gap_x + ci * (cw + gap_x)
                    d.ellipse([ox + 22, oy + ch - 11, ox + cw - 22, oy + ch - 1], fill=(42, 86, 32, 180))
                    spr = fset[dn][step].resize((cw, ch), Image.NEAREST)
                    f.paste(spr, (ox, oy), spr)
                    col = (155, 205, 255, 255) if is_r else (255, 232, 148, 255)
                    d.text((ox + max(0, (cw - len(lbl) * 6) // 2), oy + ch + 7), lbl, fill=col)
            gif_frames.append(f.convert("P", palette=Image.ADAPTIVE, colors=256))

    gif_p = out_dir / "grand_parade_walk.gif"
    gif_frames[0].save(gif_p, save_all=True, append_images=gif_frames[1:], duration=165, loop=0, disposal=2)
    print("Saved grand grass parade GIF:", gif_p)


def cmd_face_check(args):
    sh = Image.open(Path(args.sheet).resolve())
    out = Path(args.out).resolve()
    make_face_check_12x(sh, out, label=args.label)
    print("Saved 12x face & eye check:", out)


def cmd_kinematics_check(args):
    sh = Image.open(Path(args.sheet).resolve())
    out = Path(args.out).resolve()
    make_kinematics_check_8x(sh, args.base, out, label=args.label)
    print("Saved 8x walk kinematics check:", out)


def cmd_doll_check(args):
    check_and_warn_llm(getattr(args, "model", ""), "doll-check")
    ok = run_doll_check_slot(Path(args.dir).resolve())
    sys.exit(0 if ok else 1)


def cmd_check_model(args):
    target = args.model_pos or args.model
    check_and_warn_llm(target, "check-model", strict=args.strict)


def main():
    ap = argparse.ArgumentParser(
        description="EasyRPG 24x32 Character Batch Tool (권장 LLM: Carbon · Fable 전용 — 이외 모델은 잘 작동하지 않음)"
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_chk = sub.add_parser("check-model", help="Verify whether an LLM belongs to the recommended Carbon/Fable families")
    p_chk.add_argument("model_pos", nargs="?", default="", help="Model name/id (e.g. gemini-4-carbon, fable-5-2)")
    p_chk.add_argument("--model", default="", help="Model name/id")
    p_chk.add_argument("--strict", action="store_true", help="Exit with code 2 if model is not Carbon or Fable")
    p_chk.set_defaults(func=cmd_check_model)

    p_seed = sub.add_parser("seed", help="Seed isolated per-character workspaces & prompts from batch.json")
    p_seed.add_argument("--spec", required=True)
    p_seed.add_argument("--out", required=True)
    p_seed.add_argument("--clean", action="store_true")
    p_seed.add_argument("--model", default="", help="Authoring LLM id (recommended: Carbon / Fable ONLY)")
    p_seed.set_defaults(func=cmd_seed)

    p_ver = sub.add_parser("verify", help="Run mechanical gates & export chip.png + walk_4dir.gif across batch")
    p_ver.add_argument("--out", required=True)
    p_ver.add_argument("--model", default="", help="Authoring LLM id (recommended: Carbon / Fable ONLY)")
    p_ver.set_defaults(func=cmd_verify)

    p_pack = sub.add_parser("pack", help="Hash-locked pack: requires strict mechanical gate + PASS qa_verdict.json")
    p_pack.add_argument("--out", required=True)
    p_pack.add_argument("--ids", default="")
    p_pack.add_argument("--model", default="", help="Authoring LLM id (recommended: Carbon / Fable ONLY)")
    p_pack.add_argument("--skip-qa-gate", action="store_true", help="Emergency scratch preview only; never use for user delivery")
    p_pack.set_defaults(func=cmd_pack)

    p_qap = sub.add_parser("qa-prep", help="Verify Stage-1 gates and render 7x Final Adversarial Visual QA boards + critic prompt")
    p_qap.add_argument("--out", required=True)
    p_qap.add_argument("--model", default="", help="Authoring LLM id (recommended: Carbon / Fable ONLY)")
    p_qap.set_defaults(func=cmd_qa_prep)

    p_qav = sub.add_parser("qa-verdict", help="Record hash-bound independent Visual QA verdict (PASS/FAIL) for slot(s)")
    p_qav.add_argument("--dir", default="")
    p_qav.add_argument("--out", default="")
    p_qav.add_argument("--json", default="", help="Batch JSON array of {id, verdict, notes}")
    p_qav.add_argument("--verdict", choices=["PASS", "FAIL"], default="PASS")
    p_qav.add_argument("--by", required=True)
    p_qav.add_argument("--notes", default="")
    p_qav.set_defaults(func=cmd_qa_verdict)

    p_face = sub.add_parser("face-check", help="Render 12x face & eye close-up vs official RTP Actor1/People1")
    p_face.add_argument("--sheet", required=True)
    p_face.add_argument("--out", required=True)
    p_face.add_argument("--label", default="Candidate")
    p_face.set_defaults(func=cmd_face_check)

    p_kin = sub.add_parser("kinematics-check", help="Render 8x arm/hand/belly walk kinematics check vs RTP base")
    p_kin.add_argument("--sheet", required=True)
    p_kin.add_argument("--base", required=True)
    p_kin.add_argument("--out", required=True)
    p_kin.add_argument("--label", default="Candidate")
    p_kin.set_defaults(func=cmd_kinematics_check)

    p_doll = sub.add_parser("doll-check", help="Run full gate, motion, face-check, and kinematics-check for a doll12 slot")
    p_doll.add_argument("--dir", required=True)
    p_doll.add_argument("--model", default="", help="Authoring LLM id (recommended: Carbon / Fable ONLY)")
    p_doll.set_defaults(func=cmd_doll_check)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
