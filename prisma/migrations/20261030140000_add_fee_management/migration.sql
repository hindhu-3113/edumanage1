CREATE TABLE "FeeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "classId" TEXT,
    "totalAmountPaise" INTEGER NOT NULL,
    "amountPaidPaise" INTEGER NOT NULL DEFAULT 0,
    "dueDate" DATETIME NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeeRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeeRecord_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FeeRecord_studentId_key" ON "FeeRecord"("studentId");
CREATE INDEX "FeeRecord_classId_idx" ON "FeeRecord"("classId");
CREATE INDEX "FeeRecord_dueDate_idx" ON "FeeRecord"("dueDate");

CREATE TABLE "FeePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feeRecordId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "transactionReference" TEXT,
    "description" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "balanceAfterPaise" INTEGER NOT NULL,
    "statusAfter" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeePayment_feeRecordId_fkey" FOREIGN KEY ("feeRecordId") REFERENCES "FeeRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FeePayment_receiptNumber_key" ON "FeePayment"("receiptNumber");
CREATE UNIQUE INDEX "FeePayment_idempotencyKey_key" ON "FeePayment"("idempotencyKey");
CREATE INDEX "FeePayment_feeRecordId_paymentDate_idx" ON "FeePayment"("feeRecordId", "paymentDate");
CREATE INDEX "FeePayment_paymentDate_idx" ON "FeePayment"("paymentDate");
CREATE INDEX "FeePayment_statusAfter_idx" ON "FeePayment"("statusAfter");
