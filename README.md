# EduManage

EduManage is a student management dashboard built with Next.js 16, TypeScript, Tailwind CSS 4, Prisma 6, and SQLite. It runs locally and does not require a paid service.

## First-time setup (PowerShell)

Use Node.js 20.9 or newer. From the existing project folder, run:

```powershell
Set-Location "C:\Users\ADMIN\Documents\edumanage1"
npm.cmd install
npm.cmd run db:generate
npm.cmd run db:migrate -- --name init
npm.cmd run db:seed
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database is `dev.db` in the project root and is created by the migration command. The sample seed can be run again safely; it uses upserts.

For later runs, start the app with:

```powershell
Set-Location "C:\Users\ADMIN\Documents\edumanage1"
npm.cmd run dev
```

## Features

- Dashboard totals, today’s attendance, a seven-day attendance chart, and recently added students.
- Dashboard totals for students, departments, teachers, classes, and subjects, refreshed from database counts when the dashboard is revisited or regains focus.
- Low attendance alerts for students below 75%, calculated from their recorded Present/Absent days; students with no recorded days are excluded.
- Student create, view, edit, and delete, with required-field and email validation.
- Teacher create, view, edit, and delete, with name/email validation and unique email addresses.
- Class create, view, edit, and delete, with required-field validation and unique class/year/section combinations.
- Subject create, view, edit, and delete, with unique subject codes and class/teacher assignments.
- Fee accounts, payment collection, balance tracking, searchable payment history, and printable receipts.
- Student performance records with validation, exam/subject filters, sorting, percentage analysis, and dashboard subject averages.
- Student risk analysis based on recorded attendance and valid academic results, with explainable support indicators, optional trend review when at least three results exist, and a dashboard summary.
- Weekly timetable management with class, subject, teacher, day, time, room, and academic-year fields; overlapping class/teacher schedules are rejected.
- Announcement board with categorized campus updates, priority filters, published and expiry dates, and add/edit/delete management.
- Per-student QR attendance codes with manual lookup fallback; scans save to the same attendance records as manual marking.
- Idempotent sample teacher/subject catalog records with department, class, and teacher assignments.
- Database-backed Excel (`.xlsx`) and PDF exports for students, attendance, fees/payment history, student performance, teachers, and subjects.
- Subject create, view, edit, and delete, with unique subject codes and class/teacher assignments.
- Persisted student enrollment status, shown in the directory.
- Search by student name or register number; filter by department and academic year.
- Student-directory CSV export.
- Date-specific Present/Absent attendance marking, bulk marking, and persistent saves.
- Department and local SQLite information in Settings.
- Responsive sidebar navigation, loading indicators, error messages, and save confirmations.

The sample data contains five departments, eight students, and attendance entries for the day the seed command is run. Academic years are Year 1 through Year 4.

## Testing the features

1. **Dashboard:** open `/` and check the totals, attendance overview, and recent-students list.
2. **Low attendance alerts:** the dashboard lists students with less than 75% attendance from their recorded Present/Absent days. Students with no recorded attendance are not counted as absent.
3. **Add a student:** open Students, select **Add student**, fill in all fields, and save. Use a unique register number and email.
4. **Status:** newly added and existing students display the persisted **Enrolled** status.
5. **Validation:** try submitting an empty form or an invalid email; the form blocks it. Try a register number or email already in use; the API shows a duplicate error.
6. **Search and filters:** search by part of a name or register number, then filter by department and academic year. Use **Export** to download the currently displayed results as CSV.
7. **Edit and delete:** use the row edit button to update a student. Use the delete button and confirm the prompt to remove a student.
8. **Attendance:** open Attendance, select a date, mark students Present or Absent, optionally use **Mark all present**, and select **Save changes**. Reload or revisit that date to confirm records persisted.
9. **Settings:** open Settings to view configured departments and local database details.
10. **Teachers:** open Teachers from the sidebar, add a teacher with name and email (phone and qualification are optional), edit or delete the record, and search by name or email. Try reusing an existing email to verify duplicate validation.
11. **Classes:** open Classes from the sidebar, add a class with its academic year and section, then edit, search by any of those fields, or delete it. Try adding the same name/year/section combination twice to verify duplicate validation.
12. **Subjects:** open Subjects, add a unique subject code, optionally assign classes and teachers, then edit, search by name/code, or delete. A class or teacher assigned to a subject cannot be deleted until it is unassigned.
12. **Subjects:** open Subjects, add a unique subject code, optionally assign classes and teachers, then edit, search by name/code, or delete. A class or teacher assigned to a subject cannot be deleted until it is unassigned.
13. **Fees:** open Fees, create one fee record per student, optionally assign a class, and set the total amount and due date. Use **Record payment** to enter a positive amount no greater than the remaining balance. A receipt is shown only after the database confirms the payment.
14. **Payment history and receipts:** search by student, register number, reference, or receipt; filter by payment date and status; open **Receipt** to reprint a saved payment receipt.
15. **Fee sample data:** run `npm.cmd run db:seed-fees` to add clearly marked `SAMPLE TEST RECORD` entries for the existing seeded students. The operation skips any student who already has a fee account and is safe to rerun.
16. **Timetable:** open Timetable to create, edit, filter, and remove weekly class sessions. The API requires a subject to be assigned to both the selected class and teacher, validates 24-hour times, and prevents overlapping class or teacher schedules.
17. **QR attendance:** open Students and use a row’s QR button to view or print its QR code. On Attendance, choose the date and class, then start the camera scanner or use manual student lookup. QR scans and manual lookup save Present records in the same attendance table; duplicate date/student marks are rejected.
18. **Announcements:** open Announcements from the sidebar to create, view, edit, search, filter, and delete campus updates. Active or expired status is derived from the expiry date. Run `npm.cmd run db:seed-announcements` to add eight clearly marked demonstration announcements; rerunning the seed skips existing titles.
19. **Student risk analysis:** open Risk Analysis to search/filter students by risk level and view each support profile. Attendance below 60% or academic average below 40% is High risk; attendance below 75% or academic average below 60% is Medium risk. A significant recent academic decline can also indicate Medium risk when at least three valid performance records exist. Missing data is not treated as zero. Risk indicators are not guaranteed predictions of future outcomes.

The announcement migration is additive: it creates a separate announcement table and does not change existing records. Apply pending migrations to an existing database with `npx.cmd prisma migrate deploy` before using the board.

Run code checks and a production build with:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

## Database commands

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
```

Prisma schema and migrations live under `prisma`. To add a department, update the department list in `prisma/seed.mjs` and run the seed command again.

### Applying Phase 4.1 to an existing database

The fee migration is additive and creates only the `FeeRecord` and `FeePayment` tables and indexes. For a database that already contains EduManage data, apply pending migrations without resetting the database:

```powershell
Set-Location "C:\Users\ADMIN\Documents\edumanage1"
npx.cmd prisma migrate deploy
```

Prisma uses a separate generated fee client so this feature can be generated without replacing the client file currently held by a running development server. To regenerate only the fee client while that server is running:

```powershell
npx.cmd prisma generate --generator feeClient
```

When no development server is running, `npm.cmd run db:generate` generates both Prisma clients. Add the clearly marked sample fee records with:

```powershell
npm.cmd run db:seed-fees
```

Student records with fee accounts are protected from deletion so the payment ledger is not lost. The current application does not implement authentication or role-based access; fee APIs follow its existing access pattern and should not be exposed publicly until authentication is added.

### Applying Phase 4.2 to an existing database

The performance migration adds a `PerformanceRecord` table and indexes, with restrictive foreign keys to existing students and subjects. It does not alter existing rows. From the project folder, apply the migration and generate the isolated performance client:

```powershell
Set-Location "C:\Users\ADMIN\Documents\edumanage1"
npx.cmd prisma generate --generator performanceClient
npx.cmd prisma migrate deploy
npm.cmd run db:seed-performance
```

The sample seed creates clearly marked `SAMPLE TEST` exam records only when the student/subject/exam combination does not already exist. Performance records can be created, edited, searched by student, filtered by subject or exam, and sorted on the Performance page. Duplicate student/subject/exam combinations are rejected; distinct exam names remain separate records. Marks support up to two decimal places and percentages are calculated from the saved marks.

Performance is summarized in the dashboard and student analysis page. Students or subjects with associated performance history cannot be deleted until that history is removed. Like the rest of the application, these APIs currently follow the project’s existing no-authentication pattern; add authentication before exposing the app publicly.

### Applying Phase 4.3 to an existing database

The additive migration adds an optional department relation and sample marker for teachers, plus a sample marker for subjects. Existing teacher and subject data are retained; existing teachers remain without a department unless one is assigned later.

```powershell
Set-Location "C:\Users\ADMIN\Documents\edumanage1"
npx.cmd prisma generate --generator reportClient
npx.cmd prisma migrate deploy
npm.cmd run db:seed-sample-catalog
```

The sample catalog seed creates missing sample teachers and subjects by their unique email/code, assigns teachers to existing departments, and assigns each sample subject to an existing class and teacher. Existing rows and assignments are not overwritten. Rerunning `npm.cmd run db:seed-sample-catalog` is safe.

Excel and PDF export actions are available from the Students, Attendance, Fees, Performance, Teachers, and Subjects pages. The reports are queried from the database, respect the relevant page filters, and include a title and generation date. Empty filtered reports still download with column headings and an empty-result note.

### Applying Phase 4.4 to an existing database

The additive timetable migration creates a new `TimetableEntry` table and indexes with restrictive relations to existing classes, subjects, and teachers. It does not change existing records. Apply the migration and generate the isolated client without resetting or replacing the main client:

```powershell
Set-Location "C:\Users\ADMIN\Documents\edumanage1"
npx.cmd prisma generate --generator timetableClient
npx.cmd prisma migrate deploy
npm.cmd run db:seed-timetable
```

The sample seed uses existing sample subject/class/teacher assignments, skips matching or conflicting entries, and can be rerun safely. The dashboard shows today's schedule. Timetable records protect their related class, subject, and teacher from deletion until the schedule entry is removed. The current application does not implement authentication or role-based access; timetable APIs follow its existing access pattern.

### Applying Phase 4.5 to an existing database

The additive migration adds a nullable unique QR token to existing students and does not change any other student fields, attendance, or records. Generate the isolated QR client and apply the migration, then create identifiers for existing students:

```powershell
Set-Location "C:\Users\ADMIN\Documents\edumanage1"
npx.cmd prisma generate --generator qrClient
npx.cmd prisma migrate deploy
npm.cmd run db:seed-student-qr
```

The seed generates a random 256-bit opaque token only for students without one; reruns are safe. New students receive a token when created. QR payloads contain only the opaque token, not personal information. The camera library is loaded only after the user explicitly starts the scanner. Browser camera access requires permission and a secure context (HTTPS or localhost).

Student records do not currently have a class relationship. The QR attendance form requires a class to identify the session, but cannot verify that an individual student belongs to that class. The token is a bearer code and does not establish the identity of its holder. This application has no authentication or role-based access, so QR retrieval and attendance endpoints are not production-secure and should not be exposed publicly before access controls are implemented.

## API routes

- `GET /api/dashboard`
- `GET, POST /api/students`
- `GET, PUT, DELETE /api/students/[id]`
- `GET, POST /api/teachers`
- `GET, PUT, DELETE /api/teachers/[id]`
- `GET, POST /api/classes`
- `GET, PUT, DELETE /api/classes/[id]`
- `GET, POST /api/subjects`
- `GET, PUT, DELETE /api/subjects/[id]`
- `GET /api/performance`
- `POST /api/performance`
- `PUT, DELETE /api/performance/[id]`
- `GET, POST /api/timetable`
- `PUT, DELETE /api/timetable/[id]`
- `GET, POST /api/fees`
- `GET, POST /api/payments`
- `GET /api/payments/[id]`
- `GET, POST /api/attendance`
- `POST /api/attendance/qr`
- `GET /api/students/[id]/qr`
- `GET /api/departments`
- `GET /api/exports/[report]?format=xlsx|pdf`
