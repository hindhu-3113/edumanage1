CREATE TABLE "PerformanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "examName" TEXT NOT NULL,
    "marksObtainedHundredths" INTEGER NOT NULL,
    "maximumMarksHundredths" INTEGER NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PerformanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PerformanceRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PerformanceRecord_studentId_subjectId_examName_key" ON "PerformanceRecord"("studentId", "subjectId", "examName");
CREATE INDEX "PerformanceRecord_studentId_idx" ON "PerformanceRecord"("studentId");
CREATE INDEX "PerformanceRecord_subjectId_idx" ON "PerformanceRecord"("subjectId");
CREATE INDEX "PerformanceRecord_examName_idx" ON "PerformanceRecord"("examName");
