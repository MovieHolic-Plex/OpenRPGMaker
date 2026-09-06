# HTTP field ID regression

The new shared `field` helper calls `crypto.randomUUID` directly, but
`src/util/id.ts` already supports HTTP contexts where only `getRandomValues`
is available. The regression mounts two real field rows with that platform
surface and checks distinct label/control associations.

Before any fix:

```sh
npm test -- test/eventCommandRemediation/U07/fieldId.test.ts --maxWorkers=1 --reporter=json --outputFile=.omo/evidence/event-command-remediation/U07/http-id-red.json
```

Only randomness availability is substituted. Field construction, ID generation
and DOM label association remain production code. Reuse the existing ID utility;
do not add a new fallback implementation or change persisted IDs.
