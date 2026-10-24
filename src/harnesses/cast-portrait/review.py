"""Blind "same artist?" review, repeated N times and aggregated — one reviewer call is too noisy to gate on.

Measured on the Astra professor cg-nat10: one call said 9.5/same artist, three later calls said 5, 7, 5/not same artist,
each with a different winner. So every subject is reviewed N times (default 5) with a fresh call each time, and the gate uses
the median cast-fit score, a majority vote on "same artist", and per-expression defect votes. The thresholds come from
`calibrate-review`: real cast members (each held out of the lineup in turn) must pass, known rejects must fail.

Single-subject packets: the reviewer sees the cast (without the subject), the cast with the subject inserted at a random
position (1x and 3x), and the subject's expressions at 4x. It is never told what the subject is or how it was made.
Endpoint: OpenAI-compatible chat completions with images (default the local Argon queue). Key from $OPRN_LIVE_KEY only.
"""
import base64, concurrent.futures as cf, io, json, os, random, re, statistics, time, urllib.request
from PIL import Image, ImageDraw

URL = os.environ.get('CAST_PORTRAIT_REVIEW_URL', 'http://127.0.0.1:8319/v1/chat/completions')
MODEL = os.environ.get('CAST_PORTRAIT_REVIEW_MODEL', 'gemini-4-argon-high')
BG = (232, 240, 222, 255)


def png_uri(im):
    b = io.BytesIO(); im.convert('RGB').save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def row(ims, s, pad=8, numbers=False):
    W = len(ims) * (ims[0].width * s + pad) + pad; H = max(i.height for i in ims) * s + (22 if numbers else 0) + pad
    out = Image.new('RGBA', (W, H), BG); d = ImageDraw.Draw(out)
    for i, im in enumerate(ims):
        x = pad + i * (ims[0].width * s + pad)
        out.alpha_composite(im.resize((im.width * s, im.height * s), Image.NEAREST), (x, out.height - im.height * s - (22 if numbers else 0) - pad // 2))
        if numbers: d.text((x + 4, out.height - 20), str(i + 1), fill=(0, 0, 0, 255))
    return out


def packet(cast, subject, seed):
    """cast: list of base Images (subject excluded). subject: list of expression Images (base first). Returns (images, position)."""
    rng = random.Random(seed); pos = rng.randrange(len(cast) + 1)
    lined = cast[:pos] + [subject[0]] + cast[pos:]
    return [row(cast, 3, numbers=True), row(lined, 1, 4, numbers=True), row(lined, 3, numbers=True), row(subject, 4)], pos + 1


PROMPT = """You are an independent, strict pixel-art reviewer for a game's dialogue portraits (64x64 busts).
Image 1: the game's existing cast, all drawn by one artist (numbered).
Images 2 and 3: the same cast with ONE more portrait inserted at position {pos} (1x and 3x) — the SUBJECT.
Image 4: the SUBJECT's expressions at 4x, left to right: {exprs}.
You do not know who drew the subject or how it was made.

Question: would the subject stand out as a different hand in this lineup, or is it indistinguishable in style from the cast
(outline colour and weight, palette size and shading steps, eye/nose/mouth construction, hair clustering, framing and head size)?
Check every claim against Image 1: a trait the cast itself shows (slight asymmetry, outline colours, eye sizes) is not a defect.
Then check every expression of the subject for real pixel defects (stray pixels, smears, broken outline, asymmetric eyes,
broken mouth, wrong identity between expressions). Write "none" when an expression has no defect.

Reply with JSON only:
{{"castFit": <1-10>, "sameArtist": <true|false>, "defects": {{{defect_keys}}}, "notes": "<one or two sentences>"}}"""


def call(images, text, timeout=600, tries=3):
    key = os.environ.get('OPRN_LIVE_KEY')
    if not key: raise SystemExit('OPRN_LIVE_KEY is not set (key of the local Argon proxy; never print or commit it)')
    body = {'model': MODEL, 'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': text}] + [{'type': 'image_url', 'image_url': {'url': png_uri(i)}} for i in images]}]}
    last = None
    for k in range(tries):
        try:
            r = urllib.request.urlopen(urllib.request.Request(URL, json.dumps(body).encode(), {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key}), timeout=timeout)
            txt = json.load(r)['choices'][0]['message']['content']
            m = re.search(r'\{.*\}', txt, re.S)
            return json.loads(m.group(0))
        except Exception as e:  # noqa: BLE001 — network / parse; retry
            last = e; time.sleep(10 * (k + 1))
    raise RuntimeError(f'review call failed: {last}')


def review_once(cast, subject, exprs, seed):
    images, pos = packet(cast, subject, seed)
    text = PROMPT.format(pos=pos, exprs=', '.join(exprs), defect_keys=', '.join(f'"{e}": "none|..."' for e in exprs))
    r = call(images, text)
    r['position'] = pos; r['seed'] = seed; r['model'] = MODEL
    return r


def is_none(v): return str(v).strip().lower().rstrip('.') in ('none', 'no', 'no defects', '')


def aggregate(runs, exprs):
    fits = [float(r.get('castFit', 0)) for r in runs]
    same = sum(bool(r.get('sameArtist')) for r in runs)
    defects = {e: sum(not is_none(r.get('defects', {}).get(e, 'none')) for r in runs) for e in exprs}
    return {'n': len(runs), 'scores': fits, 'median': statistics.median(fits), 'min': min(fits), 'max': max(fits),
            'sameArtistVotes': same, 'defectVotes': defects, 'worstDefectVotes': max(defects.values()) if defects else 0}


def decide(agg, th):
    """th = thresholds from calibration: fitMin, sameArtistMin (votes), defectMaxVotes."""
    why = []
    if agg['median'] < th['fitMin']: why.append(f'median fit {agg["median"]} < {th["fitMin"]}')
    if agg['sameArtistVotes'] < th['sameArtistMin']: why.append(f'same-artist votes {agg["sameArtistVotes"]}/{agg["n"]} < {th["sameArtistMin"]}')
    bad = {e: v for e, v in agg['defectVotes'].items() if v > th['defectMaxVotes']}
    if bad: why.append(f'defect votes over {th["defectMaxVotes"]}/{agg["n"]}: {bad}')
    return not why, why


def review_many(cast, subject, exprs, n, seed0, par, log=None):
    with cf.ThreadPoolExecutor(par) as ex:
        futs = [ex.submit(review_once, cast, subject, exprs, seed0 + i) for i in range(n)]
        runs = []
        for f in futs:
            r = f.result(); runs.append(r)
            if log: log(r)
    return runs
