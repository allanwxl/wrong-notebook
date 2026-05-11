import { NextResponse } from "next/server";
import { getAppConfig, updateAppConfig } from "@/lib/config";
import { forbidden, internalError, unauthorized } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { OpenAIInstance } from "@/types/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveCurrentUser, canManageSystemSettings } from "@/lib/auth-utils";

const logger = createLogger('api:settings');
const MASKED_API_KEY = '********';

export const dynamic = 'force-dynamic';

function maskApiKeys(config: ReturnType<typeof getAppConfig>) {
    return {
        ...config,
        gemini: config.gemini
            ? {
                ...config.gemini,
                apiKey: config.gemini.apiKey ? MASKED_API_KEY : config.gemini.apiKey,
            }
            : config.gemini,
        openai: config.openai
            ? {
                ...config.openai,
                instances: (config.openai.instances || []).map((instance) => ({
                    ...instance,
                    apiKey: instance.apiKey ? MASKED_API_KEY : instance.apiKey,
                })),
            }
            : config.openai,
        azure: config.azure
            ? {
                ...config.azure,
                apiKey: config.azure.apiKey ? MASKED_API_KEY : config.azure.apiKey,
            }
            : config.azure,
    };
}

export async function GET() {
    const session = await getServerSession(authOptions);
    const user = await getActiveCurrentUser(session);
    if (!user) return unauthorized();
    if (!canManageSystemSettings(user)) return forbidden("Admin access required");

    const config = getAppConfig();
    return NextResponse.json(maskApiKeys(config));
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
        if (body.gemini?.apiKey === MASKED_API_KEY) {
            // 保留原有的 API Key
            body.gemini.apiKey = currentConfig.gemini?.apiKey;
        }

        // For OpenAI instances, preserve original keys for masked entries
        if (body.openai?.instances) {
            const currentInstances = currentConfig.openai?.instances || [];
            body.openai.instances = body.openai.instances.map((instance: OpenAIInstance) => {
                if (instance.apiKey === MASKED_API_KEY) {
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
        if (body.azure?.apiKey === MASKED_API_KEY) {
            body.azure.apiKey = currentConfig.azure?.apiKey;
        }

        const updatedConfig = updateAppConfig(body);
        return NextResponse.json(maskApiKeys(updatedConfig));
    } catch (error) {
        logger.error({ error }, 'Failed to update settings');
        return internalError("Failed to update settings");
    }
}
