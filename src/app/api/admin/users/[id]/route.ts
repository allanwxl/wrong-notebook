import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-utils"
import { forbidden, badRequest, internalError } from "@/lib/api-errors"
import { createLogger } from "@/lib/logger"

const logger = createLogger('api:admin:users:id');
const VALID_ROLES = new Set(["admin", "teacher", "user"]);

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions)

    if (!requireAdmin(session)) {
        return forbidden("Admin access required")
    }

    try {
        const body = await req.json()
        const { isActive, role, canUploadErrors } = body

        // Prevent disabling self
        if (id === session?.user.id && isActive === false) {
            return badRequest("Cannot disable your own account")
        }

        // Prevent disabling super admin
        const targetUser = await prisma.user.findUnique({
            where: { id }
        })

        if (!targetUser) {
            return badRequest("User not found")
        }

        if (targetUser.email === 'admin@localhost' && isActive === false) {
            return badRequest("Cannot disable super admin")
        }

        if (role !== undefined && !VALID_ROLES.has(role)) {
            return badRequest("Invalid role")
        }

        if (id === session?.user.id && role && role !== "admin") {
            return badRequest("Cannot change your own admin role")
        }

        const nextRole = role ?? targetUser.role;
        const nextIsActive = typeof isActive === "boolean" ? isActive : targetUser.isActive;
        if (targetUser.role === "admin" && (nextRole !== "admin" || !nextIsActive)) {
            const activeAdminCount = await prisma.user.count({
                where: {
                    role: "admin",
                    isActive: true,
                    NOT: { id },
                },
            });
            if (activeAdminCount === 0) {
                return badRequest("At least one active administrator is required")
            }
        }

        const updateData: { isActive?: boolean; role?: string; canUploadErrors?: boolean } = {};
        if (typeof isActive === "boolean") updateData.isActive = isActive;
        if (role !== undefined) updateData.role = role;
        if (typeof canUploadErrors === "boolean") updateData.canUploadErrors = canUploadErrors;

        const user = await prisma.user.update({
            where: {
                id
            },
            data: updateData
        })

        return NextResponse.json(user)
    } catch (error) {
        logger.error({ error }, 'Error updating user');
        return internalError("Failed to update user")
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions)

    if (!requireAdmin(session)) {
        return forbidden("Admin access required")
    }

    try {
        // Prevent deleting self
        if (id === session?.user.id) {
            return badRequest("Cannot delete your own account")
        }

        // Prevent deleting super admin
        const targetUser = await prisma.user.findUnique({
            where: { id }
        })

        if (targetUser?.role === 'admin') {
            if (targetUser.email === 'admin@localhost') {
                return badRequest("Cannot delete super admin")
            }
            const activeAdminCount = await prisma.user.count({
                where: {
                    role: "admin",
                    isActive: true,
                    NOT: { id },
                },
            });
            if (targetUser.isActive && activeAdminCount === 0) {
                return badRequest("At least one active administrator is required")
            }
        }

        const user = await prisma.user.delete({
            where: {
                id
            }
        })

        return NextResponse.json(user)
    } catch (error) {
        logger.error({ error }, 'Error deleting user');
        return internalError("Failed to delete user")
    }
}
