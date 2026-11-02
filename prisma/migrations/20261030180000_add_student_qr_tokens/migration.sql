ALTER TABLE "Student" ADD COLUMN "qrToken" TEXT;

CREATE UNIQUE INDEX "Student_qrToken_key" ON "Student"("qrToken");
