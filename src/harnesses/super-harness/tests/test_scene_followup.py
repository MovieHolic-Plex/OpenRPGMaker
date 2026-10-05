"""Isolated repair-queue regressions. Never points at the operational SQLite DB."""
import copy
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import art_acceptance
import art_feedback
import art_repair
import scene_followup
import store


class FollowupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.data = self.root / 'data'
        self.data.mkdir()
        for name, value in [('DATA', str(self.data)), ('DB', str(self.data / 'sh.sqlite'))]:
            p = patch.object(store, name, value)
            p.start()
            self.addCleanup(p.stop)
        store.init()
        store.set_setting('paused', 1)
        store.set_setting('max_art_revisions', 10)
        self.cid = 'underground-parking-garage'
        store.add_concept(self.cid, 'Parking', [], 'fixture', 'fixture', 1)
        store.update_concept(self.cid, stage='art-review', status='idle', art_revision=6)
        self.folder = self.data / 'concepts' / self.cid
        self.folder.mkdir(parents=True)
        (self.folder / 'art-acceptance.json').write_text('{"id":"old-small"}')
        source = scene_followup.ROOT / 'harness-data/modern-chipset/parking-wide/followup.json'
        self.request = json.loads(source.read_text())
        for key in ('review', 'binding', 'scene', 'plan', 'acceptance'):
            rel = self.request[key]
            target = self.root / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(scene_followup.ROOT / rel, target)
        self.request_path = self.root / 'followup.json'
        self.request_path.write_text(json.dumps(self.request))
        p = patch.object(scene_followup, 'ROOT', self.root)
        p.start()
        self.addCleanup(p.stop)

    def test_incomplete_pass_queues_once_and_preserves_original(self):
        first = scene_followup.enqueue(self.request_path)
        again = scene_followup.enqueue(self.request_path)
        self.assertEqual(first['revision'], 7)
        self.assertTrue(again['duplicate'])
        self.assertEqual(store.concept(self.cid)['art_revision'], 7)
        self.assertEqual(store.concept(self.cid)['stage'], 'art')
        old = json.loads((Path(first['history']) / 'art-acceptance.json').read_text())
        self.assertEqual(old['id'], 'old-small')
        feedback = json.loads((self.folder / 'art-feedback.json').read_text())
        self.assertEqual(len(art_repair.obligations(feedback)), 4)
        self.assertTrue(all(o['required'] for o in art_repair.obligations(feedback)))
        self.assertEqual(feedback['repairs'][0]['sourceVerdict']['assemblyVerdict'], 'PASS')

    def test_changed_image_does_not_consume_budget_or_replace_contract(self):
        (self.root / self.request['scene']).write_bytes(b'changed after review')
        with self.assertRaisesRegex(ValueError, 'changed after review'):
            scene_followup.enqueue(self.request_path)
        self.assertEqual(store.concept(self.cid)['art_revision'], 6)
        self.assertEqual(json.loads((self.folder / 'art-acceptance.json').read_text())['id'], 'old-small')

    def test_limit_and_missing_order(self):
        self.request['fixes'].pop()
        self.request_path.write_text(json.dumps(self.request))
        with self.assertRaisesRegex(ValueError, 'Every visual limitation'):
            scene_followup.enqueue(self.request_path)
        self.assertEqual(store.concept(self.cid)['art_revision'], 6)
        source = scene_followup.ROOT / self.request['review']
        self.assertTrue(source.is_file())
        # Restore the omitted order from a fresh copy retained by the test setup.
        original = Path(__file__).resolve().parents[4] / 'harness-data/modern-chipset/parking-wide/followup.json'
        self.request_path.write_bytes(original.read_bytes())
        store.update_concept(self.cid, art_revision=10)
        result = scene_followup.enqueue(self.request_path)
        self.assertEqual(result['status'], 'limit-reached')
        self.assertEqual(store.concept(self.cid)['stage'], 'blocked')
        self.assertEqual(store.concept(self.cid)['art_revision'], 10)

    def test_required_comparison_cannot_be_demoted(self):
        request = {'comparisonObligations': [{'id': 'required', 'group': 'parking-kit', 'required': True}],
                   'previousImages': [], 'acceptance': {'contract': {}}}
        comparison = {'status': 'advisory', 'before': 'before ' * 8, 'after': 'after ' * 8, 'evidence': 'evidence ' * 8}
        report = {'verdict': 'PASS', 'comparisons': {'required': comparison}, 'previousImagesSeen': []}
        for status in ('advisory', 'deferred', 'unresolved'):
            comparison['status'] = status
            with self.assertRaises(ValueError):
                art_repair.validate_comparison(report, request, 'parking-kit')
        comparison['status'] = 'resolved'
        art_repair.validate_comparison(report, request, 'parking-kit')

    def test_assembly_pass_cannot_override_incomplete_facility(self):
        acceptance = {'sha256': 'a', 'contract': {'requiresFacilityVerdict': True,
                       'criteria': [{'id': 'structure', 'axes': ['attachments']}]}}
        report = {'acceptanceSha256': 'a', 'criterionResults': {'structure': {'verdict': 'PASS', 'evidence': 'visible joined wall ' * 3}},
                  'checks': {'attachments': {'verdict': 'PASS'}}, 'facilityVerdict': 'INCOMPLETE'}
        with self.assertRaises(ValueError):
            art_acceptance.validate(report, acceptance, ['attachments'])
        report['facilityVerdict'] = 'COMPLETE'
        art_acceptance.validate(report, acceptance, ['attachments'])


if __name__ == '__main__':
    unittest.main()
