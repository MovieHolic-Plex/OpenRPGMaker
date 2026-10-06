#!/usr/bin/env python3
"""Hostile hero GIF gate. Structural validity never supplies an art score.

Prepare immutable native/GIF evidence, require root AND independent judgments,
then re-read all bytes before returning a shipping verdict. No project writes.
"""
from pathlib import Path
import argparse
from io import BytesIO
import hashlib
import json
import subprocess
import sys
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[4]
RUBRIC = ROOT / 'harness-data/pokemon-character-motion/hero-quality-rubric.json'
FROZEN_RUBRIC_SHA = '2cf097d80cc9d8f17110fcebd21b7493b7320bc101596126cebd5cff66dcd5ec'
ORDER = [0, 1, 2, 1]
ROWS = ['up', 'right', 'down', 'left']


def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def load(file):
    return json.loads(Path(file).read_text())


def write(file, data):
    file = Path(file)
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def visible_pixels(image):
    return tuple(pixel if pixel[3] else (0, 0, 0, 0)
                 for pixel in image.convert('RGBA').get_flattened_data())


def inspect(sheet_file, gif_file):
    require(sha(RUBRIC) == FROZEN_RUBRIC_SHA, 'Frozen rubric changed')
    sheet_bytes = Path(sheet_file).read_bytes()
    gif_bytes = Path(gif_file).read_bytes()
    sheet = Image.open(BytesIO(sheet_bytes)).convert('RGBA')
    require(sheet.size == (48, 128), 'Native atlas must be48x128')
    require(all(p[3] in [0, 255] for p in sheet.get_flattened_data()), 'Nonbinary source alpha')
    colors = {p[:3] for p in sheet.get_flattened_data() if p[3]}
    require(len(colors) <= 15, 'Native palette exceeds15')
    gif = Image.open(BytesIO(gif_bytes))
    require(gif.size == (68, 32), 'GIF must contain all four native directions')
    require(gif.n_frames == 4, 'GIF must contain the complete four-frame cycle')
    require(gif.info.get('loop') == 0, 'GIF must repeat indefinitely')
    decoded, durations = [], []
    for i, column in enumerate(ORDER):
        gif.seek(i)
        frame = gif.convert('RGBA')
        require(all(frame.getpixel((x, y))[3] == 0 for x in [16, 33, 50, 67] for y in range(32)), 'GIF gutters must stay transparent')
        duration = gif.info.get('duration')
        require(isinstance(duration, int) and 80 <= duration <= 180, 'GIF timing outside80..180ms')
        durations.append(duration)
        for row in range(4):
            native = sheet.crop((column*16, row*32, column*16+16, row*32+32))
            actual = frame.crop((row*17, 0, row*17+16, 32))
            require(visible_pixels(native) == visible_pixels(actual),
                    f'GIF frame{i} direction{ROWS[row]} differs from actual native pose')
        decoded.append(frame.copy())
    require(len(set(durations)) == 1, 'Unequal timing requires a separate reviewed profile')
    result = subprocess.run(
        ['node', str(ROOT/'src/harnesses/pokemon-character-motion/node/cli.mjs'),
         'check', '--source', str(Path(sheet_file).resolve())],
        cwd=ROOT, capture_output=True, text=True)
    structural = json.loads(result.stdout)
    require(result.returncode == 0 and structural['pass'], 'Current native structural gate failed')
    require(sha(sheet_file) == hashlib.sha256(sheet_bytes).hexdigest() and sha(gif_file) == hashlib.sha256(gif_bytes).hexdigest(), 'Source changed during inspection')
    return sheet, decoded, {
        'sheetSha256': sha(sheet_file), 'gifSha256': sha(gif_file),
        'rubricSha256': sha(RUBRIC), 'implementationSha256': sha(__file__),
        'decodedFrames': len(decoded), 'durationsMs': durations, 'loop': 0,
        'opaqueColors': len(colors), 'nativeGifPoseComparisons': 16,
        'structuralPass': True, 'structuralWarnings': structural['warnings'],
    }


def contact(sheet, frames, out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    source_contact = Image.new('RGB', (540, 560), '#e8e5d9')
    draw = ImageDraw.Draw(source_contact)
    for row, name in enumerate(ROWS):
        draw.text((8, row*140+8), name, fill='#283b4a')
        for column in range(3):
            native = sheet.crop((column*16, row*32, column*16+16, row*32+32))
            enlarged = native.resize((64, 128), Image.Resampling.NEAREST)
            source_contact.paste(enlarged, (column*170+80, row*140+5), enlarged)
            source_contact.paste(native, (column*170+45, row*140+95), native)
    source_contact.save(out/'native-contact.png')
    decoded_contact = Image.new('RGB', (340, 740), '#e8e5d9')
    draw = ImageDraw.Draw(decoded_contact)
    for i, frame in enumerate(frames):
        draw.text((8, i*185+4), f'GIF decoded frame{i} / native pose{ORDER[i]}', fill='#283b4a')
        large = frame.resize((272, 128), Image.Resampling.NEAREST)
        decoded_contact.paste(large, (20, i*185+25), large)
        decoded_contact.paste(frame, (20, i*185+154), frame)
    decoded_contact.save(out/'decoded-gif-contact.png')
    return [{'file': str((out/name).resolve()), 'sha256': sha(out/name)}
            for name in ['native-contact.png', 'decoded-gif-contact.png']]


def prepare(sheet_file, gif_file, out):
    sheet, frames, measurement = inspect(sheet_file, gif_file)
    evidence = contact(sheet, frames, out)
    package = {**measurement, 'sheet': str(Path(sheet_file).resolve()),
               'gif': str(Path(gif_file).resolve()), 'evidence': evidence,
               'scope': 'Native12poses and all decoded GIF frames. Display enlargement only; no art resampling.'}
    write(Path(out)/'quality-evidence.json', package)
    return package


def check_evidence(evidence):
    require(isinstance(evidence, list) and len(evidence) >= 1, 'Visual evidence missing')
    for item in evidence:
        require(Path(item['file']).is_file() and sha(item['file']) == item['sha256'], 'Visual evidence changed')


def judge(review, measured, independent):
    require(review.get('author') == 'root', 'Declared artist must be root')
    reviewer = review.get('reviewer')
    if isinstance(reviewer, str):
        reviewer = reviewer.strip()
    require(isinstance(reviewer, str) and reviewer.strip(), 'Reviewer missing')
    require((reviewer != 'root') if independent else reviewer == 'root', 'Independent/root reviewers required')
    for key in ['sheetSha256', 'gifSha256', 'rubricSha256', 'decodedFrames', 'durationsMs', 'loop']:
        require(review.get(key) == measured[key], f'Review stale or incomplete: {key}')
    check_evidence(review.get('evidence'))
    require(review.get('allTwelvePosesViewed') is True and review.get('nativeAnd4xViewed') is True, 'Complete native/display observation declaration required')
    require(review.get('verdict') == 'pass', 'Reviewer rejected artwork')
    require(review.get('criticalFailures') == [], 'Critical artwork failure or missing critical review')
    rubric = load(RUBRIC)
    scores = review.get('scores', {})
    require(isinstance(scores, dict), 'Scores must be an object')
    require(set(scores) == {a['id'] for a in rubric['axes']}, 'Every quality axis required')
    total = 0
    for axis in rubric['axes']:
        require(isinstance(scores[axis['id']], dict), 'Axis judgment must be an object')
        score = scores[axis['id']].get('score')
        reason = scores[axis['id']].get('reason')
        require(type(score) is int and 0 <= score <= axis['weight'], 'Invalid axis score')
        require(score >= axis['minimum'], 'Quality axis below minimum: '+axis['id'])
        require(isinstance(reason, str) and len(reason.strip()) >= 15, 'Specific visual reason required')
        total += score
    require(type(review.get('total')) is int and total == review.get('total'), 'Reviewer total does not match axis sum')
    require(total >= rubric['passRule']['minimumTotal'], 'Quality score below85')
    return {'reviewer': reviewer, 'score': total, 'criticalFailures': []}


def gate(package_file, independent_file, root_file, out):
    package = load(package_file)
    _, _, measured = inspect(package['sheet'], package['gif'])
    for key, value in measured.items():
        require(package.get(key) == value, 'Prepared evidence stale: '+key)
    check_evidence(package['evidence'])
    # Recreate the images from the current bytes, so an arbitrary matching file hash cannot replace prepared visual evidence.
    import tempfile
    with tempfile.TemporaryDirectory(prefix='hero-contact-check-') as temporary:
        sheet, frames, _ = inspect(package['sheet'], package['gif'])
        regenerated = contact(sheet, frames, temporary)
        require([e['sha256'] for e in package['evidence']] == [e['sha256'] for e in regenerated], 'Prepared contact images do not depict current native/GIF pixels')
    review_hashes = {str(p): sha(p) for p in [package_file, independent_file, root_file]}
    independent_review, root_review = load(independent_file), load(root_file)
    for review in [independent_review, root_review]:
        require(review.get('observationPackageSha256') == review_hashes[str(package_file)], 'Review does not bind current prepared observation package')
    browser = root_review.get('browserProof')
    require(isinstance(browser, dict), 'Root actual browser playback proof missing')
    check_evidence([browser])
    playback = load(browser['file'])
    require(playback.get('gifSha256') == measured['gifSha256'] and playback.get('errors') == [], 'Browser playback stale or errored')
    checks = playback.get('checks', [])
    require(len(checks) == 2 and {c.get('scale') for c in checks} == {1, 4} and all(c.get('nativePixelsMatch') is True and c.get('distinctNativePoses') == 3 and c.get('samples', 0) >= 12 for c in checks), 'Browser must show exact GIF pixels and all3poses at1x/4x')
    judgments = [judge(independent_review, measured, True), judge(root_review, measured, False)]
    for file, old_hash in review_hashes.items():
        require(sha(file) == old_hash, 'Judgment/package changed during gate')
    for key, file in [('sheetSha256', package['sheet']), ('gifSha256', package['gif']), ('rubricSha256', RUBRIC), ('implementationSha256', __file__)]:
        require(sha(file) == measured[key], 'Gate inputs changed during gate')
    result = {**measured, 'pass': True, 'judgments': judgments,
              'packageSha256': sha(package_file), 'independentReviewSha256': sha(independent_file),
              'rootReviewSha256': sha(root_file), 'evidence': package['evidence'],
              'limitations': 'Hashes bind recorded judgments to actual GIF/PNG bytes; they cannot prove aesthetic truth or authenticate that a reviewer viewed the images.'}
    write(Path(out)/'quality-gate.json', result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', choices=['prepare', 'gate'])
    for key in ['sheet', 'gif', 'pack', 'review', 'root-review', 'out']:
        parser.add_argument('--'+key)
    args = parser.parse_args()
    require(args.out, '--out required')
    if args.stage == 'prepare':
        require(args.sheet and args.gif, '--sheet and --gif required')
        result = prepare(args.sheet, args.gif, args.out)
    else:
        require(args.pack and args.review and args.root_review, '--pack --review --root-review required')
        result = gate(args.pack, args.review, args.root_review, args.out)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, TypeError, KeyError, OSError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
