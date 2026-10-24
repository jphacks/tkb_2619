/**
 * AIレコメンド（Gemini）用の Supabase Edge Function。
 *
 * Gemini の APIキーをブラウザに出さないため、アプリはこの関数を経由して Gemini を呼ぶ。
 * - 必要な Secret: GEMINI_API_KEY（ダッシュボードの Edge Functions → Secrets で登録）
 * - 任意の Secret: GEMINI_MODEL（未設定なら DEFAULT_MODEL）
 * - SUPABASE_URL / SUPABASE_ANON_KEY は Supabase が自動で渡す
 *
 * 公開鍵で誰でも呼べてしまうため、存在するルームからの呼び出しだけ受け付け、
 * ルームごとに呼び出し間隔の下限を設けている（インスタンスが入れ替わるとリセットされる簡易版）。
 * 返す曲は「実在するか」をアプリ側で iTunes 検索にかけて確かめてから表示する。
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_MODEL = "gemini-2.5-flash";
const MIN_INTERVAL_MS = 20_000;
const MAX_SONGS = 15;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SongRef {
  title: string;
  artist: string;
}

interface RequestBody {
  roomId: string;
  /** 画面に出している表記（例: "20代", "J-POP"）のまま受け取る */
  conditions: { genders: string[]; genres: string[]; nationalities: string[]; ageGroups: string[]; other: string };
  likedSongs: SongRef[];
  exclude: SongRef[];
}

const lastCallAt = new Map<string, number>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const clip = (text: unknown, max: number) => String(text ?? "").slice(0, max);
const clipList = (list: unknown, max: number) => (Array.isArray(list) ? list.slice(0, max).map((x) => clip(x, 40)) : []);
const clipSongs = (list: unknown, max: number): SongRef[] =>
  (Array.isArray(list) ? list.slice(0, max) : []).map((s) => ({ title: clip(s?.title, 80), artist: clip(s?.artist, 80) }));

function buildPrompt(body: RequestBody): string {
  const c = body.conditions;
  const line = (label: string, values: string[]) => `- ${label}: ${values.length ? values.join("、") : "指定なし"}`;
  const songs = (list: SongRef[]) => (list.length ? list.map((s) => `「${s.title}」${s.artist}`).join(" / ") : "なし");
  return [
    "あなたは、集まった人たち全員が楽しめる選曲を手伝うアシスタントです。",
    "次の集まりで流す曲の候補を挙げてください。",
    "",
    "集まる人たち:",
    line("性別", c.genders),
    line("好きなジャンル", c.genres),
    line("国籍", c.nationalities),
    line("年代", c.ageGroups),
    `- その他の希望: ${c.other || "なし"}`,
    "",
    `参加者が好きな曲: ${songs(body.likedSongs)}`,
    `すでに候補にある曲（挙げないこと）: ${songs(body.exclude)}`,
    "",
    "条件:",
    `- 実在する曲だけを${MAX_SONGS}曲。曲名とアーティスト名は、配信サービスで検索して見つかる正式な表記で書く`,
    "- 選んだ属性の人たちがなるべく全員知っていて、一緒に楽しめる曲を優先する",
    "- 定番曲だけに偏らず、参加者の好きな曲に近い曲も混ぜる",
    "- reason は、なぜこの集まりに合うかを日本語20文字以内で",
  ].join("\n");
}

async function askGemini(prompt: string): Promise<(SongRef & { reason: string })[]> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = Deno.env.get("GEMINI_MODEL") || DEFAULT_MODEL;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { title: { type: "STRING" }, artist: { type: "STRING" }, reason: { type: "STRING" } },
            required: ["title", "artist", "reason"],
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((s) => s && typeof s.title === "string" && typeof s.artist === "string")
    .slice(0, MAX_SONGS)
    .map((s) => ({ title: clip(s.title, 80), artist: clip(s.artist, 80), reason: clip(s.reason, 40) }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let raw: Partial<RequestBody>;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const roomId = clip(raw.roomId, 40).toLowerCase();
  if (!/^[a-z0-9]{4,40}$/.test(roomId)) return json({ error: "invalid room" }, 400);

  // 存在するルームからの呼び出しだけ受け付ける
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: room, error } = await supabase.from("rooms").select("id, ai_enabled").eq("id", roomId).maybeSingle();
  if (error) return json({ error: "room lookup failed" }, 500);
  if (!room) return json({ error: "room not found" }, 404);
  if (!room.ai_enabled) return json({ songs: [] });

  const now = Date.now();
  if (now - (lastCallAt.get(roomId) ?? 0) < MIN_INTERVAL_MS) return json({ error: "too many requests" }, 429);
  lastCallAt.set(roomId, now);

  const c = (raw.conditions ?? {}) as Partial<RequestBody["conditions"]>;
  const body: RequestBody = {
    roomId,
    conditions: {
      genders: clipList(c.genders, 4),
      genres: clipList(c.genres, 12),
      nationalities: clipList(c.nationalities, 20),
      ageGroups: clipList(c.ageGroups, 6),
      other: clip(c.other, 120),
    },
    likedSongs: clipSongs(raw.likedSongs, 20),
    exclude: clipSongs(raw.exclude, 60),
  };

  try {
    return json({ songs: await askGemini(buildPrompt(body)) });
  } catch (e) {
    console.error(e);
    return json({ error: "gemini failed" }, 502);
  }
});
