// =============================================================
// 小兹 · 聊天后端（Supabase Edge Function）
//
// 职责：
//   1. 认身份（只信 JWT，不信 body 里的 user_id）
//   2. 每日配额（防匿名用户刷爆 AI 额度）
//   3. 读记忆（最近 12 条）+ 读画像 + 检索 WIKI
//   4. 组装 prompt → 调 DeepSeek → 流式回传
//   5. 边回传边攒全文，结束后落库
//
// 部署：
//   supabase functions deploy chat
//   supabase secrets set DEEPSEEK_API_KEY=sk-xxxx
//
// 可选环境变量：
//   CHAT_MODEL   默认 deepseek-chat（可换 deepseek-reasoner）
//   DAILY_QUOTA  默认 40，每人每天最多几句
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildSystemPrompt } from "./prompt.ts";
import type { WikiHit } from "./prompt.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-session-id",
};

const MODEL = Deno.env.get("CHAT_MODEL") ?? "deepseek-chat";
// 配错成空/非数字时回落 40，不然 NaN 会让配额永远判定超额
const DAILY_QUOTA = (() => {
  const raw = Number(Deno.env.get("DAILY_QUOTA") ?? "40");
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 40;
})();
const MAX_HISTORY = 12;
const MAX_INPUT = 2000;
const UPSTREAM = "https://api.deepseek.com/v1/chat/completions";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

/** 把 HTTP 状态码翻译成人话，别把 401 直接甩给用户 */
function humanizeUpstream(status: number): string {
  if (status === 401) return "小兹的钥匙好像过期了，进不去自己的资料库…… 帮我跟站长说一声？";
  if (status === 402) return "小兹今天的话说完了，账户里没钱钱了…… 明天再聊好不好？";
  if (status === 429) return "小兹有点说过头了，缓一下下再说？";
  if (status >= 500) return "小兹的大脑好像卡住了，等一下再问一次试试？";
  return "小兹这边出了点小状况，再试一次？";
}

/** 从「我叫XX」里顺手记住称呼（只在明确自报时触发，不瞎猜） */
function extractNick(text: string): string | null {
  const m = text.match(/(?:我叫|叫我|你可以叫我)([\u4e00-\u9fa5A-Za-z0-9]{1,6})/);
  return m ? m[1] : null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "只支持 POST" }, 405);

  try {
    // ---------- 1. 身份：只从 JWT 取，绝不信 body ----------
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "先登录一下再聊呀～（站长是不是还没开匿名登录？）" }, 401);

    const auth = await admin.auth.getUser(jwt);
    const user = auth?.data?.user;
    if (auth?.error || !user) return json({ error: "身份过期了，刷新一下页面吧～" }, 401);

    // ---------- 2. 入参 ----------
    let payload: { message?: string; session_id?: string | null };
    try {
      payload = await req.json();
    } catch {
      return json({ error: "收到的内容看不懂" }, 400);
    }

    const message = (payload.message ?? "").trim();
    if (!message) return json({ error: "你什么都没说呀" }, 400);
    if (message.length > MAX_INPUT) return json({ error: "话太长啦，小兹一次听不完，拆一拆？" }, 400);

    // ---------- 3. 配额 ----------
    // 迁移没跑时不让聊天彻底挂掉：报错只记日志，继续走
    let quota: { allowed?: boolean; used?: number } | null = null;
    try {
      const r = await admin.rpc("chat_take_quota", {
        p_user: user.id,
        p_limit: DAILY_QUOTA,
      });
      if (r.error) console.error("[chat] quota rpc:", r.error.message);
      const rows = Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
      quota = (rows[0] ?? null) as { allowed?: boolean; used?: number } | null;
    } catch (e) {
      console.error("[chat] quota rpc threw:", e);
    }

    if (quota && quota.allowed === false) {
      return json({
        error: `今天已经聊了 ${quota.used} 句啦，${DAILY_QUOTA} 句是上限，明天再来找小兹玩～`,
      }, 429);
    }

    // ---------- 4. 会话 ----------
    let sessionId: string | null = payload.session_id ?? null;
    if (sessionId) {
      const owned = await admin
        .from("chat_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (owned.error || !owned.data) sessionId = null;
    }
    if (!sessionId) {
      const created = await admin
        .from("chat_sessions")
        .insert({ user_id: user.id, title: message.slice(0, 24) })
        .select("id")
        .single();
      if (created.error) console.error("[chat] create session:", created.error.message);
      sessionId = created.data?.id ?? null;
    }

    // ---------- 5. 记忆 / 画像 / 检索（并行，任一失败都不影响聊天） ----------
    const historyReq: Promise<unknown> = sessionId
      ? admin
          .from("chat_messages")
          .select("role,content")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(MAX_HISTORY)
      : Promise.resolve({ data: [], error: null });

    const profileReq: Promise<unknown> = admin
      .from("chat_profiles")
      .select("nick,traits")
      .eq("user_id", user.id)
      .maybeSingle();

    const wikiReq: Promise<unknown> = admin.rpc("search_wiki", { q: message, lim: 4 });

    const [historyRes, profileRes, wikiRes] = await Promise.allSettled([
      historyReq,
      profileReq,
      wikiReq,
    ]);

    function pick<T>(settled: PromiseSettledResult<unknown>, fallback: T): T {
      if (settled.status !== "fulfilled") {
        console.error("[chat] 并行查询失败:", settled.reason);
        return fallback;
      }
      const value = settled.value as { data?: unknown; error?: { message?: string } | null };
      if (value?.error) console.error("[chat] 并行查询报错:", value.error.message);
      return (value?.data ?? fallback) as T;
    }

    const historyRows = pick<Array<{ role: string; content: string }>>(historyRes, []);
    const profile = pick<{ nick: string | null; traits: Record<string, unknown> | null } | null>(
      profileRes,
      null,
    );
    const wikiHits = pick<WikiHit[]>(wikiRes, []);

    // ---------- 6. 人设（允许后台改，不用发版） ----------
    let customPersona: string | null = null;
    try {
      const cfg = await admin
        .from("system_config")
        .select("value")
        .eq("key", "chat_system_prompt")
        .maybeSingle();
      const v = cfg.data?.value;
      if (typeof v === "string" && v.trim()) customPersona = v;
    } catch {
      /* system_config 不存在也无所谓，用默认人设 */
    }

    const system = buildSystemPrompt({
      now: new Date(),
      nick: profile?.nick ?? null,
      traits: profile?.traits ?? null,
      wiki: wikiHits,
      persona: customPersona,
    });

    const messages = [
      { role: "system", content: system },
      ...historyRows
        .reverse()
        .map((h) => ({ role: h.role === "user" ? "user" : "assistant", content: h.content })),
      { role: "user", content: message },
    ];

    // ---------- 7. 上游 ----------
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!apiKey) return json({ error: "站长还没给小兹配钥匙（DEEPSEEK_API_KEY 未设置）" }, 500);

    let upstream: Response;
    try {
      upstream = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          stream: true,
          temperature: 0.85,
          presence_penalty: 0.4,
          frequency_penalty: 0.3,
          max_tokens: 500,
        }),
      });
    } catch (e) {
      console.error("[chat] fetch upstream:", e);
      return json({ error: "连不上小兹的大脑，可能是网络抽风了，再试一次？" }, 502);
    }

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("[chat] upstream", upstream.status, detail.slice(0, 300));
      return json({ error: humanizeUpstream(upstream.status) }, 502);
    }
    if (!upstream.body) return json({ error: "小兹那边没回话，再试一次？" }, 502);

    // ---------- 8. 流式转发 + 攒全文 ----------
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    let full = "";
    let buf = "";
    let truncated = false;
    let closed = false;
    let persisted = false;

    async function persist(): Promise<void> {
      if (persisted) return;
      persisted = true;
      if (!sessionId) return;
      try {
        await admin.from("chat_messages").insert([
          { session_id: sessionId, user_id: user.id, role: "user", content: message },
          {
            session_id: sessionId,
            user_id: user.id,
            role: "assistant",
            content: full || "（这轮没说出话）",
          },
        ]);
        await admin
          .from("chat_sessions")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", sessionId);

        const nick = extractNick(message);
        if (nick) {
          await admin
            .from("chat_profiles")
            .upsert(
              { user_id: user.id, nick, updated_at: new Date().toISOString() },
              { onConflict: "user_id" },
            );
        }
      } catch (e) {
        console.error("[chat] persist:", e);
      }
    }

    function consumeLine(line: string): void {
      const t = line.trim();
      if (!t.startsWith("data:")) return;
      const data = t.slice(5).trim();
      if (!data || data === "[DONE]") return;
      try {
        const obj = JSON.parse(data);
        const choice = obj?.choices?.[0];
        const delta = choice?.delta?.content;
        if (typeof delta === "string") full += delta;
        if (choice?.finish_reason === "length") truncated = true;
      } catch {
        /* 跨块被切开的半个 JSON，等下一块补上 */
      }
    }

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller: ReadableStreamDefaultController<Uint8Array>): Promise<void> {
        if (closed) return;

        const chunk = await reader.read().catch(() => null);
        if (!chunk) {
          closed = true;
          await persist();
          controller.close();
          return;
        }

        if (chunk.done) {
          if (buf) consumeLine(buf);
          closed = true;

          // 被 max_tokens 截断时补一句，别让话停在半句
          if (truncated) {
            const suffix = "……（一下子说太多了，要不要我拆开讲？）";
            full += suffix;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: suffix } }] })}\n\n`,
              ),
            );
          }

          await persist();
          controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
          controller.close();
          return;
        }

        controller.enqueue(chunk.value);
        buf += decoder.decode(chunk.value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) consumeLine(line);
      },
      cancel(): void {
        closed = true;
        reader.cancel().catch(() => {});
        const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
          .EdgeRuntime;
        if (rt?.waitUntil) rt.waitUntil(persist());
        else persist();
      },
    });

    const headers: Record<string, string> = {
      ...CORS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    };
    if (sessionId) headers["x-session-id"] = sessionId;

    return new Response(stream, { headers });
  } catch (e) {
    console.error("[chat] unhandled:", e);
    return json({ error: "小兹这边摔了一跤，刷新一下再试试？" }, 500);
  }
});