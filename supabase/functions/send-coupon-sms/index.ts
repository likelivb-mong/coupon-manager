// Supabase Edge Function: 쿠폰 발행/사용완료 시 고객에게 SMS 발송 (국내 SOLAPI 연동)
// 시크릿: SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_FROM_NUMBER
// 템플릿은 DB sms_templates 에서 type별 is_default=true 인 것 사용
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 배포 시 자동 주입됨

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SOLAPI_API_KEY = Deno.env.get("SOLAPI_API_KEY");
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET");
const SOLAPI_FROM_NUMBER = Deno.env.get("SOLAPI_FROM_NUMBER");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function toKoreanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("82") && digits.length >= 11) return digits.slice(2);
  if (digits.startsWith("0")) return digits;
  if (digits.length >= 9) return "0" + digits.replace(/^82/, "");
  return digits;
}

function substitute(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v ?? "");
  }
  return out.replace(/\{\{[^}]+\}\}/g, "");
}

function buildSolapiAuth(apiKey: string, apiSecret: string): Promise<string> {
  const dateTime = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const data = dateTime + saltHex;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${dateTime}, salt=${saltHex}, signature=${sigHex}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" },
    });
  }

  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  try {
    const body = await req.json();
    const type = (body.type as string) || "issue";
    const phone = body.phone as string | undefined;
    const couponCode = body.couponCode as string | undefined;

    if (!phone || !couponCode) {
      return new Response(JSON.stringify({ success: false, error: "phone, couponCode 필요" }), { status: 400, headers: cors });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "SMS 설정 없음 (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요)" }),
        { status: 503, headers: cors }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: row, error: templateErr } = await supabase
      .from("sms_templates")
      .select("content")
      .eq("type", type)
      .eq("is_default", true)
      .maybeSingle();

    if (templateErr || !row?.content) {
      return new Response(
        JSON.stringify({ success: false, error: "해당 타입의 기본 템플릿이 없습니다." }),
        { status: 400, headers: cors }
      );
    }

    const vars: Record<string, string> = {
      couponCode: couponCode ?? "",
      discountLabel: (body.discountLabel as string) ?? "",
      headcountLabel: (body.headcountLabel as string) ?? "",
      issuedBranch: (body.issuedBranch as string) ?? "",
      customerPhone: toKoreanPhone(phone),
      verifiedBranch: (body.verifiedBranch as string) ?? "",
      verifiedAt: (body.verifiedAt as string) ?? "",
    };
    const text = substitute(row.content, vars);

    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !SOLAPI_FROM_NUMBER) {
      return new Response(
        JSON.stringify({ success: false, error: "SMS 설정 없음 (SOLAPI_* 시크릿 설정 필요)" }),
        { status: 503, headers: cors }
      );
    }

    const toNumber = toKoreanPhone(phone);
    const authHeader = await buildSolapiAuth(SOLAPI_API_KEY, SOLAPI_API_SECRET);
    const res = await fetch("https://api.solapi.com/messages/v4/send-many/detail", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ to: toNumber, from: SOLAPI_FROM_NUMBER.replace(/\D/g, ""), text }],
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: (data as any)?.errorMessage ?? res.statusText }),
        { status: 502, headers: cors }
      );
    }

    return new Response(JSON.stringify({ success: true }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500, headers: cors });
  }
});
