import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // quality={95}를 사용하기 위해 허용 품질 목록에 추가
    qualities: [75, 95],
  },
};

export default nextConfig;
