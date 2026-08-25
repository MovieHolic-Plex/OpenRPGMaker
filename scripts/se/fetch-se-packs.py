"""CC0 효과음 원본 8팩을 스테이징에 내려받고 목록/메타데이터를 만든다.

    python scripts/se/fetch-se-packs.py [--staging dist/se-staging]

재실행 안전: 같은 크기의 zip 이 이미 있으면 다시 받지 않는다.
Kenney 다운로드 URL 에는 회전하는 해시 경로가 들어 있어 팩 페이지에서 매번 추출한다.

왜 python 인가: 이 레포의 다른 스크립트는 .mjs 지만 (1) zip 컨테이너를 풀어야 하고
Node 에는 내장 unzip 이 없다 (2) WAV 헤더/피크 계산에 `wave` 가 필요하다
(3) 이 환경에 ffmpeg 도 npm 추가 의존성도 없다. 전부 python 표준 라이브러리로 해결된다.
"""
import argparse, json, os, re, struct, sys, hashlib, zipfile, collections
import urllib.request

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
UA = {'User-Agent': 'rpg-zzu-se-fetch/1.0 (+CC0 asset pipeline)'}

# Kenney: 팩 페이지에서 zip 링크를 추출한다(해시 경로가 회전한다).
KENNEY_SLUGS = [
    'interface-sounds', 'ui-audio', 'music-jingles',
    'rpg-audio', 'impact-sounds',
]
# OpenGameArt: 안정적인 직접 링크.
OGA_URLS = {
    'rpg_sound_pack':  'https://opengameart.org/sites/default/files/rpg_sound_pack.zip',
    '80-CC0-RPG-SFX':  'https://opengameart.org/sites/default/files/80-CC0-RPG-SFX_0.zip',
    '100-CC0-SFX':     'https://opengameart.org/sites/default/files/100-CC0-SFX_0.zip',
}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()


def kenney_zip_url(slug):
    page = get('https://kenney.nl/assets/' + slug).decode('utf-8', 'replace')
    m = re.search(r'https://kenney\.nl/media/pages/assets/[^"\']*?\.zip', page)
    if not m:
        raise SystemExit('kenney zip 링크를 못 찾았다: %s' % slug)
    return m.group(0)


# ── 오디오 메타데이터 ────────────────────────────────────────────────────
def pcm_peak_rms(frames, sampwidth):
    """audioop 은 Python 3.13 에서 제거됐다 — 직접 계산한다."""
    import array, math
    if sampwidth == 1:
        vals, full = [b - 128 for b in frames], 128.0
    elif sampwidth == 2:
        a = array.array('h'); a.frombytes(frames[:len(frames) // 2 * 2]); vals, full = a, 32768.0
    elif sampwidth == 3:
        vals = []
        for i in range(0, len(frames) - 2, 3):
            v = frames[i] | (frames[i + 1] << 8) | (frames[i + 2] << 16)
            vals.append(v - 0x1000000 if v & 0x800000 else v)
        full = 8388608.0
    elif sampwidth == 4:
        a = array.array('i'); a.frombytes(frames[:len(frames) // 4 * 4]); vals, full = a, 2147483648.0
    else:
        return None, None
    if not len(vals):
        return None, None
    return (round(max(max(vals), -min(vals)) / full, 4),
            round(math.sqrt(sum(v * v for v in vals) / len(vals)) / full, 4))


def ogg_info(path):
    """첫 페이지에서 코덱/샘플레이트, 마지막 페이지 granulepos 로 길이."""
    with open(path, 'rb') as f:
        head = f.read(64 * 1024)
        if head[:4] != b'OggS':
            return None
        i = head.find(b'\x01vorbis')
        if i >= 0:
            codec, ch = 'vorbis', head[i + 11]
            rate = struct.unpack('<I', head[i + 12:i + 16])[0]
        else:
            i = head.find(b'OpusHead')
            if i < 0:
                return None
            codec, ch, rate = 'opus', head[i + 9], 48000  # opus granule 은 48k 기준
        size = os.path.getsize(path)
        f.seek(max(0, size - 64 * 1024))
        tail = f.read()
        p = tail.rfind(b'OggS')
        if p < 0:
            return None
        granule = struct.unpack('<q', tail[p + 6:p + 14])[0]
        return dict(codec=codec, sampleRate=rate, channels=ch,
                    seconds=round(granule / rate, 3) if rate else None, peak=None, rms=None)


def wav_info(path):
    import wave
    try:
        with wave.open(path, 'rb') as w:
            ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
            frames = w.readframes(n)
    except Exception as e:
        return dict(codec='wav?', sampleRate=None, channels=None, seconds=None,
                    peak=None, rms=None, err=str(e))
    try:
        peak, rms = pcm_peak_rms(frames, sw)
    except Exception:
        peak = rms = None
    return dict(codec='pcm%d' % (sw * 8), sampleRate=sr, channels=ch,
                seconds=round(n / sr, 3) if sr else None, peak=peak, rms=rms)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--staging', default=os.path.join(REPO, 'dist', 'se-staging'))
    args = ap.parse_args()
    staging = os.path.abspath(args.staging)
    zdir, rdir = os.path.join(staging, 'zip'), os.path.join(staging, 'raw')
    os.makedirs(zdir, exist_ok=True)
    os.makedirs(rdir, exist_ok=True)

    urls = {'kenney_' + s: kenney_zip_url(s) for s in KENNEY_SLUGS}
    urls.update(OGA_URLS)

    for name, url in urls.items():
        dest = os.path.join(zdir, name + '.zip')
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            print('건너뜀 %-26s %9d B' % (name, os.path.getsize(dest)))
        else:
            blob = get(url)
            if blob[:4] != b'PK\x03\x04':
                raise SystemExit('zip 이 아니다: %s' % name)
            open(dest, 'wb').write(blob)
            print('받음   %-26s %9d B' % (name, len(blob)))
        with zipfile.ZipFile(dest) as zf:
            zf.extractall(os.path.join(rdir, name))

    rows = []
    for pack in sorted(os.listdir(rdir)):
        for root, dirs, files in os.walk(os.path.join(rdir, pack)):
            dirs[:] = [d for d in dirs if d != '__MACOSX']
            for fn in sorted(files):
                if fn.startswith('._') or fn == '.DS_Store':
                    continue
                ext = os.path.splitext(fn)[1].lower()
                if ext not in ('.wav', '.ogg'):
                    continue
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, os.path.join(rdir, pack)).replace(os.sep, '/')
                info = (ogg_info if ext == '.ogg' else wav_info)(full) or {}
                with open(full, 'rb') as fh:
                    digest = hashlib.sha256(fh.read()).hexdigest()
                rows.append(dict(pack=pack, rel=rel, name=fn, ext=ext,
                                 bytes=os.path.getsize(full), sha256=digest, **info))

    json.dump(rows, open(os.path.join(staging, 'inventory.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('\n오디오 %d개 → %s' % (len(rows), os.path.join(staging, 'inventory.json')))
    by = collections.OrderedDict()
    for r in rows:
        by.setdefault(r['pack'], []).append(r)
    for p, rs in by.items():
        durs = [r['seconds'] for r in rs if r.get('seconds')]
        print('  %-26s %4d개  %.2f~%.2fs  실패 %d'
              % (p, len(rs), min(durs), max(durs), len([r for r in rs if not r.get('seconds')])))
    dup = collections.Counter(r['sha256'] for r in rows)
    print('  내용 중복 그룹: %d' % len([k for k, v in dup.items() if v > 1]))


if __name__ == '__main__':
    main()
