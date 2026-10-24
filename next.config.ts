import type { NextConfig } from "next";

// GitHub Pages ( https://jphacks.github.io/tkb_2619/ ) にサブパスで配信するため、
// Pages用ビルド（GITHUB_PAGES=true）のときだけ basePath を付与する。
// ローカル開発・Codespaces・Vercel等では空のまま（ルートパス配信）。
const isGithubPagesBuild = process.env.GITHUB_PAGES === "true";
const basePath = isGithubPagesBuild ? "/tkb_2619" : "";

const nextConfig: NextConfig = {
  /* config options here */
  // GitHub Pagesは静的ファイルホスティングのみのため、全ページを静的出力する。
  // 全ページが "use client" のクライアントコンポーネントなので静的書き出しと相性が良い。
  output: "export",
  basePath,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
