import { PrismaClient } from "../node_modules/@prisma/client-fee/index.js";

const prisma = new PrismaClient();
const sampleDueDate = new Date("2026-12-15T00:00:00.000Z");
const feeSamples = [
  {
    registerNo: "EDU2024001",
    totalAmountPaise: 4_500_000,
    payments: [
      { amountPaise: 3_000_000, method: "BANK_TRANSFER", date: "2026-10-10", reference: "SAMPLE-BANK-001" },
      { amountPaise: 1_500_000, method: "UPI", date: "2026-10-20", reference: "SAMPLE-UPI-001" },
    ],
  },
  {
    registerNo: "EDU2024002",
    totalAmountPaise: 5_000_000,
    payments: [
      { amountPaise: 2_000_000, method: "CASH", date: "2026-10-12", reference: "SAMPLE-CASH-002" },
    ],
  },
  {
    registerNo: "EDU2024003",
    totalAmountPaise: 4_000_000,
    payments: [],
  },
  {
    registerNo: "EDU2024004",
    totalAmountPaise: 5_500_000,
    payments: [
      { amountPaise: 1_000_000, method: "CARD", date: "2026-10-14", reference: "SAMPLE-CARD-004" },
      { amountPaise: 2_000_000, method: "UPI", date: "2026-10-24", reference: "SAMPLE-UPI-004" },
    ],
  },
  {
    registerNo: "EDU2024005",
    totalAmountPaise: 4_200_000,
    payments: [
      { amountPaise: 1_200_000, method: "CARD", date: "2026-10-18", reference: "SAMPLE-CARD-005" },
    ],
  },
];

function statusAfter(paidPaise, totalPaise) {
  if (paidPaise >= totalPaise) return "PAID";
  return paidPaise > 0 ? "PARTIALLY_PAID" : "PENDING";
}

async function main() {
  const students = await prisma.student.findMany({
    where: { registerNo: { in: feeSamples.map((sample) => sample.registerNo) } },
    select: { id: true, name: true, registerNo: true },
  });
  const byRegisterNo = new Map(students.map((student) => [student.registerNo, student]));
  let created = 0;
  let skipped = 0;

  for (const sample of feeSamples) {
    const student = byRegisterNo.get(sample.registerNo);
    if (!student) {
      console.warn(`Skipped fee sample: existing student ${sample.registerNo} was not found.`);
      skipped += 1;
      continue;
    }

    const existing = await prisma.feeRecord.findUnique({ where: { studentId: student.id } });
    if (existing) {
      console.log(`Skipped ${student.name}: a fee record already exists.`);
      skipped += 1;
      continue;
    }

    await prisma.$transaction(async (transaction) => {
      const feeRecord = await transaction.feeRecord.create({
        data: {
          studentId: student.id,
          totalAmountPaise: sample.totalAmountPaise,
          amountPaidPaise: 0,
          dueDate: sampleDueDate,
          isSample: true,
        },
      });
      let paidPaise = 0;
      for (const [paymentIndex, payment] of sample.payments.entries()) {
        paidPaise += payment.amountPaise;
        await transaction.feePayment.create({
          data: {
            feeRecordId: feeRecord.id,
            amountPaise: payment.amountPaise,
            paymentDate: new Date(`${payment.date}T00:00:00.000Z`),
            paymentMethod: payment.method,
            transactionReference: payment.reference,
            description: "SAMPLE TEST RECORD - not a real payment.",
            receiptNumber: `EM-SAMPLE-${sample.registerNo}-${String(paymentIndex + 1).padStart(2, "0")}`,
            idempotencyKey: `sample-fee-${sample.registerNo}-${paymentIndex + 1}-v1`,
            balanceAfterPaise: sample.totalAmountPaise - paidPaise,
            statusAfter: statusAfter(paidPaise, sample.totalAmountPaise),
          },
        });
      }
      if (sample.payments.length) {
        await transaction.feeRecord.update({
          where: { id: feeRecord.id },
          data: { amountPaidPaise: paidPaise },
        });
      }
    });
    console.log(`Added clearly marked sample fee data for ${student.name}.`);
    created += 1;
  }

  console.log(`Fee sample run complete: ${created} created, ${skipped} skipped.`);
}

main()
  .catch((error) => {
    console.error("Fee sample seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
