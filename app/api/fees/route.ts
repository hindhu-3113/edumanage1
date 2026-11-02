import { Prisma } from "@prisma/client-fee";
import { feePrisma as prisma } from "@/lib/fee-prisma";
import { validateFeeRecord } from "@/lib/fee-validation";

type FeeStatus = "PAID" | "PARTIALLY_PAID" | "PENDING";

function getStatus(paid: number, total: number): FeeStatus {
  if (paid >= total) return "PAID";
  return paid > 0 ? "PARTIALLY_PAID" : "PENDING";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const requestedStatus = searchParams.get("status");
    if (requestedStatus && !["PAID", "PARTIALLY_PAID", "PENDING"].includes(requestedStatus)) {
      return Response.json({ error: "Fee status filter is invalid." }, { status: 400 });
    }

    const records = await prisma.feeRecord.findMany({
      include: {
        student: { include: { department: true } },
        class: true,
      },
      orderBy: [{ dueDate: "asc" }, { student: { name: "asc" } }],
    });
    const allFees = records.map((record) => ({
      ...record,
      status: getStatus(record.amountPaidPaise, record.totalAmountPaise),
    }));
    const fees = allFees.filter((record) => {
      const matchesStatus = !requestedStatus || record.status === requestedStatus;
      const needle = search?.toLocaleLowerCase();
      const matchesSearch =
        !needle ||
        record.student.name.toLocaleLowerCase().includes(needle) ||
        record.student.registerNo.toLocaleLowerCase().includes(needle) ||
        record.student.id.toLocaleLowerCase().includes(needle);
      return matchesStatus && matchesSearch;
    });
    const payableFees = allFees.filter((record) => record.status !== "PAID");

    const totalExpectedPaise = records.reduce((sum, record) => sum + record.totalAmountPaise, 0);
    const totalCollectedPaise = records.reduce((sum, record) => sum + record.amountPaidPaise, 0);
    const dashboard = {
      totalExpectedPaise,
      totalCollectedPaise,
      totalPendingPaise: totalExpectedPaise - totalCollectedPaise,
      fullyPaidStudents: records.filter((record) => getStatus(record.amountPaidPaise, record.totalAmountPaise) === "PAID").length,
      partiallyPaidStudents: records.filter((record) => getStatus(record.amountPaidPaise, record.totalAmountPaise) === "PARTIALLY_PAID").length,
      pendingStudents: records.filter((record) => getStatus(record.amountPaidPaise, record.totalAmountPaise) === "PENDING").length,
    };

    return Response.json({ fees, payableFees, feeStudentIds: records.map((record) => record.studentId), dashboard });
  } catch (error) {
    console.error("Failed to load fee records:", error);
    return Response.json({ error: "Could not load fee records." }, { status: 500 });
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
    console.error("Failed to read fee record request:", error);
    return Response.json({ error: "Could not read fee record details." }, { status: 400 });
  }

  const result = validateFeeRecord(body);
  if (!result.success) return Response.json({ error: result.message }, { status: 400 });

  try {
    const feeRecord = await prisma.feeRecord.create({
      data: result.data,
      include: { student: true, class: true },
    });
    return Response.json(feeRecord, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Response.json({ error: "A fee record already exists for this student." }, { status: 409 });
      }
      if (error.code === "P2003") {
        return Response.json({ error: "Choose an existing student and class." }, { status: 400 });
      }
    }
    console.error("Failed to create fee record:", error);
    return Response.json({ error: "Could not create fee record." }, { status: 500 });
  }
}
