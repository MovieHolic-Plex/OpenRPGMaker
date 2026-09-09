import assert from 'node:assert/strict';

// Deletion and child-table absence proof are explicit QA evidence, not production rechecks.
export async function deleteOwnedFixture(fixture) {
  const { rest, projectId, commits, ownsTitle } = fixture;
  const rows = await rest('projects', 'GET', undefined, { select: 'project_id,title' });
  assert.equal(rows.length, 1, 'Exactly one run-owned project must exist');
  assert.equal(rows[0].project_id, projectId);
  assert.equal(ownsTitle(rows[0].title), true, 'Positive run ownership required for cleanup');
  assert.equal((await rest('projects', 'DELETE', undefined, { title: `eq.${rows[0].title}` })).length, 1);
  for (const table of ['projects', 'maps', 'tilesets', 'project_commits']) assert.deepEqual(await rest(table, 'GET', undefined, { select: 'project_id' }), []);
  for (const id of commits) assert.deepEqual(await rest('project_changes', 'GET', undefined, { commit_id: `eq.${id}`, select: 'commit_id' }), []);
  return { projectId, kind: 'deleted-and-absence-verified', commitIds: [...commits] };
}
