# Interrupted command

The tooling killed the combined diagnostics-final/app-typecheck shell at its 180-second
limit. Diagnostics completed with exit0 and its receipt was retained. The subsequent
`npm run typecheck:app` had not returned to the synchronous receipt writer, so no child
exit or output is claimed for that interrupted invocation. A process-list check found
no remaining task14 typecheck or receipt writer. This is not a passing typecheck.
