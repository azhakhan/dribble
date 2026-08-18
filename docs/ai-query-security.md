# AI query read-only security

Only SQL submitted by the `run_query` tool in `app/api/chat/route.ts` uses the
AI read-only path. Notebook queries and table edits continue to use `runQuery`,
`runPagedQuery`, and `updateRows`, so their existing write behavior is unchanged.

## Enforcement model

`DatabaseDriver.runAiReadOnlyQuery` is a distinct API. The PostgreSQL
implementation:

1. conservatively accepts exactly one SELECT-family statement, including
   read-only CTEs and EXPLAIN SELECT, while rejecting transaction control, COPY,
   DDL, DML, and writable CTEs;
2. checks out one pool client and starts `BEGIN TRANSACTION READ ONLY`;
3. sets transaction-local `statement_timeout`, `lock_timeout`, and
   `idle_in_transaction_session_timeout` values;
4. submits the AI statement with PostgreSQL's extended query protocol, which
   rejects multiple commands in one Parse message; and
5. commits on success or rolls back on failure, then always releases the client.
   A rollback failure destroys the pooled client and is surfaced rather than
   silently ignored.

The SQL shape check reduces the exposed surface, including PostgreSQL's limited
allowance for writes to temporary tables in read-only transactions. It is not
the primary write-security boundary: PostgreSQL's transaction mode enforces the
restriction against the connected database.

## Residual risk and defense in depth

PostgreSQL read-only transactions prevent database writes to non-temporary
tables, but they cannot guarantee that an arbitrary volatile function is free
of external side effects. For example, a function implemented by an extension
or untrusted procedural language could call an external service even when
invoked by SELECT.

For production defense in depth, configure the saved connection with a
genuinely read-only PostgreSQL role: grant only CONNECT, USAGE on the required
schemas, and SELECT on the intended tables/views; do not grant CREATE,
TEMPORARY, EXECUTE on unsafe functions, or membership in writable roles. The
application transaction boundary should complement, not replace, database
least privilege.

## Tests

`npm test` runs the policy and driver lifecycle tests. The PostgreSQL integration
suite is opt-in so it cannot mutate an arbitrary developer database; point it at
a disposable database to exercise the real server semantics:

```bash
TEST_DATABASE_URL=postgresql://... npm test
```

The integration suite creates uniquely named fixtures, verifies allowed reads,
server transaction settings, rejected mutations, and notebook writes, then
drops its fixtures.
