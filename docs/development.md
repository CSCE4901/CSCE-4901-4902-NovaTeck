# Development guide

## Local setup

1. Use Python 3.12+, MySQL 8 and Node 22.12+.
2. Create a virtual environment and install the backend:
   ```sh
   python3 -m venv .venv
   .venv/bin/pip install -r backend/requirements.txt
   cp backend/.env.example backend/.env
   ```
3. Set MySQL credentials and a random JWT secret in `backend/.env`.
4. For a **new, empty database**, load `database/novatek_schema_v2.sql`. It creates `novatek_db` and initial skill vocabulary, without a demo account:
   ```sh
   mysql -u root -p < database/novatek_schema_v2.sql
   ```
   For an existing database, back it up and run the additive migrations instead:
   ```sh
   .venv/bin/python backend/migrate.py
   ```
5. Start the API and frontend in separate terminals:
   ```sh
   .venv/bin/python backend/app.py
   ```
   ```sh
   cd frontend
   npm ci
   npm run dev
   ```
6. Open http://127.0.0.1:3000 and register your own account.

`pdfminer.six` extracts PDF text and `python-docx` extracts DOCX text. Both run locally without paid APIs. The same `nlp_tagger.py` vocabulary and spaCy/NLTK processing pipeline handles jobs and resumes, without external model downloads. Text-only documents are supported; encrypted or image-only PDFs are rejected. Files are limited to 5 MB and processed in memory, without retaining file bytes or plain text.

## Checks

```sh
.venv/bin/python -m unittest discover -s backend/tests
.venv/bin/python backend/tests/integration_mysql.py
npm --prefix frontend run build
npm --prefix frontend audit
```

The opt-in MySQL test needs permission to create databases. It creates a uniquely named `novateck_test_*` database and deletes only that database afterward. CI also builds both production images and audits Python dependencies.

## Administrator accounts

No default administrator is created. Register an account, then assign its database role as described in the [deployment guide](deployment.md).
