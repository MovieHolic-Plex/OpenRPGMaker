# Composed storage regression

This supplements, rather than replaces, the per-unit authoring RED/GREEN and
browser/player evidence. It performs no new production fix and makes no claim
that every command executes in every storage context.

Run:

```sh
npm test -- test/eventCommandRemediationStorage.test.ts --maxWorkers=2 --reporter=json --outputFile=.omo/evidence/event-command-remediation/aggregates/storage.json
```

One project contains the repaired shop message variants, explicit and omitted
picture waits, variable EXP, loop text metadata, conditional target/value data,
transfer settings, false movie flags, follower intent and named text codes.
Identical payloads are stored in map-page, common-event and troop-page containers.

The production codec must preserve authored data, meaningful omissions and
unrelated records. A second roundtrip must be identical to the normalized first.
Existing per-unit tests remain responsible for the edits that produce these
payloads and for their actual runtime effects.
