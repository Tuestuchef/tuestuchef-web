import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El PDF de los presupuestos lee el logo del disco cuando no hay imagen de encabezado.
  outputFileTracingIncludes: {
    "/**": ["./src/common/assets/logo/logo-gradient.png"],
  },
};

export default nextConfig;
