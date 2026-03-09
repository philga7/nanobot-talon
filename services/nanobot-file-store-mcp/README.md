# nanobot-file-store-mcp

File-backed document store MCP server for NanoBot / WrenAir.

This MCP server manages logical documents (journals, todos/projects, news notes, portfolio snapshots, and future mini apps) on disk under a single root directory. Tools operate on `{ app, id, docType }` rather than raw file paths and enforce a sandboxed, convention-based layout.

## Data root

The data root is configured via environment variable:

- `OPENCLAW_DATA_ROOT` (preferred)
- `NANOBOT_FILE_STORE_ROOT` (fallback)

If neither is set, it defaults to `~/.nanobot-file-store`.

All files are stored under this root; tools will reject any attempt to escape this directory.

## Path conventions (initial)

The server maps logical documents to relative paths using `app`, `id`, `docType`, and (for daily docs) `date`:

- Journals: `app: "journal"`
  - Daily entry: `journal/YYYY/MM/YYYY-MM-DD.md` (id or date = `YYYY-MM-DD`)
- Todos: `app: "todos"`
  - Inbox list: `todos/inbox.json` (id = `"inbox"`)
  - Other lists: `todos/<id>.json`
  - Daily todos: `todos/daily/YYYY/MM/YYYY-MM-DD.json` (docType = `"daily_todos"`)
- Projects: `app: "projects"`
  - Project definition: `projects/<slug>.json`
- News: `app: "news"`
  - Daily log: `news/YYYY/MM/YYYY-MM-DD.md` (docType omitted or `"daily_news"`)
  - Topic file: `news/topics/<topic>.md` (docType = `"news_topic"`)
- Portfolio: `app: "portfolio"`
  - Current state: `portfolio/current.json` (id = `"current"` or docType = `"portfolio_current"`)
  - Snapshot: `portfolio/snapshots/YYYY-MM-DD.json` (docType = `"portfolio_snapshot"` or id = date)

Unknown apps fall back to `<app>/<id>` without an extension.

## Templates

Templates are optional, stored under:

```text
templates/<app>/<docType>.md
templates/<app>/<docType>.json
templates/<app>/<templateName>.md
templates/<app>/<templateName>.json
```

Templates can contain simple placeholders that will be replaced on creation:

- `{{date}}` – ISO date string (e.g. `2026-03-08`)
- `{{weekday}}` – Localized weekday name (e.g. `Sunday`)
- `{{app}}` – App name (`journal`, `todos`, etc.)
- `{{docType}}` – Optional document type

## Tools

All tools return a single text block containing JSON with the result (suitable for the agent to parse).

### `file_store_list_documents`

List documents for an app, optionally filtered by docType and date range.

**Params**

- `app` (string, required) – Application namespace (e.g. `"journal"`, `"todos"`)
- `docType` (string, optional) – Only include documents whose inferred docType matches
- `since` (string, optional) – ISO date `YYYY-MM-DD`; only include docs on/after this date when a date can be inferred
- `until` (string, optional) – ISO date `YYYY-MM-DD`; only include docs on/before this date when a date can be inferred
- `limit` (integer, optional) – Maximum number of results (default: unlimited, capped internally to 1000)

**Result JSON**

- `app`, `docType`
- `items` – Array of:
  - `app`, `id`, `docType`, `path`, `date?`

### `file_store_read_document`

Read a logical document from the store.

**Params**

- `app` (string, required) – Application namespace (e.g. `"journal"`, `"todos"`)
- `id` (string, required) – Logical identifier (e.g. `"2026-03-08"`, `"inbox"`, `"project-slug"`)
- `docType` (string, optional) – Optional subtype (e.g. `"daily_journal"`, `"daily_todos"`)

**Result JSON**

- `app`, `id`, `docType`
- `path` – Relative filesystem path under the data root
- `content` – Raw file content

### `file_store_write_document`

Create or replace a logical document in the store.

**Params**

- `app` (string, required)
- `id` (string, required)
- `docType` (string, optional)
- `content` (string, required) – Full document content to write
- `upsert` (boolean, optional, default `true`) – If `false`, will fail when the document does not exist
- `ifNotExists` (boolean, optional) – If `true`, will fail when the document already exists

**Result JSON**

- `app`, `id`, `docType`
- `path` – Relative filesystem path written

### `file_store_delete_document`

Delete a logical document.

**Params**

- `app` (string, required)
- `id` (string, required)
- `docType` (string, optional)
- `mode` (`"trash"` | `"hard"`, optional, default `"trash"`)

**Behavior**

- `"hard"` – Delete the file directly.
- `"trash"` – Copy content to `trash/<timestamp>-<flattened-path>` and then delete the original.

**Result JSON**

- `app`, `id`, `docType`
- `deleted` – `true`
- `mode`
- `trashPath` – Present when `mode="trash"`.

### `file_store_ensure_daily_document`

Ensure that a daily document exists for a given app and date, creating it from a template if missing.

**Params**

- `app` (string, required)
- `date` (string, required) – ISO date `YYYY-MM-DD`
- `docType` (string, optional) – e.g. `"daily_journal"`, `"daily_todos"`, `"daily_news"`
- `templateName` (string, optional) – Explicit template override

**Behavior**

- Derives the path from `{app, date, docType}`.
- If the file already exists, returns it as-is.
- If it does not exist:
  - Attempts to load a template as described above.
  - Performs placeholder substitution.
  - Writes the new file and returns it.

**Result JSON**

- `app`, `id` (same as `date`), `docType`
- `path` – Relative filesystem path
- `content` – Raw content

## Example NanoBot config

```json
"nanobot-file-store": {
  "command": "node",
  "args": ["/app/services/nanobot-file-store-mcp/dist/index.js"],
  "env": {
    "OPENCLAW_DATA_ROOT": "/workspace/openclaw-data"
  },
  "toolTimeout": 30
}
```

## Development

```bash
cd services/nanobot-file-store-mcp
npm install
npm run build
npm run start
```

