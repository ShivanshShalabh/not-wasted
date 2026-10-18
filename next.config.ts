import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output produces a minimal server bundle for OCI Container Instances / OKE.
  output: "standalone",
  // The OCI SDK is loaded lazily on the server only when OCI_GENAI_ENABLED=true.
  devIndicators: false,
  serverExternalPackages: ["oci-common", "oci-generativeaiinference"],
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
