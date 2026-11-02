ALTER TABLE "Teacher" ADD COLUMN "departmentId" TEXT REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Teacher" ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subject" ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Teacher_departmentId_idx" ON "Teacher"("departmentId");
