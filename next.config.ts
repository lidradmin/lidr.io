import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true, // URL parity with WordPress (/about/ not /about)
  images: { unoptimized: true }, // we pre-optimize; plain <img>/<picture>
};

export default nextConfig;
