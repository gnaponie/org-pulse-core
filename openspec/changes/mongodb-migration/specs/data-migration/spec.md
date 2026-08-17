## ADDED Requirements

### Requirement: Automatic startup migration from JSON files
On first startup with an empty MongoDB and a populated `data/` directory, the system SHALL read all existing JSON files and insert them into the appropriate MongoDB collections. The migration SHALL be marked as complete via a version marker in a `_migrations` collection.

#### Scenario: First deployment with existing data
- **WHEN** the server starts with an empty MongoDB and JSON files exist in `data/`
- **THEN** all JSON files are imported into their corresponding MongoDB collections and a migration version marker is written to `_migrations`

#### Scenario: Subsequent startup after migration
- **WHEN** the server starts and the `_migrations` collection contains the current version marker
- **THEN** the migration is skipped and the server starts normally

### Requirement: JSON files preserved after migration
The migration process SHALL NOT delete JSON files from the PVC after importing them into MongoDB. The files serve as a rollback safety net.

#### Scenario: Rollback after failed migration
- **WHEN** a migration fails or produces incorrect data
- **THEN** an operator can wipe the MongoDB database, fix the migration code, redeploy, and the auto-migration runs again from the preserved JSON files

### Requirement: File-per-entity flattening
File-per-entity patterns SHALL be flattened into proper collections. One-file-per-person directories become documents with key fields. Nested directory structures become documents with composite fields.

#### Scenario: People files flattened
- **WHEN** the migration encounters `people/bob_smith.json`
- **THEN** it creates a document in `core__people` (or `team-tracker__people`) with a `name` key field and the file's contents as document fields

#### Scenario: Snapshot files flattened
- **WHEN** the migration encounters `snapshots/{team}/{date}.json`
- **THEN** it creates a document in the snapshots collection with `team` and `date` fields

### Requirement: Map entries become individual documents
JSON files containing maps (like `registry.json`) SHALL have each entry inserted as its own document in the corresponding collection.

#### Scenario: Registry map migration
- **WHEN** the migration encounters `team-data/registry.json` containing a map of person-to-team assignments
- **THEN** each entry becomes a separate document in the registry collection

### Requirement: Singleton configs share a collection
Small singleton config files (site-config, modules-state, messages) SHALL be stored as documents in a single `core__config` collection, keyed by config name.

#### Scenario: Site config migration
- **WHEN** the migration encounters `site-config.json`
- **THEN** it creates a document in `core__config` with a key identifying it as site config

### Requirement: Storage function replacement
All seven remaining storage functions SHALL be replaced with Mongoose operations as each store migrates. `readFromStorage` becomes `Model.findOne()`/`Model.find()`. `writeToStorage` becomes `Model.create()`/`Model.findOneAndUpdate()`. `deleteFromStorage` becomes `Model.deleteOne()`. `listStorageFiles` becomes `Model.find()` with projections. `deleteStorageDirectory` becomes `Model.deleteMany()`. `getFileMtime` is replaced by Mongoose `timestamps: true` providing `updatedAt`. `initStorage` is replaced by `mongoose.connect()`.

#### Scenario: Store uses Mongoose instead of file operations
- **WHEN** a core store (e.g., role-store) is migrated
- **THEN** all `readFromStorage`/`writeToStorage` calls are replaced with Mongoose model operations and the store's tests use `mongodb-memory-server`

### Requirement: Mutexes removed after migration
The `async-mutex` concurrency layer SHALL be removed as each store migrates to MongoDB. MongoDB atomic operations (`findOneAndUpdate`, `$set`, `$push`, `$pull`) replace application-level mutexes.

#### Scenario: Store migration removes mutex
- **WHEN** the role-store is migrated to Mongoose
- **THEN** the `rolesMutex` and its `runExclusive` calls are removed, replaced by atomic MongoDB operations
