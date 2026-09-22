import type { NextConfig } from "next";

/**
 * GitHub Pages に置くので静的書き出しにする。
 * プロジェクトページは /<リポジトリ名>/ 配下に出るので basePath が要る。
 * ローカル（npm run dev）では NEXT_PUBLIC_BASE_PATH が空なのでそのまま / で動く。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // /room/ を /room/index.html として出すため。静的ホスティングでは必須
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
