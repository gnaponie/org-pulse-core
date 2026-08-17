## ADDED Requirements

### Requirement: Mongoose connection lifecycle
The system SHALL connect to MongoDB via Mongoose early in the `startServer()` startup sequence and close the connection on `SIGTERM`/`SIGINT`. The connection string SHALL be read from the `MONGODB_URI` environment variable. The database name SHALL be read from the `DB_NAME` environment variable, defaulting to `org-pulse`.

#### Scenario: Startup with MongoDB configured
- **WHEN** `MONGODB_URI` is set
- **THEN** `startServer()` connects to MongoDB before loading modules, and `context.db` is available to all modules

#### Scenario: Startup without MongoDB (transitional mode)
- **WHEN** `MONGODB_URI` is not set and `DEMO_MODE` is not `true`
- **THEN** `startServer()` starts `mongodb-memory-server` as an ephemeral local instance and connects to it, providing `context.db` to modules

#### Scenario: Graceful shutdown
- **WHEN** the process receives `SIGTERM` or `SIGINT`
- **THEN** the Mongoose connection is closed before the process exits

### Requirement: Scoped database factory on module context
The module context SHALL include a `context.db` object with a `model(name, schema)` method. Calling `model(name, schema)` SHALL return a standard Mongoose model bound to a collection named `<module-slug>__<name>`.

#### Scenario: Module registers a model
- **WHEN** a module with slug `releases` calls `context.db.model('features', featureSchema)`
- **THEN** it receives a Mongoose model operating on the `releases__features` collection

#### Scenario: Model reuse within a module
- **WHEN** a module calls `context.db.model('features', schema)` more than once with the same name
- **THEN** it receives the same Mongoose model instance (idempotent)

### Requirement: Core platform models use core prefix
Core platform Mongoose models SHALL use the `core__` collection prefix. The `team-tracker` module SHALL use the `team-tracker__` prefix following the module convention.

#### Scenario: Core platform collection naming
- **WHEN** core registers a model for roles
- **THEN** the collection is named `core__roles`

#### Scenario: Team-tracker collection naming
- **WHEN** team-tracker registers a model for snapshots
- **THEN** the collection is named `team-tracker__snapshots`

### Requirement: Demo mode uses in-memory MongoDB
When `DEMO_MODE` is `true`, the system SHALL use `mongodb-memory-server` instead of requiring an external MongoDB instance. Fixture JSON files SHALL be seeded into the in-memory database on startup.

#### Scenario: Demo mode startup
- **WHEN** `DEMO_MODE` is `true`
- **THEN** an in-memory MongoDB instance starts, fixture data is seeded, and `context.db` is available with the same API as production

#### Scenario: Fixture seeding from module.json
- **WHEN** a module declares fixtures in its `module.json` under a `fixtures` section
- **THEN** the corresponding JSON files are loaded and inserted into the module's namespaced collections on demo startup

### Requirement: Test support via shared in-memory instance
Tests SHALL share a single `mongodb-memory-server` instance across the test run, started once in a Vitest global setup hook. Each test suite SHALL get a unique database name for isolation.

#### Scenario: Test suite isolation
- **WHEN** two test suites run in the same test process
- **THEN** each operates on a separate database, and writes in one suite are not visible in the other

#### Scenario: createTestContext includes db
- **WHEN** a test calls `createTestContext()`
- **THEN** the returned context includes a `context.db` property with the scoped model factory

### Requirement: Local development compose file
A Docker/Podman compose file SHALL be provided to start a MongoDB container for local development. The container credentials SHALL match the default `MONGODB_URI` in the code.

#### Scenario: Local dev with compose
- **WHEN** a developer runs the compose file and starts the app without setting `MONGODB_URI`
- **THEN** the app connects to the local MongoDB container using default credentials

### Requirement: Kustomize deployment manifests
Kustomize manifests for the MongoDB service binding SHALL be included in `org-pulse-core` alongside the existing kustomize layers. This SHALL cover ConfigMap entries for `DB_NAME` and the secret reference for `MONGODB_URI`.

#### Scenario: Consumer repo inherits manifests
- **WHEN** a consumer repo uses the core kustomize overlay chain
- **THEN** the MongoDB ConfigMap and secret references are included in the generated manifests

### Requirement: Mongoose schemas declare indexes
Each Mongoose schema SHALL declare its indexes as part of the schema definition. Mongoose SHALL run `ensureIndexes` on startup to create any missing indexes.

#### Scenario: Index creation on startup
- **WHEN** the application starts and connects to MongoDB
- **THEN** all indexes declared in Mongoose schemas are created if they don't already exist
