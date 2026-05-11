import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { hash } from "bcryptjs"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-utils"
import { badRequest, conflict, forbidden, internalError, validationError } from "@/lib/api-errors"
import { createLogger } from "@/lib/logger"
import { isValidUserIdentifier, normalizeUserIdentifier, userIdentifierErrorMessage } from "@/lib/user-identifier"

const logger = createLogger('api:admin:users');
const VALID_ROLES = new Set(["admin", "teacher", "user"]);

const createUserSchema = z.object({
    email: z.string().min(1).transform(normalizeUserIdentifier).refine(isValidUserIdentifier, {
        message: userIdentifierErrorMessage(),
    }),
    password: z.string().min(6, "Password must be at least 6 characters"),
    name: z.string().min(1, "Name is required"),
    role: z.enum(["admin", "teacher", "user"]).default("user"),
    isActive: z.boolean().default(true),
    canUploadErrors: z.boolean().default(true),
});

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!requireAdmin(session)) {
        return forbidden("Admin access required")
    }

    try {
        const users = await prisma.user.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                canUploadErrors: true,
                createdAt: true,
                _count: {
                    select: {
                        errorItems: true,
                        practiceRecords: true
                    }
                }
            }
        })

        return NextResponse.json(users)
    } catch (error) {
        logger.error({ error }, 'Error fetching users');
        return internalError("Failed to fetch users")
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!requireAdmin(session)) {
        return forbidden("Admin access required")
    }

    try {
        const body = await req.json()
        const parsed = createUserSchema.safeParse(body)

        if (!parsed.success) {
            return validationError("Invalid user data", parsed.error.flatten())
        }

        const { email, password, name, role, isActive, canUploadErrors } = parsed.data

        if (!VALID_ROLES.has(role)) {
            return badRequest("Invalid role")
        }

        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            return conflict("User with this email or phone already exists")
        }

        const hashedPassword = await hash(password, 10)
        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                role,
                isActive,
                canUploadErrors,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                canUploadErrors: true,
                createdAt: true,
                _count: {
                    select: {
                        errorItems: true,
                        practiceRecords: true
                    }
                }
            }
        })

        return NextResponse.json(user, { status: 201 })
    } catch (error) {
        logger.error({ error }, 'Error creating user');
        return internalError("Failed to create user")
    }
}
