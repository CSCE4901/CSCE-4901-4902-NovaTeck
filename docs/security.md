# Dependency audit and application boundaries

Frontend dependencies were updated to Vite 8.3 and the current React plugin. `npm audit` reported zero known vulnerabilities after the update.

Backend dependencies were upgraded and pinned after audit. The remaining advisory is NLTK `PYSEC-2026-3740` / `CVE-2026-81726`, for which the advisory lists no patched release. It affects model import/export APIs (`TransitionParser`, perceptron persistence and maxent model saves) when an application allows untrusted callers to choose model paths and relies on NLTK path sandboxing.

NovaTeck imports only NLTK `RegexpTokenizer` for in-memory section tokenization. It does not call those model APIs, accept model paths, download models, train models or rely on NLTK's filesystem sandbox. Resume bytes/text are processed in memory; client filenames are used only to validate the extension. The advisory's required attack path is therefore absent from the application.

CI suppresses only this advisory, with the above rationale; all other findings fail the audit. Reassess/remove the exception as soon as NLTK publishes a fix, and before adding any NLTK model persistence or path-handling feature. An ignored advisory does not mean the package itself has no vulnerability.

The app requires bearer authentication for business APIs; login, registration, password-reset entry points and an intentionally non-sensitive health probe are exceptions. Role/ownership checks are server-side. Production uses same-origin Caddy HTTPS and Gunicorn, with no public MySQL/API ports. Application registration never accepts an admin role. Use SMTP delivery, operator-managed secrets and backups as documented in the deployment guide.
