import { lookup } from "node:dns/promises";
import { request as httpRequest, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { brotliDecompress, gunzip, inflate } from "node:zlib";
import { promisify } from "node:util";

const DEFAULT_MAX_REDIRECTS = 10;
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const blockedIpv4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedIpv4.addSubnet(network, prefix, "ipv4");
}

// Globally routable unicast IPv6 lives in 2000::/3. Explicitly exclude the
// special ranges inside it as well (IETF assignments, documentation, 6to4).
const publicIpv6 = new BlockList();
publicIpv6.addSubnet("2000::", 3, "ipv6");
const blockedIpv6 = new BlockList();
for (const [network, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const) {
  blockedIpv6.addSubnet(network, prefix, "ipv6");
}

const decompressGzip = promisify(gunzip);
const decompressDeflate = promisify(inflate);
const decompressBrotli = promisify(brotliDecompress);

export class SsrfBlockedError extends Error {
  constructor(message = "URL is not publicly routable") {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

type ResolvedAddress = { address: string; family: 4 | 6 };

export type SsrfSafeResponse = {
  body: Buffer;
  headers: Headers;
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
};

export type SsrfSafeFetchOptions = {
  body?: Buffer | string | Uint8Array;
  headers?: HeadersInit;
  maxRedirects?: number;
  maxResponseBytes?: number;
  method?: string;
  rejectUnauthorized?: boolean;
  signal?: AbortSignal;
};

function hostnameWithoutBrackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedIpv4.check(address, "ipv4");
  if (family === 6) {
    return (
      publicIpv6.check(address, "ipv6") &&
      !blockedIpv6.check(address, "ipv6")
    );
  }
  return false;
}

/** Resolve every address for the host and reject if any answer is non-public. */
export async function resolvePublicHttpUrl(
  input: string | URL
): Promise<{ addresses: ResolvedAddress[]; url: URL }> {
  let url: URL;
  try {
    url = input instanceof URL ? new URL(input.href) : new URL(input);
  } catch {
    throw new SsrfBlockedError("URL must be a valid absolute URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfBlockedError("URL must use http or https");
  }
  if (url.username || url.password) {
    throw new SsrfBlockedError("URLs containing credentials are not allowed");
  }

  const hostname = hostnameWithoutBrackets(url.hostname).replace(/\.$/, "");
  const lowerHostname = hostname.toLowerCase();
  if (
    lowerHostname === "localhost" ||
    lowerHostname.endsWith(".localhost") ||
    lowerHostname.endsWith(".local")
  ) {
    throw new SsrfBlockedError();
  }

  const literalFamily = isIP(hostname);
  const addresses: ResolvedAddress[] = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : (await lookup(hostname, { all: true, verbatim: true })).map((entry) => ({
        address: entry.address,
        family: entry.family as 4 | 6,
      }));

  if (addresses.length === 0 || addresses.some((entry) => !isPublicIpAddress(entry.address))) {
    throw new SsrfBlockedError();
  }

  // Prefer IPv4 where both families are available. Some serverless runtimes
  // resolve AAAA records but do not have working outbound IPv6 connectivity.
  addresses.sort((left, right) => left.family - right.family);

  return { addresses, url };
}

function requestBodyBuffer(
  body: SsrfSafeFetchOptions["body"]
): Buffer | undefined {
  if (body == null) return undefined;
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === "string") return Buffer.from(body);
  return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
}

function responseHeaders(rawHeaders: string[]): Headers {
  const headers = new Headers();
  for (let index = 0; index < rawHeaders.length; index += 2) {
    headers.append(rawHeaders[index], rawHeaders[index + 1]);
  }
  return headers;
}

async function decodeResponseBody(
  headers: Headers,
  body: Buffer,
  maximumBytes: number
): Promise<Buffer> {
  const encoding = headers.get("content-encoding")?.trim().toLowerCase();
  let decoded = body;
  if (encoding === "gzip" || encoding === "x-gzip") {
    decoded = await decompressGzip(body);
  } else if (encoding === "deflate") {
    decoded = await decompressDeflate(body);
  } else if (encoding === "br") {
    decoded = await decompressBrotli(body);
  } else {
    return body;
  }

  if (decoded.length > maximumBytes) {
    throw new Error("Upstream response exceeded the size limit after decompression");
  }

  headers.delete("content-encoding");
  headers.set("content-length", String(decoded.length));
  return decoded;
}

async function requestOnce(
  input: string | URL,
  options: SsrfSafeFetchOptions
): Promise<SsrfSafeResponse> {
  const { addresses, url } = await resolvePublicHttpUrl(input);
  // Pin the request to the exact result that was validated. The HTTP Host
  // header and TLS SNI still use url.hostname, preventing DNS-rebinding TOCTOU.
  const selected = addresses[0];
  const headers = new Headers(options.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("proxy-connection");
  headers.delete("transfer-encoding");
  headers.set("accept-encoding", "identity");

  const body = requestBodyBuffer(options.body);
  if (body) headers.set("content-length", String(body.length));
  else headers.delete("content-length");

  const requestHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });

  const lookupPinned: RequestOptions["lookup"] = (
    _hostname,
    _lookupOptions,
    callback
  ) => {
    callback(null, selected.address, selected.family);
  };

  return new Promise<SsrfSafeResponse>((resolve, reject) => {
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = transport(
      url,
      {
        // Do not share pooled sockets with unrelated HTTP clients. Each
        // connection must use the DNS result validated for this request.
        agent: false,
        family: selected.family,
        headers: requestHeaders,
        lookup: lookupPinned,
        method: options.method ?? "GET",
        rejectUnauthorized: options.rejectUnauthorized ?? true,
        signal: options.signal,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let received = 0;
        const maximum =
          options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;

        response.on("data", (chunk: Buffer | Uint8Array) => {
          const buffer = Buffer.from(chunk);
          received += buffer.length;
          if (received > maximum) {
            response.destroy(new Error("Upstream response exceeded the size limit"));
            return;
          }
          chunks.push(buffer);
        });
        response.once("error", reject);
        response.once("end", () => {
          const resultHeaders = responseHeaders(response.rawHeaders);
          decodeResponseBody(resultHeaders, Buffer.concat(chunks), maximum)
            .then((decodedBody) => {
              resolve({
                body: decodedBody,
                headers: resultHeaders,
                ok:
                  typeof response.statusCode === "number" &&
                  response.statusCode >= 200 &&
                  response.statusCode < 300,
                status: response.statusCode ?? 502,
                statusText: response.statusMessage ?? "",
                url: url.href,
              });
            })
            .catch(reject);
        });
      }
    );
    request.once("error", reject);
    request.end(body);
  });
}

/**
 * Fetch an HTTP(S) URL with DNS pinning and manual redirect validation.
 * Every hop is independently resolved and rejected if any DNS answer is not
 * globally routable.
 */
export async function ssrfSafeFetch(
  input: string | URL,
  options: SsrfSafeFetchOptions = {}
): Promise<SsrfSafeResponse> {
  const maximumRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let currentUrl = input instanceof URL ? new URL(input.href) : new URL(input);
  let method = (options.method ?? "GET").toUpperCase();
  let body = options.body;
  const headers = new Headers(options.headers);

  for (let redirects = 0; ; redirects += 1) {
    const response = await requestOnce(currentUrl, {
      ...options,
      body,
      headers,
      method,
    });
    const location = response.headers.get("location");
    if (!location || !REDIRECT_STATUSES.has(response.status)) return response;
    if (redirects >= maximumRedirects) {
      if (maximumRedirects === 0) return response;
      throw new Error("Too many redirects");
    }

    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.origin !== currentUrl.origin) {
      headers.delete("authorization");
      headers.delete("cookie");
    }
    if (
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) && method === "POST")
    ) {
      method = "GET";
      body = undefined;
      headers.delete("content-length");
      headers.delete("content-type");
    }
    currentUrl = nextUrl;
  }
}
