# Plan49/50 authorized teardown receipt

Status: **REMOVED**.

Coordinator-approved archive: `08d601403f987c32537cdf61cfb1d22cc72180dd`.
Historical source: `462a7f3425079abc94fefafe2142dfcd5b42b034`. No source/evidence verdict changes.

## Private configuration retention

Both original .env.local files were required to be regular non-symlinks.
Private creation was exclusive, existing backups required byte equality, and
contents and secret hashes were never printed or recorded in evidence.
The retention directory is mode0700; each retained file is mode0600.

- `/home/main/z-project/rpg-zzu/.git/life-full-20260906-env-retention/placement-core.env.local`: mode0600; original/backup byte equality confirmed.
- `/home/main/z-project/rpg-zzu/.git/life-full-20260906-env-retention/placement-core-verify.env.local`: mode0600; original/backup byte equality confirmed.

## Executed Git commands and direct exits

```sh
git -C /home/main/z-project/rpg-zzu-life-full-p4 merge-base --is-ancestor 462a7f3425079abc94fefafe2142dfcd5b42b034 08d601403f987c32537cdf61cfb1d22cc72180dd
```
Direct exit: 0.
```sh
git -C /home/main/z-project/rpg-zzu-life-full-p4 worktree unlock /home/main/z-project/rpg-zzu-life-full-placement-core-verify
```
Direct exit: 0.
```sh
git -C /home/main/z-project/rpg-zzu-life-full-p4 worktree remove /home/main/z-project/rpg-zzu-life-full-placement-core
```
Direct exit: 0.
```sh
git -C /home/main/z-project/rpg-zzu-life-full-p4 worktree remove /home/main/z-project/rpg-zzu-life-full-placement-core-verify
```
Direct exit: 0.
```sh
git -C /home/main/z-project/rpg-zzu-life-full-p4 merge-base --is-ancestor 462a7f3425079abc94fefafe2142dfcd5b42b034 08d601403f987c32537cdf61cfb1d22cc72180dd
```
Direct exit: 0.

## Guards and outcome

Committed archive paths, all populated evidence decodes, old HEAD/branch,
tracked status, ordinary/ignored and physical inventories, owned source bytes,
Git locks and fresh activity indicators were checked before removal.
Coordinator confirms owners st_01a0791b and st_01a0792c complete and idle.
Permission-inaccessible unrelated processes are a visibility limit, not an
active-user finding. Full counts and outcomes are in removal.receipt.json.

Both exact old worktree directories and registry entries are absent.
The producer branch/source reachability, shared dependency directory identity
and private retained files were verified after removal.

Removed-tree allocation before removal: 684384256 bytes.
Observed filesystem free-space delta: 674066432 bytes.
Filesystem delta may include concurrent unrelated activity; it is not an
exclusive attribution of all filesystem changes to this teardown.

Only the two authorized old trees were targeted. No spatial-rights tree,
evidence51, other tree, branch, shared cache or dependency target was removed.
No staging, commit, QA/test/build or source edit occurred. Previous preparation
documents and archived evidence remain unchanged. These receipts are uncommitted.
