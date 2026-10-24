// ミューコネ: AIおすすめ曲（Supabase Edge Function / Deno）
//
// 集まる人たちの属性・自由入力・みんなが持ち込んだ曲を Gemini に渡し、
// 「集団全体に届く実在の曲」を JSON で返す。
// APIキーはブラウザに置けないため、この関数の中でだけ Supabase の Secrets から読む。
//
// 必要な Secrets（Supabase ダッシュボード → Edge Functions → Secrets）
//   GEMINI_API_KEY  Google AI Studio で発行したキー（必須）
//   GEMINI_MODEL    使うモデル（任意。既定は gemini-3.5-flash-lite）

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
// 画面で待てる速さを優先して、最速・低コストのモデルを既定にする
// （gemini-3.8-flash は混雑時に1分以上かかり、Edge Function の150秒制限に達することがあった）
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
/** 1回あたりの待ち時間。混雑・遅延時は1回だけやり直しても150秒の制限に収まるようにする */
const ATTEMPT_TIMEOUT_MS = 40_000;
const RETRY_DELAY_MS = 1_500;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SongRef {
  title: string;
  artist: string;
}

interface RecommendRequest {
  attributes: { genders: string[]; genres: string[]; nationalities: string[]; ageGroups: string[] };
  other: string;
  /** みんなが持ち込んだ曲（被った人数の多い順） */
  likedSongs: (SongRef & { people: number })[];
  /** すでに候補にある曲（提案しない） */
  exclude: SongRef[];
  count: number;
}

// 公開URLから呼ばれるため、入力の大きさを必ず制限する（大量の入力で課金が膨らまないように）
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strings = (v: unknown, maxItems: number) =>
  Array.isArray(v) ? v.map((x) => text(x, 30)).filter(Boolean).slice(0, maxItems) : [];
const songRefs = (v: unknown, maxItems: number) =>
  Array.isArray(v)
    ? v
        .map((s) => ({
          title: text(s?.title, 100),
          artist: text(s?.artist, 100),
          people: Number.isFinite(s?.people) ? Number(s.people) : 0,
        }))
        .filter((s) => s.title && s.artist)
        .slice(0, maxItems)
    : [];

function parseRequest(raw: unknown): RecommendRequest {
  const r = (raw ?? {}) as Record<string, any>;
  const a = (r.attributes ?? {}) as Record<string, unknown>;
  return {
    attributes: {
      genders: strings(a.genders, 5),
      genres: strings(a.genres, 15),
      nationalities: strings(a.nationalities, 15),
      ageGroups: strings(a.ageGroups, 10),
    },
    other: text(r.other, 200),
    likedSongs: songRefs(r.likedSongs, 40),
    exclude: songRefs(r.exclude, 120),
    count: Math.min(Math.max(Number(r.count) || 8, 1), 12),
  };
}

const SYSTEM_INSTRUCTION = `あなたは、カラオケ・パーティー・ドライブで流す曲を選ぶアシスタントです。
集まった人たちの属性と、それぞれが持ち込んだ曲（好み）をもとに、その場の全員が楽しめる曲を提案します。

守ること:
- 実在する曲だけを、正式な曲名とアーティスト名で答える。存在が確かでない曲は出さない。
- 「すでに候補にある曲」は提案しない。
- 属性が複数ある場合（例: 20代と50代、日本とアメリカ）は、片方だけが知っている曲より、両方に届く曲を優先する。
- 持ち込まれた曲がある場合は、その好みの近くにある曲を選ぶ。
- 定番曲だけに偏らず、少し意外でも盛り上がる曲を混ぜる。
- reason には、なぜこの集団に合うのかを日本語30文字以内で書く。`;

function buildPrompt(req: RecommendRequest): string {
  const a = req.attributes;
  const list = (items: string[]) => (items.length ? items.join("、") : "指定なし");
  const songs = (items: SongRef[]) => (items.length ? items.map((s) => `- ${s.title} / ${s.artist}`).join("\n") : "（なし）");
  return `# 集まる人たちの属性
- 性別: ${list(a.genders)}
- 好きなジャンル: ${list(a.genres)}
- 国籍: ${list(a.nationalities)}
- 年代: ${list(a.ageGroups)}
- その他の希望: ${req.other || "なし"}

# みんなが持ち込んだ曲（上ほど多くの人と被っている）
${songs(req.likedSongs)}

# すでに候補にある曲（提案しないこと）
${songs(req.exclude)}

この集団におすすめの曲を${req.count}曲提案してください。`;
}

// Gemini の構造化出力（generateContent の responseSchema）
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    songs: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          artist: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["title", "artist", "reason"],
      },
    },
  },
  required: ["songs"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "GEMINI_API_KEY が Supabase の Secrets に登録されていません" }, 500);
  const model = Deno.env.get("GEMINI_MODEL") || DEFAULT_MODEL;

  let request: RecommendRequest;
  try {
    request = parseRequest(await req.json());
  } catch {
    return json({ error: "リクエストのJSONが不正です" }, 400);
  }

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: buildPrompt(request) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.7,
    },
  });

  // 混雑（503/429）や応答の遅れは一時的なことが多いので、1回だけやり直す
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: payload,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
      if (timedOut && attempt === 0) continue;
      return json(
        { error: timedOut ? "Gemini の応答が時間内に返りませんでした（混雑している可能性があります）" : "Gemini に接続できませんでした" },
        504
      );
    }
    if ((res.status === 503 || res.status === 429) && attempt === 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }
    break;
  }
  if (!res) return json({ error: "Gemini の応答が時間内に返りませんでした（混雑している可能性があります）" }, 504);

  if (res.status === 503 || res.status === 429) {
    return json({ error: "Gemini が混雑しています。少し待ってから「AIに聞き直す」を押してください" }, 503);
  }
  if (!res.ok) {
    // エラー本文にキーは含まれないが、念のため先頭だけ返す
    const detail = (await res.text()).slice(0, 300);
    return json({ error: `Gemini API がエラーを返しました（${res.status}）`, detail }, 502);
  }

  const data = await res.json();
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) return json({ error: `Gemini が入力をブロックしました（${blockReason}）` }, 502);

  const outputText: string = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  let parsed: { songs?: unknown };
  try {
    parsed = JSON.parse(outputText);
  } catch {
    return json({ error: "Gemini の応答をJSONとして読めませんでした", finishReason: data?.candidates?.[0]?.finishReason }, 502);
  }

  const songs = (Array.isArray(parsed.songs) ? parsed.songs : [])
    .map((s: any) => ({ title: text(s?.title, 100), artist: text(s?.artist, 100), reason: text(s?.reason, 60) }))
    .filter((s: SongRef) => s.title && s.artist)
    .slice(0, request.count);
  return json({ songs, model });
});
