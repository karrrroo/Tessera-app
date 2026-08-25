# Tessera — Product Requirements Document

**Version** 2.1 — final · **Date** August 2026 · **Status** In build

**Audience** — the project supervisor, and Claude Code as the implementation
specification.

**Language** — written in English because it is the build specification. All
user-facing strings are Armenian first, with English and Russian translations, and
appear here in Armenian where they are normative.

**Convention** — sections marked ❓ contain genuinely unresolved questions. They are
deliberately not filled with plausible-sounding guesses. They are answered by talking
to people, not by analysis.

**Supersedes** — all earlier PRD drafts. Most importantly, this version reflects the
decision that **Tessera does not integrate with EMIS**. Any earlier document describing
an EMIS gateway, a sync queue, or a commit-to-EMIS action is obsolete.

**Design source of truth** — the current design package, whose latest state is
`corrections-6.md`. The version chain is `v2-FINAL` → `v2.4-fixes` → `corrections-2…6`.
Any reference elsewhere to "v2.4, the most recent" is out of date. Where this document
and the design disagree on a screen, the design wins and the conflict is recorded in
`tessera-roadmap.md` §3.

**Build sequencing** — §16 of this document has been superseded by
`tessera-roadmap.md`, which is the plan of record. This document specifies *what* the
product is; the roadmap specifies *how and in what order* it is built.

**What already exists** — the database is live on Neon with schema and seed applied:
8 classes, 10 subjects, 20 teachers, 200 students, 1121 assessments, 25 606 published
marks, 40 superseded with reasons, 12 drafts, 8 credential requests, 4 demo accounts.
`tessera-schema.sql` and `tessera-seed.sql` document exactly what is there.

---

# 1. Summary

Tessera is a digital academic records and student identity platform for Armenian
schools. It is a school's own system: it holds its own data, and it hands the school a
file when the school needs to submit information elsewhere.

It serves two roles from one codebase:

- A **student** carries a digital ID with a scannable QR code, views their marks as a
  visual mosaic, browses their archive across years, and submits non-formal credentials
  for recognition.
- A **teacher** enters marks across several classes as private drafts, reviews them, and
  publishes them to the class in a batch. Corrections after publication are permanent
  and attributable.

An **administrator** sets the school up and manages the roster.

All roles have access to **Iter**, an in-product assistant whose interface is complete
in this release but which produces no generated responses.

The product is trilingual (Armenian, English, Russian), works as a responsive web
application and an installable PWA, and functions offline for the one action that must
never fail: showing the ID.

## 1.1 The one-sentence pitch

> Tessera is a school's own gradebook and student ID. Teachers enter marks once in an
> interface built for the job, students carry their record and identity on their phone,
> and the school exports whatever it needs to submit elsewhere.

---

# 2. The problem

## 2.1 For students

A student who needs proof of enrolment — for a scholarship, a discount, a competition,
a library — must physically visit an administrative office to collect a paper
certificate stating something the school already knows. The office may be closed, the
responsible person absent, the printer broken. The visit repeats.

Separately, seeing one's own marks requires asking a teacher. There is no interface a
student would voluntarily open.

## 2.2 For teachers

Mark entry is slow enough that many teachers keep a private parallel record — a
notebook, a spreadsheet — and transcribe in bulk later, which introduces a second
opportunity for error.

Once a mark is recorded, correcting it is procedural and slow. During the wait the
record is wrong and everyone knows it.

## 2.3 For the school

Every certificate is a manual act. Every physical ID card costs money and gets lost.
Every correction is paperwork.

> ❓ **Unquantified.** How often does each of these happen? How many certificates per
> year, how many visits per certificate, how long does a correction take, what does a
> physical card cost? These figures do not exist yet and must not be invented. They come
> from the interviews in §5.2.

---

# 3. Goals and non-goals

## 3.1 Goals

| # | Goal |
|---|---|
| G1 | A student proves enrolment and identity from their phone, without visiting an office, and without a network connection |
| G2 | A student sees their complete record — current and historical — in an interface designed for them |
| G3 | A teacher enters a full column of marks faster than on paper |
| G4 | A teacher can correct a mistake privately before anyone sees it, and every correction after publication is permanent and attributable |
| G5 | Non-formal achievement is submitted, reviewed and recorded against a subject |
| G6 | A school can set itself up and import its roster without developer assistance |
| G7 | A school can export its data in a form it can submit elsewhere |
| G8 | Fully usable in Armenian, English and Russian with no degradation in any |

## 3.2 Non-goals

| Not doing | Why |
|---|---|
| **EMIS integration** | See §6. Tessera holds its own data and exports files |
| Native iOS/Android applications | One codebase. Widgets are designed but require a native shell |
| A parent role | Requires a consent and guardian-linking model that has not been designed |
| Physical card production | Logistics, not software |
| Multi-country support | Generalising now adds abstraction with no user |
| Push notification delivery | Preference toggles exist; delivery infrastructure is later |
| Timetable and attendance | Adjacent and tempting. Out of scope |
| Generated Iter responses | Interface complete, model not connected. See §9.7 |

---

# 4. Users

## 4.1 The student — primary

Aged roughly 15 to 18, grades 10–12. Smartphone is their primary computing device.

Opens Tessera for one of three reasons, in descending frequency: to show their ID at a
door, to check a mark they were just told about, or to see how a subject is going.

Sessions are short — under a minute in the common case. The product must reward that.

## 4.2 The teacher — primary

Teaches one or two subjects across three to six classes: 70 to 150 students. Enters
marks in bursts — a few after a lesson, a large volume at the end of a term.

Competent with software but not enthusiastic. Will abandon a tool slower than paper
without complaining first.

Their peak load — a full term in one sitting — is the load that decides adoption.

## 4.3 The administrator — secondary user, primary buyer

The director or deputy director for academic affairs. Sets the school up, imports the
roster, approves credentials, exports data.

Not a daily user, but **this is the person who decides whether the school uses Tessera
at all.** They will never open the student interface. They are persuaded by audit
integrity, reduced administrative load and reduced paper — not by anything a student
cares about.

## 4.4 Not a user in this release

Parents, ministry analysts, external verifiers using a general-purpose QR app.

---

# 5. Evidence status

Deliberately incomplete. This is the weakest part of the project and concealing it would
make the document useless.

## 5.1 What exists

- The author has personally experienced the certificate problem
- Informal conversations with more than ten people — students and teachers
- Direct observation of existing systems' interface problems

## 5.2 What is missing

> ❓ **None of it is recorded.** No interview was structured, no answer written down, no
> participant quotable. Unrecorded conversation is memory, and memory bends toward what
> one hopes to hear. It cannot support a claim in this document.

**Required:** eight structured interviews — five students, two teachers, one
administrator — asking about the past rather than the future, written up within ten
minutes of each conversation.

The questions that carry the most weight:

- *When did you last need a certificate, and what did you actually do?*
- *Have you ever built your own workaround for this?* — a self-made workaround is the
  strongest evidence of real pain that exists
- *Was there anyone who did not care?* — if every respondent is enthusiastic, the
  question was asked wrong

## 5.3 The four questions the administrator interview must answer

> ❓ **Q1.** Do teachers use the existing electronic gradebook, or avoid it, and why?
> If they use it and are satisfied, Tessera's gradebook has no reason to exist.

> ❓ **Q2.** Why did the Polytechnic discontinue its digital student cards? If the
> answer is "nobody used them", the core feature has already failed once in this market.

> ❓ **Q3.** Can the school export its student roster to a file? This does not change
> the architecture, but it could halve the work in §9.2.

> ❓ **Q4.** What does the school currently spend on certificates, paper, staff time and
> physical cards? Without these figures there is no commercial argument.

---

# 6. Positioning and the EMIS decision

## 6.1 The decision

**Tessera does not integrate with EMIS.** It is the school's own system, holding its own
data, with an export function for anything the school must submit elsewhere.

## 6.2 Why

Integration required an API that is not publicly documented and access that has not been
granted. Building against it would have made the entire product hostage to a dependency
outside the author's control.

Removing it eliminates the largest risk in the project. The product becomes complete,
demonstrable and deployable with nothing outside it, and can be piloted in one school
this term without ministry approval, without an API, and without waiting for anyone.

## 6.3 What this costs, stated honestly

Tessera does not eliminate double entry. The school still enters marks into EMIS,
because that is a legal obligation Tessera cannot remove.

**The honest claim:** enter marks once, in a good interface; the second entry becomes a
file upload or a copy-paste instead of retyping six hundred numbers.

That is a smaller claim than "we remove the duplication". It is also one that can be
defended in front of anyone, today, with no unresolved dependency behind it.

## 6.4 What is unaffected

The student-facing half — the ID, the QR, the record, the archive, the credentials —
never depended on EMIS at all. It is exactly as strong as it was, and it remains the
part with no equivalent anywhere.

## 6.5 Competitive landscape

| System | What it does | Why Tessera still has a place |
|---|---|---|
| **EMIS** | The state register: schools, classes, staff, students, marks | Effectively no student-facing interface. Corrections are procedural |
| **EMIS electronic gradebook** | A gradebook inside EMIS, with all schools pre-created | ❓ See Q1. If teachers avoid it, the reason for avoiding it is the entire case for Tessera's gradebook |
| **dasaran.am** | Commercial gradebook with parent access | No identity card, no credential workflow, no student-owned record |
| **Paper** | Certificates, transcripts, physical cards | The real competitor. "Keep doing nothing" is the default comparison |

## 6.6 Forward compatibility

The schema retains nullable, unused `emis_id` columns on institution, student and
teacher. They cost nothing and mean that if integration ever becomes possible, no
migration is required. Removing them would be tidy and short-sighted.

---

# 7. Scope

Everything in the current design document is in scope. This is the complete product to
be built and presented.

| Area | Included |
|---|---|
| **Authentication** | Login, forgot password, forced first-login change, sessions, logout |
| **Administration setup** | Institution, years, terms, subjects, class generator, bulk student and teacher import with preview, teaching assignments, credential handout, roster management |
| **Student identity** | Digital ID card, static QR, full offline operation |
| **Academic record** | Grade mosaic, subject detail, topic breakdown, multi-year archive, attestations |
| **Teacher gradebook** | Multi-class, per-class drafts, keyboard entry, batch publish, append-only history, new assessment columns |
| **Export** | Per class–subject–term, per class, per institution, in `.xlsx` and `.csv` |
| **Credentials** | Student submission with attachment, review queue, approve or decline with reason |
| **Iter** | Panel, suggestion chips, attachments, thinking state. **No model connected** |
| **Settings** | Account, appearance, language, notifications, export, support, widget gallery |
| **Support** | Contact, problem report, feedback, FAQ |
| **Localisation** | Armenian, English, Russian, complete |
| **Theming** | Light and dark, four backgrounds, seven accents, black default |
| **Platform** | Responsive web, installable PWA, Web/Mobile preview switch |
| **Widgets** | Eleven designs as a gallery. Native implementation out of scope |
| **Offline** | ID and QR fully functional without network |

---

# 8. Roles and permissions

| Capability | Student | Teacher | Administrator |
|---|---|---|---|
| View own marks | ✓ | — | — |
| View own archive | ✓ | — | — |
| Display own QR | ✓ | ✓ | ✓ |
| View class marks | — | own classes | all |
| Enter draft marks | — | own classes | — |
| Publish marks | — | own classes | — |
| Supersede a published mark | — | ✓ with reason | ✓ with reason |
| View mark history | own | own classes | all |
| Submit a credential | ✓ | — | — |
| Decide a credential | — | own subject | all |
| Export data | — | own classes | all |
| Set up the institution | — | — | ✓ |
| Import roster, create accounts | — | — | ✓ |
| Manage teaching assignments | — | — | ✓ |
| Change own password | ✓ | ✓ | ✓ |
| Use Iter | ✓ | ✓ | ✓ |

**Role is a property of the account.** There is no role switcher in the interface.
Changing role requires logging out.

---

# 9. Feature specifications

Acceptance criteria are testable by observation. If one cannot be verified by looking at
the running product, it is written wrong.

---

## 9.1 Authentication

### Stories
- As a student, I log in with credentials my school gave me.
- As a first-time user, I must replace the temporary password before using anything.
- As someone who forgot their password, I reset it by email without contacting anyone.
- As a user on a shared device, I log out and leave nothing behind.

### Requirements

**AUTH-1** The application renders the login screen on load. No other screen, no
navigation and no content renders until authenticated.

**AUTH-2** No public registration. Accounts are created by the institution. No link,
button or copy suggests otherwise.

**AUTH-3** Login accepts an email address or an institution-issued ID, plus a password.

**AUTH-4** JWT. Access token 15 minutes; refresh token 30 days, httpOnly, rotated on
every use.

**AUTH-5** "Remember this device" extends the refresh token to 90 days and records a
`device_session`.

**AUTH-6** Argon2id hashing for every password the product writes. Minimum 8 characters,
one digit, one uppercase. Validated
on client and server.

**AUTH-7** When `must_change_password` is true, the change screen renders in place of
the application and cannot be dismissed, skipped or navigated away from.

**AUTH-8** Reset flow: email → confirmation with a 60-second resend cooldown → new
password with a live requirements checklist. Token single-use, 30-minute expiry.

**AUTH-9** Failed login returns one generic error — "Սխալ տվյալներ։ Փորձեք կրկին։" —
revealing nothing about whether the account exists.

**AUTH-10** Six failures in 15 minutes locks the account for 15 minutes. The message
does not confirm the account exists.

**AUTH-11** Logout clears all client state and returns to login.

**AUTH-12** Active sessions listed in Settings with device label and last-seen time,
individually and collectively revocable.

### Acceptance criteria
- Any direct URL while unauthenticated lands on login
- A first-login account cannot reach another screen by any route, including browser back
- A reset link used twice fails on the second use
- Revoking a session on device A invalidates device B within one request cycle
- No response body or timing difference distinguishes an existing from a non-existent
  account

---

## 9.2 Administration setup — new

**Without this the product does not function.** With no external roster, nothing exists
in the database until an administrator puts it there. This is the largest single area of
new work in the project.

### Stories
- As a director, I set my school up in one sitting without calling anyone.
- As a director, I import six hundred students from a spreadsheet and see problems
  before anything is saved.
- As a director, I hand each class a sheet of logins.

### Requirements

**ADM-1 Institution** — name, region, type, academic year with dates, terms with dates.
Entered once.

**ADM-2 Subjects** — list, add, edit, with names in all three languages. Ships with ten
standard Armenian school subjects, editable and removable.

**ADM-3 Classes** — grade and letter. **A range generator**: grades 9–12 × letters
Ա–Դ creates sixteen classes in one action. Entering sixteen classes by hand is the kind
of task that makes someone abandon a product on day one.

**ADM-4 Student bulk import**
- Download an `.xlsx` template with required columns in Armenian and two example rows
- Upload a filled file
- **A preview table before anything is written.** Every row shown, problems marked in
  place: missing surname, invalid date, duplicate, unknown class
- Fix inline or re-upload. Nothing is committed until the administrator confirms.
- On confirm: student records created, user accounts generated, temporary passwords
  issued, `must_change_password` set

**ADM-5 Teacher bulk import** — same flow, plus teaching assignments. The preview shows
assignments as a readable grid — teachers as rows, classes as columns — not a list of
pairs, because this is the part administrators get wrong.

**ADM-6 Credential handout** — a printable sheet per class: name, login, temporary
password. Crude, and exactly what a school will actually do.

**ADM-7 Roster management** — add a student mid-year, transfer between classes, mark a
student as departed. **Departure never deletes**; it sets a status. The academic record
survives the student leaving.

**ADM-8** Every import writes an `import_batch` and one `import_row` per line, retained
so a failed import can be diagnosed after the fact.

### Acceptance criteria
- A 600-row file imports in under 30 seconds with a visible preview first
- A file with 12 bad rows out of 600 lets the administrator fix those 12 without
  re-uploading
- Nothing is written to `student` or `"user"` until confirmation
- The class generator creates 16 classes in one action
- A departed student's marks remain visible in the archive
- The handout prints one page per class at A4

---

## 9.3 Digital student ID and QR

The most frequently used feature in the product.

### Stories
- As a student at a door, I open my ID and show it in under three seconds.
- As a student with no signal, my ID still works.
- As a teacher, I have the same credential for the same doors.

### Requirements

**ID-1** Rendered as a physical credential: portrait 3:4, a vertical gradient derived
from `--accent-tint`, the mark in the upper third, the name in the lower third, role and
institution beneath.

**ID-2** The card follows the accent. With the default black accent it resolves to
near-black. Dark in both themes.

**ID-3** The QR opens as a sheet sliding over the lower two thirds.

**ID-4 — THE QR IS STATIC.** Generated once from a stable hash of the student
identifier. It does not rotate, does not refresh, has no countdown and no progress ring.
Byte-identical on every open, indefinitely.

*Rationale.* An earlier design rotated it every second, which made it unscannable — a
reader needs two to three seconds of stable image. A static code is also what permits
full offline operation. Security comes from the server-side scan log in ID-9, not from
the code changing.

**ID-5** Rendered on a solid white card, 24px radius. White, not cream — scanners are
calibrated for white.

**ID-6** Adjacent dark modules merge into continuous rounded shapes, corners rounded at
45% of a module's width only where there is no neighbour. Finder patterns: 30% outer
radius, fully rounded inner block. Four L-shaped corner brackets outside the quiet zone.
**The quiet zone is four clear modules on every side and is never reduced.**

**ID-7** The payload is a signed token containing the student identifier, the institution
identifier and an issue timestamp. **No name, no marks, no birth date.**

**ID-8** Fully functional offline. The token is stored on device at login. Nothing greyed
out, nothing disabled, and the interface states plainly:
"Աշխատում է առանց ինտերնետի".

**ID-9** Every scan is recorded in `scan_event`: credential, scanner, time, result. This
log — not code rotation — detects a shared screenshot. Two scans of one credential at two
locations within a short window is a detectable anomaly.

**ID-10** ~~Teachers get the same card with different content.~~ **Deleted.**
`corrections-6.md` §2 removed the ID card and the QR from the teacher role entirely. The
teacher's "Քարտ" navigation slot became **"Այսօր"**, a screen of its own — not a panel
beneath a card that no longer exists. See §16.1.

### Acceptance criteria
- Observing the QR for two continuous minutes shows no change of any kind
- In airplane mode the ID and QR open and display fully
- A physical scanner reads it on the first attempt in normal indoor lighting
- The decoded payload contains no name and no marks
- Two scans 30 seconds apart at different scanner IDs produce a flagged anomaly

---

## 9.4 Academic record

### Requirements

**REC-1** The overview presents all subjects as a mosaic — one row per subject, one tile
per mark, coloured by the fixed grade scale.

**REC-2 — The grade colour scale is fixed.** Marks 1–10 map to `--g1` through `--g10`.
Never changed by theme, background, accent or opacity. Colour carries meaning here.

**REC-3** Mosaic tiles sit on an opaque surface. A translucent surface over a gradient
shifts every tile's perceived hue, destroying the only thing the mosaic exists to do.

**REC-4** Subject detail shows the mark sequence, the average, a trend indicator, and a
topic breakdown where curriculum tagging exists.

**REC-5** The archive lists previous years, each expanding to final marks and any
attestation.

**REC-6 — The student view is read-only.** No student-role path alters a mark.

**REC-7 — Students see only published marks.** Drafts are invisible to them. This is
what makes the draft state meaningful.

**REC-8** A superseded mark is visible to the student in the subject history: previous
value, new value, date, and the stated reason. Corrections are not hidden from the person
they concern.

**REC-9** Every list and screen has a designed empty state with its own copy. A
first-year student in September must see a considered screen, not an empty container.

> ❓ **REC-10 Curriculum tagging.** Topic breakdown requires each assessment to carry a
> topic. Whether teachers will enter these is unknown. Build the schema to support it;
> degrade the UI to a subject-level view when tags are absent.

### Acceptance criteria
- The same mark value renders the identical hex across both themes, all four backgrounds
  and all seven accents
- No student-role path modifies any mark
- A draft mark is invisible to the student it concerns
- Every student-reachable screen has a defined empty state
- A superseded mark shows old value, new value, date and reason

---

## 9.5 Teacher gradebook

The highest-load screen. Adoption is decided here.

### Stories
- As a teacher, I enter a full column of marks with the keyboard alone.
- As a teacher, I check my work before students see it.
- As a teacher, I move between my four classes without losing unsaved work.
- As a teacher, I correct a mistake and the record shows what happened.

### Requirements

**GB-1** Students as rows, assessments as columns, for one class–subject pair.

**GB-2 — Multiple classes.** A class selector above the grid: pills on desktop, a
horizontally scrolling row on mobile, each showing class, subject and student count.

**GB-3 — Drafts are per class.** Switching class and returning preserves unsaved marks
exactly. Losing a teacher's work once destroys trust permanently.

**GB-4** A new mark is `state = 'draft'`, visible only to the teacher, shown in the draft
colour.

**GB-5 — Publishing.** Publishing moves all drafts for that class–subject to
`state = 'published'` and makes them visible to students. The confirmation dialog reads:

> "24 գնահատական կհրապարակվի 11-Բ-ի աշակերտներին։ Հրապարակումից հետո ուղղումը կպահանջի նոր գրառում՝ պատճառով։"

That second sentence is what makes the teacher pause and check.

**GB-6 — Marks are append-only.** `mark.value` is never updated. A correction inserts a
new row with `supersedes_mark_id` set and a mandatory reason; the superseded row becomes
`'superseded'`. Enforced by a partial unique index, not by application code.

**GB-7** Full history per cell: who, when, from what to what, and why.

**GB-8 — Keyboard entry.** Every cell focusable with a visible focus ring.
- Digits 2–9 fill and advance down immediately
- **"1" waits 400ms**; a following "0" produces 10, otherwise it commits as 1. The
  pending "1" shows dimmed during the wait. **Without this, entering a 10 is impossible,
  and 10 is the mark teachers most want to enter quickly.**
- Backspace clears and stays
- `Enter`/`↓` next student · `Shift+Enter`/`↑` previous · `Tab`/`→` next column ·
  `Shift+Tab`/`←` previous · `Home`/`End` first/last · `Escape` exits
- At the end of a column, `Enter` wraps to the first student of the next
- The focused cell scrolls with `block: 'nearest'`, never centred

**GB-9** The tap picker remains available and is primary on mobile.

**GB-10 — New assessment column.** A "+" cell at the end of the header row inserts a
column with no dialog: date defaults to today, header enters edit mode, focus moves to
the first student's cell. `Escape` before any mark removes it. It overlaps no other
element.

**GB-11** The student name column and the column header stay pinned during scroll.

**GB-12** Below 768px the grid becomes a per-student list; tapping opens their marks as a
bottom sheet. Draft and publish logic identical.

**GB-13** Publishing displays a single gradient sweep across the top of the content area.
That is the confirmation; no toast accompanies it.

**GB-14** Export is available from the class header — a secondary action, deliberately
not placed beside Publish. They are different kinds of action and must not sit together.

### Acceptance criteria
- A column of 25 marks entered with only digits and `Enter`
- Typing "1" then "0" within 400ms produces 10; "1" alone produces 1
- Drafts in class A survive switching to B and back
- A published mark cannot be edited in place through any path
- Correcting a published mark without a reason is rejected
- The partial unique index prevents two current marks for one student and assessment
- The "+" cell overlaps nothing at 375px, 390px and 430px

---

## 9.6 Export

### Requirements

**EXP-1** Scope: one class–subject–term, one class for a term, or the whole institution
for a term.

**EXP-2** Formats: `.xlsx` default, `.csv` alternative.

**EXP-3** Layout: students as rows, assessments as columns, dates in the header, marks in
cells — the same shape as the on-screen grid, so it is recognisable without explanation.

**EXP-4 — Only published marks are exported.** Drafts never leave the product.

**EXP-5** Every export writes an `export_log` row: who, what scope, when, how many marks.
When someone asks whether a term was submitted, this answers it.

**EXP-6** The filename states its contents:
`Tessera_11-B_Hanrahashiv_1-kisamyak_2026-11-20.xlsx`. It will sit among forty others in
a downloads folder.

> ❓ **EXP-7 The exact column format the school needs is unknown.** Ask the administrator
> to show what they currently type or upload elsewhere. Matching that shape turns the
> export from "some data" into "the thing you paste in". Until then, ship the readable
> grid above — useful regardless.

### Acceptance criteria
- An export of a class with 25 students and 20 assessments opens cleanly in Excel and in
  LibreOffice
- No draft mark appears in any export
- Armenian text renders correctly in both formats — UTF-8 with BOM for CSV
- Every export appears in `export_log`

---

## 9.7 Iter

### Requirements

**IT-1** Reachable from every screen, both platform modes, all roles, all three
languages.

**IT-2** A floating circular button, bottom-right: 44px on mobile with clearance above
the navigation pill, 48px on web at 28px from the corner.

**IT-3 — It must not be confused with the QR button.** They differ in size (44 vs 58), in
hue (violet vs blue-teal), and in position. Size carries most of the distinction; colour
alone is insufficient.

**IT-4** Panel: a 420px right sheet on desktop; a 92%-height bottom sheet with grab handle
and swipe-to-dismiss on mobile.

**IT-5** The empty state greets by **first name only** — "Բարև, Անի" — with a second line
and three role-appropriate suggestion chips. Tapping a chip fills the input without
sending.

**IT-6** Four attachment actions: image, file, voice, "screenshot this screen". Maximum
four attachments, shown as removable thumbnails or chips above the field. Drag and drop
supported.

**IT-7 — No model in this release.** On send: the message posts, a thinking indicator
appears for 1400ms, then an honest line replaces it:
"Iter-ը դեռ միացված չէ։ Հաղորդագրությունը պահվել է։"

**IT-8 — No fabricated response, under any circumstance.** No canned answer, no simulated
reasoning. An input that silently swallows text reads as broken; an invented answer reads
as dishonest. One honest line is correct.

**IT-9** The thinking indicator is a pill whose 2px border is an animated conic gradient.
This animation appears nowhere else in the product.

**IT-10** Sent messages persist while the panel is open.

> ❓ **IT-11 Model hosting is a legal question, not a technical one.** When connected,
> Iter will read the academic records of minors. Where the model runs, what leaves the
> country, and whether the provider retains prompts must be settled before a single real
> response is generated. The interface is identical either way.

### Acceptance criteria
- Iter opens from every screen, all roles, both modes
- The greeting uses the first name only, once per session
- Sending produces exactly the honest line, never generated text
- Five attachments cannot be added
- The rotating gradient border appears on no other element

---

## 9.8 Credentials

**CR-1** A student submits: category, title, description, optional subject, one
attachment.

**CR-2** PDF, JPG, PNG up to 10MB. Type validated server-side by content, not extension.

**CR-3** States: `pending` → `approved` | `declined`. No other transitions.

**CR-4 — Declining requires a reason**, mandatory and shown to the student. A rejection
without explanation is worse than no system.

**CR-5** The reviewer is a teacher of the named subject, or an administrator.

**CR-6** An approved credential appears in the student's subject view, visually distinct
from a regular mark.

**CR-7** The teacher queue spans all their subjects; it is not class-scoped.

**CR-8** Every state change logged with actor and timestamp.

### Acceptance criteria
- Declining with an empty reason is rejected on client and server
- The student sees the decline reason in full
- A renamed `.exe` uploaded as `.pdf` is rejected by content inspection
- An approved credential is visible in the subject view, marked as non-formal

---

## 9.9 Settings, notifications, support

**SET-1** Seven groups: Հաշիվ · Տեսք · Լեզու · Ծանուցումներ · Արտահանում ·
Աջակցություն · Վիջեթներ. Sticky sub-navigation above 900px, a chip row below.

**SET-2** Account: read-only identity rows; inline password change with live strength
feedback; active sessions with individual and bulk revocation.

**SET-3** Appearance: theme (light/dark/system), accent (seven, black default),
background (four), Iter button position.

**SET-4** Language: three options, changing immediately with no reload and no state loss.

**SET-5** Notifications: toggles for new mark, request status change, weekly summary.
Interface only in this release.

**SET-6** Export: scope selection and format, per §9.6.

**SET-7 — Support.** The only channel a user has when something is wrong, and not
optional.
- Contact: subject, message, with app version, role and institution automatically
  attached and visible before sending
- Report a problem: same, with an optional "attach current screen data" checkbox
- Feedback: a 1–5 scale and free text
- FAQ: five entries as an accordion, including *"Ի՞նչ կապ ունի EMIS-ի հետ։"* — answered
  honestly: no direct connection; Tessera keeps the school's own record and produces an
  export file the school submits as it always has
- Version number, terms, privacy

**SET-8** Widgets: the eleven designs as a browsable gallery with a clear note that they
require a native application.

---

## 9.10 Platform and offline

**PL-1** Responsive web. Breakpoints at 768px and 900px.

**PL-2** Installable PWA. On mobile, a dismissible install prompt appears once after
first reaching the dashboard. Never on desktop.

**PL-3 — The device decides the layout.** The user is never asked whether they want web
or mobile. The Web/Mobile switch is a **prototype preview control**, visible above 900px
only.

**PL-4** Navigation: a collapsible sidebar on web; a floating pill with a docked centre
button on mobile. **The centre button is role-dependent**: a QR for a student, a **plus**
for a teacher that opens a new gradebook column (`dockGlyph: isT ? '+' : QR`). Teachers
have no card and no QR — see ID-10.

The rail and the pill are **different lists**, not one list at two widths. Settings is in
the rail; on mobile it is the header gear. The exact items are tabulated in
`tessera-roadmap.md`, Phase 4.

**PL-5** Offline: the ID and QR fully functional. Cached record data displayed with an
offline banner. Network-dependent actions disabled with an explanation.

**PL-6** Eleven widget designs delivered as specifications and a gallery. iOS
home-screen widgets require WidgetKit and cannot be delivered by a PWA — a platform
constraint, not a scheduling decision.

---

# 10. Data model

PostgreSQL. Every table carries `id uuid primary key default gen_random_uuid()`,
`created_at timestamptz not null default now()`, `updated_at timestamptz`.

> **This section is implemented and live.** `tessera-schema.sql` and `tessera-seed.sql`
> are the executable form of what follows, already applied to Neon. Both constraints in
> §10.3 have been verified against the running database: each violating insert was
> attempted and each was rejected.
>
> The backend generates its types by introspecting the live database and verifies the
> result against `tessera-schema.sql`. **No migrations are written. No table is altered,
> dropped or recreated.** If a change becomes genuinely necessary, it stops and asks.

## 10.1 Institution and structure

```sql
institution   (id, name, emis_id text null, region, type)
academic_year (id, institution_id fk, label, starts_on date, ends_on date)
term          (id, academic_year_id fk, index smallint, label, starts_on, ends_on)
class         (id, institution_id fk, academic_year_id fk, grade smallint, letter text)
subject       (id, institution_id fk, name_hy, name_en, name_ru, code text null)
```

`emis_id` is nullable and currently unused. Retained per §6.6.

## 10.2 People

```sql
"user"  (id, email citext unique, password_hash,
         role enum('student','teacher','admin'),
         locale enum('hy','en','ru') default 'hy',
         must_change_password bool default true,
         is_demo bool default false, last_login_at, locked_until)

student (id, user_id fk unique, institution_id fk, emis_student_id text null,
         first_name, last_name, patronymic, birth_date date)

teacher (id, user_id fk unique, institution_id fk, emis_teacher_id text null,
         first_name, last_name, patronymic)

enrollment          (id, student_id fk, class_id fk, academic_year_id fk,
                     status enum('active','transferred','departed','graduated'))

teaching_assignment (id, teacher_id fk, class_id fk, subject_id fk, academic_year_id fk)
```

`teaching_assignment` is why a teacher has several classes. Four classes means four rows.
It is never a column on `teacher`.

## 10.3 Marks — the core table

```sql
assessment (id, class_id fk, subject_id fk, term_id fk, held_on date,
            kind enum('lesson','test','exam','project'), title text null,
            topic text null, created_by_teacher_id fk)

mark (id, assessment_id fk, student_id fk,
      value smallint check (value between 1 and 10),
      state enum('draft','published','superseded') not null,
      supersedes_mark_id uuid null references mark(id),
      reason text null,
      entered_by_teacher_id fk, entered_at timestamptz not null,
      published_at timestamptz null)
```

**Invariant: `mark.value` is never UPDATEd.**

```sql
create unique index one_current_mark
  on mark (assessment_id, student_id)
  where state in ('draft','published');

alter table mark add constraint reason_required_when_superseding
  check (supersedes_mark_id is null or reason is not null);
```

Both constraints live in the database. An audit trail enforced only in application code
is not an audit trail, and audit integrity is the main credibility argument with an
administrator.

## 10.4 Import, export, credentials, identity, operations

```sql
import_batch (id, institution_id fk, actor_user_id fk,
              kind enum('students','teachers','assignments'),
              filename, row_count int, error_count int,
              status enum('previewing','applied','discarded'), created_at, applied_at)

import_row   (id, import_batch_id fk, row_index int, raw jsonb,
              status enum('ok','warning','error'), message text null,
              created_entity_id uuid null)

export_log   (id, institution_id fk, actor_user_id fk, scope jsonb,
              format enum('xlsx','csv'), mark_count int, created_at)

credential_request (id, student_id fk, subject_id fk null, category, title, description,
                    attachment_url text null, attachment_mime text null,
                    status enum('pending','approved','declined'),
                    decided_by_user_id fk null, decided_at, decision_reason text null)

qr_credential (id, student_id fk, seed text not null, issued_at, revoked_at null)
scan_event    (id, qr_credential_id fk, scanner_id text, scanned_at, result, location text null)

device_session    (id, user_id fk, device_label, refresh_token_hash, last_seen_at, revoked_at null)
notification_pref (id, user_id fk, kind, enabled bool)
support_ticket    (id, user_id fk, kind enum('contact','problem','feedback'),
                   subject, body, rating smallint null, context jsonb, created_at)
audit_log         (id, actor_user_id fk, action, entity_type, entity_id,
                   before jsonb, after jsonb, ip inet, created_at)
```

`import_row` is what makes the preview possible and what lets an administrator fix twelve
bad rows out of six hundred instead of re-uploading blindly.

## 10.5 Not stored

- Translated strings. The backend returns **error codes**; the client translates.
- Passwords in any recoverable form.
- Anything the product does not need.

## 10.6 Seed data

> **This section is applied. There is no seed script and none is to be written.**
>
> The data below was created once, by `tessera-seed.sql`, and is live on Neon. **Nothing
> wipes it.** A `npm run seed` command that "wipes and refills" would destroy 25 606
> marks, and no phase of the build requires one.
>
> If the dataset ever needs regenerating, it is done deliberately by running
> `tessera-seed.sql` by hand, never by a command that sits in `package.json` next to
> `npm start`.

One institution, one year with two terms, **eight classes, 200 students** with realistic
Armenian names — every full name distinct — **twenty teachers** with four assignments
each, ten subjects, fourteen assessments per class–subject (1121 in total), and
25 606 published marks.

**Marks must not be random.** Each student gets a hidden ability score; marks generate
around it with noise. Some students strong in some subjects and weak in others — that
pattern is exactly what the mosaic exists to reveal, and uniformly random data makes
every screen look broken for reasons that are hard to diagnose.

Include: gaps, one visibly weaker class, several superseded marks with reasons, twelve
unpublished drafts for one teacher, eight credential requests in mixed states, and one
student with almost no marks so empty states are reachable.

All seeded data is obviously invented. No real student's name and no real school's data,
including from a school the author knows.

## 10.7 Demo accounts

Four accounts with `is_demo = true` and real **bcrypt** hashes at cost 12 (`$2a$12$`) —
verified in the live database — matching the login screen's demo buttons: a student, a teacher with four classes, an administrator, and a first-login
account that forces a password change.

---

# 11. Non-functional requirements

## 11.1 Performance

| Metric | Target |
|---|---|
| First contentful paint, 3G | < 2.0s |
| Time to interactive, 3G | < 4.0s |
| ID open to QR visible | < 500ms cached |
| Gradebook render, 30 × 20 | < 300ms |
| **Keystroke to cell update** | **< 50ms** |
| Roster import, 600 rows | < 30s including preview |
| API p95 read / write | < 300ms / < 600ms |

The keystroke figure is not decorative. Above roughly 100ms, bulk entry feels laggy and
teachers revert to paper.

## 11.2 Reliability

Optimistic UI with rollback on failure. Publish is idempotent — a repeated request with
the same batch identifier does not double-write. Import is transactional: a batch applies
completely or not at all.

## 11.3 Accessibility

WCAG 2.1 AA. Text contrast 4.5:1 against what is actually behind it, including through
translucent layers. Minimum touch target 44×44px. Full keyboard operability. Visible
focus indicators with no transition delay. All motion respects
`prefers-reduced-motion`. Screen-reader labels on every icon-only control.

## 11.4 Browser support

Last two versions of Chrome, Safari, Firefox, Edge. iOS Safari 16+. Android Chrome 110+.
`backdrop-filter` degrades to a solid surface where unsupported.

## 11.5 Technology

Backend Node.js with Express and TypeScript · ORM Drizzle · Frontend Next.js with
TypeScript · Styling Tailwind · Database PostgreSQL on Neon · Auth JWT.

Two root folders, `frontend` and `backend`, with a root `package.json` supporting a single
`npm start`. **No third-party database API layer** — the backend owns all database
interaction directly. No Neon serverless API, no Supabase, no BaaS of any kind.

### 11.5.1 Origin and session transport

**Single origin.** Next.js rewrites proxy `/api/*` to Express, so the browser and the API
share one origin.

The refresh token is httpOnly, Secure, `SameSite=Lax`, and path-scoped to the refresh
endpoint alone. The access token lives in memory and is never written to `localStorage`.

Separate origins were considered and rejected: they force `SameSite=None`, which sends
the refresh cookie on every cross-site request and moves CSRF defence from the browser
into application code. That is the wrong place to economise on a minor's academic record.

### 11.5.2 Password hashing

**Argon2id is the standard** (AUTH-6, S-2). Every password the product writes — a reset,
a forced first-login change, an account created by import — is hashed with Argon2id.

The four seeded demo accounts carry **bcrypt at cost 12** (`$2a$12$`), because the seed
was executed inside PostgreSQL and `pgcrypto` has no Argon2 implementation. This is a
fact about the live database, verified directly, not a preference.

**Both are accepted at login, and bcrypt is upgraded on the way through.** On a
successful login against a `$2a$` hash, the password — already in memory and already
verified — is rehashed with Argon2id and written back. The account is Argon2id from its
second login onward, with no reset and no user-visible step.

This satisfies S-2 without pretending the seeded hashes are something they are not.

### 11.5.3 Email

Password reset is the only email the product sends. Transport is **Resend**, configured
by `RESEND_API_KEY` and `MAIL_FROM`.

In development, `MAIL_TRANSPORT=console` prints the reset link to the server log rather
than sending it, so recovery is testable before a domain exists.

❓ **Q9.** A school may require mail to originate from its own SMTP server. That changes
configuration, not architecture.

### 11.5.4 The Tessera identifier

The identifier printed on the ID card and shown in Settings → Account is **Tessera's
own**, in the format `TSR-AM-####-####`. Its label is `Tessera ID`.

It is derived deterministically from `student.id` and requires no schema change. It has
**no relation to `emis_student_id`**, which remains null and is read by nothing (§6.6).

This is stated explicitly because the design's data file names the field `emis`, and that
name invites exactly the wrong wiring.

### 11.5.5 Attachment storage

Credential attachments and import files go to **S3-compatible object storage —
Cloudflare R2** — in both development and production, using separate buckets. MinIO is
not used, which means **Docker is not required anywhere in this project**.

The backend is the only gateway. `credential_request.attachment_url` stores the object
**key**, never a public URL. A client asks the backend for a file; the backend checks
permission and returns a signed link valid for five minutes.

Storing a full URL would mean that anyone who saw it once has access forever.

Postgres `bytea` was rejected: binary data inflates every backup and every dump, and
Neon's storage tier fills quickly with scans and PDFs. A local filesystem volume was
rejected because deployment targets are ephemeral — the first restart loses every
uploaded certificate.

---

# 12. Localisation

**L-1** Armenian is the source and the default. English and Russian are translations.

**L-2** Every user-visible string lives in a single `T` dictionary with `hy`, `en`, `ru`
keys, organised by area. No Armenian text is hardcoded in any component.

**L-3 — The backend returns error codes, never translated messages.**

**L-4** Includes subject names, relative time expressions, and all empty, error and
confirmation copy.

**L-5** Russian runs roughly 15–20% longer than Armenian. Sidebar labels, tab labels and
buttons are verified at the Russian setting.

**L-6** One font stack across all three. Only strings change.

**L-7** Compact HY · EN · RU in the interface; full names in Settings. It does not appear
in the application header — language is a setting, not a toolbar control.

**L-8** Exported files carry Armenian text correctly: UTF-8 with BOM for CSV.

---

# 13. Security and privacy

**The system processes the personal and academic data of minors.** This governs every
decision below.

**S-1** TLS everywhere, HSTS enabled.

**S-2** Argon2id. Passwords never logged, never returned, never recoverable.

**S-3** Short-lived access tokens; refresh tokens httpOnly, rotated on use, revocable per
device.

**S-4** Authorisation enforced server-side on every request. A teacher requesting a class
they do not teach is rejected at the API, never merely hidden in the interface.

**S-5** All input validated server-side. Parameterised queries only.

**S-6** Uploads validated by content inspection, stored outside the web root, served
through an authenticated endpoint.

**S-7** Rate limiting: 6 login attempts per 15 minutes per account; 100 API requests per
minute per user.

**S-8** The QR payload contains identifiers only.

**S-9** Scan events retained for one academic year, then aggregated and the detail
discarded.

**S-10** `audit_log` records every mark change, credential decision, permission change,
import, export and account action, with actor, timestamp and before/after state.

**S-11** No analytics, tracking pixels or third-party scripts that transmit student data.

**S-12** Temporary passwords from an import are single-use in effect —
`must_change_password` is set on every generated account.

> ❓ **S-13 Data residency is unresolved.** Whether the database may be hosted outside
> Armenia, and under what conditions, depends on Armenian data protection law as applied
> to minors' educational records. **Must be answered before any deployment holding real
> student data.** It does not affect development against seeded data.

> ❓ **S-14 Iter's model hosting** is the same question in a different form. See IT-11.

---

# 14. Design system

The interface is governed by the design brief and its token file. The following are
normative constraints, not preferences:

1. **Grade colours never change** — not with theme, background, accent or opacity
2. **The accent appears in exactly three places** — primary buttons, active navigation,
   focus ring
3. **Data surfaces are opaque; chrome may be glass** — glass frames data, never sits
   beneath it
4. **No gradient has a visible edge** — colour reaches full transparency before any
   boundary
5. **Grain overlays every gradient surface**
6. **Glass is two layers** — a solid object with a frosted panel partially over it
7. **`--accent-tint` never resolves to pure black or white**
8. **Minimum radius 14px; minimum touch target 44px**
9. **`backdrop-filter` on at most 8 elements per screen**

The token file — CSS custom properties only — is the contract between design and
implementation. Colours are read from it, never sampled from screenshots.

---


## 14.1 Administrative screens

The administrator interface has no precedent in the design package — `role` there has two
values, `student` and `teacher`. Those ten screens are built from design system
primitives.

They use the **full token layer** without exception: colours, accent, type scale, spacing
grid, buttons, inputs, tables, focus states, empty states, motion timings. Anyone opening
them recognises the same product.

They omit only the **decorative layer** — glass panels, gradient surfaces, grain — and
only where it harms the task. A six-hundred-row import preview needs contrast to find
twelve bad rows; frosted glass reduces it. Density is higher because these are data
screens.

This is not a simplified second-class interface. It is the correct instrument for a data
surface, in the same family and at the same standard.

---

# 15. Success metrics

> ❓ **Targets are not set**, because setting them before the field interviews would be
> inventing them. The shape is correct; the numbers come from §5.2.

| Feature | Signal | Not a signal |
|---|---|---|
| Student ID | N students display the QR at least twice weekly through the first month | Downloads |
| Gradebook | N teachers enter a full term in Tessera and **not** in parallel elsewhere | Logins |
| Credentials | Median submission-to-decision time falls from X to Y days | Submissions received |
| Setup | A school completes setup and roster import **without contacting the author** | Schools signed up |

The parallel-entry measure is the important one. A teacher who uses Tessera *and* keeps
their old notebook has not adopted anything.

The setup measure is the second most important. If a director cannot get their school in
without help, the product does not scale beyond one pilot.

"People liked it" is not a measurement.

---

# 16. Build phases

**Superseded by `tessera-roadmap.md`, which is the plan of record.**

The phase table that stood here assumed the database had yet to be created and that a
local Docker Postgres would be used. Neither is true: the schema and the seed are live on
Neon, and no Docker is used anywhere (§11.5.5). Keeping a stale sequence next to a live
one guarantees that one of them is followed by mistake.

The roadmap expands each phase into screens, endpoints, frontend work, and a test the
author can run personally. It contains sixteen phases, numbered 0 to 15, rather than
fourteen, because
authentication is split into backend and frontend, a typed data access layer is inserted
before any HTTP route, and the teacher's "Այսօր" screen is separated out — see §16.1.

Two principles from the original table survive and still hold:

**Schema before screens.** Models derived from a prototype's invented shapes rather than
from §10 are rebuilt later. This is now satisfied by construction: the schema exists and
the backend introspects it.

**Administration before student and teacher features.** Without a roster there is nothing
for them to operate on, and it is the largest area of new work. It must not be discovered
late. See §17 risk 4.

## 16.1 The teacher has no ID card

`corrections-6.md` §2 removed the ID card and the QR from the teacher role entirely. The
teacher's "Քարտ" navigation slot became **"Այսօր"**, and the implemented code follows it:
`isId: !isT && st.screen === 'id'`.

Teacher navigation is therefore `gradebook · today · queue · archive · settings`.

Any earlier description of a teacher ID card variant, and any mobile shell file still
containing one, is an older build and must not be used as a reference.

---

# 17. Risks

Ordered by the cost of leaving them unresolved.

| # | Risk | Cost of delay | Mitigation |
|---|---|---|---|
| 1 | Teachers are satisfied with the existing gradebook | Half the product has no reason to exist | Q1 in the administrator interview |
| 2 | Why the Polytechnic discontinued digital cards | The core feature may have failed here once | Ask anyone connected to that programme |
| 3 | No evidence the problem is real | Months building for nobody | Eight interviews, one week |
| 4 | Administration setup is larger than estimated | The whole product is blocked behind it | Phase 5 is placed early precisely for this |
| 5 | Data residency for minors' records | Cannot deploy with real data | Resolve before any real deployment |
| 6 | Iter model hosting | Cannot enable Iter with real data | Same; interface unaffected |
| 7 | No savings figures | No commercial argument | Q4 in the administrator interview |
| 8 | Export format does not match what the school needs | Export is decorative | Ask to see what they currently submit |
| 9 | Curriculum tagging unavailable | Topic breakdown cannot ship | Schema supports it; UI degrades |

**The EMIS dependency, previously risk 1, has been eliminated by the decision in §6.**

---

# 18. Open questions

Each is answered by a person, not by analysis.

| # | Question | Who answers | Blocks |
|---|---|---|---|
| Q1 | Do teachers use the existing gradebook, or avoid it, and why? | Teachers, administrator | The gradebook's justification |
| Q2 | Why were the Polytechnic's digital cards discontinued? | That institution | The ID's core premise |
| Q3 | Can the school export its roster to a file? | Administrator | Could halve the work in §9.2 |
| Q4 | What does the school spend on certificates, paper, staff time, cards? | Administrator | The commercial argument |
| Q5 | Who decides a software purchase — the school or the ministry? | Administrator | Go-to-market |
| Q6 | What format does the school need marks in when it submits them? | Administrator | EXP-7 |
| Q7 | May minors' records be hosted outside Armenia? | Legal / ԿԳՄՍ | Real-data deployment |
| Q8 | Is curriculum topic data available, and will teachers enter it? | Teachers | Topic breakdown |
| Q9 | Which email provider, and does the school require its own SMTP? | Administrator | Nothing — §11.5.2 has a working default |
| Q10 | How long may Iter messages be retained? | Legal / ԿԳՄՍ | Storing Iter messages at all. Until answered, nothing is stored |

**None of Q1–Q10 blocks development against seeded data.** Every one of them blocks the
claim that this product should exist. Both statements are true simultaneously, and this
document is written so that building can proceed while the second set is resolved.

---

*End of document.*
