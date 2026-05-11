import { Session } from "next-auth"
import { prisma } from "@/lib/prisma"

export type UserRole = "admin" | "teacher" | "user";

export type AuthUser = {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isActive: boolean;
    canUploadErrors: boolean;
    educationStage?: string | null;
    enrollmentYear?: number | null;
};

export function isAdmin(user: { role?: string } | null | undefined) {
    return user?.role === "admin"
}

export function isTeacher(user: { role?: string } | null | undefined) {
    return user?.role === "teacher"
}

export function isStudent(user: { role?: string } | null | undefined) {
    return !user?.role || user.role === "user"
}

export function canManageSystemSettings(user: { role?: string } | null | undefined) {
    return isAdmin(user)
}

export function canAssignErrorItems(user: { role?: string } | null | undefined) {
    return isAdmin(user) || isTeacher(user)
}

export function canUploadErrorItems(user: { role?: string; isActive?: boolean; canUploadErrors?: boolean } | null | undefined) {
    if (!user?.isActive) return false;
    if (isAdmin(user) || isTeacher(user)) return true;
    return isStudent(user) && user.canUploadErrors !== false;
}

export function requireAdmin(session: Session | null) {
    if (!session || !isAdmin(session.user)) {
        return false
    }
    return true
}

export async function getCurrentUser(session: Session | null): Promise<AuthUser | null> {
    if (!session?.user?.email) {
        return null;
    }

    return prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            canUploadErrors: true,
            educationStage: true,
            enrollmentYear: true,
        },
    });
}

export async function getActiveCurrentUser(session: Session | null): Promise<AuthUser | null> {
    const user = await getCurrentUser(session);
    if (!user?.isActive) {
        return null;
    }
    return user;
}
