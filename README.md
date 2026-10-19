# DBI Assess

The Digital Bridge Initiative assessment platform for JHS/SHS students: quizzes, tests and exams that
mark correctly, keep working when the network drops, and resist cheating.

- **Front end:** plain HTML/JS with Firebase (Auth + Firestore, compat SDK 9.22). Hosted from `DBI Assess/`.
- **Trusted server:** a Cloudflare Worker (`worker/`) does the work Cloud Functions would do, so the
  Firebase project can stay on the free **Spark** plan. It grades answers, keeps the timer, signs in
  students, issues certificate numbers and signs uploads.
- **File storage:** Cloudinary (question pictures and file-upload answers).

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how grading, offline mode and anti-cheat work.

## Question types

Multiple choice, multiple select, true/false, fill in the blank (several blanks), short answer (exact,
keywords, or teacher-marked), number (with tolerance or range), matching, ordering, essay, coding and
file upload. Essays, coding and file uploads, plus short answers without an automatic key, always go to the
teacher's **marking queue**. They are never marked automatically.

## Deploying

### 1. Firebase (Spark plan is enough)

```bash
npm install
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project dbi-assess
```

The rules stop students reading questions, answer keys and other students' results. Only the Worker
writes attempts and scores, so scores cannot be forged.

### 2. Cloudflare Worker

1. In Firebase → Project settings → Service accounts, click **Generate new private key**.
2. Deploy:

```bash
cd worker
npx wrangler login
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT     # paste the whole JSON file
npx wrangler secret put CLOUDINARY_API_KEY           # optional, for uploads
npx wrangler secret put CLOUDINARY_API_SECRET        # optional, for uploads
npx wrangler deploy
```

3. In `worker/wrangler.toml` set `CLOUDINARY_CLOUD_NAME`. Set `ALLOWED_ORIGINS` to your site's address,
   for example `https://assess.dbi.org.gh`, then deploy again.
4. In `DBI Assess/shared/config.js` set `apiUrl` to the Worker URL that `wrangler deploy` printed.

Cloudflare's free plan allows 100,000 requests a day, which is plenty for class tests. Students save
answers in batches every few seconds, not on every key press.

### 3. Host the site

Any static host works: Firebase Hosting (`npx firebase deploy --only hosting`), Cloudflare Pages or
GitHub Pages. The site must be served over HTTPS so the offline mode (service worker) runs.

### 4. One-off steps after upgrading from the old system

Sign in at `/admin/` and open **Settings & tools**:

1. **Protect student passwords**: hashes the plain-text passwords. Students keep their passwords.
2. **Upgrade all questions**: links answer keys to options and moves them where students can't read them.
   This is the fix for correct answers being marked wrong. True/false questions from the old builder
   are flagged "Confirm answer", because that builder saved "False" by default. Open each one and save it.
3. **Regrade every assessment**: re-marks new-system attempts with the fixed keys.

Admins are added on the **Admins** page by an existing admin. The very first admin must be created by
hand: create the user in Firebase Authentication, then add a document `admins/<their uid>` with
`{ name, email, role: "owner" }`.

## Developing and testing

```bash
npm test                    # grading engine unit tests
npm run test:integration    # Worker against the Firebase emulators
npm run test:e2e            # Playwright: student journey (phone) and admin journey (desktop)
```

The integration and end-to-end scripts start the Firestore and Auth emulators, `wrangler dev` and a
static server by themselves. Add `?emulator=1` to a page URL to point a local browser at the emulators.

---
Built by **ProfJero Digital Studio** · Powered by **Digital Bridge Initiative**
