import { Prisma } from "@prisma/client-fee";
import { randomUUID } from "node:crypto";
import { feePrisma as prisma } from "@/lib/fee-prisma";
import { validateFeePayment } from "@/lib/fee-validation";

function statusAfterPayment(paid: number, total: number): string {
  if (paid >= total) return "PAID";
  return paid > 0 ? "PARTIALLY_PAID" : "PENDING";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");
    if (status && !["PAID", "PARTIALLY_PAID", "PENDING"].includes(status)) {
      return Response.json({ error: "Payment status filter is invalid." }, { status: 400 });
    }
    const paymentDate: Prisma.DateTimeFilter = {};

    if (from) {
      const start = new Date(`${from}T00:00:00.000Z`);
      if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== from) {
        return Response.json({ error: "Start date is invalid." }, { status: 400 });
      }
      paymentDate.gte = start;
    }
    if (to) {
      const end = new Date(`${to}T23:59:59.999Z`);
      if (Number.isNaN(end.getTime()) || end.toISOString().slice(0, 10) !== to) {
        return Response.json({ error: "End date is invalid." }, { status: 400 });
      }
      paymentDate.lte = end;
    }
    if (from && to && from > to) {
      return Response.json({ error: "Start date must not be after end date." }, { status: 400 });
    }

    const payments = await prisma.feePayment.findMany({
      where: {
        ...(from || to ? { paymentDate } : {}),
        ...(status ? { statusAfter: status } : {}),
        ...(search
          ? {
              OR: [
                { receiptNumber: { contains: search } },
                { transactionReference: { contains: search } },
                {
                  feeRecord: {
                    student: {
                      OR: [
                        { name: { contains: search } },
                        { registerNo: { contains: search } },
                        { id: { contains: search } },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        feeRecord: {
          include: {
            student: { include: { department: true } },
            class: true,
          },
        },
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    });
    return Response.json(payments);
  } catch (error) {
    console.error("Failed to load payment history:", error);
    return Response.json({ error: "Could not load payment history." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    console.error("Failed to read payment request:", error);
    return Response.json({ error: "Could not read payment details." }, { status: 400 });
  }

  const result = validateFeePayment(body);
  if (!result.success) return Response.json({ error: result.message }, { status: 400 });

  const paymentData = result.data;
  try {
    const existing = await prisma.feePayment.findUnique({
      where: { idempotencyKey: paymentData.idempotencyKey },
      include: { feeRecord: { include: { student: true, class: true } } },
    });
    if (existing) {
      if (!isSameSubmission(existing, paymentData)) {
        return Response.json({ error: "This payment submission key was already used for different details." }, { status: 409 });
      }
      return Response.json(existing);
    }

    const fee = await prisma.feeRecord.findUnique({
      where: { id: paymentData.feeRecordId },
      select: { id: true, totalAmountPaise: true, amountPaidPaise: true },
    });
    if (!fee) return Response.json({ error: "Fee record not found." }, { status: 404 });

    const remainingPaise = fee.totalAmountPaise - fee.amountPaidPaise;
    if (paymentData.amountPaise > remainingPaise) {
      return Response.json({ error: "Payment cannot exceed the remaining balance." }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.feeRecord.updateMany({
        where: {
          id: fee.id,
          amountPaidPaise: fee.amountPaidPaise,
        },
        data: { amountPaidPaise: { increment: paymentData.amountPaise } },
      });
      if (updateResult.count !== 1) throw new Error("FEE_BALANCE_CHANGED");

      const balanceAfterPaise = remainingPaise - paymentData.amountPaise;
      const payment = await transaction.feePayment.create({
        data: {
          feeRecordId: fee.id,
          amountPaise: paymentData.amountPaise,
          paymentDate: paymentData.paymentDate,
          paymentMethod: paymentData.paymentMethod,
          transactionReference: paymentData.transactionReference,
          description: paymentData.description,
          receiptNumber: `EM-${paymentData.paymentDate.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
          idempotencyKey: paymentData.idempotencyKey,
          balanceAfterPaise,
          statusAfter: statusAfterPayment(fee.amountPaidPaise + paymentData.amountPaise, fee.totalAmountPaise),
        },
        include: {
          feeRecord: {
            include: {
              student: { include: { department: true } },
              class: true,
            },
          },
        },
      });
      return payment;
    });
    return Response.json(updated, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "FEE_BALANCE_CHANGED") {
      return Response.json({ error: "This fee balance changed while recording the payment. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const duplicate = await prisma.feePayment.findUnique({
          where: { idempotencyKey: paymentData.idempotencyKey },
          include: { feeRecord: { include: { student: true, class: true } } },
        });
        if (duplicate) {
          if (!isSameSubmission(duplicate, paymentData)) {
            return Response.json({ error: "This payment submission key was already used for different details." }, { status: 409 });
          }
          return Response.json(duplicate);
        }
        return Response.json({ error: "A payment with this receipt or submission key already exists." }, { status: 409 });
      }
      if (error.code === "P2025") return Response.json({ error: "Fee record not found." }, { status: 404 });
    }
    console.error("Failed to record payment:", error);
    return Response.json({ error: "Could not record payment." }, { status: 500 });
  }
}

function isSameSubmission(
  existing: {
    feeRecordId: string;
    amountPaise: number;
    paymentDate: Date;
    paymentMethod: string;
    transactionReference: string | null;
    description: string | null;
  },
  submitted: {
    feeRecordId: string;
    amountPaise: number;
    paymentDate: Date;
    paymentMethod: string;
    transactionReference: string | null;
    description: string | null;
  },
) {
  return existing.feeRecordId === submitted.feeRecordId &&
    existing.amountPaise === submitted.amountPaise &&
    existing.paymentDate.getTime() === submitted.paymentDate.getTime() &&
    existing.paymentMethod === submitted.paymentMethod &&
    existing.transactionReference === submitted.transactionReference &&
    existing.description === submitted.description;
}
