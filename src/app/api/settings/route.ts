import { NextResponse } from "next/server";
import { getAppConfig, updateAppConfig } from "@/lib/config";
import { forbidden, internalError, unauthorized } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { OpenAIInstance } from "@/types/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveCurrentUser, canManageSystemSettings } from "@/lib/auth-utils";

const logger = createLogger('api:settings');

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getServerSession(authOptions);
    const user = await getActiveCurrentUser(session);
    if (!user) return unauthorized();
    if (!canManageSystemSettings(user)) return forbidden("Admin access required");

    const config = getAppConfig();
    // Return full config including API keys only to administrators.
    return NextResponse.json(config);
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const user = await getActiveCurrentUser(session);
        if (!user) return unauthorized();
        if (!canManageSystemSettings(user)) return forbidden("Admin access required");

        const body = await req.json();
        const currentConfig = getAppConfig();

        // Don't save masked keys if they somehow get sent back (for Gemini)
        if (body.gemini?.apiKey === '********') {
            // 保留原有的 API Key
            body.gemini.apiKey = currentConfig.gemini?.apiKey;
        }

        // For OpenAI instances, preserve original keys for masked entries
        if (body.openai?.instances) {
            const currentInstances = currentConfig.openai?.instances || [];
            body.openai.instances = body.openai.instances.map((instance: OpenAIInstance) => {
                if (instance.apiKey === '********') {
                    // 查找原有实例并保留其 API Key
                    const originalInstance = currentInstances.find((i: OpenAIInstance) => i.id === instance.id);
                    return {
                        ...instance,
                        apiKey: originalInstance?.apiKey || '',
                    };
                }
                return instance;
            });
        }

        // For Azure, preserve original key if masked
        if (body.azure?.apiKey === '********') {
            body.azure.apiKey = currentConfig.azure?.apiKey;
        }

        const updatedConfig = updateAppConfig(body);
        return NextResponse.json(updatedConfig);
    } catch (error) {
        logger.error({ error }, 'Failed to update settings');
        return internalError("Failed to update settings");
    }
}

