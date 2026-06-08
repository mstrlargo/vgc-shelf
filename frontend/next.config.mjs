const backendInternalUrl = process.env.BACKEND_INTERNAL_URL || "http://backend:4000";

const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendInternalUrl}/:path*`
      }
    ];
  }
};

export default nextConfig;
