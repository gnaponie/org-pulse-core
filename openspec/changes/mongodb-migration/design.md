## Context

Org Pulse is a two-repo system: `org-pulse-core` (npm package providing the app shell, shared server/client code, and the team-tracker module) and consumer repos like `rhai-org-pulse` (which add feature modules). All persistent data currently lives as JSON files in a `data/` directory on a PVC, accessed through a storage abstraction (`readFromStorage`/`writeToStorage`). Core PR #29 made this abstraction async and added `async-mutex` for concurrency safety, but the underlying model is still file-based.

The module context (`buildModuleContext()`) provides shared services to every module: storage, auth, role store, secrets. The database layer would be added as a new service on this context.

There are 10 modules in the consumer repo plus `team-tracker` in core. Some module contributors are non-technical and cannot be expected to operate infrastructure. Multiple consumer repos depend on `@org-pulse/core`.

## Goals / Non-Goals

**Goals:**
- Replace all JSON file storage with MongoDB for core platform data and module data
- Provide a scoped, isolated database API for modules that prevents cross-module data corruption
- Ship a transitional core version where MongoDB is optional, so consumer repos can upgrade at their own pace
- Support zero-setup local development (no containers required) alongside container-based dev
- Auto-migrate existing JSON data to MongoDB on first deployment with rollback safety

**Non-Goals:**
- MongoDB replication or sharding — the IT-managed service handles HA
- Per-module database instances — single shared instance with collection-level isolation
- Migrating external collector processes — they continue to push data via HTTP API
- Building a custom query DSL — modules use standard Mongoose APIs directly

## Decisions

### 1. Mongoose as ODM (over native MongoDB driver)

Mongoose provides schema definitions with validation, declared indexes, middleware hooks, and a managed connection lifecycle. The native driver would require building these patterns manually. Mongoose is the Node.js analog of the dashboard's Beanie ODM, making the pattern familiar to the team.

### 2. Database layer in core (over consumer repo)

The module context is built and frozen inside core's `buildModuleContext()`. For modules to get a DB handle, it must come through this same mechanism. Putting the DB layer in a consumer repo would require forking the startup path or adding a hook mechanism. Core already owns the lifecycle (`startServer`), the module loader, and the context builder.

### 3. Scoped factory `context.db.model()` (over raw connection handle)

Passing the raw Mongoose connection would let any module read/write any collection. The scoped factory automatically prefixes collection names with the module slug (`<slug>__<name>`), enforcing isolation at the API level. This mirrors how `registerRefresh` already scopes handler IDs with `slug + ':' + id`.

### 4. `core__` prefix for platform collections, `<slug>__` for modules

Core registers itself as `'platform'` for roles and scopes, but the repo and package are named `core`. Using `core__` for platform collections (`core__roles`, `core__teams`) and `<slug>__` for module collections (`releases__features`) makes ownership immediately visible in the database. `team-tracker` uses `team-tracker__` despite shipping with core, because it's registered as a module with its own slug.

### 5. HTTP-only cross-module access (over shared-read DB access)

Cross-module writes already go through HTTP. Extending this to reads (replacing the `readFromStorage` shortcut on exported files) creates a uniform model. Giving modules read-only DB access to other modules' collections would create implicit coupling — schema changes in module B could silently break module A's queries.

### 6. `mongodb-memory-server` for demo, tests, AND optional local dev

Demo mode and tests use `mongodb-memory-server` for an ephemeral in-memory MongoDB. For local dev, it's offered as a zero-setup alternative to Podman compose. When `MONGODB_URI` is not set and `DEMO_MODE` is not `true`, `startServer()` spins up `mongodb-memory-server` automatically. This lowers the barrier for non-technical contributors.

### 7. Transitional core version (over hard cutover)

Multiple consumer repos depend on `@org-pulse/core`. A hard cutover (MongoDB required immediately on upgrade) would block adoption. The transitional version makes MongoDB optional: `context.db` is `null` when `MONGODB_URI` is not set, and file-based storage continues to work. A subsequent major version makes MongoDB required.

### 8. IT-managed database service (over self-hosted pod)

Running a standalone MongoDB pod means the org-pulse platform team owns uptime, HA, backups, monitoring, and upgrades. The IT-managed database service (GCADBA) already handles all of this for MongoDB. Using them avoids the platform team becoming a database operations team.

### 9. Drop mutexes, use MongoDB atomics (over keeping both)

The `async-mutex` layer exists because file I/O read-modify-write cycles can interleave. MongoDB's `findOneAndUpdate`, `$set`, `$push`, `$pull` handle single-document atomicity natively. For multi-document operations (like `deleteTeam`), eventual consistency with graceful dangling-ref handling is acceptable — the complexity of requiring a replica set for transactions is not justified.

## Risks / Trade-offs

- **`mongodb-memory-server` downloads a ~100MB MongoDB binary on first use** → Acceptable for dev/test; in CI, the binary can be cached. Production never uses it.
- **Transitional version doubles the supported storage backends temporarily** → The file-based path is already tested and stable; it just stays as-is until Phase 3 removes it. No new code paths for file storage.
- **Auto-migration could fail on unexpected data shapes** → Migration runs against preprod first. JSON files are preserved on PVC as rollback safety — wipe the DB, fix the migration, redeploy.
- **Single shared MongoDB is a single point of failure** → Mitigated by IT-managed service providing HA and backups. Collection-level isolation prevents cross-module impact for data issues.
- **Eventual consistency for multi-document operations** → Only affects a few operations (team delete, bulk assignments). These are admin-triggered, low-frequency actions. Dangling reference cleanup can be handled on read.

## Migration Plan

**Phase 1 (transitional core version):** Add Mongoose, connection lifecycle, `context.db.model()` factory, `mongodb-memory-server` for demo/tests/local dev, Podman compose file, kustomize manifests. MongoDB optional — `context.db` is `null` without `MONGODB_URI`. Publish as new major core version.

**Phase 2 (core store migration):** Migrate stores one by one in separate PRs: role-store, team-store, field-store, audit-log, roster, people metrics, snapshots, contributions, config singletons. Add auto-migration logic. MongoDB becomes required.

A store must be a factory before it can be migrated. The model is injected at start-up via `options.model`, so a store that exports bare functions has nowhere to receive it. `role-store` and `field-store` were already factories; `team-store` was not, and was converted first in its own PR (task 5.5a). Reads and writes must move together — migrating only the writes leaves every caller reading an empty file. Check the shape of a store before estimating its task.

**Phase 3 (cleanup):** Remove `readFromStorage`, `writeToStorage`, `demo-storage.js`, `storage-mutex.js`, `async-mutex`. Publish as another major core version.

Rollback at any phase: JSON files on PVC are never deleted. Wipe MongoDB, revert to previous core version, app starts with file storage.

## Open Questions

- Exact kustomize manifest structure for the IT-managed MongoDB service binding — depends on how GCADBA provisions the connection string (Vault secret, ServiceBinding, or ConfigMap).
- Whether `mongodb-memory-server` should auto-start for local dev or require an explicit flag (e.g., `MONGODB_MEMORY=true`) to avoid surprising developers who have Podman compose running.
