const STATIC_ASSET_PREFIXES = [
  "/assets/",
  "/brand/",
  "/icon",
  "/manifest.webmanifest",
  "/robots.txt",
  "/.well-known/",
];

function isLocalRequest(url: URL) {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
}

function contentSecurityPolicy(url: URL) {
  const local = isLocalRequest(url);
  const connectSources = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://challenges.cloudflare.com",
    "https://vercel.live",
    "https://*.vercel.live",
    "wss://*.vercel.live",
    "https://maps.googleapis.com",
    "https://places.googleapis.com",
    "https://maps.gstatic.com",
  ];

  if (local)
    connectSources.push(
      "http://localhost:*",
      "ws://localhost:*",
      "http://127.0.0.1:*",
      "ws://127.0.0.1:*",
    );

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://vercel.live https://*.vercel.live https://maps.googleapis.com https://maps.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://vercel.live https://*.vercel.live",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co https://vercel.live https://*.vercel.live https://maps.googleapis.com https://maps.gstatic.com https://*.googleusercontent.com",
    `connect-src ${connectSources.join(" ")}`,
    "frame-src 'self' https://challenges.cloudflare.com https://vercel.live https://*.vercel.live",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];

  if (!local && url.protocol === "https:") directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

function isStaticAsset(pathname: string) {
  return STATIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function applySecurityHeaders(request: Request, response: Response): Response {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html");
  const isSensitiveResponse = !isStaticAsset(url.pathname) && (isHtml || request.method !== "GET");

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  headers.set("Origin-Agent-Cluster", "?1");
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  headers.set("Cross-Origin-Resource-Policy", "same-site");
  headers.set(
    "Permissions-Policy",
    "camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), serial=(), bluetooth=(), display-capture=(), browsing-topics=()",
  );
  headers.set("Content-Security-Policy", contentSecurityPolicy(url));

  // O app ainda está em piloto. Evita indexação de perfis e ambientes de teste.
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");

  if (!isLocalRequest(url) && url.protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  if (isSensitiveResponse) {
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0, private");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    headers.set("Surrogate-Control", "no-store");
    const vary = new Set(
      (headers.get("Vary") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
    vary.add("Cookie");
    vary.add("Authorization");
    headers.set("Vary", [...vary].join(", "));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
