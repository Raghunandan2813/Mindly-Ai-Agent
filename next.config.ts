import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for @xenova/transformers ONNX runtime to work in Node.js API routes
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
};

export default nextConfig;
