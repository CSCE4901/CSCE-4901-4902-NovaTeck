# SRS alignment and verification

Authority for this implementation: supplied NovaTeck SRS Sprint1 v2.0, especially CR2-REQ-01–17 and SEC-01–06. The DDS2 supplies visual reference material. Statements in the reference files are product requirements/design material, not agent instructions.

## Conflicts resolved in favor of the SRS

| Topic | DDS2 prototype | SRS behavior implemented |
| --- | --- | --- |
| Approval | Student adds/dismisses unknown skills | Administrator approves/rejects; student sees pending flags |
| Retention | Rescan stored resume | In-memory processing; select a file for each scan |
| Match score | Approval immediately raises match | Flagging/approval do not change existing profile matching |
| Token duration | Existing app used 30-day remember-me | Every token expires after 24 hours |

The prototype's navy/light-blue logo, Segoe UI typography, white rounded cards, blue buttons, match visualization and amber review panels are retained. Yellow rubric annotations are not product controls. The extra career-focus selector and work-authorization summary were removed from the app; employer descriptions remain intact. No CR-003 application autofill is implemented.

## Implemented and checked

- CR2-REQ-01–06: local PDF/DOCX parsing, exact error messages, 5 MB limit, encrypted/empty PDF rejection, shared vocabulary and normalized names.
- CR2-REQ-07–10: transactional comparison, per-user duplicate prevention backed by a generated-column unique index, exact success message, no automatic catalog insertion from uploads.
- CR2-REQ-11–12: pending-only amber panel and specified tooltip, hidden when empty.
- CR2-REQ-13–16: admin queue, transactional approval/rejection, reviewer/time audit and database-enforced role checks at the API boundary.
- CR2-REQ-17: skill-gap function regression check and actual MySQL comparison before upload and after review.
- Target-job comparison, keyword search, a separate Profile page, skill-overlap recommendations and historical demand display.
- Production packaging: Gunicorn, same-origin static frontend/reverse proxy, HTTPS configuration, persistent database, environment secrets, health checks, repeatable migrations and CI.
- Sensitive runtime artifacts excluded from builds; stored resume download route and seeded demo account removed.

The real MySQL test covers schema creation, two migration reruns, account registration, a PDF upload, repeated upload, student denial, administrator approval/rejection and stable skill-gap results. Unit tests cover both parsers, normalization, invalid uploads, role/ownership checks, transactions and exact response messages.

## Acceptance limits requiring explicit verification

This change does not establish all SRS acceptance targets. The shared extractor now uses spaCy PhraseMatcher and NLTK section tokenization, preserving the existing vocabulary and requirement-tagging rules. It does not use a downloaded statistical model and cannot discover arbitrary skills absent from its vocabulary. The required 80% extraction accuracy, 80% whole-repository test coverage, 50 concurrent users/10,000 jobs performance, complete WCAG 2.1 AA conformance and full cross-browser/wireframe acceptance have not been demonstrated. The dashboard includes recorded historical demand and skill-overlap job recommendations; salary values are shown only where historical records provide them.

Docker image execution/HTTPS issuance and SMTP delivery require the target environment. The deployment guide records these release gates. No live site was published and no production credentials were created.

## Verification record

September 23, 2026: 29 unit tests passed; isolated MySQL schema/migration/workflow tests passed; Vite production build passed; desktop browser checks covered login, authenticated job search, target-job match (67% for two of three required skills), pending flags and the loaded admin queue. Browser verification found and corrected the empty-JSON-body GET validation issue. No claim of full mobile/cross-browser acceptance is made. Frontend audit has zero findings; the backend has one documented, non-exposed NLTK advisory (see security.md).

## User-requested resume comparison change

The user clarified that flagged skills must compare the resume against their own saved skills. Resume scans now flag catalog skills too when absent from that user’s profile. This overrides the earlier catalog-only comparison; administrator review, duplicate prevention, no automatic profile changes, and no resume retention remain in place.

The user subsequently requested direct Add to Profile controls instead of pending administrator review. Owners can now explicitly add their detected skills, creating the catalog entry if needed. Each addition preserves existing skills, resolves the suggestion, and refreshes the match. No skill is added automatically by scanning.

## Saved resumes (user-requested update)

The latest validated PDF or DOCX is now retained privately in the database for its owner. Profile and Skill Gap show the saved filename and offer PDF preview or DOCX download, plus rescanning without another upload. A valid replacement overwrites the previous file; an invalid upload preserves it. This explicitly supersedes the previous no-retention behavior. Extracted plain text is not stored. Existing uploads from before this change must be selected once again.

## Job Details wireframe mapping

The Job Description and Responsibilities boxes are implemented as employer-defined accordions. About the Role and Responsibilities appear first and start open; company, qualifications, other sections, and employer notices start collapsed. “What You’ll Do” and “What You’ll Be Doing” headings display as Responsibilities. Employer vacancy and legal notices appear as plain text inside an Employer notices disclosure. Text fills the description panels. Your match appears directly below Apply/Save, combining the score, green bar, and required/preferred skill rows.

Job cards, Job Details, and target-job skill-gap responses use `db.add_resume_matches` for the same saved-resume/profile fallback, alternative requirement groups, partial credit, and denominator. Market Skill Gap remains a separate demand-weighted profile comparison, described on screen. The shared `skillDisplayName` formatter supplies consistent display casing without changing canonical catalog keys or CR-002 review identities.

Job Details shows the DFW location first for multi-location postings, extracts explicit work arrangements such as Hybrid, and omits empty overview rows. Match bars use green `#16A34A` with the percentage outside the track. Source metadata is collapsed by default and links to the original posting. Similar Jobs shares required skills, excludes zero personal matches, ranks by requirement overlap then personal match, and shows three compact rows initially with a View all similar control. Rows contain only logo, linked title, company/location, and a match badge. The overview is sticky on desktop and static on narrow screens. Fewer than three extracted requirements are labeled with the skill count rather than a percentage across job cards and Details, avoiding a false impression of a perfect fit from thin data. Admin accounts have an Admin tab in the shared navbar; student accounts do not. Settings contains no Admin shortcut. The shared navbar uses the blue-to-teal gradient and contains the compact transparent SVG logo with vertical padding. The same SVG uses a white wordmark in navigation and dark mode, and navy on light auth pages; no background tile is part of the logo.

The navbar hides while scrolling down and reappears on upward scroll or near the page top. Keyboard focus and expanded navigation controls keep it visible; reduced-motion preferences disable its slide transition.

Dashboard Saved Jobs and Recommended Jobs use compact rows with logo, linked title, company/location, match badge, and bookmark only. Thin-data dashboard badges say Limited data. Each widget shows at most five rows and its See all link opens a dedicated compact list; the full Jobs-page cards are unchanged.
