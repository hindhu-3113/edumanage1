-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "registerNo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENROLLED',
    "academicYear" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("academicYear", "createdAt", "departmentId", "email", "id", "name", "phone", "registerNo", "updatedAt") SELECT "academicYear", "createdAt", "departmentId", "email", "id", "name", "phone", "registerNo", "updatedAt" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_registerNo_key" ON "Student"("registerNo");
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");
CREATE INDEX "Student_departmentId_idx" ON "Student"("departmentId");
CREATE INDEX "Student_academicYear_idx" ON "Student"("academicYear");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
