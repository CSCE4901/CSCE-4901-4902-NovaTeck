# Using NovaTeck

Register with your name, email, password and optional skills. Passwords need uppercase, lowercase and a number, and must contain at least eight characters. Sessions expire after 24 hours, including remembered sessions. Use Forgot Password for an emailed one-time reset link.

Search Jobs by keyword, skill, location, company and experience. Open a result for its full description, required/preferred skills and source link. Save jobs to your Dashboard; remove them there when no longer useful. Apply opens the employer's posting.

Edit your name from Profile or the Dashboard. Update My Skills on Skill Gap edits the skills used in matching. Existing catalog skills are linked to your profile; editing a profile does not add entries to the global Skills table.

Dashboard recommendations rank active jobs by required-skill overlap. Market Trends shows recorded demand snapshots; missing salary information is shown as unavailable. On Skill Gap, select a Target Job to compare its required and preferred skills against your profile.

## Resume detection

On the Dashboard or Skill Gap page, choose a text-based PDF or DOCX no larger than 5 MB and select Scan Resume for Skills. The panel shows processing, identified skills and the number of newly flagged skills. A selected PDF can be previewed locally. The detected-skill list is available for both document formats.

Your file and extracted text are not retained. Select your file again for another scan. Unsupported, corrupt, encrypted or image-only files show a clear error.

Skill Gap displays Unverified Skills from Your Resume only when you have pending flags. Pending Review labels mean the skill was detected in the resume but is missing from your saved profile, even if it already exists in the shared catalog. Hover or focus a skill for its explanation. Repeated scans do not duplicate an existing pending flag for your account. Pending skills do not alter your match percentage.

## Administrator review

Administrators open Admin → Flagged Skills Review. Each pending row shows Skill Name, Submitted By and Date Flagged. Approve adds the skill to the catalog if absent and records the reviewer and time; Reject records the decision without adding the skill. Either action removes that pending row. Refresh Queue loads new submissions.

Catalog approval does not automatically change a student's profile or match percentage. Students may update their skills after review. This preserves the SRS requirement that resume flagging does not change existing skill-gap results. Only operators can assign administrator roles; non-admin API requests receive 403.

## Adding detected resume skills

On Skill Gap, Resume Skills to Add lists detected skills missing from your saved profile. Select Add to Profile beside a skill to save it immediately; no administrator approval is required. The suggestion disappears and Your Skills and the match percentage refresh. Scanning alone does not change your saved skills.

## Saved resumes (user-requested update)

The latest validated PDF or DOCX is now retained privately in the database for its owner. Profile and Skill Gap show the saved filename and offer PDF preview or DOCX download, plus rescanning without another upload. A valid replacement overwrites the previous file; an invalid upload preserves it. This explicitly supersedes the previous no-retention behavior. Extracted plain text is not stored. Existing uploads from before this change must be selected once again.
