"""Native enemy authoring lifecycle. Pixel synthesis and project writes are absent.

Requires Python 3 + Pillow. Each candidate is a separate art workspace; workers
never share an editor checkout or a canonical game project.
"""
import argparse
import base64
from contextlib import contextmanager
import fcntl
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import uuid
import zipfile
from datetime import datetime, timezone
from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[4]
POSES = ('idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead')
EXTRA_POSES = ('skill_a', 'skill_b', 'skill_c', 'poison_a', 'poison_b', 'stun_a', 'stun_b', 'sleep_a', 'sleep_b')
MOTIONS = ('dash', 'hop', 'stomp', 'shoot', 'float', 'swoop', 'breath')
ID = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')


def stamp():
    return datetime.now(timezone.utc).isoformat()


def sha(value):
    return hashlib.sha256(value).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def load(path):
    return json.loads(path.read_text())


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


@contextmanager
def lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError(f'다른 작업이 사용 중: {path}')
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def identifier(value):
    if not value or not ID.fullmatch(value):
        raise ValueError(f'소문자 kebab-case id 필요: {value}')
    return value


class Harness:
    def __init__(self, args):
        self.args = args
        self.seed_path = Path(args.seed).resolve()
        self.seed = load(self.seed_path)
        if self.seed.get('version') != 1 or self.seed['style'].get('poses') != list(POSES):
            raise ValueError('seed version/9자세 순서 오류')
        style = self.seed['style']
        if not 2 <= style['maxColors'] <= 32 or style['effort'] != 'high':
            raise ValueError('maxColors 2..32, effort high 필요')
        self.specs = {}
        resource_ids = set()
        for monster in self.seed['monsters']:
            identifier(monster['id'])
            if monster['id'] in self.specs or monster['resourceId'] in resource_ids:
                raise ValueError('종/resourceId 중복')
            if monster['cell'] not in (64, 96, 128) or monster['motion'] not in MOTIONS:
                raise ValueError('native64/96/128 또는 motion 계약 오류')
            if not isinstance(monster['idleFrameMs'], int) or monster['idleFrameMs'] < 50:
                raise ValueError('idleFrameMs는 50ms 이상의 정수')
            self.specs[monster['id']] = monster
            resource_ids.add(monster['resourceId'])
        self.root = Path(args.root).resolve()
        # A custom candidate root gets its own decisions; it cannot contaminate
        # the committed human decision ledger during experiments.
        default_root = (REPO / 'qa-runs/harnesses/battle-monster').resolve()
        self.ledger_path = (REPO / 'harness-data/battle-monster/ledger.json'
                            if self.root == default_root else self.root / 'ledger.json')

    def directory(self):
        monster = identifier(self.args.monster)
        if monster not in self.specs:
            raise ValueError(f'시드에 종이 없음: {monster}')
        return self.root / monster / identifier(self.args.candidate)

    def expected_brief(self, monster):
        return {'version': 1, 'style': self.seed['style'], 'monster': self.specs[monster],
                'runtime': {'columns': 3, 'rows': 3, 'baseline': self.specs[monster]['cell'] - 4,
                            'alpha': [0, 255], 'facing': 'right', 'minimumEdge': 1}}

    def init(self, directory):
        if directory.exists():
            raise ValueError('후보가 이미 존재함. 새 --candidate를 사용하거나 기존 원본을 직접 고치세요.')
        directory.mkdir(parents=True)
        (directory / 'source/poses').mkdir(parents=True)
        save(directory / 'brief.json', self.expected_brief(directory.parent.name))
        save(directory / 'provenance.json', {'createdAt': stamp(), 'kind': 'new',
                                             'userApproved': False, 'jobs': []})

    def brief(self, directory):
        brief = load(directory / 'brief.json')
        if brief != self.expected_brief(directory.parent.name):
            raise ValueError('시드/제작 계약이 바뀌었습니다. 새 후보로 다시 시작하세요.')
        return brief

    def pixels(self, directory, phase):
        brief = self.brief(directory)
        size = brief['monster']['cell']
        palette_path = directory / 'source/palette.json'
        palette = load(palette_path)
        if not isinstance(palette, dict) or not palette or len(palette) > brief['style']['maxColors']:
            raise ValueError('팔레트 색 수 오류')
        colors = {'.': (0, 0, 0, 0)}
        for symbol, color in palette.items():
            if len(symbol) != 1 or not symbol.isascii() or symbol.isspace() or symbol == '.':
                raise ValueError(f'잘못된 팔레트 기호: {symbol}')
            if not isinstance(color, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', color):
                raise ValueError(f'RGB hex 색 필요: {color}')
            colors[symbol] = tuple(bytes.fromhex(color[1:])) + (255,)
        names = POSES + EXTRA_POSES if phase == 'suite' else POSES if phase == 'poses' else POSES[:1]
        sources = {'brief.json': sha(canonical(brief)), 'source/palette.json': sha(palette_path.read_bytes())}
        frames, geometry, errors = {}, {}, []
        for pose in names:
            path = directory / ('source/poses' if pose in POSES else 'source/actions') / (pose + '.pxgrid')
            rows = path.read_text(encoding='ascii').splitlines()
            if len(rows) != size or any(len(row) != size for row in rows):
                raise ValueError(f'{pose}: {size}×{size} 문자 격자 필요')
            unknown = set(''.join(rows)) - colors.keys()
            if unknown:
                raise ValueError(f'{pose}: 정의되지 않은 색 {sorted(unknown)}')
            image = Image.new('RGBA', (size, size))
            image.putdata([colors[symbol] for row in rows for symbol in row])
            bbox = image.getbbox()
            if bbox is None:
                errors.append(f'{pose}: 빈 그림')
            elif bbox[0] < 1 or bbox[1] < 1 or bbox[2] > size - 1 or bbox[3] > size - 3:
                errors.append(f'{pose}: 투명 테두리/바닥 y{size - 4} 계약을 벗어남 {bbox}')
            used = {image.getpixel((x, y)) for y in range(size) for x in range(size) if image.getpixel((x, y))[3]}
            geometry[pose] = {'bboxExclusive': bbox, 'opaqueColors': len(used), 'rgbaSha256': sha(image.tobytes())}
            frames[pose] = image
            sources[str(path.relative_to(directory))] = sha(path.read_bytes())
        if brief['monster'].get('grounded') and frames['idle_a'].getbbox():
            if frames['idle_a'].getbbox()[3] != size - 3:
                errors.append(f'idle_a: 접지 기준 y{size - 4}에 닿지 않음')
        if len({row['rgbaSha256'] for row in geometry.values()}) != len(names):
            errors.append('완전히 같은 자세가 반복됨')
        color_count = len({frame.getpixel((x, y)) for frame in frames.values()
                           for y in range(size) for x in range(size) if frame.getpixel((x, y))[3]})
        if color_count > brief['style']['maxColors']:
            errors.append('전 자세의 색 합집합이 팔레트 상한을 벗어남')
        binding = sha(canonical({'phase': phase, 'sources': sources}))
        return brief, frames, {'phase': phase, 'binding': binding, 'sources': sources,
                               'frames': geometry, 'errors': errors, 'pass': not errors,
                               'limitations': ['격자·서로 다른 해시는 직접 저작/좋은 그림/자연스러운 동작의 증거가 아님',
                                               '자세 미리보기는 실제 전투 이동·스킬·피해 검증이 아님']}

    def bake(self, directory, phase):
        brief, frames, report = self.pixels(directory, phase)
        output = directory / 'preview' / phase
        output.mkdir(parents=True, exist_ok=True)
        size = brief['monster']['cell']
        names = POSES + EXTRA_POSES if phase == 'suite' else POSES
        sheet = Image.new('RGBA', (size * 3, size * (6 if phase == 'suite' else 3)))
        for index, pose in enumerate(names):
            if pose in frames:
                image = frames[pose]
                image.save(output / (pose + '.png'))
                # Decode actual bytes instead of trusting the encoder call.
                with Image.open(output / (pose + '.png')) as decoded:
                    if decoded.convert('RGBA').tobytes() != image.tobytes():
                        raise ValueError('PNG 재읽기 불일치')
                sheet.paste(image, ((index % 3) * size, (index // 3) * size))
        sheet.save(output / 'sheet.png')
        frames['idle_a'].save(output / 'portrait.png')
        with Image.open(output / 'sheet.png') as decoded:
            for index, pose in enumerate(names):
                if pose in frames:
                    x, y = (index % 3) * size, (index // 3) * size
                    if decoded.crop((x, y, x + size, y + size)).tobytes() != frames[pose].tobytes():
                        raise ValueError('시트 재읽기 불일치')
        # Rectangles and text here are diagnostic backgrounds/labels only.
        # Every source-art pixel above is assigned directly from literal grids.
        columns = 3 if phase in ('poses', 'suite') else 1
        rows = 6 if phase == 'suite' else 3 if phase == 'poses' else 1
        for background in ('light', 'dark', 'checker'):
            board = Image.new('RGB', ((size * 3 + 24) * columns, (size * 4 + 44) * rows), '#808080')
            draw = ImageDraw.Draw(board)
            for index, (pose, image) in enumerate(frames.items()):
                x = (index % columns) * (size * 3 + 24) + 12
                y = (index // columns) * (size * 4 + 44) + 8
                draw.text((x, y), pose + ' / 1x + 3x', fill='#ffffff')
                for scale, offset in ((1, 18), (3, size + 30)):
                    enlarged = image if scale == 1 else image.resize((size * 3, size * 3), Image.Resampling.NEAREST)
                    backdrop = Image.new('RGB', enlarged.size, '#e3dfd6' if background == 'light' else '#242832')
                    if background == 'checker':
                        p = backdrop.load()
                        for yy in range(backdrop.height):
                            for xx in range(backdrop.width):
                                v = 110 if ((xx // (8 * scale)) + (yy // (8 * scale))) % 2 else 155
                                p[xx, yy] = (v, v, v)
                    backdrop.paste(enlarged, (0, 0), enlarged)
                    board.paste(backdrop, (x, y + offset))
            board.save(output / (background + '.png'))
        report['images'] = {str(path.relative_to(directory)): sha(path.read_bytes())
                            for path in sorted(output.glob('*.png'))}
        save(directory / ('check-' + phase + '.json'), report)
        return report

    def ledger(self):
        return load(self.ledger_path) if self.ledger_path.exists() else {'version': 1, 'decisions': []}

    def decision(self, directory, phase, binding):
        latest = self.latest_decision(directory, phase)
        if latest is None:
            return 'pending'
        return latest['choice'] if latest['binding'] == binding else 'stale'

    def latest_decision(self, directory, phase):
        key = str(directory.relative_to(self.root))
        records = [row for row in self.ledger()['decisions'] if row['candidate'] == key and row['phase'] == phase]
        return records[-1] if records else None

    def current_critique(self, directory, phase, report):
        path = directory / ('critique-' + phase + '.json')
        if not path.exists():
            return None
        review = load(path)
        images = {name: digest for name, digest in report['images'].items()
                  if Path(name).name in ('portrait.png', 'light.png', 'dark.png', 'checker.png')}
        if review.get('binding') != report['binding'] or review.get('imageHashes') != images:
            return None
        job_id = review.get('jobId', '')
        try:
            uuid.UUID(job_id)
            job = directory / 'jobs' / job_id
            record = load(job / 'job.json')
            raw = load(job / 'result.json')
            if (record.get('stage') != 'critique' or record.get('phase') != phase
                    or record.get('preparedOnly') is not False or record.get('exitCode') != 0
                    or record.get('imageHashes') != images or record.get('effort') != 'high'
                    or sha((job / 'prompt.md').read_bytes()) != record.get('promptSha256')):
                return None
            if any(raw.get(key) != review.get(key) for key in ('recommendation', 'summary', 'issues')):
                return None
        except (ValueError, OSError, KeyError, TypeError):
            return None
        return review

    def work(self, directory, stage, phase):
        brief = self.brief(directory)
        job_id = str(uuid.uuid4())
        job = directory / 'jobs' / job_id
        job.mkdir(parents=True)
        frozen = None
        if stage == 'author':
            previous = self.latest_decision(directory, phase)
            correction = self.args.note or (previous['note'] if previous and previous['choice'] == 'rework' else None)
            if phase == 'poses':
                idle = self.bake(directory, 'idle')
                if not idle['pass'] or self.decision(directory, 'idle', idle['binding']) != 'keep':
                    raise ValueError('기본 자세의 현재 사용자 keep 선택이 먼저 필요합니다.')
                frozen = idle['binding']
            prompt = (f'You are an original RM2003 enemy pixel artist. Work ONLY in {directory}/source. '
                      'Never edit the repository, game stores, ledger, brief, or other candidates. '
                      'Write literal ASCII palette-index native pixel rows. No image generation, shape rasterization, '
                      'resampling, rotations/translations/interpolation of entire frames or synthesized shading. '
                      'Author coherent silhouettes, volume, material and explicit pixel cluster changes yourself. '
                      f'Contract: {json.dumps(brief, ensure_ascii=False)}\n'
                      'Files: source/palette.json (one ASCII symbol -> #RRGGBB; dot is transparent and absent in palette), '
                      'source/poses/<pose>.pxgrid. Every row and canvas must exactly match cell size. '
                      'All art has 1px transparent border; lowest ink y<=cell-4. For grounded idle_a feet MUST touch exactly y=cell-4. '
                      + ('Create all nine poses and palette as one complete candidate for the user to judge. '
                         'When source grids already exist, revise them according to the user correction. '
                         'Hand-author every changed cluster; keep identity and palette consistent across all nine poses.\n'
                         if phase in ('full', 'complete') else 'Preserve the existing nine core poses and palette.\n' if phase == 'actions' else 'Create only idle_a and palette. This is the user steering checkpoint.\n' if phase == 'idle' else
                         'Preserve palette.json and idle_a byte-for-byte. Hand-author the other eight poses, '
                         'including distinct windup/move/attack/recover/hit/dead anatomy and a readable death pose.\n')
                      + f'User correction: {correction or "follow the silhouette and action brief"}\n'
                      'Save source/AUTHORING.md describing explicit changes and remaining visual problems. '
                      'Do not claim user approval. Do not run tests/gates or write outside source.')
            if phase in ('complete', 'actions'):
                prompt += ('\nAlso hand-author source/actions/<name>.pxgrid: ' + ', '.join(EXTRA_POSES)
                    + '. Same native cell and palette, full character plus literal effect pixels. '
                      'skill_a/b/c are distinct preparation, cast/contact and recovery for this species skill; '
                      'show connected hands/weapons and a characteristic authored effect. '
                      'poison_a/b show sick posture and changing toxic bubbles; stun_a/b show slumped posture '
                      'and differently placed authored stars; sleep_a/b show closed eyes, lowered weapon and breathing. '
                      'No generated letters/text. Statuses must be visually distinct, not palette tints or reused attacks. '
                      'Every frame must differ; preserve transparent margins and y<=cell-4. '
                      'All new source is full literal rows; do not synthesize effects or move whole bodies. '
                      'Save source/TIMING.md describing GIF pose order, holds and skill hand/mouth/weapon anchor.\n')
                if phase == 'actions':
                    frozen = self.pixels(directory, 'poses')[2]['binding']
                    prompt += 'Preserve ALL source/poses and palette.json byte-for-byte; author ONLY source/actions and notes.\n'
            images = []
            if phase == 'poses':
                images = [directory / 'preview/idle/checker.png']
            elif (directory / 'reference.png').exists():
                images = [directory / 'reference.png']
            images += sorted((directory / 'references').glob('*.png'))
            if images:
                prompt += ('\nInspect the attached reference images before authoring. Study readable anatomy, '
                           'silhouette and hand/weapon connections; author original literal pixels. '
                           'References are visual study only, never trace, extract, resample or redistribute them.\n')
        else:
            report = self.bake(directory, phase)
            if not report['pass']:
                raise ValueError('픽셀 검사 실패: ' + '; '.join(report['errors']))
            images = [directory / 'preview' / phase / name for name in ('portrait.png', 'light.png', 'dark.png', 'checker.png')]
            expected_images = {str(path.relative_to(directory)): sha(path.read_bytes()) for path in images}
            prompt = (f'Independent visual reviewer. Do NOT edit art or any existing files. View the four supplied actual PNGs '
                      f'at native 1x and nearest 3x. Contract: {json.dumps(brief, ensure_ascii=False)}. '
                      'Review silhouette/anatomy, volume/material/light, missing outline or transparent holes, '
                      'pose readability and frame continuity, grounded feet, hand/tool connection. '
                      'A geometry PASS is not visual approval. This is a pose preview, not actual battle footage. '
                      + ('The last nine frames are skill preparation/contact/recovery, poison, stun and sleep pairs. '
                         'Check these are distinct readable authored states, not tints or unrelated attacks. '
                         'Check the skill effect is attached to the actual hand, mouth or weapon. '
                         if phase == 'suite' else '')
                      + f'Write ONLY {job}/result.json with schema: '
                      '{"recommendation":"keep|rework", "summary":"specific observations", '
                      '"issues":[{"pose":"idle_a", "x":0,"y":0,"message":"specific pixel repair"}]}. '
                      'Coordinates are native pixels. Mention limits honestly. Do not choose for the user.')
        (job / 'prompt.md').write_text(prompt)
        model = brief['style']['authorModel' if stage == 'author' else 'reviewerModel']
        command = ['codex', 'exec', '--skip-git-repo-check', '--ephemeral',
                   '--sandbox', 'workspace-write', '-C', str(directory),
                   '-m', model, '-c', 'model_reasoning_effort="high"', '--json']
        # Separate reviewer workspace/session; never resume the author's turn.
        if stage == 'critique':
            command[command.index('-C') + 1] = str(job)
        for path in images:
            command += ['-i', str(path)]
        command += ['-']
        record = {'id': job_id, 'stage': stage, 'phase': phase, 'model': model, 'effort': 'high',
                  'startedAt': stamp(), 'preparedOnly': self.args.prepare_only,
                  'command': command, 'promptSha256': sha(prompt.encode()),
                  'toolSha256': sha(Path(__file__).read_bytes()),
                  'imageHashes': {str(path.relative_to(directory)): sha(path.read_bytes()) for path in images}}
        save(job / 'job.json', record)
        if self.args.prepare_only:
            return record
        if stage == 'critique':
            frozen = report['binding']
        with (job / 'events.jsonl').open('w') as events:
            process = subprocess.run(command, input=prompt, text=True, stdout=events, stderr=subprocess.STDOUT)
        record.update({'exitCode': process.returncode, 'finishedAt': stamp()})
        save(job / 'job.json', record)
        provenance = load(directory / 'provenance.json')
        provenance['jobs'].append(record)
        save(directory / 'provenance.json', provenance)
        if process.returncode:
            raise ValueError(f'{stage} 실패. {job}/events.jsonl 확인')
        if stage == 'author':
            if frozen and self.pixels(directory, 'poses' if phase == 'actions' else 'idle')[2]['binding'] != frozen:
                raise ValueError('동작 저작 중 선택한 기본 자세/팔레트가 변함. 이전 선택은 무효입니다.')
            return self.bake(directory, 'suite' if phase in ('complete', 'actions') else 'poses' if phase == 'full' else phase)
        if self.pixels(directory, phase)[2]['binding'] != frozen:
            raise ValueError('검수 중 원본이 바뀜. 결과는 현재 그림에 적용되지 않습니다.')
        result = load(job / 'result.json')
        if result.get('recommendation') not in ('keep', 'rework') or not isinstance(result.get('summary'), str):
            raise ValueError('그림 검수 응답 형식 오류')
        if not isinstance(result.get('issues'), list):
            raise ValueError('그림 검수 좌표 목록 없음')
        for issue in result['issues']:
            if issue.get('pose') not in report['frames'] or not isinstance(issue.get('message'), str):
                raise ValueError('검수 자세/수정 지시 오류')
            if any(not isinstance(issue.get(axis), int) or not 0 <= issue[axis] < brief['monster']['cell'] for axis in ('x', 'y')):
                raise ValueError('검수 좌표 오류')
        result.update({'binding': frozen, 'phase': phase, 'imageHashes': expected_images,
                       'jobId': job_id, 'model': model, 'effort': 'high', 'finishedAt': stamp(),
                       'userApproved': False})
        save(directory / ('critique-' + phase + '.json'), result)
        return result

    def decide(self, directory):
        report = self.bake(directory, self.args.phase)
        if self.args.binding != report['binding']:
            raise ValueError('현재 그림 해시가 화면/선택 요청과 다름. review로 다시 확인하세요.')
        if not self.args.by or not self.args.note:
            raise ValueError('--by 사용자와 --note 선택/수정 원문이 필요합니다.')
        if self.args.choice == 'keep':
            if not report['pass'] or not self.current_critique(directory, self.args.phase, report):
                raise ValueError('keep 전에 현재 그림의 픽셀 검사와 독립 그림 검수가 필요합니다.')
            if self.args.phase == 'poses':
                idle = self.bake(directory, 'idle')
                if self.decision(directory, 'idle', idle['binding']) != 'keep':
                    raise ValueError('기본 자세 선택이 현재 그림에 유효하지 않습니다.')
        with lock(self.ledger_path.with_suffix('.lock')):
            ledger = self.ledger()
            row = {'candidate': str(directory.relative_to(self.root)), 'phase': self.args.phase,
                   'choice': self.args.choice, 'binding': report['binding'], 'by': self.args.by,
                   'note': self.args.note, 'at': stamp()}
            ledger['decisions'].append(row)
            save(self.ledger_path, ledger)
        return row

    def candidates(self):
        return sorted(path.parent for path in self.root.glob('*/*/brief.json'))

    def status(self, directory):
        row = {'id': directory.parent.name, 'candidate': directory.name, 'phases': {}}
        phases = ('idle', 'poses', 'suite') if any((directory / 'source/actions').glob('*.pxgrid')) else ('idle', 'poses')
        for phase in phases:
            try:
                report = self.bake(directory, phase)
                review = self.current_critique(directory, phase, report)
                row['phases'][phase] = {'binding': report['binding'], 'pixelPass': report['pass'],
                                        'errors': report['errors'], 'decision': self.decision(directory, phase, report['binding']),
                                        'critique': review,
                                        'critiqueState': 'current' if review else 'stale' if (directory / ('critique-' + phase + '.json')).exists() else 'pending'}
            except (ValueError, OSError, KeyError) as error:
                row['phases'][phase] = {'unavailable': str(error)}
        return row

    def review(self):
        data = []
        for directory in self.candidates():
            with lock(directory / '.lock'):
                row = self.status(directory)
                brief = self.brief(directory)
                row.update({'name': brief['monster']['name'], 'cell': brief['monster']['cell'],
                            'motion': brief['monster']['motion'], 'idleFrameMs': brief['monster']['idleFrameMs'],
                            'silhouette': brief['monster']['silhouette']})
                for phase in ('idle', 'poses'):
                    sheet = directory / 'preview' / phase / 'sheet.png'
                    if 'unavailable' not in row['phases'][phase] and sheet.exists():
                        row['phases'][phase]['sheet'] = 'data:image/png;base64,' + base64.b64encode(sheet.read_bytes()).decode()
                data.append(row)
        template = (Path(__file__).parent / 'review.html').read_text()
        fragment = template.replace('/* CANDIDATE_DATA */[]', json.dumps(data, ensure_ascii=False).replace('<', '\\u003c'))
        out = Path(self.args.out).resolve() if self.args.out else self.root / 'review.html'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(fragment)
        standalone = out.with_name(out.stem + '.standalone.html')
        standalone.write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
                              '<title>전투 몬스터 도트 검토</title><style>body{max-width:960px;margin:24px auto;padding:16px;'
                              'font:16px system-ui;color:#302e28;background:#f6f2e8}button,select{font:inherit;padding:8px}'
                              'button[aria-pressed=true]{outline:2px solid currentColor}</style>' + fragment + '</html>')
        return {'candidates': len(data), 'fragment': str(out), 'standalone': str(standalone)}

    def review_coverage(self, directory, reports):
        """An actual larger review covers exact source subsets, without fake reviews."""
        current = {phase: self.current_critique(directory, phase, report)
                   for phase, report in reports.items()}
        coverage = {}
        for phase, report in reports.items():
            for reviewed_phase in ('suite', 'poses', 'idle'):
                reviewed = reports.get(reviewed_phase)
                review = current.get(reviewed_phase)
                if (review and reviewed['pass'] and all(reviewed['sources'].get(path) == digest
                                                       for path, digest in report['sources'].items())):
                    coverage[phase] = {'reviewedPhase': reviewed_phase, 'jobId': review['jobId'],
                                       'binding': reviewed['binding'], 'sources': report['sources']}
                    break
        return coverage

    def pack(self, directory):
        phases = ('idle', 'poses', 'suite') if all((directory / 'source/actions' / (p + '.pxgrid')).exists() for p in EXTRA_POSES) else ('idle', 'poses')
        reports = {phase: self.bake(directory, phase) for phase in phases}
        coverage = self.review_coverage(directory, reports)
        for phase, report in reports.items():
            if not report['pass'] or self.decision(directory, phase, report['binding']) != 'keep':
                raise ValueError(f'{phase}: 현재 사람 선택/픽셀 검사 없음. 선택되지 않은 후보는 팩에 넣지 않습니다.')
            if phase not in coverage:
                raise ValueError(f'{phase}: 현재 독립 그림 검수 없음')
        brief = self.brief(directory)
        monster = brief['monster']
        from motions import bake_motions
        _, frames, _ = self.pixels(directory, 'suite' if 'suite' in reports else 'poses')
        motions = bake_motions(directory, brief, frames)
        asset_dir = 'assets/harnesses/battle-monster/' + monster['id']
        metadata = {'resourceId': monster['resourceId'], 'path': asset_dir + '/sheet.png',
                    'portraitPath': asset_dir + '/portrait.png', 'cell': monster['cell'],
                    'motion': monster['motion'], 'idleFrameMs': monster['idleFrameMs'],
                    'motions': [{**m, 'gif': asset_dir + '/motions/' + m['id'] + '.gif',
                                'poster': asset_dir + '/motions/' + m['id'] + '.png'}
                                for m in motions if m['available']]}
        out = Path(self.args.out).resolve() if self.args.out else self.root / 'packs' / (monster['id'] + '-' + directory.name + '.zip')
        out.parent.mkdir(parents=True, exist_ok=True)
        if out.exists():
            raise ValueError('팩 파일이 이미 있음. 다른 --out을 사용하세요.')
        key = str(directory.relative_to(self.root))
        decisions = [row for row in self.ledger()['decisions'] if row['candidate'] == key]
        with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(directory.rglob('*')):
                if (path.is_file() and not path.is_relative_to(directory / 'references')
                        and path.suffix in ('.pxgrid', '.json', '.md', '.png', '.gif')):
                    archive.write(path, 'provenance/' + str(path.relative_to(directory)))
            archive.write(directory / 'preview/poses/sheet.png', asset_dir + '/sheet.png')
            archive.write(directory / 'preview/poses/portrait.png', asset_dir + '/portrait.png')
            for path in sorted((directory / 'preview/motions').glob('*')):
                if path.suffix in ('.gif', '.png', '.json'):
                    archive.write(path, asset_dir + '/motions/' + path.name)
            archive.writestr('sheets.json', json.dumps([metadata], ensure_ascii=False, indent=2))
            archive.writestr('decisions.json', json.dumps(decisions, ensure_ascii=False, indent=2))
            archive.writestr('review-coverage.json', json.dumps(coverage, ensure_ascii=False, indent=2))
            archive.writestr('README.md', 'Original native-grid monster art. Source provenance and human choices included.\n'
                             'Register sheets.json in pixelEnemySheets/pixelEnemyPortraits through the owning shared asset pack.\n'
                             'This ZIP does not install assets or create enemy/skill records. Runtime movement, skill contact, '
                             'HP/state/reward and canonical save/reload must be verified separately.\n')
        with zipfile.ZipFile(out) as archive:
            if archive.testzip() is not None:
                raise ValueError('ZIP 재읽기 실패')
        return {'zip': str(out), 'sha256': sha(out.read_bytes()), 'sheets': [metadata], 'projectModified': False}

    def run(self):
        stage = self.args.stage
        if stage == 'pilot':
            results = []
            source = REPO / self.seed['pilotSource']
            for monster in self.specs.values():
                if not (source / (monster['id'] + '.palette.json')).exists():
                    continue  # New species are authored by wave, never fabricated as pilot copies.
                directory = self.root / monster['id'] / 'baseline'
                if not directory.exists():
                    self.init(directory)
                    with lock(directory / '.lock'):
                        shutil.copyfile(source / (monster['id'] + '.palette.json'), directory / 'source/palette.json')
                        for pose in POSES:
                            shutil.copyfile(source / monster['id'] / (pose + '.pxgrid'), directory / 'source/poses' / (pose + '.pxgrid'))
                        prior_review = REPO / monster.get('origin', '')
                        if prior_review.is_file():
                            shutil.copyfile(prior_review, directory / 'source/PRIOR-AUTHOR-REVIEW.md')
                        save(directory / 'provenance.json', {'createdAt': stamp(), 'kind': 'pilot-copy',
                                                             'originalSource': self.seed['pilotSource'],
                                                             'priorAuthorReview': monster.get('origin'),
                                                             'userApproved': False, 'jobs': []})
                with lock(directory / '.lock'):
                    results.append(self.status(directory))
            return results
        if stage == 'review':
            return self.review()
        if stage == 'status':
            results = []
            for directory in self.candidates():
                with lock(directory / '.lock'):
                    results.append(self.status(directory))
            return results
        directory = self.directory()
        if stage in ('init', 'ingest'):
            self.init(directory)
        if not directory.exists():
            raise ValueError('init/pilot/ingest로 후보를 먼저 만드세요.')
        with lock(directory / '.lock'):
            if stage == 'ingest':
                if not self.args.source or not self.args.palette:
                    raise ValueError('ingest에는 --source 격자 폴더와 --palette JSON 필요')
                source = Path(self.args.source).resolve()
                shutil.copyfile(self.args.palette, directory / 'source/palette.json')
                for pose in POSES:
                    path = source / (pose + '.pxgrid')
                    if path.exists():
                        shutil.copyfile(path, directory / 'source/poses' / path.name)
                if self.args.phase == 'suite':
                    (directory / 'source/actions').mkdir(parents=True, exist_ok=True)
                    for pose in EXTRA_POSES:
                        shutil.copyfile(source.parent / 'actions' / (pose + '.pxgrid'),
                                        directory / 'source/actions' / (pose + '.pxgrid'))
                for name in ('AUTHORING.md', 'TIMING.md'):
                    note = source.parent / name
                    if note.is_file():
                        shutil.copyfile(note, directory / 'source' / name)
                save(directory / 'provenance.json', {'createdAt': stamp(), 'kind': 'imported-literal-grid',
                                                     'originalSource': str(source), 'userApproved': False, 'jobs': []})
                return self.bake(directory, self.args.phase)
            if stage == 'init':
                return {'candidate': str(directory), 'brief': self.brief(directory)}
            if stage in ('author', 'critique'):
                return self.work(directory, stage, self.args.phase)
            if stage == 'check':
                return self.bake(directory, self.args.phase)
            if stage == 'decide':
                return self.decide(directory)
            if stage == 'pack':
                return self.pack(directory)
        raise ValueError(f'알 수 없는 단계: {stage}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', choices=('pilot', 'init', 'author', 'ingest', 'check', 'critique', 'review', 'decide', 'pack', 'status'))
    parser.add_argument('--seed', default=str(REPO / 'harness-data/battle-monster/seed.json'))
    parser.add_argument('--root', default=str(REPO / 'qa-runs/harnesses/battle-monster'))
    parser.add_argument('--monster')
    parser.add_argument('--candidate', default='baseline')
    parser.add_argument('--phase', choices=('idle', 'poses', 'full', 'suite', 'complete', 'actions'), default='idle')
    parser.add_argument('--prepare-only', action='store_true')
    parser.add_argument('--source')
    parser.add_argument('--palette')
    parser.add_argument('--choice', choices=('keep', 'rework', 'discard'))
    parser.add_argument('--binding')
    parser.add_argument('--by')
    parser.add_argument('--note')
    parser.add_argument('--out')
    args = parser.parse_args()
    if args.phase in ('full', 'complete', 'actions') and args.stage != 'author':
        parser.error('--phase full/complete/actions는 author 전용입니다.')
    if args.stage == 'decide' and not args.choice:
        parser.error('decide에는 --choice 필요')
    try:
        result = Harness(args).run()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if args.stage in ('check', 'author', 'ingest') and result.get('pass') is False:
            return 1
        return 0
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
