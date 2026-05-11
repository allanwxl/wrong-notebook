import { NextResponse } from "next/server";
import { getAIService } from "@/lib/ai";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { calculateGradeNumber, inferSubjectFromName } from "@/lib/knowledge-tags";
import { calculateGrade } from "@/lib/grade-calculator";
import { prisma } from "@/lib/prisma";
import { badRequest, createErrorResponse, ErrorCode, forbidden, unauthorized } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { canUploadErrorItems, getActiveCurrentUser } from "@/lib/auth-utils";

const logger = createLogger('api:analyze');

export async function POST(req: Request) {
    logger.info('Analyze API called');

    const session = await getServerSession(authOptions);

    const currentUser = await getActiveCurrentUser(session);
    if (!currentUser) {
        logger.warn('Unauthorized or inactive user access attempt');
        return unauthorized("Authentication required");
    }
    if (!canUploadErrorItems(currentUser)) {
        logger.warn({ userId: currentUser.id }, 'Upload analysis denied by role permission');
        return forbidden("上传权限已被管理员关闭");
    }

    try {
        const body = await req.json();
        let { imageBase64, mimeType } = body;
        const { language, subjectId } = body;

        logger.debug({
            imageLength: imageBase64?.length,
            mimeType,
            language,
            subjectId
        }, 'Request received');

        if (!imageBase64) {
            logger.warn('Missing image data');
            return badRequest("Missing image data");
        }

        // Parse Data URL if present
        if (imageBase64.startsWith('data:')) {
            const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                imageBase64 = matches[2];
                logger.debug({ mimeType, base64Length: imageBase64.length }, 'Parsed Data URL');
            }
        }

        // 先获取用户年级信息，用于动态生成 AI prompt 中的标签列表
        let userGrade: 7 | 8 | 9 | 10 | 11 | 12 | null = null;
        let userGradeSemester: string | null = null;
        let subjectName: 'math' | 'physics' | 'chemistry' | 'biology' | 'english' | 'chinese' | 'history' | 'geography' | 'politics' | null = null;

        if (session?.user?.email) {
            try {
                // 获取用户信息
                if (currentUser) {
                    userGrade = calculateGradeNumber(currentUser.educationStage ?? null, currentUser.enrollmentYear ?? null);
                    if (currentUser.educationStage && currentUser.enrollmentYear) {
                        userGradeSemester = calculateGrade(currentUser.educationStage, currentUser.enrollmentYear, new Date(), 'zh');
                    }
                    logger.debug({ userGrade, userGradeSemester }, 'Calculated user grade');
                }

                // 获取错题本信息以推断学科
                if (subjectId) {
                    const subject = await prisma.subject.findUnique({
                        where: { id: subjectId },
                        select: { name: true }
                    });

                    if (subject) {
                        subjectName = inferSubjectFromName(subject.name);
                        logger.debug({ subjectName, subjectDisplayName: subject.name }, 'Inferred subject');
                    }
                }
            } catch (error) {
                logger.error({ error }, 'Error fetching user/subject info');
                // 继续执行，不传递年级参数（会返回所有年级的标签）
            }
        }


        // 将内部科目名称转换为中文科目名称
        const subjectNameMapping: Record<string, string> = {
            'math': '数学',
            'physics': '物理',
            'chemistry': '化学',
            'biology': '生物',
            'english': '英语',
            'chinese': '语文',
            'history': '历史',
            'geography': '地理',
            'politics': '政治',
        };
        const subjectChinese = subjectName ? subjectNameMapping[subjectName] : null;

        logger.info({ userGrade, userGradeSemester, subject: subjectChinese }, 'Calling AI service for image analysis');
        const aiService = getAIService();
        const analysisResult = await aiService.analyzeImage(imageBase64, mimeType, language, userGrade, subjectChinese, userGradeSemester);

        logger.debug({
            knowledgePointsCount: analysisResult.knowledgePoints?.length,
            knowledgePointsType: typeof analysisResult.knowledgePoints,
            isArray: Array.isArray(analysisResult.knowledgePoints)
        }, 'AI returned knowledge points');

        // AI 现在从数据库获取标签列表，返回的标签已经是标准化的，不需要额外处理
        if (!analysisResult.knowledgePoints || analysisResult.knowledgePoints.length === 0) {
            logger.warn('Knowledge points is empty or null');
        }

        logger.info('AI analysis successful');

        return NextResponse.json(analysisResult);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        logger.error({
            error: message,
            stack
        }, 'Analysis error occurred');

        // 返回具体的错误类型，便于前端显示详细提示
        let errorMessage = message || "Failed to analyze image";

        // 识别特定错误类型
        if (message && (
            message === 'AI_CONNECTION_FAILED' ||
            message === 'AI_RESPONSE_ERROR' ||
            message.includes('AI_AUTH_ERROR') ||
            message === 'AI_TIMEOUT_ERROR' ||
            message === 'AI_QUOTA_EXCEEDED' ||
            message === 'AI_PERMISSION_DENIED' ||
            message === 'AI_NOT_FOUND' ||
            message === 'AI_SERVICE_UNAVAILABLE' ||
            message === 'AI_UNKNOWN_ERROR'
        )) {
            // 直接传递 AI Provider 定义的错误类型 (如果是 AI_AUTH_ERROR，提取出来)
            if (message.includes('AI_AUTH_ERROR')) {
                errorMessage = 'AI_AUTH_ERROR';
            } else {
                errorMessage = message;
            }
        } else if (message.includes('Zod') || message.includes('validate')) {
            // Zod 验证错误
            errorMessage = 'AI_RESPONSE_ERROR';
        }

        return createErrorResponse(errorMessage, 500, ErrorCode.AI_ERROR, message);
    }
}
