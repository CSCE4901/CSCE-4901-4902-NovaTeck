# Cloud database and scheduled job imports

NovaTeck can use a shared Aiven MySQL database while the frontend and backend run locally. Students do not need to install MySQL. Keep database credentials private in backend configuration; do not distribute the Aiven administrator password with the app.

## Local connection

Download the Aiven project CA certificate to `backend/aiven-ca.pem`. Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in `backend/.env` from the service connection information. Set `DB_SSL_CA=aiven-ca.pem`. NovaTeck verifies both the certificate and server hostname. The local configuration and CA file are excluded from Git.

Use separate installations or accounts for testing. This shared database contains actual user accounts, resumes, and saved jobs. Back it up before migrations; never import the initial schema over an existing installation.

## Scheduled imports

The workflow `.github/workflows/job-sync.yml` runs the existing public employer-feed importer twice daily, at 06:17 and 18:17 UTC, and can also be started manually. It does not require an Adzuna account. GitHub schedules may be delayed and operate only when the workflow is on the default branch. Public-repository schedules can be disabled after 60 days without repository activity.

An authorized repository administrator must add these repository Actions secrets under Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| CLOUD_DB_HOST | Aiven hostname |
| CLOUD_DB_PORT | Aiven MySQL port |
| CLOUD_DB_NAME | Initialized database name, such as defaultdb |
| CLOUD_DB_USER | Database user authorized to run the importer |
| CLOUD_DB_PASSWORD | That user's password |
| CLOUD_DB_CA | Full contents of the downloaded CA PEM certificate, including its BEGIN and END lines |

Keep the importer account separate from the administrator account where practical. It needs the read and write permissions used by `backend/job_sync.py` and its database helpers; the scheduled workflow does not initialize schemas or run migrations.

Push the workflow and database TLS support to the default branch. Open Actions → Sync cloud jobs → Run workflow to verify the first run. Missing secrets stop the workflow before connection. A partial source failure retains successful imports and reports a failed run for inspection. Existing crawler robots policies and rate limits remain in effect.

The schedule runs on GitHub rather than your laptop. Free standard GitHub-hosted runners are available for public repositories; private repositories have plan-specific quotas. Stay within Aiven's free storage allowance, especially when saving resumes. Hosting only the database does not provide a public NovaTeck website.

References: [Aiven free MySQL](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier), [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage), [scheduled workflow inactivity](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows).
