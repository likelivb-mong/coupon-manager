import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { normalizeCouponCode } from "../utils/couponUtils";
import { supabase } from "../lib/supabase";

export default function CouponScanPanel({ onScanned }: { onScanned: (couponCode: string) => void }) {
  const regionId = "qr-reader-region";
  const qrRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function start() {
      setErr(null);

      try {
        const qr = new Html5Qrcode(regionId);
        qrRef.current = qr;

        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          async (decodedText) => {
            const code = normalizeCouponCode(decodedText);
            if (!code) return;

            await supabase.from("coupon_events").insert({
              coupon_code: code,
              event_type: "SCAN",
              meta: { raw: decodedText },
            });

            if (!mounted) return;
            onScanned(code);
            try {
              await qr.stop();
            } catch {
              // ignore stop errors (already stopped / not running)
            }
          },
          () => {}
        );
      } catch (e: any) {
        setErr(e?.message ?? "카메라 시작 실패");
      }
    }

    start();

    return () => {
      mounted = false;
      const qr = qrRef.current;
      qrRef.current = null;
      if (qr) {
        (async () => {
          try {
            await qr.stop();
          } catch {
            // ignore stop errors
          }
          try {
            await qr.clear();
          } catch {
            // ignore clear errors
          }
        })();
      }
    };
  }, [onScanned]);

  return (
    <div className="panel">
      <h2 style={{ margin: 0, marginBottom: 12 }}>QR 스캔 (Scan)</h2>

      {err && <p style={{ color: "tomato" }}>{err}</p>}
      <div id={regionId} style={{ width: 320, maxWidth: "100%" }} />
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid #555" }}
        >
          카메라로 촬영해서 등록
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
        />
      </div>
      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
        QR 내용은 “쿠폰코드만” 입니다. 스캔되면 자동으로 인증 화면으로 이동합니다. 촬영 버튼을 누르면 휴대폰
        카메라로 사진 촬영도 가능합니다.
      </p>
    </div>
  );
}
