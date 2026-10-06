"""Preserve root's actual native viewing and full writer reading, without a pass."""
import datetime
import hashlib
import json
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
E = ROOT / 'verify-shots/battle-monster-fifty'
W = ROOT / 'qa-runs/battle-monster-fifty-wave/candidates'
CASES = [
    ('thousand-year-pine-king', '003', 'after-repair-two', {
        'author_pixels.py': '2c54f2329b33efd66f786391554699f6af101d5b6bbe2296034535344c3af2a9',
        'author_motion.py': '78b36b0714a5ca4851d1721c7e66afd94f56bc8ccef167405189eb79397aba81',
        'author_rest.py': '3f2bd49a65eddf23be479036c13d4d014c853215c76a830bbba24707a2b42c18',
        'author_actions.py': '678df5baa7204ec93457a9dd9a6bf646fef8f39b6bbb4f3484f57787c3b82997',
        'repair_pixels.py': '2e57489ed9e1b8fe7735dc01604c871db50fe076976a5d892263be8a863e1a12',
        'finish_pixels.py': '9d700c17b7eabe9c3d13c27e1b3037c56f0cff63271d042ed1592f586c6eaf00',
        'repair_review.py': '5185f77f5e496c0597c978b1551e4bbd473f2e717783c9605248a05e26606510',
        'repair_direction_crown.py': 'aa4a8881b5e5b0d89d1141e41e6caf79703240ee457ebe64214d342d0f49e985',
        'rebuild.py': '1000644c2ed737accdf5cdd6cad2c55b2fb1b19ef965fd4bad22023ec034200a',
    }, [
        'Actually opened all18 native128 poses at original1632x1272, native1x and nearest2x. Broad layered teal crown, reddish bark, gold screen-right eye/brow/nose and pale root beard retain the tree-elder identity. The dark far arm has limited contrast.',
        'Raised branch hand, spread root stride and branch strike are articulated. Hit bends the connected head/trunk backward and a support root; sleep is a closed-eye crouch with a connected neck and fuller layered crown. Crown/trunk mass and split-bark continuity still vary, as the actual independent rework specifies. Corpse is a wider low needle/log mass.',
        'Foot-origin charge grows into3 connected curling bark stems, then woody fragments. Poison bows and guards the belly with bubbles; stun hangs the arm with stars. Idle and status pairs have small changes. Static native views do not prove live battle timing/contact.',
        'Read all methods and module flow in9 native writer/orchestrator files. Six unchanged original files were already fully read and their exact hashes match; fully read both new repair modules and changed rebuild. Repairs archive their own grids, erase selected rectangles, apply literal rows/overlays and load explicit awake_face_rows.txt x/y clusters. Rebuild calls7 author/repair main functions then the read-only renderer. No procedural body geometry, full-frame transform or tween. Fully read unchanged renderer and new diagnostic viewer; background rectangles and nearest enlargement only affect previews.',
    ]),
    ('abyss-nine-eye-spider', '002', 'after-repair-one', {
        'author.py': 'bec2e6fa3c63f3ed0c6b7d52d8b101089c24178bc43b3ea2fa1731bb9e4b6e3e',
        'repair.py': '13d49528f0d9d0fbc2debc008f0e40e609c98bcedd127386015f3bfcf6499e69',
    }, [
        'Actually opened all18 native128 poses at original1632x1272, native1x and nearest2x. Silver segmented abdomen has upper-left ivory highlights and dark blue/purple underside. Nine small red eyes,8 thin bent legs and paired fangs identify the spider; distant legs and angular joints have limited dark-background contrast.',
        'Windup folds the foreleg; move bends a pushing rear leg; attack advances a forelimb and adjusts fangs but the bite remains weak, as independently flagged. Hit raises the head; corpse is a separate flat collapse. Poison folds the foreleg with bubbles but needs more sick-body deformation. Stars mark drooping stun; sleep curls the body with closed eyes and preserved long forelimb. The actual reviewer found2 stray sleep outline pixels.',
        'Charge and2 purple web forks meet the actual mouth; recovery closes fangs and leaves3 droplets. Rigid abdomen reuse and small idle changes remain. No live collision or timing claim.',
        'Fully read all author.py functions and ordered module corrections, complete repair.py apply/module guard, and entire read-only render.py. The author copies its own literal BODY rows, clears selected part rectangles and writes explicit x/y literal clusters; dead/sleep are separately authored on blank grids. repair.py loads its own original-before-repair snapshot and applies ordered PATCHES/REFINEMENTS to6 named frames; author.py does not import it. No body-shape generator, whole-frame transform or automatic tween. Renderer decodes nativeRGBA, makes diagnostic backgrounds/sheets and8 native GIFs and checks decoded equality without editing native grids.',
    ]),
    ('bronze-cauldron-demon', '001', 'initial', {
        'author.py': 'ca93e0f93ec27f860cafb8d309c7c280091d53412b2e70c20d375329bd8a9d44',
    }, [
        'Actually opened all18 native128 poses at original1632x1272, native1x and nearest2x. Rounded green bronze vessel has gold open rim, near/far handle arms,3 feet, quiet gold face and red tassel. Broad upper-left light and dark right planes give material volume; the far arm is dark and paired changes are modest.',
        'Windup lifts the attached handle fist, move changes the stride, attack extends the fist modestly and recovery lowers it. The actual reviewer requests a clearer punch and removal of shin slivers. Hit droops the face/body; dead lies horizontally with tucked limbs; closed-eye sleep crouches separately. Poison brings a hand toward the mouth with bubbles, stun slumps with stars.',
        'Rim-origin charge develops into2 tall gold/orange flames then3 residual flames; the actual reviewer found one residual flame rooted on the outer rim. Static native views do not establish battle displacement/contact/timing.',
        'Fully read every author.py method and full module call order, including inspected_joint_repairs after make_poses/rest_and_dead/skill/poison/stun. Blank grids receive explicit literal clusters, own rigid original parts are reused selectively, independently authored limb/face/status/dead rows and explicit selected erasures replace changing anatomy. No body primitives, full-frame transform or tween. Fully read render.py: native128 palette decode, nearest diagnostic sheets, explicit8 GIF timelines and actual decoded duration/hash readback; it writes previews rather than native grids.',
    ]),
]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

for monster, round_id, suffix, writers, observations in CASES:
    candidate = W / monster / 'fifty-v1'
    frozen = candidate / 'visual-repairs' / round_id
    q = json.loads((frozen / 'critique-suite.json').read_text())
    j = json.loads((candidate / 'jobs' / q['jobId'] / 'job.json').read_text())
    receipt_path = E / f'native-contact-{monster}.json'
    receipt = json.loads(receipt_path.read_text())
    png = E / f'native-contact-{monster}.png'
    assert q['recommendation'] == 'rework'
    assert q['binding'] == receipt['binding']
    assert j['model'] == q['model'] == 'gpt-6.1-sol'
    assert j['effort'] == q['effort'] == 'high'
    assert j['preparedOnly'] is False and j['exitCode'] == 0 and j['finishedAt']
    assert j['imageHashes'] == q['imageHashes']
    assert receipt['nativePoses'] == 18 and receipt['noSourceWrites']
    assert receipt['boardSize'] == [1632, 1272]
    assert digest(png) == receipt['pngSha256']
    for name, sha in writers.items():
        assert digest(frozen / 'source' / name) == sha, name
    for f in receipt['frames']:
        name = f['pose'] + '.pxgrid'
        paths = [frozen / 'source' / folder / name for folder in ['poses', 'actions']]
        src = next(p for p in paths if p.exists())
        assert digest(src) == f['sourceSha256']
        assert digest(frozen / 'review-images' / (f['pose'] + '.png')) == f['nativePngSha256']
        assert f['rgbaMatchesNativeSource']
    for name, sha in q['imageHashes'].items():
        assert digest(frozen / 'review-images' / pathlib.Path(name).name) == sha
    prefix = f'draft-native-contact-{monster}-{suffix}'
    shutil.copyfile(png, E / (prefix + '.png'))
    shutil.copyfile(receipt_path, E / (prefix + '.json'))
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    doc = {
        'at': now, 'passed': False, 'key': receipt['key'], 'binding': receipt['binding'],
        'nativePosesActuallyViewed': 18,
        'actualUnresizedNativeContact': str((E / (prefix + '.png')).relative_to(ROOT)),
        'nativeContactPngSha256': receipt['pngSha256'], 'nativeWriterFilesRead': writers,
        'observations': observations,
        'actualIndependentRecommendation': q['recommendation'],
        'actualIndependentJob': q['jobId'], 'actualIndependentIssues': q['issues'],
        'preservedBeforeNextRepairSource': str((frozen / 'source').relative_to(ROOT)),
        'claimScope': 'Actual native18 viewing, complete writer/module reading and actual independent rework only. No keeper, Allow, selected archive or completed species claim.',
    }
    write(E / f'root-draft-review-{monster}-{suffix}.json', doc)
    write(E / f'draft-independent-rework-{monster}-{suffix}.json', {
        'at': now, 'passed': False, 'key': receipt['key'], 'actualCritique': q,
        'actualJob': j, 'preservedBeforeNextRepairSource': doc['preservedBeforeNextRepairSource'],
        'rootNative18ReviewOfThisSnapshotClaim': True,
        'claimScope': doc['claimScope'],
    })
    print(json.dumps({'monster': monster, 'binding': q['binding'], 'nativeViewed': 18,
                      'writersRead': len(writers), 'actualReworkIssues': len(q['issues']),
                      'countedAsPassed': False}))
