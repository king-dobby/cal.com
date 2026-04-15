import * as Sentry from "@sentry/nextjs";
import { type Instrumentation } from "next";

import { shipDoc } from "@lib/elasticExporter";

export async function register() {
  if (process.env.NODE_ENV === "production") {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NEXT_RUNTIME === "nodejs") {
      await import("./sentry.server.config");
    }
    if (process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NEXT_RUNTIME === "edge") {
      await import("./sentry.edge.config");
    }
  }
}

export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  if (process.env.NODE_ENV === "production") {
    Sentry.captureRequestError(err, request, context);
  }

  // Also ship to Elasticsearch so crashes are queryable in Kibana alongside
  // access logs. Fire-and-forget — shipDoc swallows all errors.
  try {
    const e = err as Error;
    void shipDoc({
      "@timestamp": new Date().toISOString(),
      event: {
        kind: "event",
        category: ["web"],
        type: ["error"],
        outcome: "failure",
        dataset: "calcom.error",
      },
      message: e?.message,
      error: {
        type: e?.name,
        message: e?.message,
        stack_trace: e?.stack,
      },
      http: {
        request: {
          method: request?.method,
          headers: request?.headers as Record<string, string> | undefined,
        },
      },
      url: { path: request?.path, original: request?.path },
      labels: {
        route: context?.routePath,
        routerKind: context?.routerKind,
        renderSource: context?.renderSource,
        revalidateReason: context?.revalidateReason,
      },
    });
  } catch {
    // swallow
  }
};
