# Production deployment

## New installation

Use an Ubuntu host with Docker Engine and Compose installed. Point a domain's A/AAAA records to the host and permit inbound TCP 80/443 (and optionally UDP 443). Do not expose MySQL or the API port publicly.

1. Copy `.env.example` to `.env`. Set `APP_DOMAIN`, matching HTTPS `APP_PUBLIC_URL`, two distinct database passwords and a random `JWT_SECRET` of at least 32 characters. Generate secrets with `python3 -c 'import secrets; print(secrets.token_urlsafe(48))'`. Never commit `.env`.
2. Configure SMTP host, sender and credentials. Password reset emails require a working SMTP server; test delivery before opening registration.
3. Run `docker compose up -d --build`. Caddy obtains and renews certificates for the configured domain; the frontend and API share one origin. Gunicorn serves the Flask application. MySQL, certificates and Caddy configuration use named volumes.
4. Check `docker compose ps`, `docker compose logs api web`, and `curl --fail https://YOUR_DOMAIN/api/health`.
5. Register an account through the app. Assign the first administrator through an operator-controlled database session:
   ```sh
   docker compose exec db mysql -u root -p novatek_db
   ```
   ```sql
   UPDATE Users SET role = 'admin' WHERE email = 'your-registered-email';
   ```
   Refresh or sign in again. The Admin button opens the Admin Dashboard, including Flagged Skills Review. Administrators land there after signing in; `/admin` also opens it for an authenticated administrator. The API checks the database role on every admin request.
6. Import real listings with `docker compose --profile maintenance run --rm crawler`. Review `backend/crawler/company_sources.json` first. There is no automatic sample-data import.

The initial schema runs only when the MySQL volume is empty. Do not apply it over an existing database. Never run `docker compose down -v` against data you need to keep.

## Upgrading

Back up the database before upgrading. Build the new images, then run `docker compose run --rm api python migrate.py` and `docker compose up -d`. Migrations are repeatable and additive. MySQL DDL can auto-commit; restore from backup if an upgrade fails and cannot be repaired. Keep the previous application image/tag for rollback.

The schema no longer seeds `student@test.com`. An existing installation may still contain that legacy account and old resume metadata; review/remove the demo account before public launch. Existing stored resume files must be deleted after confirming the new parser is installed. The app no longer serves or writes them. Resume uploads are excluded from Git and Docker build contexts.

## Operations

Schedule the crawler with the host's scheduler, for example twice daily:

```cron
0 6,18 * * * cd /opt/novateck && docker compose --profile maintenance run --rm crawler >> /var/log/novateck-sync.log 2>&1
```

Only public, approved sources are collected. Feed collection honors robots.txt, crawl delays and a per-host delay; unavailable policies and redirects fail closed. Failed feeds do not retire missing jobs. The standalone breadth-first crawler remains separately configurable.

Create encrypted/off-host MySQL backups using your host's secret management, and rehearse restoration to a separate database. Monitor health-check failures, database storage, certificate renewal, sync results and API errors. Keep the development Vite server private; production serves only built static assets.

See [security review](security.md) for the narrowly scoped, currently unpatched NLTK model-path advisory; this app does not expose the affected APIs.

## Release gate

The local environment has verified unit tests, a real isolated MySQL integration test and the frontend production build. Docker is unavailable locally, so image startup, Caddy certificate issuance and deployment-host connectivity still need the CI/host smoke test. Also verify SMTP delivery, mobile/browser accessibility, load with 50 concurrent users and 10,000 records, and the SRS NLP accuracy target on a labeled validation set before public release. These outcomes cannot be inferred from a successful build.
