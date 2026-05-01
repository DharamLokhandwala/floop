import { getAuditById } from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_PROTOCOLS = ["https:", "http:"];

function normalizePath(pathname: string, search = ""): string {
  const p = `${pathname}${search}`;
  return p === "" || p === "/" ? "/" : p.replace(/\/$/, "") || "/";
}

function getPinPath(pageUrl: string | undefined, auditOrigin: string): string {
  if (!pageUrl) return "/";

  // Only unwrap ?path= when the URL is exactly the proxy view route.
  const isProxyViewUrl = (pathname: string) =>
    /\/audit\/[^/]+\/view\/?$/i.test(pathname);

  const fromUrl = (u: URL) => {
    if (isProxyViewUrl(u.pathname)) {
      const p = u.searchParams.get("path");
      if (p) {
        try { return normalizePath(new URL(p, auditOrigin).pathname, new URL(p, auditOrigin).search); } catch { return "/"; }
      }
      return "/";
    }
    return normalizePath(u.pathname, u.search);
  };

  try { return fromUrl(new URL(pageUrl)); } catch { /* fall through */ }
  try { return fromUrl(new URL(pageUrl, auditOrigin)); } catch { /* fall through */ }
  return "/";
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function viewerErrorResponse(
  status: number,
  title: string,
  message: string,
  appOrigin: string,
  auditId: string
): NextResponse {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const body = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      html, body { margin: 0; padding: 0; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #0b0b0e; color: #f4f4f5; }
      .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { width: min(620px, 100%); background: rgba(24,24,27,.9); border: 1px solid rgba(244,244,245,.15); border-radius: 14px; padding: 18px; }
      .status { display: inline-block; font-size: 12px; color: #a1a1aa; border: 1px solid rgba(161,161,170,.35); border-radius: 999px; padding: 4px 10px; margin-bottom: 10px; }
      h1 { margin: 0 0 8px 0; font-size: 18px; line-height: 1.35; }
      p { margin: 0; color: #d4d4d8; line-height: 1.5; }
      .actions { margin-top: 14px; display: flex; gap: 8px; }
      button { border: 1px solid rgba(244,244,245,.2); background: #18181b; color: #fafafa; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
      button:hover { background: #27272a; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <span class="status">Error ${status}</span>
        <h1>${safeTitle}</h1>
        <p>${safeMessage}</p>
        <div class="actions">
          <button type="button" onclick="window.location.reload()">Try again</button>
        </div>
      </div>
    </div>
    <script>
      (function() {
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: "AUDIT_VIEWER_ERROR",
              status: ${status},
              title: ${JSON.stringify(title)},
              message: ${JSON.stringify(message)}
            }, "*");
          }
        } catch (e) {}
      })();
    </script>
  </body>
</html>`;
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "ALLOWALL",
      "Content-Security-Policy": "frame-ancestors *",
      "X-Audit-Viewer-Error": "1",
      "X-Audit-Viewer-Id": `${auditId}`,
      "Access-Control-Allow-Origin": appOrigin,
    },
  });
}

/**
 * Proxies the audit's live website and injects the comment overlay script.
 * GET /audit/[id]/view?path=/about -> fetches audit.url + path, rewrites links, injects script.
 *
 * All sub-resource URLs (JS, CSS, fonts, images) pointing to the target origin
 * are rewritten to go through /audit/[id]/asset/â€¦ so the browser never makes
 * cross-origin requests, avoiding CORS failures for module scripts, fonts, etc.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const appOrigin = request.nextUrl.origin;
  const audit = await getAuditById(id);
  if (!audit) {
    return viewerErrorResponse(404, "Audit not found", "This audit no longer exists or you may not have access to it.", appOrigin, id);
  }

  const path = request.nextUrl.searchParams.get("path") ?? "";
  const baseUrl = audit.url.replace(/\/$/, "");
  let targetUrl: URL;
  try {
    targetUrl = new URL(path.startsWith("http") ? path : baseUrl + (path.startsWith("/") ? path : "/" + path));
  } catch {
    return viewerErrorResponse(400, "Invalid page path", "The requested page path could not be parsed.", appOrigin, id);
  }

  const auditOrigin = new URL(audit.url).origin;
  if (targetUrl.origin !== auditOrigin) {
    return viewerErrorResponse(403, "Blocked cross-site navigation", "Navigation is limited to the original website for this audit.", appOrigin, id);
  }
  if (!ALLOWED_PROTOCOLS.includes(targetUrl.protocol)) {
    return viewerErrorResponse(400, "Unsupported protocol", "Only http and https websites are supported.", appOrigin, id);
  }

  const fetchOptions = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Sec-Ch-Ua":
        '"Chromium";v="124", "Google Chrome";v="124", "Not_A Brand";v="24"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
    redirect: "follow" as RequestRedirect,
  };

  let html: string;
  const doFetch = async (signal: AbortSignal) => {
    const res = await fetch(targetUrl.href, { ...fetchOptions, signal });
    if (!res.ok) return { ok: false as const, status: res.status };
    const text = await res.text();
    return { ok: true as const, html: text };
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    let result = await doFetch(controller.signal);
    clearTimeout(timeout);

    if (!result.ok) {
      const retryable = [403, 503, 502, 429].includes(result.status);
      if (retryable) {
        await new Promise((r) => setTimeout(r, 2000));
        const c2 = new AbortController();
        const t2 = setTimeout(() => c2.abort(), 45_000);
        result = await doFetch(c2.signal);
        clearTimeout(t2);
      }
      if (!result.ok) {
        return viewerErrorResponse(
          result.status,
          `Website returned ${result.status}`,
          "This website blocked or failed the proxied request. Please try again, or open another page in the site.",
          appOrigin,
          id
        );
      }
    }
    html = result.ok ? result.html : "";
  } catch (err) {
    console.error("Proxy fetch error:", targetUrl.href, err);
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Page took too long to respond"
        : "Failed to load page";
    return viewerErrorResponse(502, "Website unavailable", message, appOrigin, id);
  }
  const proxyViewBase = `${appOrigin}/audit/${id}/view`;
  const assetBase = `${appOrigin}/audit/${id}/asset`;

  // --- Pins for this page --------------------------------------------------
  const targetPath = normalizePath(targetUrl.pathname, targetUrl.search);
  const isRootPath = !path || path === "/";
  const pinsForPage = [...audit.pins, ...audit.userPins].filter(
    (pin: { pageUrl?: string }) => {
      if (pin.pageUrl) {
        return getPinPath(pin.pageUrl as string, auditOrigin) === targetPath;
      }
      return isRootPath;
    }
  );

  // --- Rewrite HTML ---------------------------------------------------------
  // 1. Rewrite <a> navigation links â†’ view proxy
  html = rewriteNavigationLinks(html, targetUrl.href, auditOrigin, proxyViewBase);
  // 2. Rewrite full-origin and absolute-path sub-resource URLs â†’ asset proxy
  html = rewriteResourceUrls(html, auditOrigin, assetBase, proxyViewBase, id);
  // 3. Strip attributes that trigger CORS or SRI failures on proxied content
  html = stripCorsAttributes(html);

  // 4. Inject <base> pointing at asset proxy so relative URLs also route through it
  const historyShim = getHistoryShimScript(auditOrigin, proxyViewBase, assetBase);
  const baseTag = `<base href="${assetBase}/">`;
  if (/<head\b/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, "$&" + historyShim + baseTag);
  } else {
    html = html.replace(/<html\b/i, "<html><head>" + historyShim + baseTag + "</head>");
  }

  const sessionUser = await getCurrentUser();
  const createdById = audit.createdById ?? null;
  const viewerAuthenticated = !!sessionUser;
  const viewerIsOwner = !!(sessionUser && createdById && sessionUser.id === createdById);

  // 5. Inject viewer script
  const viewerScript = getViewerScript(id, targetUrl.href, pinsForPage, {
    viewerAuthenticated,
    viewerIsOwner,
    viewerUserId: sessionUser?.id ?? null,
    viewerName: sessionUser?.name || sessionUser?.email || null,
  });
  if (html.includes("</body>")) {
    html = html.replace("</body>", `${viewerScript}</body>`);
  } else {
    html += viewerScript;
  }

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "ALLOWALL",
      "Content-Security-Policy": "frame-ancestors *",
    },
  });
}

// ---------------------------------------------------------------------------
// HTML rewriters
// ---------------------------------------------------------------------------

/**
 * Rewrites <a href="â€¦"> links that point to the audit origin so navigation
 * goes through the view proxy (which fetches + instruments the next page).
 */
function rewriteNavigationLinks(
  html: string,
  currentPageUrl: string,
  allowedOrigin: string,
  proxyViewBase: string
): string {
  return html.replace(
    /<a\s+([^>]*?)href\s*=\s*["']([^"']*)["']/gi,
    (match, attrs, href) => {
      const trimmed = href.trim();
      if (
        !trimmed ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("javascript:")
      ) {
        return match;
      }
      let resolved: URL;
      try {
        resolved = new URL(trimmed, currentPageUrl);
      } catch {
        return match;
      }
      if (resolved.origin !== allowedOrigin) return match;
      const path = resolved.pathname + resolved.search;
      const newHref = `${proxyViewBase}?path=${encodeURIComponent(path)}`;
      return `<a ${attrs}href="${newHref}"`;
    }
  );
}

/**
 * Rewrites sub-resource URLs so they load through the asset proxy:
 * - Full-origin refs: https://audit-origin/path â†’ assetBase/path
 * - Absolute paths: /path (e.g. /assets/foo.js) â†’ assetBase/path
 * With <base href="assetBase/">, absolute paths resolve to origin + path = app
 * origin + /path, so we must rewrite "/path" to "/audit/id/asset/path" in HTML.
 */
function rewriteResourceUrls(
  html: string,
  auditOrigin: string,
  assetBase: string,
  proxyViewBase: string,
  auditId: string
): string {
  const escaped = auditOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Asset path prefix without origin: /audit/{id}/asset
  const assetPathPrefix = `/audit/${auditId}/asset`;

  // 1) Full-origin refs on resource-like tags: https://origin/â€¦ â†’ assetBase/â€¦
  html = html.replace(
    new RegExp(
      `(<(?:script|link|img|source|video|audio|embed|object|iframe)\\s[^>]*?(?:src|href|srcset|poster|content|data-src)\\s*=\\s*["'])${escaped}(/[^"']*)`,
      "gi"
    ),
    (_m, prefix, path) => `${prefix}${assetBase}${path}`
  );

  // 2) Absolute-path refs on same tags: "/path" â†’ "/audit/id/asset/path"
  //    so the browser requests our proxy instead of localhost:3000/path
  html = html.replace(
    /(<(?:script|link|img|source|video|audio|embed|object|iframe)\s[^>]*?(?:src|href|srcset|poster|content|data-src)\s*=\s*["'])(\/[^"']*)/gi,
    (match, prefix, path) => {
      if (path.startsWith("//")) return match; // protocol-relative URL, leave for origin rewrite
      return `${prefix}${assetPathPrefix}${path}`;
    }
  );

  // 3) url() in inline <style>
  html = html.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m, open, css, close) => {
      const reOrigin = new RegExp(
        `url\\(\\s*(['"]?)${escaped}(/[^)'"\\s]*)\\1\\s*\\)`,
        "gi"
      );
      const reAbs = /url\s*\(\s*(['"]?)(\/[^)'"\s]*)\1\s*\)/gi;
      let out = css.replace(
        reOrigin,
        (_: string, q: string, p: string) => `url(${q}${assetBase}${p}${q})`
      );
      out = out.replace(
        reAbs,
        (_: string, q: string, p: string) =>
          `url(${q}${assetPathPrefix}${p}${q})`
      );
      return open + out + close;
    }
  );

  // 4) srcset can contain multiple URLs: "/a 1x, /b 2x" or "https://origin/a 1x, ..."
  html = html.replace(
    /(<(?:img|source)\s[^>]*?\ssrcset\s*=\s*["'])([^"']*)(["'])/gi,
    (_m, prefix, value, suffix) => {
      const rewritten = value
        .split(",")
        .map((part: string) => {
          const trimmed = part.trim();
          const space = trimmed.indexOf(" ");
          const url = space >= 0 ? trimmed.slice(0, space) : trimmed;
          const rest = space >= 0 ? trimmed.slice(space) : "";
          if (!url) return part;
          if (url.startsWith("//")) return part;
          if (url.startsWith(auditOrigin)) {
            const path = url.slice(auditOrigin.length) || "/";
            return assetBase + path + rest;
          }
          if (url.startsWith("/")) {
            return assetPathPrefix + url + rest;
          }
          return part;
        })
        .join(", ");
      return prefix + rewritten + suffix;
    }
  );

  // 5) form action (same-origin) â†’ view proxy so submissions stay in proxy
  html = html.replace(
    /(<form\s[^>]*?\saction\s*=\s*["'])(\/[^"']*)(["'])/gi,
    (_m, prefix, path, suffix) => {
      if (path.startsWith("//")) return _m;
      return `${prefix}${proxyViewBase}?path=${encodeURIComponent(path)}${suffix}`;
    }
  );

  // 6) meta content (og:image, etc.) same-origin URLs â†’ asset proxy
  html = html.replace(
    new RegExp(
      `(<meta\\s[^>]*?content\\s*=\\s*["'])${escaped}(/[^"']*)(["'])`,
      "gi"
    ),
    (_m, prefix, path, suffix) => `${prefix}${assetBase}${path}${suffix}`
  );
  html = html.replace(
    /(<meta\s[^>]*?content\s*=\s*["'])(\/[^"']*)(["'])/gi,
    (_m, prefix, path, suffix) => {
      if (path.startsWith("//")) return _m;
      return `${prefix}${assetPathPrefix}${path}${suffix}`;
    }
  );

  return html;
}

/**
 * Removes crossorigin and integrity attributes that would break proxied
 * resources. Also removes nonce attributes since the CSP doesn't match.
 * Strips <meta http-equiv="Content-Security-Policy"> tags so the website's
 * own CSP doesn't block our injected inline viewer script.
 */
function stripCorsAttributes(html: string): string {
  return html
    .replace(/\s+crossorigin(?:\s*=\s*["'][^"']*["'])?/gi, "")
    .replace(/\s+integrity\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s+nonce\s*=\s*["'][^"']*["']/gi, "")
    // Remove CSP meta tags so the site's policy doesn't block our inline script
    .replace(/<meta\s[^>]*http-equiv\s*=\s*["']content-security-policy["'][^>]*>/gi, "")
    .replace(/<meta\s[^>]*content\s*=\s*["'][^"']*["'][^>]*http-equiv\s*=\s*["']content-security-policy["'][^>]*>/gi, "");
}

// ---------------------------------------------------------------------------
// History API shim
// ---------------------------------------------------------------------------

function getHistoryShimScript(
  auditOrigin: string,
  proxyViewBase: string,
  assetBase: string
): string {
  const originJson = JSON.stringify(auditOrigin);
  const proxyViewBaseJson = JSON.stringify(proxyViewBase);
  const assetBaseJson = JSON.stringify(assetBase);

  return `<script>
(function(){
  var origin=${originJson};
  var viewBase=${proxyViewBaseJson};
  var assetBase=${assetBaseJson};

  function rewrite(url){
    if(!url) return url;
    var s=String(url);
    if(s.indexOf(origin)!==0) return s;
    try{
      var u=new URL(s);
      return viewBase+'?path='+encodeURIComponent(u.pathname+u.search);
    }catch(e){return s;}
  }

  function notifyParentPageUrl(url) {
    if (window.parent === window) return;
    try {
      var parsed;
      try { parsed = new URL(String(url)); } catch(e2) { parsed = new URL(String(url), window.location.origin); }
      var pathParam = parsed.searchParams ? parsed.searchParams.get('path') : null;
      var pageUrl;
      if (pathParam && /\/audit\/[^/]+(?:\/view)?\/?$/i.test(parsed.pathname || '')) {
        var purl = new URL(pathParam, origin);
        pageUrl = origin + purl.pathname + (purl.search || '') + (purl.hash || '');
      } else if (parsed.origin === origin) {
        pageUrl = parsed.href;
      } else {
        var p = parsed.pathname + (parsed.search || '') + (parsed.hash || '');
        pageUrl = origin + (p.charAt(0) === '/' ? p : '/' + p);
      }
      if (window.__AUDIT_VIEWER__) window.__AUDIT_VIEWER__.pageUrl = pageUrl;
      window.parent.postMessage({ type: 'AUDIT_VIEWER_READY', pageUrl: pageUrl }, '*');
    } catch (e) {}
  }

  var _replace=history.replaceState;
  var _push=history.pushState;
  history.replaceState=function(st,t,url){
    var rewritten = url ? (function(){ try { return rewrite(url); } catch(e) { return url; } })() : url;
    try { _replace.call(this,st,t,rewritten); } catch(e){ try{ _replace.call(this,st,t); } catch(e2){} }
    if (rewritten) notifyParentPageUrl(rewritten);
  };
  history.pushState=function(st,t,url){
    var rewritten = url ? (function(){ try { return rewrite(url); } catch(e) { return url; } })() : url;
    try { _push.call(this,st,t,rewritten); } catch(e){ try{ _push.call(this,st,t); } catch(e2){} }
    if (rewritten) notifyParentPageUrl(rewritten);
  };
  window.addEventListener('popstate', function() {
    try { notifyParentPageUrl(window.location.href); } catch (e) {}
  });
  window.addEventListener('hashchange', function() {
    try { notifyParentPageUrl(window.location.href); } catch (e) {}
  });

  // Intercept window.location assignments that some SPAs use
  var _fetch=window.fetch;
  if(_fetch) window.fetch=function(input,init){
    if(typeof input==='string'&&input.indexOf(origin)===0){
      var u=new URL(input);
      input=assetBase+u.pathname+u.search;
    }
    return _fetch.call(this,input,init);
  };

  // Intercept XMLHttpRequest.open for older sites
  var _open=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url){
    if(typeof url==='string'&&url.indexOf(origin)===0){
      var u=new URL(url);
      url=assetBase+u.pathname+u.search;
    }
    return _open.apply(this,arguments.length>=3?[method,url,arguments[2],arguments[3],arguments[4]]:[method,url]);
  };
})();
</script>`;
}

interface PinForScript {
  id?: string;
  x: number;
  y: number;
  category?: string;
  feedback?: string;
  selector?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  scrollX?: number;
  scrollY?: number;
  docX?: number;
  docY?: number;
  authorId?: string;
  authorName?: string;
  replies?: Array<{
    id: string;
    userId: string;
    body: string;
    createdAt: string;
    authorName?: string | null;
  }>;
}

function getViewerScript(
  auditId: string,
  pageUrl: string,
  pins: PinForScript[],
  viewerContext: { viewerAuthenticated: boolean; viewerIsOwner: boolean; viewerUserId: string | null; viewerName: string | null }
): string {
  const pinsJson = JSON.stringify(pins);
  const vAuth = JSON.stringify(viewerContext.viewerAuthenticated);
  const vOwner = JSON.stringify(viewerContext.viewerIsOwner);
  const vUserId = JSON.stringify(viewerContext.viewerUserId);
  const vName = JSON.stringify(viewerContext.viewerName);
  const script = `
<script>
window.__AUDIT_VIEWER__ = { auditId: ${JSON.stringify(auditId)}, pageUrl: ${JSON.stringify(pageUrl)}, pins: ${pinsJson}, viewerAuthenticated: ${vAuth}, viewerIsOwner: ${vOwner}, viewerUserId: ${vUserId}, viewerName: ${vName} };
(function() {
  var commentMode = false;
  var ctrlHeld = false; // tracks whether the modifier key is physically held in this frame
  var hotspotElements = [];
  var categoryColors = { SEO: '#3b82f6', 'Visual Design': '#a855f7', CRO: '#22c55e', Feedback: '#3A3CFF' };

  /* â”€â”€ Hover highlight overlay for comment mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var hoverOverlay = null;
  var lastHoveredEl = null;

  function createHoverOverlay() {
    if (hoverOverlay) return;
    hoverOverlay = document.createElement('div');
    hoverOverlay.id = 'audit-comment-hover-overlay';
    hoverOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483645;border:2px solid #3A3CFF;border-radius:4px;background:rgba(58,60,255,0.08);transition:left 0.08s ease-out,top 0.08s ease-out,width 0.08s ease-out,height 0.08s ease-out;display:none;';
    document.documentElement.appendChild(hoverOverlay);
  }

  function updateHoverOverlay(el) {
    if (!hoverOverlay || !el) { hideHoverOverlay(); return; }
    try {
      if (el.id === 'audit-viewer-hotspots' || el.id === 'audit-comment-hover-overlay' || el.id === 'audit-viewer-tooltip' || el.closest('#audit-viewer-hotspots') || el.classList.contains('audit-viewer-hotspot')) {
        hideHoverOverlay(); return;
      }
    } catch(ex) {}
    var r = el.getBoundingClientRect();
    hoverOverlay.style.left = r.left + 'px';
    hoverOverlay.style.top = r.top + 'px';
    hoverOverlay.style.width = r.width + 'px';
    hoverOverlay.style.height = r.height + 'px';
    hoverOverlay.style.display = 'block';
    lastHoveredEl = el;
  }

  function hideHoverOverlay() {
    if (hoverOverlay) hoverOverlay.style.display = 'none';
    lastHoveredEl = null;
  }

  var isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
  function isModifierHeld(e) { return isMac ? e.metaKey : e.ctrlKey; }
  function setCommentModeFromKey(active) {
    if (commentMode === active) return;
    commentMode = active;
    document.body.style.cursor = active ? 'crosshair' : '';
    if (document.documentElement) document.documentElement.style.cursor = active ? 'crosshair' : '';
    if (active) createHoverOverlay();
    else hideHoverOverlay();
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'CTRL_KEY_STATE', held: active }, '*');
    }
  }

  document.addEventListener('keydown', function(e) {
    if ((isMac && e.key === 'Meta') || (!isMac && e.key === 'Control')) {
      ctrlHeld = true;
      setCommentModeFromKey(true);
    }
  });
  document.addEventListener('keyup', function(e) {
    if ((isMac && e.key === 'Meta') || (!isMac && e.key === 'Control')) {
      ctrlHeld = false;
      setCommentModeFromKey(false);
    }
  });
  window.addEventListener('blur', function() { ctrlHeld = false; setCommentModeFromKey(false); });

  document.addEventListener('mousemove', function(e) {
    var modHeld = isModifierHeld(e);
    ctrlHeld = modHeld; // keep ctrlHeld in sync via mouse events (covers case where keydown fired in parent frame)
    if (modHeld !== commentMode) setCommentModeFromKey(modHeld);
    if (!commentMode) { hideHoverOverlay(); return; }
    createHoverOverlay();
    var wasDisplay = hoverOverlay ? hoverOverlay.style.display : '';
    if (hoverOverlay) hoverOverlay.style.display = 'none';
    var target = document.elementFromPoint(e.clientX, e.clientY);
    if (hoverOverlay) hoverOverlay.style.display = wasDisplay;
    if (!target) return;
    try {
      if (target.id === 'audit-viewer-hotspots' || target.id === 'audit-comment-hover-overlay' || target.id === 'audit-viewer-tooltip' || target.closest('#audit-viewer-hotspots') || target.classList.contains('audit-viewer-hotspot')) return;
    } catch(ex) {}
    if (target === lastHoveredEl) return;
    var meaningful = target;
    while (meaningful && meaningful !== document.body && meaningful !== document.documentElement) {
      var tag = meaningful.tagName;
      if (tag === 'A' || tag === 'BUTTON' || tag === 'IMG' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'VIDEO' ||
          tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6' ||
          tag === 'P' || tag === 'LI' || tag === 'TD' || tag === 'TH' || tag === 'SECTION' || tag === 'ARTICLE' ||
          tag === 'NAV' || tag === 'HEADER' || tag === 'FOOTER' || tag === 'MAIN' || tag === 'ASIDE' || tag === 'FORM' ||
          tag === 'FIGURE' || tag === 'BLOCKQUOTE' || tag === 'PRE' || tag === 'CODE' || tag === 'TABLE' || tag === 'UL' || tag === 'OL' ||
          tag === 'DIV') {
        if (tag === 'DIV') {
          var divRect = meaningful.getBoundingClientRect();
          if (divRect.width > 30 && divRect.height > 30) break;
        } else break;
      }
      var rect = meaningful.getBoundingClientRect();
      if (rect.width > 20 && rect.height > 20) break;
      meaningful = meaningful.parentElement;
    }
    if (!meaningful || meaningful === document.body || meaningful === document.documentElement) meaningful = target;
    updateHoverOverlay(meaningful);
  }, { passive: true });

  document.addEventListener('mouseleave', function() { hideHoverOverlay(); });

  /* â”€â”€ Find the actual scroll container â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   * Many modern sites (React/Next.js) don't scroll the window â€”
   * they scroll an inner div. We need to find it so we can compute
   * document-level positions properly.
   * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function findScrollContainer() {
    // First check if the normal window scrolls
    if (document.documentElement.scrollHeight > document.documentElement.clientHeight + 10) {
      return null; // window is the scroll container
    }
    // Walk the DOM looking for the first oversized scrollable container
    var candidates = document.querySelectorAll('div, main, section');
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var style = window.getComputedStyle(el);
      var overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && el.scrollHeight > el.clientHeight + 10) {
        return el;
      }
    }
    return null;
  }

  /* â”€â”€ Resolve a pin to its target DOM element â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function resolveTargetElement(pin) {
    if (pin.selector) {
      try {
        var el = document.querySelector(pin.selector);
        if (el) return el;
      } catch(e) {}
    }
    return null;
  }

  function getCachedTargetElement(pin) {
    var cached = pin && pin.__auditTargetEl;
    if (cached && cached.isConnected) return cached;
    var resolved = resolveTargetElement(pin);
    pin.__auditTargetEl = resolved || null;
    return resolved;
  }

  var _highlightedEl = null;
  var _highlightTimer = null;
  function highlightPinTarget(pin) {
    clearPinHighlight();
    var target = resolveTargetElement(pin);
    if (target) {
      target.style.outline = '3px solid #0ea5e9';
      target.style.outlineOffset = '2px';
      _highlightedEl = target;
    }
  }
  function clearPinHighlight() {
    if (_highlightedEl) { _highlightedEl.style.outline = ''; _highlightedEl.style.outlineOffset = ''; _highlightedEl = null; }
    if (_highlightTimer) { clearTimeout(_highlightTimer); _highlightTimer = null; }
  }

  /* â”€â”€ Compute viewport-relative position for a pin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function computePinViewportPosition(pin, scrollContainer, containerRect) {
    // Try to anchor to DOM element first (most robust)
    var target = getCachedTargetElement(pin);
    if (target) {
      var r = target.getBoundingClientRect();
      return { vx: r.left + r.width / 2, vy: r.top, visible: true };
    }
    // Fall back to saved coordinates
    if (scrollContainer) {
      // The pin's docX/docY are in the scroll container's coordinate space
      var rect = containerRect || scrollContainer.getBoundingClientRect();
      if (typeof pin.docX === 'number' && typeof pin.docY === 'number') {
        var vx = rect.left + pin.docX - scrollContainer.scrollLeft;
        var vy = rect.top + pin.docY - scrollContainer.scrollTop;
        return { vx: vx, vy: vy, visible: true };
      }
      if (pin.scrollX != null && pin.scrollY != null && pin.viewportWidth && pin.viewportHeight) {
        var docPx = pin.scrollX + (pin.x / 100) * pin.viewportWidth;
        var docPy = pin.scrollY + (pin.y / 100) * pin.viewportHeight;
        var vx2 = rect.left + docPx - scrollContainer.scrollLeft;
        var vy2 = rect.top + docPy - scrollContainer.scrollTop;
        return { vx: vx2, vy: vy2, visible: true };
      }
    } else {
      // Window is the scroll container
      if (typeof pin.docX === 'number' && typeof pin.docY === 'number') {
        return { vx: pin.docX - window.scrollX, vy: pin.docY - window.scrollY, visible: true };
      }
      if (pin.scrollX != null && pin.scrollY != null && pin.viewportWidth && pin.viewportHeight) {
        var dx = pin.scrollX + (pin.x / 100) * pin.viewportWidth;
        var dy = pin.scrollY + (pin.y / 100) * pin.viewportHeight;
        return { vx: dx - window.scrollX, vy: dy - window.scrollY, visible: true };
      }
      // Percentage-based fallback
      var docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth || 0);
      var docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight || 0);
      var fdx = (pin.x / 100) * docW;
      var fdy = (pin.y / 100) * docH;
      return { vx: fdx - window.scrollX, vy: fdy - window.scrollY, visible: true };
    }
    return { vx: 0, vy: 0, visible: false };
  }

  /* Pin thread tooltip (reply / delete) */
  var tooltipEl = null;
  var activeTooltipIndex = -1;
  var hideTooltipTimer = null;
  var activeReplyMicCleanup = null;
  /* Set to true after a reply succeeds; prevents the scheduled-hide timer from
     closing the tooltip during the async window between reply success and the
     UPDATE_PINS message that triggers renderHotspots. Reset in renderHotspots. */
  var replyJustPosted = false;
  var replyJustPostedSafetyTimer = null;

  function cancelHideTooltip() {
    if (hideTooltipTimer) { clearTimeout(hideTooltipTimer); hideTooltipTimer = null; }
  }
  function scheduleHideTooltip() {
    if (replyJustPosted) return;
    cancelHideTooltip();
    hideTooltipTimer = setTimeout(function() { hideTooltip(); }, 280);
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function authorInitials(name) {
    var n = String(name == null ? '' : name).trim();
    if (!n.length) return '?';
    return n.charAt(0).toUpperCase();
  }
  function replyAvatarBg(name) {
    var h = 0, s = String(name || 'user');
    for (var j = 0; j < s.length; j++) h = (h + s.charCodeAt(j) * 17) % 360;
    return 'hsl(' + h + ', 46%, 44%)';
  }

  function timeAgo(dateInput) {
    if (!dateInput) return 'just now';
    var d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'just now';
    var seconds = Math.round((new Date().getTime() - d.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.round(hours / 24);
    if (days < 30) return days + 'd ago';
    var months = Math.round(days / 30);
    if (months < 12) return months + 'mo ago';
    var years = Math.round(days / 365);
    return years + 'y ago';
  }

  function injectFigmaThreadCss() {
    if (document.getElementById('audit-figma-thread-css')) return;
    var st = document.createElement('style');
    st.id = 'audit-figma-thread-css';
    st.textContent = '#audit-viewer-tooltip.audit-figma-root{max-width:320px;min-width:300px;max-height:72vh;overflow:hidden;padding:0;margin:0;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1e1e1e;background:#fff;border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.06);-webkit-font-smoothing:antialiased;display:flex;flex-direction:column;padding-top:12px;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-messages{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-header{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;flex-shrink:0;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-header-title{font-size:15px;font-weight:700;color:#111827;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-header-btn{background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;color:#6b7280;display:flex;align-items:center;justify-content:center;transition:background 0.15s;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-header-btn:hover{background:#f3f4f6;color:#111827;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-msg{padding:8px 16px 12px;display:flex;flex-direction:column;gap:6px;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-name{font-size:11px;font-weight:500;color:#6b7280;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-bubble{background:rgba(243,244,246,0.6);border:1px solid rgba(229,231,235,0.8);border-radius:12px;padding:12px;font-size:13px;line-height:1.6;color:#111827;word-break:break-word;white-space:pre-wrap;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-composer{padding:4px 16px 16px;flex-shrink:0;border-top:1px solid rgba(229,231,235,0.6);}' +
      '#audit-viewer-tooltip.audit-figma-root .af-initial-reply{display:flex;align-items:center;gap:6px;color:#3A3CFF;font-size:13px;font-weight:500;background:none;border:none;cursor:pointer;padding:0;margin-top:4px;transition:opacity 0.15s;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-initial-reply:hover{opacity:0.8;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-composer-state2{display:none;flex-direction:column;gap:6px;margin-top:4px;}' +
      '#audit-viewer-tooltip.audit-figma-root.is-replying .af-initial-reply{display:none;}' +
      '#audit-viewer-tooltip.audit-figma-root.is-replying .af-composer-state2{display:flex;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-composer-row{display:flex;align-items:center;gap:8px;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-ta{flex:1;box-sizing:border-box;border:1px solid rgba(229,231,235,0.8);border-radius:8px;padding:0 12px;font-size:13px;font-family:inherit;background:rgba(243,244,246,0.6);height:36px;line-height:36px;transition:border-color 0.15s;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-ta:focus{outline:none;border-color:rgba(58,60,255,0.5);}' +
      '#audit-viewer-tooltip.audit-figma-root .af-ta::placeholder{color:rgba(107,114,128,0.5);}' +
      '#audit-viewer-tooltip.audit-figma-root .af-btn{flex-shrink:0;width:36px;height:36px;border-radius:50%;border:none;background:#3A3CFF;color:#fff;display:flex;align-items:center;justify-content:center;transition:background 0.15s;cursor:pointer;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-btn:disabled{background:rgba(58,60,255,0.5);cursor:default;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-btn svg{width:16px;height:16px;margin-left:-2px;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-mic-btn{width:36px;height:36px;min-width:36px;border-radius:50%;border:none;background:#f3f4f6;color:#6b7280;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background 0.15s,color 0.15s;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-mic-btn:hover{background:#e5e7eb;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-mic-btn.af-mic-rec{background:#ef4444;color:#fff;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-mic-btn:disabled{opacity:0.5;cursor:default;}' +
      '@keyframes af-mic-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
      '#audit-viewer-tooltip.audit-figma-root .af-mic-spin{animation:af-mic-spin 0.8s linear infinite;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-reply-field{flex:1;min-width:0;display:flex;align-items:stretch;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-reply-field .af-ta{flex:1;min-width:0;width:100%;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-reply-wave{display:none;flex:1;min-width:0;align-items:center;gap:3px;height:36px;padding:0 12px;box-sizing:border-box;border:1px solid rgba(229,231,235,0.8);border-radius:8px;background:rgba(243,244,246,0.6);}' +
      '#audit-viewer-tooltip.audit-figma-root .af-reply-wave-bar{display:inline-block;width:3px;height:4px;border-radius:2px;background:#788BE6;opacity:0.25;flex-shrink:0;align-self:center;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-header-actions{display:flex;align-items:center;gap:2px;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-trash-btn{color:#be123c;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-trash-btn:hover{background:rgba(190,18,60,0.08);color:#9f1239;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-edit-btn{color:#6b7280;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-edit-btn:hover{background:rgba(58,60,255,0.08);color:#3A3CFF;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-edit-ta{width:100%;box-sizing:border-box;border:1px solid rgba(58,60,255,0.3);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;background:#fff;min-height:50px;resize:none;line-height:1.5;transition:border-color 0.15s;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-edit-ta:focus{outline:none;border-color:rgba(58,60,255,0.6);}' +
      '#audit-viewer-tooltip.audit-figma-root .af-edit-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:6px;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-edit-cancel{background:none;border:1px solid #e5e7eb;border-radius:6px;padding:4px 10px;font-size:12px;font-family:inherit;cursor:pointer;color:#6b7280;transition:background 0.15s;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-edit-cancel:hover{background:#f3f4f6;color:#111827;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-edit-save{background:#3A3CFF;border:none;border-radius:6px;padding:4px 10px;font-size:12px;font-family:inherit;cursor:pointer;color:#fff;font-weight:500;transition:background 0.15s;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-edit-save:hover{background:#2d2fcc;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-edit-save:disabled{opacity:0.5;cursor:default;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-reply-msg:hover .af-reply-actions{opacity:1!important;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-confirm-bar{display:flex;align-items:center;gap:6px;padding:6px 16px;background:rgba(254,242,242,0.8);border-top:1px solid rgba(239,68,68,0.15);font-size:12px;color:#991b1b;flex-shrink:0;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-confirm-bar span{flex:1;min-width:0;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-confirm-yes{background:#dc2626;color:#fff;border:none;border-radius:5px;padding:3px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:background 0.15s;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-confirm-yes:hover{background:#b91c1c;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-confirm-no{background:none;border:1px solid #e5e7eb;border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer;color:#6b7280;font-family:inherit;transition:background 0.15s;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-confirm-no:hover{background:#f3f4f6;}' +
      '#audit-viewer-tooltip.audit-figma-root .af-err{font-size:11px;color:#dc2626;margin-top:6px;display:block;}';
    document.head.appendChild(st);
  }

  function ensureTooltip() {
    if (tooltipEl) return;
    injectFigmaThreadCss();
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'audit-viewer-tooltip';
    tooltipEl.className = 'audit-figma-root';
    tooltipEl.style.cssText = 'position:fixed;left:0;top:0;display:none;z-index:2147483647;pointer-events:auto;';
    
    tooltipEl.addEventListener('mouseenter', cancelHideTooltip);
    tooltipEl.addEventListener('mouseleave', function() { scheduleHideTooltip(); });

    // Allow clicking outside the tooltip to close it
    document.addEventListener('mousedown', function(e) {
      if (tooltipEl && tooltipEl.style.display !== 'none') {
        if (!tooltipEl.contains(e.target) && !e.target.closest('.audit-viewer-hotspot')) {
          cancelHideTooltip();
          tooltipEl.style.display = 'none';
          activeTooltipIndex = -1;
          clearPinHighlight();
        }
      }
    });

    document.documentElement.appendChild(tooltipEl);
  }

  function showTooltip(pin, i, vx, vy) {
    ensureTooltip();
    cancelHideTooltip();
    activeTooltipIndex = i;
    var replyMicAborted = false;
    var av = window.__AUDIT_VIEWER__ || {};
    var aid = av.auditId;
    var viewerAuthenticated = !!av.viewerAuthenticated;
    var viewerIsOwner = !!av.viewerIsOwner;
    var viewerUserId = av.viewerUserId || null;
    var cat = escHtml(pin.category || 'Feedback');
    var text = escHtml(pin.feedback || ('Comment ' + (i + 1)));
    var pinId = pin.id || '';
    var replies = pin.replies || [];
    var pinAuthorId = pin.authorId || null;
    var pinAuthorName = pin.authorName || null;
    var canEditPin = !!(pinId && viewerAuthenticated && (viewerIsOwner || (viewerUserId && pinAuthorId && viewerUserId === pinAuthorId)));
    var canDeletePin = canEditPin;
    /* Default: comment + Reply button only; composer shows after user clicks Reply (same for threads). */
    tooltipEl.className = 'audit-figma-root';

    var editBtnHtml = '';
    if (canEditPin) {
      editBtnHtml = '<button type="button" class="af-header-btn af-edit-btn" id="audit-pin-edit-btn" aria-label="Edit comment" title="Edit comment"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>';
    }
    var trashBtnHtml = '';
    if (canDeletePin) {
      trashBtnHtml = '<button type="button" class="af-header-btn af-trash-btn" id="audit-pin-delete-btn" aria-label="Delete comment" title="Delete comment"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>';
    }
    var headerHtml = '<div class="af-header"><span class="af-header-title">' + cat + '</span><div class="af-header-actions">' + editBtnHtml + trashBtnHtml +
      '<button type="button" class="af-header-btn" aria-label="Close" onclick="document.getElementById(\\'audit-viewer-tooltip\\').style.display=\\'none\\'"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>' +
      '</div>';
    var deleteErrHtml = canDeletePin ? '<span id="audit-pin-delete-err" class="af-err" style="padding:0 16px;"></span>' : '';

    var displayAuthorName = pinAuthorName || (viewerIsOwner ? (av.viewerName || 'You') : 'Author');
    var displayAuthorInitial = escHtml(authorInitials(displayAuthorName));
    var displayAuthorBg = replyAvatarBg(displayAuthorName);
    var displayAuthorColor = '#fff';
    var dateStr = pin.createdAt ? '<span style="color:rgba(107,114,128,0.4);line-height:1;">\u00b7</span><span style="font-size:10px;color:rgba(107,114,128,0.7);">' + escHtml(timeAgo(pin.createdAt)) + '</span>' : '';
    var rootRow = '<div class="af-msg"><div style="display:flex;align-items:center;gap:6px;"><div style="width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:' + displayAuthorColor + ';background:' + displayAuthorBg + ';text-transform:uppercase;">' + displayAuthorInitial + '</div><span class="af-name" style="display:flex;align-items:center;gap:6px;"><span>' + escHtml(displayAuthorName) + '</span>' + dateStr + '</span></div><div class="af-bubble" id="audit-pin-bubble">' + text + '</div></div>';

    var repliesHtml = '';
    for (var ri = 0; ri < replies.length; ri++) {
      var r = replies[ri];
      var ra = escHtml(r.authorName || 'User');
      var rb = escHtml(r.body || '');
      var ini = escHtml(authorInitials(r.authorName));
      var bg = replyAvatarBg(r.authorName);
      var rDateStr = r.createdAt ? '<span style="color:rgba(107,114,128,0.4);line-height:1;">\u00b7</span><span style="font-size:10px;color:rgba(107,114,128,0.7);">' + escHtml(timeAgo(r.createdAt)) + '</span>' : '';
      var canEditReply = !!(viewerAuthenticated && (viewerIsOwner || (viewerUserId && r.userId && viewerUserId === r.userId)));
      var replyActionsHtml = '';
      if (canEditReply) {
        replyActionsHtml = '<span class="af-reply-actions" style="display:inline-flex;align-items:center;gap:1px;opacity:0;transition:opacity 0.15s;margin-left:auto;flex-shrink:0;">' +
          '<button type="button" class="af-header-btn af-edit-btn af-reply-edit-btn" data-reply-id="' + escHtml(r.id) + '" data-reply-idx="' + ri + '" aria-label="Edit reply" title="Edit reply" style="padding:2px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>' +
          '<button type="button" class="af-header-btn af-trash-btn af-reply-delete-btn" data-reply-id="' + escHtml(r.id) + '" data-reply-idx="' + ri + '" aria-label="Delete reply" title="Delete reply" style="padding:2px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>' +
          '</span>';
      }
      repliesHtml += '<div class="af-msg af-reply-msg" style="padding-top:4px;" data-reply-id="' + escHtml(r.id) + '"><div style="display:flex;align-items:center;gap:6px;"><div style="width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#fff;background:' + bg + ';text-transform:uppercase;">' + ini + '</div><span class="af-name" style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;"><span>' + ra + '</span>' + rDateStr + '</span>' + replyActionsHtml + '</div><div class="af-bubble af-reply-bubble" id="af-reply-bubble-' + ri + '">' + rb + '</div></div>';
    }
    
    var replyBox = '';
    if (viewerAuthenticated) {
      var afWaveBars = '';
      for (var wbi = 0; wbi < 12; wbi++) {
        afWaveBars += '<span class="af-reply-wave-bar"></span>';
      }
      var composerName = av.viewerName || 'You';
      var composerInitial = escHtml(authorInitials(composerName));
      var composerBg = replyAvatarBg(composerName);
      replyBox = '<div class="af-composer">' +
        '<button class="af-initial-reply" onclick="document.getElementById(\\'audit-viewer-tooltip\\').classList.add(\\'is-replying\\')">Reply <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg></button>' +
        '<div class="af-composer-state2"><div style="display:flex;align-items:center;gap:6px;"><div style="width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#fff;background:' + composerBg + ';text-transform:uppercase;">' + composerInitial + '</div><span class="af-name">' + escHtml(composerName) + '</span></div><div class="af-composer-row"><div class="af-reply-field"><input type="text" id="audit-pin-reply-ta" class="af-ta" placeholder="Write a reply\u2026" autocomplete="off"/><div id="audit-pin-reply-wave" class="af-reply-wave" style="display:none" aria-hidden="true">' + afWaveBars + '</div></div><button type="button" class="af-mic-btn" id="audit-pin-reply-mic" title="Record voice reply" aria-label="Record voice reply"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="23"/></svg></button><button type="button" class="af-btn" id="audit-pin-reply-btn" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button></div></div>' +
        '<span id="audit-pin-reply-err" class="af-err"></span></div>';
    }
    tooltipEl.innerHTML = headerHtml + deleteErrHtml + '<div class="af-messages">' + rootRow + repliesHtml + '</div>' + replyBox;
    // Scroll messages to bottom so latest reply is always visible
    var msgsEl = tooltipEl.querySelector('.af-messages');
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;

    activeReplyMicCleanup = null;
    var replyBtn = document.getElementById('audit-pin-reply-btn');
    var ta = document.getElementById('audit-pin-reply-ta');
    var micBtn = document.getElementById('audit-pin-reply-mic');
    var replyRecorder = null, replyChunks = [], replyStream = null, replyMime = '';
    var replyMicMode = 'idle';
    var replyAudioCtx = null;
    var replyAnalyser = null;
    var replyWaveAnimId = null;

    function stopReplyWaveform() {
      if (replyWaveAnimId) {
        cancelAnimationFrame(replyWaveAnimId);
        replyWaveAnimId = null;
      }
      if (replyAudioCtx) {
        try { replyAudioCtx.close(); } catch (eW0) {}
        replyAudioCtx = null;
      }
      replyAnalyser = null;
      var waveRoot = document.getElementById('audit-pin-reply-wave');
      if (waveRoot) {
        var bars = waveRoot.querySelectorAll('.af-reply-wave-bar');
        for (var bi = 0; bi < bars.length; bi++) {
          bars[bi].style.height = '4px';
          bars[bi].style.opacity = '0.25';
        }
      }
    }

    function startReplyWaveform(stream) {
      stopReplyWaveform();
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        replyAudioCtx = new AC();
        replyAnalyser = replyAudioCtx.createAnalyser();
        replyAnalyser.fftSize = 64;
        replyAnalyser.smoothingTimeConstant = 0.75;
        replyAudioCtx.createMediaStreamSource(stream).connect(replyAnalyser);
        replyAudioCtx.resume().catch(function() {});
        var dataArray = new Uint8Array(replyAnalyser.frequencyBinCount);
        var NUM_BARS = 12;
        var waveRoot = document.getElementById('audit-pin-reply-wave');
        function draw() {
          if (!replyAnalyser) return;
          replyAnalyser.getByteFrequencyData(dataArray);
          var bars = waveRoot ? waveRoot.querySelectorAll('.af-reply-wave-bar') : [];
          for (var bj = 0; bj < bars.length; bj++) {
            var bar = bars[bj];
            var bin = Math.floor((bj / NUM_BARS) * dataArray.length * 0.6);
            var v = dataArray[bin] / 255;
            bar.style.height = (4 + v * 18) + 'px';
            bar.style.opacity = v < 0.05 ? '0.2' : String(0.4 + v * 0.6);
          }
          replyWaveAnimId = requestAnimationFrame(draw);
        }
        draw();
      } catch (eW1) {}
    }

    function syncReplySendState() {
      if (!replyBtn || !ta) return;
      if (replyMicMode === 'idle') replyBtn.disabled = !ta.value.trim();
    }

    function setReplyMicMode(m) {
      replyMicMode = m;
      if (!micBtn || !ta || !replyBtn) return;
      var waveEl = document.getElementById('audit-pin-reply-wave');
      if (waveEl) {
        if (m === 'recording') {
          ta.style.display = 'none';
          waveEl.style.display = 'flex';
          waveEl.setAttribute('aria-hidden', 'false');
        } else {
          ta.style.display = '';
          waveEl.style.display = 'none';
          waveEl.setAttribute('aria-hidden', 'true');
        }
      }
      micBtn.disabled = (m === 'transcribing');
      ta.disabled = (m === 'transcribing' || m === 'recording');
      if (m === 'transcribing') ta.placeholder = 'Transcribing…';
      else if (m === 'recording') ta.placeholder = 'Recording…';
      else ta.placeholder = 'Write a reply…';
      micBtn.className = 'af-mic-btn' + (m === 'recording' ? ' af-mic-rec' : '');
      if (m === 'transcribing') {
        micBtn.innerHTML = '<svg class="af-mic-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
      } else if (m === 'recording') {
        micBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
      } else {
        micBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="23"/></svg>';
      }
      if (m === 'idle') syncReplySendState();
      else replyBtn.disabled = true;
    }

    activeReplyMicCleanup = function() {
      replyMicAborted = true;
      stopReplyWaveform();
      try {
        if (replyRecorder && replyRecorder.state !== 'inactive') replyRecorder.stop();
      } catch (e0) {}
      try {
        if (replyStream) replyStream.getTracks().forEach(function(t) { t.stop(); });
      } catch (e1) {}
      replyRecorder = null;
      replyStream = null;
      replyChunks = [];
      replyMicMode = 'idle';
      replyMicAborted = false;
    };

    if (ta && replyBtn && micBtn) {
      ta.oninput = function() { syncReplySendState(); };
      ta.onkeydown = function(e) {
        if (e.key === 'Enter' && replyMicMode === 'idle') { e.preventDefault(); replyBtn.click(); }
      };
      micBtn.onclick = function() {
        var errEl = document.getElementById('audit-pin-reply-err');
        if (errEl) errEl.textContent = '';
        if (replyMicMode === 'transcribing') return;
        if (replyMicMode === 'recording') {
          if (replyRecorder && replyRecorder.state !== 'inactive') replyRecorder.stop();
          return;
        }
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function(s) {
          replyStream = s;
          replyChunks = [];
          var mimeTypes = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg','audio/mp4'];
          replyMime = '';
          for (var ki = 0; ki < mimeTypes.length; ki++) {
            try {
              if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeTypes[ki])) {
                replyMime = mimeTypes[ki];
                break;
              }
            } catch (e2) {}
          }
          replyRecorder = new MediaRecorder(s, replyMime ? { mimeType: replyMime } : undefined);
          replyRecorder.ondataavailable = function(ev) { if (ev.data && ev.data.size > 0) replyChunks.push(ev.data); };
          replyRecorder.onstop = function() {
            stopReplyWaveform();
            var errEl2 = document.getElementById('audit-pin-reply-err');
            try { if (replyStream) replyStream.getTracks().forEach(function(t) { t.stop(); }); } catch (e3) {}
            replyStream = null;
            if (replyMicAborted) {
              replyChunks = [];
              setReplyMicMode('idle');
              syncReplySendState();
              replyRecorder = null;
              return;
            }
            var blob = new Blob(replyChunks, { type: replyMime || 'audio/webm' });
            replyChunks = [];
            if (!blob.size) {
              setReplyMicMode('idle');
              syncReplySendState();
              replyRecorder = null;
              return;
            }
            setReplyMicMode('transcribing');
            var ext = replyMime.indexOf('ogg') >= 0 ? 'ogg' : replyMime.indexOf('mp4') >= 0 ? 'm4a' : 'webm';
            var fd = new FormData();
            fd.append('audio', blob, 'recording.' + ext);
            fetch('/audit/' + aid + '/transcribe-audio', { method: 'POST', credentials: 'include', body: fd })
              .then(function(res) { return res.json().then(function(data) { return { res: res, data: data }; }); })
              .then(function(x) {
                setReplyMicMode('idle');
                if (!x.res.ok) throw new Error(x.data.error || 'Transcription failed');
                if (x.data.transcript && ta) ta.value = x.data.transcript;
                if (errEl2 && x.data.error && !x.data.transcript) errEl2.textContent = x.data.error;
                syncReplySendState();
              })
              .catch(function(e4) {
                setReplyMicMode('idle');
                if (errEl2) errEl2.textContent = e4.message || 'Transcription failed';
                syncReplySendState();
              });
            replyRecorder = null;
          };
          replyRecorder.start(250);
          setReplyMicMode('recording');
          startReplyWaveform(s);
        }).catch(function() {
          var errEl3 = document.getElementById('audit-pin-reply-err');
          if (errEl3) errEl3.textContent = 'Could not access microphone';
        });
      };
    } else if (ta && replyBtn) {
      ta.oninput = function() { replyBtn.disabled = !ta.value.trim(); };
      ta.onkeydown = function(e) {
        if (e.key === 'Enter') { e.preventDefault(); replyBtn.click(); }
      };
    }

    if (replyBtn) {
      replyBtn.onclick = function() {
        var errEl = document.getElementById('audit-pin-reply-err');
        if (errEl) errEl.textContent = '';
        var body = (ta && ta.value || '').trim();
        if (!body) { if (errEl) errEl.textContent = 'Enter a message'; return; }
        var p = av.pins && av.pins[activeTooltipIndex];
        var pid = p && p.id;
        if (!pid) { if (errEl) errEl.textContent = 'Cannot reply to this pin yet'; return; }
        replyBtn.disabled = true;
        fetch('/audit/' + aid + '/pin/reply', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinId: pid, body: body }) })
          .then(function(res) { return res.json().then(function(data) { return { res: res, data: data }; }); })
          .then(function(x) {
            replyBtn.disabled = false;
            if (!x.res.ok) throw new Error(x.data.error || 'Failed');
            if (ta) ta.value = '';
            // Block scheduled-hide between now and the upcoming UPDATE_PINS / renderHotspots
            replyJustPosted = true;
            cancelHideTooltip();
            if (replyJustPostedSafetyTimer) clearTimeout(replyJustPostedSafetyTimer);
            replyJustPostedSafetyTimer = setTimeout(function() { replyJustPosted = false; replyJustPostedSafetyTimer = null; }, 8000);
            if (window.parent !== window) window.parent.postMessage({ type: 'PINS_MUTATED' }, '*');
          })
          .catch(function(e) {
            replyBtn.disabled = false;
            if (errEl) errEl.textContent = e.message || 'Failed';
          });
      };
    }
    var delBtn = document.getElementById('audit-pin-delete-btn');
    if (delBtn) {
      delBtn.onclick = function() {
        cancelHideTooltip();
        /* Remove any existing confirm bar */
        var oldBar = tooltipEl.querySelector('.af-confirm-bar');
        if (oldBar) { oldBar.remove(); return; }
        var errEl = document.getElementById('audit-pin-delete-err');
        if (errEl) errEl.textContent = '';
        var p = av.pins && av.pins[activeTooltipIndex];
        var pid = p && p.id;
        if (!pid) { if (errEl) errEl.textContent = 'Missing pin id'; return; }
        /* Show inline confirm bar */
        var bar = document.createElement('div');
        bar.className = 'af-confirm-bar';
        bar.innerHTML = '<span>Delete this comment?</span><button type="button" class="af-confirm-no">No</button><button type="button" class="af-confirm-yes">Yes</button>';
        tooltipEl.appendChild(bar);
        bar.querySelector('.af-confirm-no').onclick = function() { bar.remove(); };
        bar.querySelector('.af-confirm-yes').onclick = function() {
          bar.querySelector('.af-confirm-yes').disabled = true;
          bar.querySelector('.af-confirm-yes').textContent = 'Deleting\u2026';
          fetch('/audit/' + aid + '/pin?pinId=' + encodeURIComponent(pid), { method: 'DELETE', credentials: 'include' })
            .then(function(res) { return res.json().then(function(data) { return { res: res, data: data }; }); })
            .then(function(x) {
              if (!x.res.ok) throw new Error(x.data.error || 'Failed');
              if (window.parent !== window) window.parent.postMessage({ type: 'PINS_MUTATED' }, '*');
              hideTooltip();
            })
            .catch(function(e) {
              bar.remove();
              if (errEl) errEl.textContent = e.message || 'Failed';
            });
        };
      };
    }

    /* ── Edit pin handler ─────────────────────────────── */
    var editBtn = document.getElementById('audit-pin-edit-btn');
    if (editBtn) {
      editBtn.onclick = function() {
        cancelHideTooltip();
        var bubble = document.getElementById('audit-pin-bubble');
        if (!bubble) return;
        var currentText = pin.feedback || '';
        bubble.innerHTML = '<textarea id="audit-pin-edit-ta" class="af-edit-ta">' + escHtml(currentText) + '</textarea>' +
          '<div class="af-edit-actions">' +
          '<button type="button" class="af-edit-cancel" id="audit-pin-edit-cancel">Cancel</button>' +
          '<button type="button" class="af-edit-save" id="audit-pin-edit-save">Save</button>' +
          '</div>' +
          '<span id="audit-pin-edit-err" class="af-err"></span>';
        var editTa = document.getElementById('audit-pin-edit-ta');
        if (editTa) { editTa.focus(); editTa.selectionStart = editTa.value.length; }
        var cancelBtn = document.getElementById('audit-pin-edit-cancel');
        var saveBtn = document.getElementById('audit-pin-edit-save');
        if (cancelBtn) {
          cancelBtn.onclick = function() {
            bubble.innerHTML = escHtml(currentText);
          };
        }
        if (saveBtn && editTa) {
          editTa.onkeydown = function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveBtn.click(); }
            if (e.key === 'Escape') { cancelBtn && cancelBtn.click(); }
          };
          saveBtn.onclick = function() {
            var newText = editTa.value.trim();
            if (!newText) return;
            var errEl = document.getElementById('audit-pin-edit-err');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
            fetch('/audit/' + aid + '/edit-pin', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinId: pinId, feedback: newText }) })
              .then(function(res) { return res.json().then(function(data) { return { res: res, data: data }; }); })
              .then(function(x) {
                if (!x.res.ok) throw new Error(x.data.error || 'Failed');
                pin.feedback = newText;
                bubble.innerHTML = escHtml(newText);
                if (window.parent !== window) window.parent.postMessage({ type: 'PINS_MUTATED' }, '*');
              })
              .catch(function(e) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
                if (errEl) errEl.textContent = e.message || 'Failed to save';
              });
          };
        }
      };
    }

    /* ── Reply edit + delete handlers ─────────────────── */
    var replyEditBtns = tooltipEl.querySelectorAll('.af-reply-edit-btn');
    var replyDeleteBtns = tooltipEl.querySelectorAll('.af-reply-delete-btn');

    for (var ei = 0; ei < replyEditBtns.length; ei++) {
      (function(btn) {
        btn.onclick = function(e) {
          e.stopPropagation();
          cancelHideTooltip();
          var rId = btn.getAttribute('data-reply-id');
          var rIdx = parseInt(btn.getAttribute('data-reply-idx'), 10);
          var bubble = document.getElementById('af-reply-bubble-' + rIdx);
          if (!bubble || !rId) return;
          var reply = replies[rIdx];
          if (!reply) return;
          var origText = reply.body || '';
          bubble.innerHTML = '<textarea id="af-reply-edit-ta-' + rIdx + '" class="af-edit-ta" style="min-height:36px;">' + escHtml(origText) + '</textarea>' +
            '<div class="af-edit-actions">' +
            '<button type="button" class="af-edit-cancel" id="af-reply-edit-cancel-' + rIdx + '">Cancel</button>' +
            '<button type="button" class="af-edit-save" id="af-reply-edit-save-' + rIdx + '">Save</button>' +
            '</div>' +
            '<span id="af-reply-edit-err-' + rIdx + '" class="af-err"></span>';
          var rTa = document.getElementById('af-reply-edit-ta-' + rIdx);
          if (rTa) { rTa.focus(); rTa.selectionStart = rTa.value.length; }
          var rCancel = document.getElementById('af-reply-edit-cancel-' + rIdx);
          var rSave = document.getElementById('af-reply-edit-save-' + rIdx);
          if (rCancel) {
            rCancel.onclick = function() { bubble.innerHTML = escHtml(origText); };
          }
          if (rSave && rTa) {
            rTa.onkeydown = function(ke) {
              if (ke.key === 'Enter' && !ke.shiftKey) { ke.preventDefault(); rSave.click(); }
              if (ke.key === 'Escape') { rCancel && rCancel.click(); }
            };
            rSave.onclick = function() {
              var newBody = rTa.value.trim();
              if (!newBody) return;
              var errEl = document.getElementById('af-reply-edit-err-' + rIdx);
              rSave.disabled = true;
              rSave.textContent = 'Saving\u2026';
              fetch('/audit/' + aid + '/pin/reply/edit', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinId: pinId, replyId: rId, body: newBody }) })
                .then(function(res) { return res.json().then(function(data) { return { res: res, data: data }; }); })
                .then(function(x) {
                  if (!x.res.ok) throw new Error(x.data.error || 'Failed');
                  reply.body = newBody;
                  bubble.innerHTML = escHtml(newBody);
                  if (window.parent !== window) window.parent.postMessage({ type: 'PINS_MUTATED' }, '*');
                })
                .catch(function(er) {
                  rSave.disabled = false;
                  rSave.textContent = 'Save';
                  if (errEl) errEl.textContent = er.message || 'Failed';
                });
            };
          }
        };
      })(replyEditBtns[ei]);
    }

    for (var di = 0; di < replyDeleteBtns.length; di++) {
      (function(btn) {
        btn.onclick = function(e) {
          e.stopPropagation();
          cancelHideTooltip();
          var rId = btn.getAttribute('data-reply-id');
          if (!rId) return;
          var rIdx = parseInt(btn.getAttribute('data-reply-idx'), 10);
          var msgEl = btn.closest('.af-reply-msg');
          /* Toggle: if confirm bar already visible, remove it */
          if (msgEl) {
            var existing = msgEl.querySelector('.af-confirm-bar');
            if (existing) { existing.remove(); return; }
          }
          /* Show inline confirm bar under the reply */
          var bar = document.createElement('div');
          bar.className = 'af-confirm-bar';
          bar.style.padding = '4px 12px';
          bar.style.borderRadius = '0 0 8px 8px';
          bar.style.marginTop = '4px';
          bar.innerHTML = '<span>Delete?</span><button type="button" class="af-confirm-no">No</button><button type="button" class="af-confirm-yes">Yes</button>';
          if (msgEl) { msgEl.appendChild(bar); } else { tooltipEl.appendChild(bar); }
          bar.querySelector('.af-confirm-no').onclick = function(ev) { ev.stopPropagation(); bar.remove(); };
          bar.querySelector('.af-confirm-yes').onclick = function(ev) {
            ev.stopPropagation();
            bar.querySelector('.af-confirm-yes').disabled = true;
            bar.querySelector('.af-confirm-yes').textContent = 'Deleting\u2026';
            fetch('/audit/' + aid + '/pin/reply/edit?pinId=' + encodeURIComponent(pinId) + '&replyId=' + encodeURIComponent(rId), { method: 'DELETE', credentials: 'include' })
              .then(function(res) { return res.json().then(function(data) { return { res: res, data: data }; }); })
              .then(function(x) {
                if (!x.res.ok) throw new Error(x.data.error || 'Failed');
                if (window.parent !== window) window.parent.postMessage({ type: 'PINS_MUTATED' }, '*');
              })
              .catch(function(er) {
                bar.remove();
                var errSpan = document.getElementById('audit-pin-delete-err');
                if (errSpan) errSpan.textContent = er.message || 'Failed';
              });
          };
        };
      })(replyDeleteBtns[di]);
    }

    // Smart positioning: open above if enough room, otherwise open below
    var viewportH = window.innerHeight;
    var margin = 16; // px from viewport edge
    var spaceAbove = vy - 12 - margin;
    var spaceBelow = viewportH - vy - 8 - margin;
    var minH = 180;
    var maxAllowed = Math.floor(viewportH * 0.72);
    var openAbove = spaceAbove >= minH || spaceAbove >= spaceBelow;
    var availableH = openAbove ? spaceAbove : spaceBelow;
    var tooltipMaxH = Math.max(minH, Math.min(maxAllowed, availableH));

    tooltipEl.style.maxHeight = tooltipMaxH + 'px';
    tooltipEl.style.display = 'block';
    tooltipEl.style.left = vx + 'px';
    if (openAbove) {
      tooltipEl.style.top = (vy - 12) + 'px';
      tooltipEl.style.transform = 'translate(-50%, -100%)';
    } else {
      tooltipEl.style.top = (vy + 8) + 'px';
      tooltipEl.style.transform = 'translate(-50%, 0)';
    }
    tooltipEl.style.animation = 'audit-tooltip-in 0.15s ease-out';
  }

  function hideTooltip() {
    cancelHideTooltip();
    if (replyJustPosted) return;
    var ta = document.getElementById('audit-pin-reply-ta');
    if (ta && (document.activeElement === ta || (ta.value && ta.value.trim() !== ''))) return;
    if (typeof activeReplyMicCleanup === 'function') {
      try { activeReplyMicCleanup(); } catch (e) {}
      activeReplyMicCleanup = null;
    }
    if (tooltipEl) tooltipEl.style.display = 'none';
    activeTooltipIndex = -1;
    clearPinHighlight();
  }

  /* â”€â”€ On-demand hotspot repositioning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   * Reposition only when there is activity (scroll/resize/update), then run
   * a short rAF burst to stay smooth during momentum/inertial scrolling.
   * This avoids a permanent 60fps loop when the page is idle. */
  var rafId = null;
  var cachedScrollContainer = undefined; // undefined = not yet computed
  var updateActiveUntil = 0;

  function schedulePositionUpdate(runForMs) {
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var ms = typeof runForMs === 'number' ? runForMs : 0;
    if (ms > 0) updateActiveUntil = Math.max(updateActiveUntil, now + ms);
    if (rafId) return;
    rafId = requestAnimationFrame(updateAllPositions);
  }

  function updateAllPositions() {
    rafId = null;
    var pins = window.__AUDIT_VIEWER__ && window.__AUDIT_VIEWER__.pins;
    if (!pins) return;
    if (cachedScrollContainer === undefined) cachedScrollContainer = findScrollContainer();
    var containerRect = cachedScrollContainer ? cachedScrollContainer.getBoundingClientRect() : null;
    for (var i = 0; i < hotspotElements.length; i++) {
      var el = hotspotElements[i];
      if (!el) continue;
      var pos = computePinViewportPosition(pins[i], cachedScrollContainer, containerRect);
      el.style.left = pos.vx + 'px';
      el.style.top = pos.vy + 'px';
      // Hide pins that are off-screen
      if (pos.vx < -50 || pos.vx > window.innerWidth + 50 || pos.vy < -50 || pos.vy > window.innerHeight + 50) {
        el.style.opacity = '0';
      } else {
        el.style.opacity = '1';
      }
    }
    // Update tooltip position if shown
    if (activeTooltipIndex >= 0 && tooltipEl && tooltipEl.style.display !== 'none' && pins[activeTooltipIndex]) {
      var tpos = computePinViewportPosition(pins[activeTooltipIndex], cachedScrollContainer, containerRect);
      var tvh = window.innerHeight, tMargin = 16, tMinH = 180;
      var tSpaceAbove = tpos.vy - 12 - tMargin;
      var tSpaceBelow = tvh - tpos.vy - 8 - tMargin;
      var tOpenAbove = tSpaceAbove >= tMinH || tSpaceAbove >= tSpaceBelow;
      var tAvail = tOpenAbove ? tSpaceAbove : tSpaceBelow;
      var tMaxH = Math.max(tMinH, Math.min(Math.floor(tvh * 0.72), tAvail));
      tooltipEl.style.maxHeight = tMaxH + 'px';
      tooltipEl.style.left = tpos.vx + 'px';
      if (tOpenAbove) {
        tooltipEl.style.top = (tpos.vy - 12) + 'px';
        tooltipEl.style.transform = 'translate(-50%, -100%)';
      } else {
        tooltipEl.style.top = (tpos.vy + 8) + 'px';
        tooltipEl.style.transform = 'translate(-50%, 0)';
      }
    }
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now < updateActiveUntil) {
      rafId = requestAnimationFrame(updateAllPositions);
    }
  }

  /* â”€â”€ Render hotspots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function cleanupHotspots() {
    cancelHideTooltip();
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    updateActiveUntil = 0;
    hotspotElements.forEach(function(el) { if (el && el.parentNode) el.parentNode.removeChild(el); });
    hotspotElements = [];
    if (tooltipEl && tooltipEl.parentNode) tooltipEl.parentNode.removeChild(tooltipEl);
    tooltipEl = null;
    activeTooltipIndex = -1;
  }

  function renderHotspots() {
    // UPDATE_PINS arrived — safe to allow hide again
    replyJustPosted = false;
    if (replyJustPostedSafetyTimer) { clearTimeout(replyJustPostedSafetyTimer); replyJustPostedSafetyTimer = null; }

    var pinsBefore = window.__AUDIT_VIEWER__ && window.__AUDIT_VIEWER__.pins;
    var reopenThread =
      !!(tooltipEl && tooltipEl.style.display !== 'none' && activeTooltipIndex >= 0 && pinsBefore && pinsBefore[activeTooltipIndex]);
    var reopenPinId = reopenThread && pinsBefore[activeTooltipIndex].id ? pinsBefore[activeTooltipIndex].id : null;
    var reopenPinIndex = reopenThread ? activeTooltipIndex : -1;

    // ALWAYS clean up old hotspots first (even if new pins are empty)
    cleanupHotspots();
    var pins = window.__AUDIT_VIEWER__ && window.__AUDIT_VIEWER__.pins;
    if (!pins || !pins.length) return;


    // Inject styles
    var styleEl = document.getElementById('audit-viewer-hotspot-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'audit-viewer-hotspot-styles';
      styleEl.textContent = '@keyframes audit-hotspot-pulse{0%,100%{box-shadow:0 2px 8px rgba(0,0,0,0.18),0 0 0 2px #fff}50%{box-shadow:0 4px 16px rgba(0,0,0,0.22),0 0 0 3px rgba(255,255,255,0.9)}}@keyframes audit-tooltip-in{from{opacity:0;transform:translate(-50%,-100%) scale(0.95) translateY(4px)}to{opacity:1;transform:translate(-50%,-100%) scale(1) translateY(0)}}.audit-viewer-hotspot{display:flex !important;align-items:center;justify-content:center;width:26px !important;height:26px !important;min-width:26px !important;min-height:26px !important;animation:audit-hotspot-pulse 2.5s ease-in-out infinite !important;opacity:1 !important;visibility:visible !important;transition:transform 0.15s ease-out,box-shadow 0.15s ease-out !important;font-size:11px;font-weight:700;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1;user-select:none;z-index:2147483646 !important}.audit-viewer-hotspot:hover{transform:translate(-50%,-100%) scale(1.3) !important;box-shadow:0 4px 20px rgba(0,0,0,0.3),0 0 0 3px #fff !important;z-index:2147483646 !important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none !important;}html,body{-ms-overflow-style:none !important;scrollbar-width:none !important;}';
      document.head.appendChild(styleEl);
    }
    ensureTooltip();

    // Recompute scroll container
    cachedScrollContainer = findScrollContainer();

    pins.forEach(function(pin, i) {
      var pos = computePinViewportPosition(pin, cachedScrollContainer);
      var el = document.createElement('div');
      el.className = 'audit-viewer-hotspot';
      el.setAttribute('data-pin-index', String(i));
      // position:fixed so it respects viewport coordinates
      el.style.cssText = 'display:flex !important;align-items:center;justify-content:center;position:fixed;left:' + pos.vx + 'px;top:' + pos.vy + 'px;transform:translate(-50%,-100%);width:26px !important;height:26px !important;border-radius:50%;background:' + (categoryColors[pin.category] || '#3A3CFF') + ' !important;border:2px solid #fff;cursor:pointer;z-index:2147483646;';
      el.textContent = String(i + 1);
      el.setAttribute('data-feedback', pin.feedback || '');
      el.setAttribute('data-category', pin.category || '');
      el.addEventListener('mouseenter', function() {
        cancelHideTooltip();
        var curPos = computePinViewportPosition(pin, cachedScrollContainer);
        showTooltip(pin, i, curPos.vx, curPos.vy);
        highlightPinTarget(pin);
        schedulePositionUpdate(260);
      });
      el.addEventListener('mouseleave', function() {
        scheduleHideTooltip();
      });
      hotspotElements.push(el);
      document.documentElement.appendChild(el);
    });
    // Initial settle/update burst after rendering pins
    schedulePositionUpdate(240);

    // After pin updates (e.g. reply posted → parent refresh → UPDATE_PINS), reopen the same thread so the modal does not disappear
    if (reopenThread && pins && pins.length) {
      var ni = -1;
      if (reopenPinId) {
        for (var rq = 0; rq < pins.length; rq++) {
          if (pins[rq].id === reopenPinId) {
            ni = rq;
            break;
          }
        }
      }
      if (ni < 0 && reopenPinIndex >= 0 && reopenPinIndex < pins.length) ni = reopenPinIndex;
      if (ni >= 0) {
        var rpos = computePinViewportPosition(pins[ni], cachedScrollContainer);
        showTooltip(pins[ni], ni, rpos.vx, rpos.vy);
        schedulePositionUpdate(300);
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderHotspots);
  else renderHotspots();

  /* ── Clear hotspots immediately on SPA navigation ────────────────────────
   * When a SPA navigates (pushState / replaceState / popstate) the DOM doesn't
   * reload, so the old page's hotspot elements stay visible until UPDATE_PINS
   * arrives from the parent.  We wrap the history methods here (after the
   * history-shim has already wrapped them) so that cleanupHotspots() fires
   * synchronously the moment the pathname changes.  We compare pathnames so
   * that replaceState calls that only update a query-param or hash (common
   * during initial load) don't trigger a spurious cleanup.
   * The parent's UPDATE_PINS message will re-render the correct pins shortly
   * after it receives the AUDIT_VIEWER_READY notification from the shim.    */
  (function() {
    var _hp = history.pushState;
    var _hr = history.replaceState;
    function cleanIfPathChanged(prevPath) {
      var nowPath = window.location.pathname;
      if (nowPath !== prevPath) {
        cleanupHotspots();
        if (window.__AUDIT_VIEWER__) window.__AUDIT_VIEWER__.pins = [];
      }
    }
    history.pushState = function() {
      var prev = window.location.pathname;
      var result = _hp.apply(this, arguments);
      cleanIfPathChanged(prev);
      return result;
    };
    history.replaceState = function() {
      var prev = window.location.pathname;
      var result = _hr.apply(this, arguments);
      cleanIfPathChanged(prev);
      return result;
    };
    window.addEventListener('popstate', function() {
      /* For popstate the URL has already changed by the time the event fires */
      cleanupHotspots();
      if (window.__AUDIT_VIEWER__) window.__AUDIT_VIEWER__.pins = [];
    });
  })();

  function getSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return null;
    if (el.id === 'audit-comment-hover-overlay' || el.id === 'audit-viewer-hotspots' || el.id === 'audit-viewer-tooltip' || el.classList.contains('audit-viewer-hotspot')) return null;
    if (el.id && /^[a-zA-Z][\\\\w.-]*$/.test(el.id)) return '#' + el.id;
    var path = [], e = el;
    while (e && e !== document.body) {
      var tag = e.tagName.toLowerCase();
      var parent = e.parentElement;
      if (!parent) break;
      var idx = Array.from(parent.children).indexOf(e) + 1;
      path.unshift(tag + ':nth-child(' + idx + ')');
      e = parent;
    }
    return path.length ? path.join(' > ') : null;
  }

  function updateHotspotsFromPins(newPins) {
    if (!newPins || !Array.isArray(newPins)) {
      // Invalid data — clean up everything
      cleanupHotspots();
      return;
    }
    window.__AUDIT_VIEWER__.pins = newPins;
    renderHotspots();
  }

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'SET_COMMENT_MODE') {
      var newVal = e.data.value;
      // Don't let the parent turn off comment mode if the modifier key is
      // physically held in this frame (e.g. parent blur fired because the
      // iframe received focus while the user was already holding Ctrl).
      if (!newVal && ctrlHeld) return;
      if (commentMode !== newVal) {
        commentMode = newVal;
        document.body.style.cursor = commentMode ? 'crosshair' : '';
        if (document.documentElement) document.documentElement.style.cursor = commentMode ? 'crosshair' : '';
        if (commentMode) createHoverOverlay();
        else hideHoverOverlay();
      }
    }
    if (e.data && e.data.type === 'UPDATE_PINS') {
      updateHotspotsFromPins(e.data.pins);
    }
    if (e.data && e.data.type === 'HIGHLIGHT') {
      var s = e.data.selector, x = e.data.x, y = e.data.y;
      var persistent = !!e.data.persistent;
      clearPinHighlight();
      if (s) {
        try {
          var el = document.querySelector(s);
          if (el) {
            if (!e.data.noScroll) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.outline = '3px solid #0ea5e9'; el.style.outlineOffset = '2px';
            _highlightedEl = el;
            if (!persistent) _highlightTimer = setTimeout(function() { el.style.outline = ''; el.style.outlineOffset = ''; _highlightedEl = null; }, 3000);
          }
        } catch (err) {}
      } else if (typeof x === 'number' && typeof y === 'number') {
        var vh = window.innerHeight, vw = window.innerWidth;
        var px = (x / 100) * vw, py = (y / 100) * vh;
        if (!e.data.noScroll) window.scrollTo({ left: px - vw/2, top: py - vh/2, behavior: 'smooth' });
      }
    }
    if (e.data && e.data.type === 'CLEAR_HIGHLIGHT') {
      clearPinHighlight();
    }
    if (e.data && e.data.type === 'SHOW_TOOLTIP' && typeof e.data.pinIndex === 'number') {
      var idx = e.data.pinIndex;
      var pins = window.__AUDIT_VIEWER__ && window.__AUDIT_VIEWER__.pins;
      if (pins && pins[idx]) {
        var pin = pins[idx];
        var pos = computePinViewportPosition(pin, cachedScrollContainer);
        showTooltip(pin, idx, pos.vx, pos.vy);
        schedulePositionUpdate(300);
        // Scroll to pin's target element if it has a selector
        var target = resolveTargetElement(pin);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          schedulePositionUpdate(420);
        }
      }
    }
    if (e.data && e.data.type === 'SCROLL_TO' && typeof e.data.y === 'number') {
      // Try scrolling both the window and any inner scroll container
      var sc = cachedScrollContainer || findScrollContainer();
      if (sc) sc.scrollTo({ top: e.data.y, behavior: e.data.behavior || 'auto' });
      else window.scrollTo({ top: e.data.y, behavior: e.data.behavior || 'auto' });
      schedulePositionUpdate(450);
    }
  });

  function isEditableTarget(el) {
    if (!el || !el.closest) return false;
    return !!el.closest('#audit-viewer-tooltip');
  }

  document.addEventListener('click', function(e) {
    var originalTarget = e.target;
    if (isEditableTarget(originalTarget)) return;
    // Recover from occasional comment-mode desync after thread mutations
    // (e.g. delete): if modifier is currently held, treat this click as comment
    // capture even if local commentMode boolean has gone stale.
    var modHeldNow = isModifierHeld(e);
    if (!commentMode && modHeldNow) setCommentModeFromKey(true);
    if (!commentMode && !modHeldNow) return;
    e.preventDefault();
    e.stopPropagation();
    var target = lastHoveredEl || e.target;
    if (target && (target.id === 'audit-comment-hover-overlay' || target.id === 'audit-viewer-hotspots' || target.id === 'audit-viewer-tooltip' || target.classList.contains('audit-viewer-hotspot'))) {
      if (hoverOverlay) hoverOverlay.style.display = 'none';
      target = document.elementFromPoint(e.clientX, e.clientY);
      if (hoverOverlay) hoverOverlay.style.display = '';
    }
    var vw = window.innerWidth, vh = window.innerHeight;
    var x = (e.clientX / vw) * 100;
    var y = (e.clientY / vh) * 100;
    var docX = typeof e.pageX === 'number' ? e.pageX : (window.scrollX + e.clientX);
    var docY = typeof e.pageY === 'number' ? e.pageY : (window.scrollY + e.clientY);
    var selector = getSelector(target);
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'AUDIT_VIEWER_CLICK',
        selector: selector,
        x: x, y: y,
        docX: docX, docY: docY,
        pageUrl: window.location.href,
        viewportWidth: vw,
        viewportHeight: vh,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      }, '*');
    }
    hideHoverOverlay();
  }, true);

  if (window.parent !== window) {
    var pageUrl = (window.__AUDIT_VIEWER__ && window.__AUDIT_VIEWER__.pageUrl) || window.location.href;
    if (window.__AUDIT_VIEWER__) window.__AUDIT_VIEWER__.pageUrl = pageUrl;
    window.parent.postMessage({ type: 'AUDIT_VIEWER_READY', pageUrl: pageUrl }, '*');
    
    function findScrollInfo() {
      var sc = cachedScrollContainer || findScrollContainer();
      if (sc) {
        return {
          scrollTop: sc.scrollTop,
          scrollHeight: sc.scrollHeight,
          clientHeight: sc.clientHeight,
        };
      }
      return {
        scrollTop: window.scrollY || document.documentElement.scrollTop,
        scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight || 0),
        clientHeight: window.innerHeight || document.documentElement.clientHeight,
      };
    }
    
    function sendScrollData() {
      var info = findScrollInfo();
      window.parent.postMessage({
        type: 'AUDIT_SCROLL',
        scrollTop: info.scrollTop,
        scrollHeight: info.scrollHeight,
        clientHeight: info.clientHeight,
      }, '*');
      schedulePositionUpdate(220);
    }
    window.addEventListener('scroll', sendScrollData, { passive: true });
    window.addEventListener('resize', function() {
      cachedScrollContainer = undefined; // layout may have changed
      sendScrollData();
      schedulePositionUpdate(320);
    }, { passive: true });
    // Also listen for scroll on inner containers
    setTimeout(function() {
      var sc = findScrollContainer();
      if (sc) {
        sc.addEventListener('scroll', sendScrollData, { passive: true });
        cachedScrollContainer = sc;
      }
      sendScrollData();
    }, 500);
  }
})();
</script>`;
  return script;
}

