# Validation and curriculum tools

Run commands from the repository root after `npm ci`.

- `npm test`: final-catalog integrity, JavaScript syntax, local-target safety, all 72 lesson-access fixtures, storage failures, creator authorization and privacy.
- `npm run test:browser`: serial browser checks for the creator panel, browser execution, draft recovery, course navigation and responsive layouts. Individual checks are available as `test:browser:creator`, `test:browser:cloud`, `test:browser:review` and `test:browser:studio`.
- `npm run curriculum:export`: rebuild teaching content from `local/db/content/`, with a disposable database and the final catalog's stable IDs. It never opens a learner database. The instructional review is applied afterwards.
- `npm run curriculum:refine`: apply the instructional review to an unreviewed exported catalog.

Browser checks require a **fresh local development preview**, with the local D1 migration applied and fictional ChatGPT authentication enabled by the portable starter. The creator test additionally needs the ignored `.dev.vars` setting `HABLA_OWNER_USER_ID=local_seedy`. These checks can change that fictional user's progress; run them serially. They never target the hosted application.

Install a browser with `npx playwright install chromium`, or select an existing browser with `HABLA_BROWSER_CHANNEL=msedge` / `chrome`. An explicit `HABLA_BROWSER_EXECUTABLE` path is also supported. `HABLA_TEST_URL` defaults to `http://127.0.0.1:5173`; only loopback origins are accepted. Remote URLs are rejected before browser launch.

Python 3.11+ with SQLite is required only for content regeneration. Set `PYTHON_BIN` to an executable path if needed; otherwise the tools try `python3`, `py -3`, then `python`. `HABLA_CURRICULUM_OUTPUT` can point to a scratch JSON file for an export check without replacing `app/curriculum.json`.

`scripts/curriculum-integrity.json` pins the reviewed final catalog. Review intentional content changes before updating its SHA-256. Regeneration currently preserves the known lesson/exercise IDs by slug and glossary IDs by their stable per-unit order; adding or reorganizing content requires an explicit ID review.

The runtime requires a modern browser with WebAssembly and network access for the initial Pyodide download. Browser QA therefore also needs access to the Pyodide CDN.
