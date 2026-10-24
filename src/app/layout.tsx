import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "musicconnect | 音楽で人と人を繋ぐ",
  description: "カラオケ・パーティー・ドライブで、みんなが知っている曲・聴きたい曲を投票で選ぶ選曲ルーム",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fbfaf7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        {/* 日本語フォントはサブセットが多くビルド時の取得が不安定なため、ブラウザから直接読み込む */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap"
        />
      </head>
      <body className="min-h-full">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-app sm:shadow-[0_0_40px_rgba(0,0,0,0.06)]">
          {children}
        </div>
      </body>
    </html>
  );
}
