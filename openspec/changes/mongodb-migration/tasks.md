## 1. Database infrastructure in core (Phase 1)

- [x] 1.1 Add `mongoose` and `mongodb-memory-server` to core's `package.json`
- [x] 1.2 Create `shared/server/database.js` with `connectDatabase(options)` and `disconnectDatabase()` — handles Mongoose connection lifecycle, `mongodb-memory-server` fallback when `MONGODB_URI` is not set
- [x] 1.3 Create `shared/server/scoped-db.js` with `createScopedDb(connection, slug)` — returns a frozen object with `model(name, schema)` that prefixes collection names with `<slug>__`
- [x] 1.4 Wire up `connectDatabase()` in core's `server/dev-server.js` `startServer()` — connect early in startup, close on `SIGTERM`/`SIGINT`
- [x] 1.5 Add `db` property to `buildModuleContext()` in `shared/server/module-context.js` — pass `createScopedDb(connection, slug)` for each module; set to `null` when no MongoDB connection (transitional mode)
- [x] 1.6 Update `createTestContext()` in `shared/server/module-context.js` to include a `db` property with a test-compatible scoped model factory
- [x] 1.7 Create Vitest global setup hook (`shared/__tests__/globalSetup.js`) that starts a shared `mongodb-memory-server` instance and exposes the URI via `globalThis`

## 2. Demo mode and fixture seeding

- [x] 2.1 Update demo mode startup path in `dev-server.js` to use `mongodb-memory-server` instead of `demo-storage.js`
- [x] 2.2 Create `shared/server/fixture-seeder.js` — reads fixture JSON files based on `module.json` `fixtures` declarations and inserts into the appropriate namespaced collections
- [x] 2.3 Add `fixtures` field support to module manifest validation (`validate:modules`)
- [x] 2.4 Add `fixtures` declarations to core's `team-tracker` module.json for its fixture files

## 3. Local development setup

- [x] 3.1 Create `docker-compose.yml` (or `compose.yaml`) at project root with MongoDB container, matching default credentials
- [x] 3.2 Update `.env.example` with `MONGODB_URI` and `DB_NAME` entries (commented out with defaults noted)
- [x] 3.3 Update `README.md` quick start section with MongoDB setup options (compose vs auto `mongodb-memory-server`)

## 4. Kustomize deployment manifests

- [x] 4.1 Add MongoDB ConfigMap entry for `DB_NAME` to core's kustomize base
- [x] 4.2 Add Vault secret reference for `MONGODB_URI` to core's kustomize base
- [x] 4.3 Verify consumer repo overlay chain inherits the new manifests

## 5. Core platform models (Phase 2 — in core repo)

- [x] 5.1 Create `shared/server/models/role.js` — Mongoose schema for roles, replacing `role-store.js` storage calls
- [x] 5.2 Migrate `shared/server/role-store.js` to use the Role model, remove `rolesMutex`
- [x] 5.3 Update role-store tests to use `mongodb-memory-server`
- [x] 5.4 Create `shared/server/models/team.js` — Mongoose schema for teams
- [ ] 5.5 Migrate `shared/server/team-store.js` to use the Team model, remove `storageMutexes` and `acquireMultiLock`
- [ ] 5.6 Update team-store tests to use `mongodb-memory-server`
- [x] 5.7 Create `shared/server/models/field-definition.js` — Mongoose schema for field definitions
- [x] 5.8 Migrate `shared/server/field-store.js` to use the FieldDefinition model, remove field mutexes
- [x] 5.9 Update field-store tests to use `mongodb-memory-server`
- [ ] 5.9a Fix `modules/team-tracker/server/migration/field-options-migration.js` — it calls `createFieldStore(storage)` with no model, so it builds its own store that always uses the file path. Once a database is configured, that one file will read and write JSON while the rest of the app uses MongoDB. Must be fixed before cutover. Same trap applies to any other locally-built store instance.
- [ ] 5.10 Create `shared/server/models/audit-entry.js` — Mongoose schema for audit log entries
- [ ] 5.11 Migrate `shared/server/audit-log.js` to use the AuditEntry model, remove `auditMutex`
- [ ] 5.12 Update audit-log tests to use `mongodb-memory-server`
- [ ] 5.13 Create `shared/server/models/config.js` — Mongoose schema for singleton configs (site-config, modules-state, messages)
- [ ] 5.14 Migrate config-related reads/writes across `dev-server.js` and route handlers to use the Config model
- [ ] 5.15 Create `shared/server/models/api-token.js` — Mongoose schema for API tokens
- [ ] 5.16 Migrate `server/api-tokens.js` to use the ApiToken model
- [ ] 5.17 Update api-tokens tests to use `mongodb-memory-server`

## 6. Team-tracker module models (Phase 2 — in core repo)

- [ ] 6.1 Create `modules/team-tracker/server/models/person.js` — Mongoose schema for per-person Jira metrics
- [ ] 6.2 Create `modules/team-tracker/server/models/snapshot.js` — Mongoose schema with `team` and `date` fields
- [ ] 6.3 Create `modules/team-tracker/server/models/registry-entry.js` — Mongoose schema for person-to-team assignments
- [ ] 6.4 Create `modules/team-tracker/server/models/contribution.js` — Mongoose schema for GitHub/GitLab contributions
- [ ] 6.5 Create `modules/team-tracker/server/models/jira-name-map.js` — Mongoose schema for Jira account ID cache
- [ ] 6.6 Migrate team-tracker route handlers and helpers from storage calls to Mongoose models
- [ ] 6.7 Migrate team-tracker refresh handlers (roster sync, Jira sync, GitHub sync, GitLab sync) to Mongoose
- [ ] 6.8 Update all team-tracker server tests to use `mongodb-memory-server`

## 7. Auto-migration logic (Phase 2)

- [ ] 7.1 Create `shared/server/migration.js` — reads `_migrations` collection for version marker, skips if current
- [ ] 7.2 Implement file-to-collection mapping logic — maps JSON file paths to Mongoose models and handles flattening (file-per-entity → documents, maps → individual documents, singletons → `core__config`)
- [ ] 7.3 Integrate migration into `startServer()` — run after Mongoose connects, before module loading
- [ ] 7.4 Write migration tests covering: first-run migration, skip on subsequent runs, file-per-entity flattening, map entry splitting, singleton config grouping
- [ ] 7.5 Guard startup migrations against concurrent execution across replicas — an atomic claim on the `_migrations` collection (e.g. `findOneAndUpdate` upsert acting as a lock) so multiple backend pods starting at once cannot double-run migrations. Applies to `migration.js` AND the role-store's startup migrations (`migrateFromAllowlist`, `migrateEmailDomains`), whose current mutex is in-process only and does not coordinate across pods.
- [ ] 7.6 Ensure `roles.json` is fully migrated into `core__roles` at cutover, including custom non-admin role assignments (not just admins re-seeded via `ADMIN_EMAILS`/allowlist). Add a test asserting no role assignments are lost when migrating an existing file-based roles store to MongoDB.

## 8. Consumer repo module migrations (Phase 2 — in this repo)

- [ ] 8.1 Add `fixtures` declarations to each module's `module.json` (ai-impact, releases, customer-insights, system-health, upstream-pulse, ai-catalyst, okr-hub, product-builds)
- [ ] 8.2 Migrate `ai-impact` module storage calls to `context.db.model()` — create schemas in `modules/ai-impact/server/models/`
- [ ] 8.3 Migrate `releases` module storage calls to `context.db.model()` — create schemas in `modules/releases/server/models/`
- [ ] 8.4 Migrate `customer-insights` module storage calls to `context.db.model()`
- [ ] 8.5 Migrate `system-health` module storage calls to `context.db.model()`
- [ ] 8.6 Migrate `upstream-pulse` module storage calls to `context.db.model()`
- [ ] 8.7 Migrate `ai-catalyst` module storage calls to `context.db.model()`
- [ ] 8.8 Migrate `okr-hub` module storage calls to `context.db.model()`
- [ ] 8.9 Migrate `product-builds` module storage calls to `context.db.model()`
- [ ] 8.10 Migrate `team-tracker` (consumer-side overrides, if any) storage calls
- [ ] 8.11 Update cross-module reads from `readFromStorage` on exported files to HTTP calls to the owning module's API
- [ ] 8.12 Update all module server tests to use `mongodb-memory-server`

## 9. Cleanup (Phase 3 — in core repo)

- [ ] 9.1 Remove `shared/server/storage.js` and `shared/server/demo-storage.js`
- [ ] 9.2 Remove `shared/server/storage-mutex.js`
- [ ] 9.3 Remove `async-mutex` from `package.json`
- [ ] 9.4 Remove `initStorage`/`initDemoStorage` calls from `dev-server.js`
- [ ] 9.5 Remove `storage` from `buildModuleContext()` and `CoreServices` typedef
- [ ] 9.6 Update `createTestContext()` to remove storage mocks
- [ ] 9.7 Remove `export.files` from module manifest schema (cross-module reads now go through HTTP)
- [ ] 9.8 Update `docs/MIGRATION-v3.md` (or create v4) with MongoDB migration guide for consumers
- [ ] 9.9 Update `shared/API.md` to document the new `context.db` API
- [ ] 9.10 Update `docs/MODULES.md` with MongoDB usage guide for module developers
- [ ] 9.11 Publish new major core version
