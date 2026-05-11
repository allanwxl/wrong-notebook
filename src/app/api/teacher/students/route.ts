import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAssignErrorItems, getActiveCurrentUser } from "@/lib/auth-utils";
import { forbidden, internalError, unauthorized } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:teacher:students");

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    const user = await getActiveCurrentUser(session);
    if (!user) return unauthorized("Authentication required");
    if (!canAssignErrorItems(user)) return forbidden("Teacher or admin access required");

    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("query")?.trim();

        const students = await prisma.user.findMany({
            where: {
                role: "user",
                isActive: true,
                ...(query
                    ? {
                        OR: [
                            { name: { contains: query } },
                            { email: { contains: query } },
                        ],
                    }
                    : {}),
            },
            orderBy: [{ name: "asc" }, { email: "asc" }],
            select: {
                id: true,
                name: true,
                email: true,
                canUploadErrors: true,
            },
        });

        return NextResponse.json(students);
    } catch (error) {
        logger.error({ error }, "Failed to fetch assignable students");
        return internalError("Failed to fetch students");
    }
}
