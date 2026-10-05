"""Encode literal source frames as native GIFs. No art synthesis or tweening."""
from PIL import Image
import json

SCENES = (
    ('idle', '대기', ('idle_a', 'idle_b', 'idle_c', 'idle_b'), None),
    ('attack', '공격', ('idle_a', 'windup', 'move', 'attack', 'recover', 'idle_a'), (600, 200, 100, 120, 220, 900)),
    ('hit', '피격', ('idle_a', 'hit', 'idle_a'), (700, 180, 900)),
    ('dead', '쓰러짐', ('idle_a', 'hit', 'dead'), (700, 150, 1700)),
    ('skill', '스킬', ('idle_a', 'skill_a', 'skill_b', 'skill_c', 'idle_a'), (700, 260, 160, 240, 900)),
    ('poison', '독', ('poison_a', 'poison_b'), (420, 420)),
    ('stun', '기절', ('stun_a', 'stun_b'), (300, 300)),
    ('sleep', '수면', ('sleep_a', 'sleep_b'), (650, 650)),
)


def bake_motions(directory, brief, frames):
    output = directory / 'preview/motions'
    output.mkdir(parents=True, exist_ok=True)
    # Exact authored RGB values; transparency has its own palette entry.
    colors = sorted({pixel[:3] for im in frames.values() for pixel in im.getdata() if pixel[3]})
    lookup = {rgb: index + 1 for index, rgb in enumerate(colors)}
    palette = [0, 0, 0] + [value for rgb in colors for value in rgb]
    palette += [0] * (768 - len(palette))
    indexed = {}
    for name, im in frames.items():
        result = Image.new('P', im.size)
        result.putpalette(palette)
        result.putdata([lookup[p[:3]] if p[3] else 0 for p in im.getdata()])
        result.info['transparency'] = 0
        indexed[name] = result
    result = []
    for name, label, sequence, timing in SCENES:
        if name == 'idle' and 'idle_a' in frames and not all(p in frames for p in sequence):
            sequence = ('idle_a',)  # An idle-only candidate still shows its actual image.
        available = all(pose in frames for pose in sequence)
        item = {'id': name, 'label': label, 'available': available}
        if available:
            durations = list(timing) if timing else [brief['monster']['idleFrameMs']] * len(sequence)
            # GIF represents time in centiseconds; snap intentionally.
            durations = [max(10, round(ms / 10) * 10) for ms in durations]
            path = output / (name + '.gif')
            first = indexed[sequence[0]]
            first.save(path, save_all=True, append_images=[indexed[p] for p in sequence[1:]],
                       duration=durations, loop=0, transparency=0, disposal=2, optimize=False)
            representative = {'attack': 'attack', 'hit': 'hit', 'dead': 'dead', 'skill': 'skill_b'}.get(name, sequence[0])
            frames[representative].save(output / (name + '.png'))
            with Image.open(path) as decoded:
                if decoded.n_frames != len(sequence):
                    raise ValueError('GIF 프레임 재읽기 불일치: ' + name)
                for index, pose in enumerate(sequence):
                    decoded.seek(index)
                    if decoded.info.get('duration') != durations[index]:
                        raise ValueError('GIF 노출 시간 재읽기 불일치: ' + name)
                    if decoded.convert('RGBA').tobytes() != frames[pose].tobytes():
                        raise ValueError('GIF 픽셀 재읽기 불일치: ' + name)
            item.update({'frames': len(sequence), 'durationMs': sum(durations),
                         'sequence': list(sequence), 'durations': durations})
        result.append(item)
    (output / 'timing.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return result
