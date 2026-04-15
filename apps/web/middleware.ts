import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { shipDoc } from "@lib/elasticExporter";

// Middleware runs BEFORE the handler, so we only capture request-side
// metadata here. Response status codes are captured via
// instrumentation.ts#onRequestError for errors. For happy-path status codes
// we'd need an Otel http instrumentation — not wired in this pass.

const SKIP_PREFIXES = [
  "/_next/",
  "/api/trpc/_",
  "/favicon.ico",
  "/static/",
  "/assets/",
  "/embed.js",
  "/robots.txt",
  "/manifest.json",
  "/apple-touch-icon",
];

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || null;
}

function safeHeaders(req: NextRequest): Record<string, string> {
  const allow = new Set([
    "host",
    "user-agent",
    "referer",
    "accept-language",
    "content-type",
    "x-forwarded-for",
    "x-real-ip",
    "x-request-id",
    "x-cal-signature-256",
  ]);
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (allow.has(k.toLowerCase())) out[k] = v;
  });
  return out;
}

export function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname, search, hostname, port, protocol } = req.nextUrl;

  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const startNs = Number(process.hrtime?.bigint?.() ?? BigInt(Date.now() * 1_000_000));

  const res = NextResponse.next();
  res.headers.set("x-request-id", reqId);

  // Fire-and-forget ship, not in the request's critical path
  event.waitUntil(
    shipDoc({
      "@timestamp": new Date().toISOString(),
      event: {
        kind: "event",
        category: ["web"],
        type: ["access"],
        outcome: "unknown",
        dataset: "calcom.access",
      },
      trace: { id: reqId },
      http: {
        request: {
          method: req.method,
          id: reqId,
          headers: safeHeaders(req),
        },
      },
      url: {
        path: pathname,
        original: pathname + (search || ""),
        query: search ? search.replace(/^\?/, "") : null,
        scheme: protocol?.replace(":", "") || null,
        domain: hostname || null,
        port: port ? Number(port) : null,
      },
      user_agent: { original: req.headers.get("user-agent") },
      client: { ip: clientIp(req) },
      // Kept for debugging latency — consumer can ignore; ns precision not
      // meaningful cross-runtime on Edge.
      _approx_start_ns: startNs,
    }),
  );

  return res;
}

export const config = {
  // Match everything except Next static + common asset paths (checked again
  // inside the middleware for belt-and-braces).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets/|static/|embed.js).*)",
  ],
};
