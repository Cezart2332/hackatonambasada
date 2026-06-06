import { prisma } from "../../shared/prisma.js";

function mapApprovalStatus(status: string | undefined | null) {
  if (status === "APPROVED") return "approved";
  if (status === "REJECTED") return "rejected";
  if (status === "PENDING") return "pending";
  return null;
}

export async function getAccount(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      producerProfile: { select: { approvalStatus: true } },
      venueProfile: { select: { approvalStatus: true } },
    },
  });

  const accountType =
    user.accountType === "VENUE"
      ? "venue"
      : user.accountType === "ADMIN"
        ? "admin"
        : "producer";

  const approvalStatus =
    user.accountType === "PRODUCER"
      ? mapApprovalStatus(user.producerProfile?.approvalStatus)
      : user.accountType === "VENUE"
        ? mapApprovalStatus(user.venueProfile?.approvalStatus)
        : null;

  return { accountType, approvalStatus };
}
