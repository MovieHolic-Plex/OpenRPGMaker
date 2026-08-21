"""dist/se-staging/pcm/*.wav → 스펙트로그램 컨택트 시트 + 청각 특성 수치.

    python scripts/se/analyze-se-audio.py [--staging dist/se-staging] [--filter kjg] [--cols 5] [--rows 6]

왜 필요한가: 라벨을 붙이는 에이전트는 소리를 들을 수 없지만 **이미지는 읽는다**.
스펙트로그램은 소리를 눈으로 볼 수 있게 만든다 — 어택/감쇠 모양, 밝기(스펙트럼 중심),
배음이 있는 악음인지 잡음인지, 그리고 **음높이가 오르는지 내리는지**가 그림에 그대로 나온다.
마지막 항목이 징글의 승리/실패를 가르는 결정적 단서다.

출력:
- audio-sheet-<n>.png  — 타일마다 스펙트로그램 + 파형 + 라벨
- audio-features.json  — 파일별 수치(길이/어택/중심주파수/궤적/배음성)
"""
import argparse, json, os, sys, wave
import numpy as np
from PIL import Image, ImageDraw

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
N_FFT, HOP = 1024, 256
TILE_W, TILE_H, LABEL_H, PAD = 216, 108, 26, 8


def read_mono(path):
    with wave.open(path, 'rb') as w:
        rate = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768.0
    return data, rate


def stft_db(x):
    if len(x) < N_FFT:
        x = np.pad(x, (0, N_FFT - len(x)))
    win = np.hanning(N_FFT).astype(np.float32)
    n = 1 + (len(x) - N_FFT) // HOP
    frames = np.stack([x[i * HOP:i * HOP + N_FFT] * win for i in range(max(1, n))])
    mag = np.abs(np.fft.rfft(frames, axis=1))
    return 20 * np.log10(mag + 1e-8)  # (frames, bins)


def frame_f0(frame, rate, fmin=70.0, fmax=1600.0):
    """자기상관 기반 기본주파수. argmax 빈 추적은 사각파 배음에서 옥타브를 튀어
    +31 반음 같은 헛값을 낸다(실측) — 그래서 스펙트럼 피크가 아니라 주기를 잰다."""
    f = frame - frame.mean()
    n = len(f)
    if np.abs(f).max() < 1e-4:
        return 0.0
    spec = np.fft.rfft(f, n * 2)
    ac = np.fft.irfft(spec * np.conj(spec))[:n]
    if ac[0] <= 0:
        return 0.0
    ac /= ac[0]
    lo, hi = int(rate / fmax), min(n - 1, int(rate / fmin))
    if hi <= lo + 1:
        return 0.0
    seg = ac[lo:hi]
    k = int(np.argmax(seg))
    if seg[k] < 0.25:  # 주기성이 약하면 피치 없음(잡음성)
        return 0.0
    return float(rate / (lo + k))


def onset_count(mag):
    """스펙트럼 플럭스 피크 = 음 이벤트 개수. 몇 음짜리 징글인지 알려준다."""
    flux = np.maximum(0, np.diff(mag, axis=0)).sum(axis=1)
    if len(flux) < 3 or flux.max() <= 0:
        return 0
    f = flux / flux.max()
    thr = max(0.18, float(np.median(f) * 2.5))
    peaks = 0
    last = -99
    for i in range(1, len(f) - 1):
        if f[i] >= thr and f[i] >= f[i - 1] and f[i] > f[i + 1] and i - last >= 4:
            peaks += 1
            last = i
    return peaks


def features(x, rate):
    db = stft_db(x)
    mag = 10 ** (db / 20)
    freqs = np.fft.rfftfreq(N_FFT, 1 / rate)
    energy = mag.sum(axis=1) + 1e-9
    # 프레임별 스펙트럼 중심(밝기).
    centroid = (mag * freqs).sum(axis=1) / energy
    # 음높이는 자기상관으로 잰다. 유성 프레임만 궤적에 쓴다.
    win = np.hanning(N_FFT).astype(np.float32)
    xp = np.pad(x, (0, max(0, N_FFT - len(x))))
    nfr = mag.shape[0]
    peak_hz = np.array([frame_f0(xp[i * HOP:i * HOP + N_FFT] * win, rate) for i in range(nfr)])
    # 소리가 실제로 울리는 프레임만 본다(무음 구간이 궤적을 흐린다).
    loud = energy > energy.max() * 0.08
    if loud.sum() < 3:
        loud = np.ones_like(loud, dtype=bool)
    idx = np.flatnonzero(loud)
    # 궤적은 유성(피치가 잡힌) 프레임만으로 낸다. 하나도 없으면 무피치로 보고한다.
    voiced = np.flatnonzero(loud & (peak_hz > 0))
    if len(voiced) >= 4:
        third = max(1, len(voiced) // 3)
        start_hz = float(np.median(peak_hz[voiced[:third]]))
        end_hz = float(np.median(peak_hz[voiced[-third:]]))
        semitones = float(12 * np.log2((end_hz + 1e-6) / (start_hz + 1e-6)))
        # 옥타브 오검출 보정: |반음| > 19 는 배음 점프로 보고 옥타브 단위로 접는다.
        while abs(semitones) > 19:
            semitones -= 12 * np.sign(semitones)
        voiced_ratio = len(voiced) / max(1, len(idx))
    else:
        start_hz = end_hz = 0.0
        semitones = 0.0
        voiced_ratio = 0.0
    # 배음성: 스펙트럼 평탄도가 낮으면 악음(피치 있음), 높으면 잡음성.
    ref = mag[idx].mean(axis=0) + 1e-9
    flatness = float(np.exp(np.log(ref).mean()) / ref.mean())
    env = np.abs(x)
    attack = float(np.argmax(env) / rate) if len(env) else 0.0
    # 장/단조(조성) 판별은 **의도적으로 넣지 않았다.** Krumhansl-Schmuckler 크로마 상관으로
    # 시도했으나 이 자산에서는 성립하지 않는다(2026-08-21 실측): 징글이 1~6음뿐이라 12음
    # 분포라는 전제가 없고, 사각파 배음이 피치클래스로 접혀 음 1개짜리 클립이 "장조 A" 로
    # 나왔다. 타악 클립도 게이트를 통과했다. 밝다/어둡다는 사람 귀나 음악 오디오로 학습된
    # 모델의 몫이다 — 여기서 추정치를 내면 잘못된 라벨의 근거로 쓰인다.
    return dict(
        onsets=onset_count(mag),
        seconds=round(len(x) / rate, 3),
        attackSeconds=round(attack, 3),
        centroidHz=round(float(np.median(centroid[idx])), 1),
        startHz=round(start_hz, 1), endHz=round(end_hz, 1),
        contourSemitones=round(semitones, 2),
        contour=('무피치' if voiced_ratio < 0.25
                 else '상승' if semitones > 1.5
                 else '하강' if semitones < -1.5 else '평탄'),
        voicedRatio=round(voiced_ratio, 2),
        flatness=round(flatness, 4),
        tonal=bool(flatness < 0.25),
    ), db


def tile(db, x, rate):
    """스펙트로그램(상단) + 파형(하단) 타일."""
    img = Image.new('RGB', (TILE_W, TILE_H), (12, 14, 20))
    spec_h = TILE_H - 26
    # 타일별 피크 기준 정규화. 절대 dB(-70~20)로 매핑하면 이 팩들은 대부분 상단에 몰려
    # 전부 흰색으로 포화된다(1차 시도에서 실측) — 그러면 궤적이 안 보인다.
    d = db - db.max()
    d = np.clip(d, -55, 0)
    d = (d + 55) / 55.0
    d = d ** 1.6  # 약한 성분을 눌러 주선율이 드러나게 한다
    # 주파수축을 로그로 리샘플해 음악적으로 읽히게 한다(저역이 뭉치면 궤적이 안 보인다).
    bins = d.shape[1]
    lo, hi = 2, bins - 1
    log_idx = np.unique(np.geomspace(lo, hi, spec_h).astype(int))
    grid = d[:, log_idx]
    grid = np.array(Image.fromarray((grid * 255).astype(np.uint8)).resize((spec_h, TILE_W), Image.BILINEAR))
    v = grid.T.astype(np.float32) / 255.0
    v = v[::-1, :]  # 저역을 아래로
    # 어두운 남색 → 자홍 → 노랑(inferno 계열). 어두운 배경에서 세기 차가 잘 읽힌다.
    rgb = np.zeros((spec_h, TILE_W, 3), dtype=np.uint8)
    rgb[..., 0] = np.clip(-40 + v * 430, 0, 255)
    rgb[..., 1] = np.clip(-90 + v * 330, 0, 255)
    rgb[..., 2] = np.clip(40 + v * 260 - (v ** 3) * 320, 0, 255)
    img.paste(Image.fromarray(rgb), (0, 0))
    # 파형
    dr = ImageDraw.Draw(img)
    wave_top, wave_h = spec_h + 2, 22
    step = max(1, len(x) // TILE_W)
    for px in range(TILE_W):
        seg = x[px * step:(px + 1) * step]
        if len(seg) == 0:
            continue
        a = float(np.abs(seg).max())
        h = int(a * wave_h / 2)
        mid = wave_top + wave_h // 2
        dr.line([(px, mid - h), (px, mid + h)], fill=(120, 200, 255))
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--staging', default=os.path.join(REPO, 'dist', 'se-staging'))
    ap.add_argument('--filter', default='')
    ap.add_argument('--cols', type=int, default=5)
    ap.add_argument('--rows', type=int, default=6)
    args = ap.parse_args()
    staging = os.path.abspath(args.staging)
    pcm_dir = os.path.join(staging, 'pcm')

    labels = {}
    lp = os.path.join(staging, 'labels.json')
    if os.path.exists(lp):
        for r in json.load(open(lp, encoding='utf-8')):
            labels[r['id']] = r

    names = sorted(f for f in os.listdir(pcm_dir)
                   if f.endswith('.wav') and (args.filter in f if args.filter else True))
    if not names:
        raise SystemExit('pcm 이 없다 — decode-se-pcm.mjs 를 먼저 돌려라')

    feats, tiles = {}, []
    for fn in names:
        rid = fn[:-4]
        x, rate = read_mono(os.path.join(pcm_dir, fn))
        f, db = features(x, rate)
        meta = labels.get(rid, {})
        f['title'] = meta.get('title', rid)
        f['sourceRel'] = meta.get('sourceRel', '')
        feats[rid] = f
        tiles.append((rid, f, tile(db, x, rate)))

    json.dump(feats, open(os.path.join(staging, 'audio-features.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    per = args.cols * args.rows
    sheets = 0
    for s in range(0, len(tiles), per):
        chunk = tiles[s:s + per]
        cw, ch = TILE_W + PAD, TILE_H + LABEL_H + PAD
        sheet = Image.new('RGB', (args.cols * cw + PAD, ((len(chunk) + args.cols - 1) // args.cols) * ch + PAD),
                          (8, 9, 13))
        dr = ImageDraw.Draw(sheet)
        for k, (rid, f, img) in enumerate(chunk):
            cx, cy = PAD + (k % args.cols) * cw, PAD + (k // args.cols) * ch
            sheet.paste(img, (cx, cy))
            # PIL 기본 폰트에 한글 글리프가 없다 — 이미지 위 텍스트는 ASCII 로만 쓴다
            # (1차 시도에서 궤적 단어가 빈칸으로 렌더됐다). 한글 제목은 features JSON 에 있다.
            short = rid.replace('cc0-se-', '').replace('-jingles-jingles-', '-')
            dr.text((cx + 2, cy + TILE_H + 2), short[:38], fill=(210, 215, 225))
            arrow = {'상승': 'UP', '하강': 'DOWN', '평탄': 'FLAT', '무피치': 'unpitched'}[f['contour']]
            dr.text((cx + 2, cy + TILE_H + 13),
                    '%-9s %+5.1fst %5.0fHz %.2fs %s' % (arrow, f['contourSemitones'],
                                                        f['centroidHz'], f['seconds'],
                                                        'tonal' if f['tonal'] else 'noisy'),
                    fill=(150, 160, 180))
        out = os.path.join(staging, 'audio-sheet-%d.png' % (sheets + 1))
        sheet.save(out)
        sheets += 1
        print('  %s  (%d개)' % (os.path.relpath(out, REPO).replace(os.sep, '/'), len(chunk)))

    print('\n%d개 분석 / 시트 %d장' % (len(feats), sheets))
    up = sum(1 for f in feats.values() if f['contour'] == '상승')
    dn = sum(1 for f in feats.values() if f['contour'] == '하강')
    print('  궤적: 상승 %d / 하강 %d / 평탄 %d' % (up, dn, len(feats) - up - dn))
    print('  악음 %d / 잡음성 %d' % (sum(1 for f in feats.values() if f['tonal']),
                                   sum(1 for f in feats.values() if not f['tonal'])))


if __name__ == '__main__':
    main()
