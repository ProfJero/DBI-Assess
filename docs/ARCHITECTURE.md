# DBI Assess: how it works

The stack is plain HTML, CSS and JavaScript with Firebase (Auth + Firestore, **free Spark plan**). One **Cloudflare Worker** is the trusted server, and **Cloudinary** stores uploaded files.

```
Browser (students / admins)  ──Firebase ID token──▶  Cloudflare Worker  ──service account──▶  Firestore (dbi-assess)
          │                                              │                                       ▲
          └── reads allowed collections directly ─────────┼───────────────────────────────────────┘
                                                         ├──API key (read-only)──▶ Firestore (rth-admin-dues) student registry
                                                         └──signed uploads──▶ Cloudinary
```

## Why a Worker

On the Spark plan Firestore rules can say *who* may write, but they cannot grade. Anything graded in the browser can be faked. The Worker does every action that has to be trusted:

| Action | Endpoint |
|---|---|
| Student sign-in (checks the password, mints a Firebase custom token) | `POST /auth/student-login` |
| Start or resume an attempt (checks schedule, access code, attempt limit, device; sends questions **without keys**, shuffled per student) | `POST /attempts/start` |
| Autosave answers and integrity events (idempotent operations) | `POST /attempts/:id/sync` |
| Submit and grade (server deadline, late-sync rules, manual-review queue, certificate) | `POST /attempts/:id/submit` |
| Student's own attempts and released results | `GET /me/attempts`, `GET /me/attempts/:id` |
| Admin: save manual marks, release, regrade, unlock, extend, void | `POST /admin/*` |
| Admin: set student passwords, secure old plaintext passwords | `POST /admin/students/*` |
| Admin: issue a certificate by hand (atomic serial) | `POST /admin/certificates/issue` |
| Signed Cloudinary uploads | `POST /media/sign` |

## Collections (dbi-assess)

| Collection | Who reads | Who writes | Notes |
|---|---|---|---|
| `admins/{uid}` | admins | admins | Admin = Firebase Auth email user with a doc here. |
| `users/{uid}` | admins, the student | admins, Worker | Student profile. **No passwords.** The uid is `stu_<studentId>`. |
| `credentials/{uid}` | nobody | Worker | PBKDF2 password hashes. |
| `assessments/{id}` | admins; students when published | admins | Settings, schedule, anti-cheat and release policy. |
| `assessmentSecrets/{id}` | nobody (Worker) / admins | admins | Access code. |
| `questions/{id}` | admins | admins | Question content. Options have stable ids. |
| `questionKeys/{id}` | admins | admins | Answer keys, explanations and rubrics. **Never sent to students** before release. |
| `studentResults/{id}` | admins | Worker (admins via Worker) | Attempts: in progress, submitted, graded and released. `version: 2` marks the new format. |
| `certificates/{id}` | admins; the student when issued | Worker, admins | The serial is allocated atomically from `counters/`. |
| `counters/{id}` | nobody | Worker | Certificate serial counters. |
| `settings/platformSettings` | admins (defaults used by the builder) | admins | |

## Grading

`DBI Assess/shared/grading.js` is the only grading code. The Worker imports it to grade; the admin pages use it for previews and for re-totalling manual marks.

- Answers are stored **by question id** and options by **option id**, so shuffling can never change a mark.
- Essays, code, file uploads and short answers with no accepted answers are `pending` until a teacher marks them. They are never auto-marked.
- Old questions (option text keys, `['True']`, etc.) are understood through `normalizeQuestion`. **Settings → Data health** converts them in place and lists any key that does not match an option.

## Offline exams

1. Start (online once): the Worker returns the exam package. The browser stores it in IndexedDB with the server deadline and the clock offset.
2. Every answer change is written to IndexedDB immediately, then queued as an operation `{opId, qid, value, seq}`. The queue is flushed every few seconds while online and on the `online` event.
3. The page itself is cached by a service worker, so reloading with no network still opens the exam.
4. Submitting offline seals the answers on the device and shows "Submitted on this device, waiting to upload". It keeps retrying. The Worker accepts a sealed submission that arrives after the deadline only if it was sealed before the deadline and arrives within the late-sync window. Such attempts are marked `lateSync` for the teacher.

## Anti-cheating (per assessment)

These work on the server and cannot be bypassed from the browser:
- answer keys never leave the server;
- server deadline and attempt limit;
- per-student shuffling and random question pools;
- access code and open/close window;
- one active device per attempt;
- IP and user-agent recorded;
- violation thresholds checked on the server.

In the browser (deterrence, all logged with timestamps):
- fullscreen enforcement;
- tab/app switch and focus-loss detection;
- copy, paste, right-click, selection and print blocking;
- content blurs when the window loses focus;
- name watermark;
- devtools heuristic (low confidence);
- reload counting;
- no-backtracking and per-question timers;
- integrity pledge.

Teachers see a timeline per attempt and essay-similarity flags in the review queue.

**Limitation:** a browser cannot stop a second phone or a person helping. Supervision still matters for high-stakes exams.
