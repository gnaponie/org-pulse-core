## Why

Org Pulse stores all persistent data as JSON files on a PVC, accessed through `readFromStorage`/`writeToStorage`. This limits querying across documents, has no built-in atomicity for concurrent writes, and the application-level mutexes added in core PR #29 are workarounds for problems a database solves natively. Moving to MongoDB gives us proper query capabilities, atomic operations, and aligns with the proven pattern already running in the AIPCC Dashboard.

## What Changes

- **BREAKING**: Replace the entire filesystem-based storage layer (`readFromStorage`, `writeToStorage`, `listStorageFiles`, `deleteFromStorage`, `deleteStorageDirectory`, `getFileMtime`) with MongoDB via Mongoose ODM
- **BREAKING**: Remove the `async-mutex` concurrency layer — MongoDB atomic operations replace application-level mutexes
- Add a scoped database factory (`context.db.model(name, schema)`) to the module context, enforcing per-module collection namespacing (`<slug>__<name>`)
- Migrate all core platform stores (roles, teams, registry, roster, people metrics, snapshots, audit log, contributions, configs) to Mongoose models
- Add `mongodb-memory-server` for demo mode, testing, and zero-setup local dev
- Add Docker/Podman compose file for persistent local dev
- Add kustomize deployment manifests for MongoDB infrastructure in org-pulse-core
- Add automatic startup migration that reads existing JSON files from PVC into MongoDB on first run
- Ship a transitional core version where MongoDB is optional before the final breaking version
- Cross-module reads now go through HTTP (like writes already do), replacing the `readFromStorage` shortcut on exported files

## Capabilities

### New Capabilities
- `database-infrastructure`: Mongoose connection lifecycle, scoped `context.db.model()` factory, demo/test support via `mongodb-memory-server`, local dev compose file
- `data-migration`: Automatic startup migration from JSON files to MongoDB, version tracking via `_migrations` collection, rollback safety (files preserved on PVC)
- `module-db-isolation`: Two-layer write safety model — database-level collection namespacing plus API-level gatekeeping for cross-module access

### Modified Capabilities
<!-- No existing specs to modify — this is a greenfield OpenSpec setup -->

## Impact

- **Multi-repo**: Database infrastructure lands in `~/proj/org-pulse-core`; module migrations happen in this repo (`~/proj/rhai-org-pulse`)
- **New dependencies**: `mongoose`, `mongodb-memory-server` added to core's `package.json`
- **Removed dependencies**: `async-mutex` removed from core after full migration
- **Removed APIs**: `readFromStorage`, `writeToStorage`, `listStorageFiles`, `deleteFromStorage`, `deleteStorageDirectory`, `getFileMtime`, `initStorage`, `demo-storage.js`, `storage-mutex.js`
- **New APIs**: `context.db.model(name, schema)` on the module context; Mongoose models for all core platform stores
- **Deployment**: New MongoDB instance provisioned via IT-managed database service; kustomize manifests added to core; `MONGODB_URI` and `DB_NAME` env vars
- **All 10 modules** in this repo plus `team-tracker` in core need storage calls migrated to Mongoose
- **All test files** using storage mocks need updating to use `mongodb-memory-server`
- **Consumer repos** get a transitional core version (MongoDB optional) before the final breaking version
