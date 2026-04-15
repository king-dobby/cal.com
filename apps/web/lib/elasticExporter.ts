/**
 * Tiny fire-and-forget Elasticsearch bulk shipper for cal.com request + error
 * logs. Runs in Edge (middleware) and Node (instrumentation onRequestError).
 *
 * Writes to the `logs-calcom-default` data stream. Silently no-ops when
 * credentials are missing so local dev stays unaffected.
 *
 * Provisioning + ILM + ingest pipeline lives in
 * henry-bot/execution/elastic/setup_indices_calcom.py.
 */

const DEFAULT_ES_URL = "https://elastic.alc.fyi";
const DEFAULT_ES_API_KEY =
  // Scoped write key for logs-calcom-* (create_doc + auto_configure).
  // Override with CALCOM_ES_API_KEY env var if rotating.
  "MEtXQ2taMEJnRmZYTXQwUldjODc6QWczWVhPVFJqQ2d6My1SbDI1c0VQdw==";

export const ES_URL = (
  process.env.ELASTICSEARCH_URL || DEFAULT_ES_URL
).replace(/\/+$/, "");
export const ES_API_KEY =
  process.env.CALCOM_ES_API_KEY || process.env.ELASTICSEARCH_API_KEY || DEFAULT_ES_API_KEY;
export const DATA_STREAM =
  process.env.CALCOM_ES_DATA_STREAM || "logs-calcom-default";

const SERVICE_NAME = "cal.com";
const SERVICE_ENV = process.env.NODE_ENV || "production";

const ENABLED = Boolean(ES_URL && ES_API_KEY);

export type EcsDoc = Record<string, unknown> & {
  "@timestamp": string;
  event?: { dataset?: string; outcome?: string; [k: string]: unknown };
};

export function shipDoc(doc: EcsDoc): Promise<void> {
  if (!ENABLED) return Promise.resolve();

  doc.service = { name: SERVICE_NAME, environment: SERVICE_ENV, ...(doc.service as object | undefined) };

  const body =
    JSON.stringify({ create: { _index: DATA_STREAM } }) +
    "\n" +
    JSON.stringify(doc) +
    "\n";

  // Fire-and-forget. Swallow all errors — a logging bug must never
  // break a cal.com request or error report.
  return fetch(`${ES_URL}/_bulk`, {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${ES_API_KEY}`,
      "Content-Type": "application/x-ndjson",
    },
    body,
    // Don't wait for long on slow ES — 5s is generous
    signal: AbortSignal.timeout(5000),
  })
    .then(() => undefined)
    .catch(() => undefined);
}
