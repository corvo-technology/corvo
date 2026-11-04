import type { Actor } from "@corvo/contracts";
import type { PrismaClient } from "@corvo/db";
import { ORPCError } from "@orpc/server";

/** Refuses anyone who is not an owner of the Space the actor is acting in. */
export async function requireSpaceOwner(prisma: PrismaClient, actor: Actor): Promise<void> {
  const membership = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: actor.spaceId, userId: actor.userId } },
    select: { role: true },
  });
  const roles = membership?.role.split(",").map((role) => role.trim());
  if (!roles?.includes("owner")) throw new ORPCError("FORBIDDEN");
}
