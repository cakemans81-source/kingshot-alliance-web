import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // quality={95}를 사용하기 위해 허용 품질 목록에 추가
    qualities: [75, 95],
    // Supabase Storage 이미지 허용 (엑박 방지)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zarsdnyjmlqfkzinphxx.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
