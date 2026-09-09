import assert from "node:assert/strict";
import { LockWait } from "./spatial-sql-lock-wait.mts";
import { ownedConnection, SqlSession } from "./spatial-db-session.mts";
import { rawObject } from "../../src/project/spatial/persistenceWire";

/** Starts exactly one HTTP operation and releases its holder only after a live DB lock proof. */
export async function resumeHttp<T>(holder: SqlSession, contenderPid: string, action: () => Promise<T>) {
  await using observer = new SqlSession();
  const [holderPid] = await holder.query("SELECT pg_backend_pid();");
  assert(holderPid && /^\d+$/.test(holderPid));
  const log = `${ownedConnection().slice(5).split("/socket ")[0]}/postgres.log`;
  using wait = new LockWait(log, contenderPid);
  const order = ["wait_subscription_ready", "http_operation_submitted"];
  // Capture the expected rejection as data immediately, avoiding an unhandled rejection race.
  const statement = action().then(value => ({ kind: "accepted", value } as const),
    (error: unknown) => ({ kind: "rejected", error } as const)).then(result => {
      order.push("same_http_operation_completed"); return result;
    });
  const event = await Promise.race([wait.event, statement.then(() => {
    assert.fail("HTTP operation completed before database-side overlap");
  })]);
  order.push("database_wait_event");
  assert.equal(event.mode, "ShareLock"); assert(/^transaction \d+$/.test(event.identity));
  const [text] = await observer.query(`SELECT jsonb_build_object('holder',h.pid,'contender',c.pid,
    'holderState',h.state,'holderXid',h.backend_xid::text,'contenderState',c.state,
    'sessionUser',c.usename,'waitType',c.wait_event_type,'waitEvent',c.wait_event,
    'query',c.query,'queryStart',c.query_start,'blockers',pg_blocking_pids(c.pid),
    'lockIdentity',w.transactionid::text,'contenderMode',w.mode,'contenderGranted',w.granted,
    'holderMode',l.mode,'holderGranted',l.granted)
    FROM pg_stat_activity h JOIN pg_stat_activity c ON c.pid=${contenderPid}
    JOIN pg_locks w ON w.pid=c.pid AND w.locktype='transactionid'
    JOIN pg_locks l ON l.pid=h.pid AND l.locktype=w.locktype AND l.transactionid=w.transactionid
    WHERE h.pid=${holderPid} AND 'transaction ' || w.transactionid::text='${event.identity}';`);
  assert(text);
  const snapshot = rawObject(JSON.parse(text));
  assert.equal(snapshot.holderState, "idle in transaction");
  assert.equal(snapshot.contenderState, "active");
  assert.equal(snapshot.sessionUser, "authenticator");
  assert.equal(snapshot.waitType, "Lock");
  assert(Array.isArray(snapshot.blockers) && snapshot.blockers.includes(Number(holderPid)));
  assert.equal(snapshot.contenderMode, "ShareLock"); assert.equal(snapshot.contenderGranted, false);
  assert.equal(snapshot.holderMode, "ExclusiveLock"); assert.equal(snapshot.holderGranted, true);
  assert.equal(snapshot.lockIdentity, snapshot.holderXid);
  order.push("live_blocker_verified", "holder_commit_submitted");
  await holder.query("COMMIT;"); order.push("holder_commit_acknowledged");
  const result = await statement;
  return { result, proof: { event, snapshot, order } };
}
