import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // X profile pictures. Narrow on purpose: next/image will proxy whatever it
    // is pointed at, and the URL here comes from a third-party API response.
    remotePatterns: [
      { protocol: "https", hostname: "pbs.twimg.com", pathname: "/profile_images/**" },
    ],
  },
};

export default nextConfig;
