## ADDED Requirements

### Requirement: Collection namespacing prevents cross-module access
The `context.db.model()` factory SHALL be the only database handle a module receives. A module SHALL NOT be able to create or access collections outside its own `<slug>__` namespace. There SHALL be no escape hatch or way to obtain a raw connection.

#### Scenario: Module cannot access another module's collection
- **WHEN** module `ai-impact` attempts to query data
- **THEN** it can only access collections prefixed with `ai-impact__`; it has no API to reach `releases__features` or any other module's collections

#### Scenario: No raw connection exposed
- **WHEN** a module inspects `context.db`
- **THEN** only the `model(name, schema)` factory is available; the underlying Mongoose connection is not exposed

### Requirement: Cross-module reads go through HTTP
When module A needs data owned by module B, the request SHALL go through module B's HTTP API endpoints. Direct database access to another module's collections is not permitted.

#### Scenario: Module reads another module's data
- **WHEN** ai-impact needs feature data owned by releases
- **THEN** ai-impact makes an HTTP request to `GET /api/modules/releases/...` and receives the data through the API

### Requirement: Cross-module writes go through HTTP with validation
When module A needs to write data owned by module B, the request SHALL go through module B's HTTP API endpoints. Module B validates the input and decides whether to accept the write.

#### Scenario: Module writes to another module's data
- **WHEN** ai-impact pushes review data to releases
- **THEN** ai-impact calls `POST /api/modules/releases/execution/ai-review/bulk` and releases validates and writes the data to its own collections

#### Scenario: Invalid cross-module write is rejected
- **WHEN** a module sends malformed data to another module's write endpoint
- **THEN** the owning module's validation rejects the request and returns an error; no data is written

### Requirement: Module schema ownership
Each module SHALL define its own Mongoose schemas in its `server/models/` directory. Module contributors SHALL NOT need to touch core code or coordinate with other module authors to define their data models.

#### Scenario: Module contributor adds a new model
- **WHEN** a releases module contributor needs a new collection
- **THEN** they create a schema in `modules/releases/server/models/`, call `context.db.model('new-collection', schema)`, and the collection `releases__new-collection` is created automatically

### Requirement: External collectors use API boundary
External collectors (processes in separate pods/namespaces) SHALL continue to push data via the app's HTTP API endpoints. No external process SHALL require direct MongoDB access.

#### Scenario: External collector writes data
- **WHEN** an external collector has new data for the releases module
- **THEN** it calls the releases module's bulk API endpoint, and the backend handler writes to MongoDB; the collector never connects to MongoDB directly
