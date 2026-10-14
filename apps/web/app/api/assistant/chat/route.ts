import { rateLimitOf } from "@vyana/shared";
import { ChatBody, assistantChat } from "@/lib/server/assistant/chat";
import { requireUser } from "@/lib/server/auth";
import { parseBody, withRoute } from "@/lib/server/errors";

// Up to 5 steps with Search (10 s) and Fetch (60 s) tools (SPEC §11).
export const maxDuration = 120;

export const POST = withRoute("assistant/chat", async (req, ctx) => {
  const authed = await requireUser(req);
  ctx.userId = authed.user.id;
  const body = await parseBody(req, ChatBody);
  return assistantChat(authed, body);
}, { rateLimit: rateLimitOf("ai_chat") });
