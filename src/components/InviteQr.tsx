"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * 招待URLのQRコードと「画像を保存」。
 * QRはカメラで読み取りやすいよう、暗い色を明るい背景に描き、保存しても粗くならない大きさ（640px）で作る。
 */
export default function InviteQr({ url, roomId, size = 224 }: { url: string; roomId: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "M", color: { dark: "#1e1410", light: "#fbefe4" } })
      .then((made) => !cancelled && setDataUrl(made))
      .catch(() => !cancelled && setDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [url]);

  // スマホは共有シート（「画像を保存」がある）、それ以外はPNGをダウンロード
  const save = async () => {
    if (!dataUrl) return;
    const fileName = `musiconnect-${roomId}.png`;
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Musiconnect 招待QRコード" }).catch(() => undefined);
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="招待URLのQRコード" className="rounded-xl" style={{ width: size, height: size }} />
      ) : (
        <span className="rounded-xl bg-surface" style={{ width: size, height: size }} />
      )}
      <p className="text-[12px] text-muted">その場の人は、カメラでこれを読み取ればOK</p>
      <button type="button" onClick={save} disabled={!dataUrl} className="py-1 text-[14px] font-bold text-accent disabled:opacity-40">
        画像を保存
      </button>
    </div>
  );
}
