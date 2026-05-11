import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, internalError, notFound, unauthorized } from "@/lib/api-errors";
import { canAssignErrorItems, getActiveCurrentUser } from "@/lib/auth-utils";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:error-items:assign");

async function getOrCreateStudentSubject(tx: Prisma.TransactionClient, studentId: string, sourceSubjectId: string | null) {
    if (!sourceSubjectId) return undefined;

    const sourceSubject = await tx.subject.findUnique({
        where: { id: sourceSubjectId },
        select: { name: true },
    });
    if (!sourceSubject) return undefined;

    const existing = await tx.subject.findUnique({
        where: {
            name_userId: {
                name: sourceSubject.name,
                userId: studentId,
            },
        },
        select: { id: true },
    });
    if (existing) return existing.id;

    const created = await tx.subject.create({
        data: {
            name: sourceSubject.name,
            userId: studentId,
        },
        select: { id: true },
    });
    return created.id;
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const user = await getActiveCurrentUser(session);
    if (!user) return unauthorized("Authentication required");
    if (!canAssignErrorItems(user)) return forbidden("Teacher or admin access required");

    try {
        const body = await req.json();
        const studentIds: string[] = Array.isArray(body.studentIds)
            ? Array.from(new Set(body.studentIds.filter((value: unknown): value is string => typeof value === "string")))
            : [];

        if (studentIds.length === 0) {
            return badRequest("At least one student is required");
        }

        const source = await prisma.errorItem.findUnique({
            where: { id },
            include: { tags: { select: { id: true } } },
        });
        if (!source) return notFound("Source error item not found");
        if (source.userId !== user.id) {
            return forbidden("Only the creator can assign this error item");
        }

        const students = await prisma.user.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, role: true, isActive: true },
        });

        if (students.length !== studentIds.length) {
            return badRequest("One or more students do not exist");
        }
        const invalidStudent = students.find((student) => student.role !== "user" || !student.isActive);
        if (invalidStudent) {
            return badRequest("Only active students can receive assignments");
        }

        const createdAssignments = await prisma.$transaction(async (tx) => {
            const results = [];

            for (const studentId of studentIds) {
                const existing = await tx.assignment.findUnique({
                    where: {
                        studentId_sourceErrorItemId: {
                            studentId,
                            sourceErrorItemId: source.id,
                        },
                    },
                    select: { id: true },
                });
                if (existing) {
                    continue;
                }

                const subjectId = await getOrCreateStudentSubject(tx, studentId, source.subjectId);
                const studentCopy = await tx.errorItem.create({
                    data: {
                        userId: studentId,
                        subjectId,
                        originalImageUrl: source.originalImageUrl,
                        ocrText: source.ocrText,
                        questionText: source.questionText,
                        answerText: source.answerText,
                        analysis: source.analysis,
                        wrongAnswerText: source.wrongAnswerText,
                        mistakeAnalysis: source.mistakeAnalysis,
                        mistakeStatus: source.mistakeStatus,
                        knowledgePoints: source.knowledgePoints,
                        source: source.source,
                        errorType: source.errorType,
                        userNotes: source.userNotes,
                        masteryLevel: 0,
                        gradeSemester: source.gradeSemester,
                        paperLevel: source.paperLevel,
                        assignedByTeacherId: user.id,
                        sourceErrorItemId: source.id,
                        tags: {
                            connect: source.tags.map((tag) => ({ id: tag.id })),
                        },
                    },
                    select: { id: true },
                });

                const assignment = await tx.assignment.create({
                    data: {
                        teacherId: user.id,
                        studentId,
                        sourceErrorItemId: source.id,
                        studentErrorItemId: studentCopy.id,
                    },
                });
                results.push(assignment);
            }

            return results;
        });

        logger.info({ sourceErrorItemId: id, assignedCount: createdAssignments.length }, "Error item assigned");
        return NextResponse.json({
            assignedCount: createdAssignments.length,
            skippedCount: studentIds.length - createdAssignments.length,
        });
    } catch (error) {
        logger.error({ error }, "Failed to assign error item");
        return internalError("Failed to assign error item");
    }
}
