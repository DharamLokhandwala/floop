import { getAuditById } from "@/lib/audits";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_PROTOCOLS = ["https:", "http:"];

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
  const audit = await getAuditById(id);
  if (!audit) {
    return new NextResponse("Audit not found", { status: 404 });
  }

  const path = request.nextUrl.searchParams.get("path") ?? "";
  const baseUrl = audit.url.replace(/\/$/, "");
  let targetUrl: URL;
  try {
    targetUrl = new URL(path.startsWith("http") ? path : baseUrl + (path.startsWith("/") ? path : "/" + path));
  } catch {
    return new NextResponse("Invalid path", { status: 400 });
  }

  const auditOrigin = new URL(audit.url).origin;
  if (targetUrl.origin !== auditOrigin) {
    return new NextResponse("Forbidden: path must be same origin as audit URL", { status: 403 });
  }
  if (!ALLOWED_PROTOCOLS.includes(targetUrl.protocol)) {
    return new NextResponse("Invalid protocol", { status: 400 });
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
        return new NextResponse(
          `Site returned ${result.status}. Some sites block automated requests.`,
          { status: result.status }
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
    return new NextResponse(message, { status: 502 });
  }

  const appOrigin = request.nextUrl.origin;
  const proxyViewBase = `${appOrigin}/audit/${id}/view`;
  const assetBase = `${appOrigin}/audit/${id}/asset`;

  // --- Pins for this page --------------------------------------------------
  const targetHref = targetUrl.href.replace(/\/$/, "") || targetUrl.origin + "/";
  const isRootPath = !path || path === "/";
  const pinsForPage = [...audit.pins, ...audit.userPins].filter(
    (pin: { pageUrl?: string }) => {
      if (pin.pageUrl) {
        const pinUrl =
          (pin.pageUrl as string).replace(/\/$/, "") || targetUrl.origin + "/";
        return pinUrl === targetHref;
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

  // 5. Inject viewer script
  const viewerScript = getViewerScript(id, targetUrl.href, pinsForPage);
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
 */
function stripCorsAttributes(html: string): string {
  return html
    .replace(/\s+crossorigin(?:\s*=\s*["'][^"']*["'])?/gi, "")
    .replace(/\s+integrity\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s+nonce\s*=\s*["'][^"']*["']/gi, "");
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
      if (pathParam) {
        pageUrl = origin + (pathParam.charAt(0) === '/' ? pathParam : '/' + pathParam);
      } else if (parsed.origin === origin) {
        pageUrl = parsed.href;
      } else {
        var p = parsed.pathname + (parsed.search || '');
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
}

function getViewerScript(auditId: string, pageUrl: string, pins: PinForScript[]): string {
  const pinsJson = JSON.stringify(pins);
  const script = `
<script>
window.__AUDIT_VIEWER__ = { auditId: ${JSON.stringify(auditId)}, pageUrl: ${JSON.stringify(pageUrl)}, pins: ${pinsJson} };
(function() {
  var commentMode = false;
  var hotspotElements = [];
  var categoryColors = { SEO: '#3b82f6', 'Visual Design': '#a855f7', CRO: '#22c55e', Feedback: '#3A3CFF' };

  /* â”€â”€ Hover highlight overlay for comment mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var hoverOverlay = null;
  var lastHoveredEl = null;

  function createHoverOverlay() {
    if (hoverOverlay) return;
    hoverOverlay = document.createElement('div');
    hoverOverlay.id = 'audit-comment-hover-overlay';
    hoverOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #3A3CFF;border-radius:4px;background:rgba(58,60,255,0.08);transition:left 0.08s ease-out,top 0.08s ease-out,width 0.08s ease-out,height 0.08s ease-out;display:none;';
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

  document.addEventListener('mousemove', function(e) {
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

  /* â”€â”€ Compute viewport-relative position for a pin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function computePinViewportPosition(pin, scrollContainer) {
    // Try to anchor to DOM element first (most robust)
    var target = resolveTargetElement(pin);
    if (target) {
      var r = target.getBoundingClientRect();
      return { vx: r.left + r.width / 2, vy: r.top, visible: true };
    }
    // Fall back to saved coordinates
    if (scrollContainer) {
      // The pin's docX/docY are in the scroll container's coordinate space
      var containerRect = scrollContainer.getBoundingClientRect();
      if (typeof pin.docX === 'number' && typeof pin.docY === 'number') {
        var vx = containerRect.left + pin.docX - scrollContainer.scrollLeft;
        var vy = containerRect.top + pin.docY - scrollContainer.scrollTop;
        return { vx: vx, vy: vy, visible: true };
      }
      if (pin.scrollX != null && pin.scrollY != null && pin.viewportWidth && pin.viewportHeight) {
        var docPx = pin.scrollX + (pin.x / 100) * pin.viewportWidth;
        var docPy = pin.scrollY + (pin.y / 100) * pin.viewportHeight;
        var vx2 = containerRect.left + docPx - scrollContainer.scrollLeft;
        var vy2 = containerRect.top + docPy - scrollContainer.scrollTop;
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

  /* â”€â”€ Tooltip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var tooltipEl = null;
  var activeTooltipIndex = -1;

  function ensureTooltip() {
    if (tooltipEl) return;
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'audit-viewer-tooltip';
    tooltipEl.style.cssText = 'position:fixed;display:none;max-width:280px;padding:10px 14px;background:#1f2937;color:#f9fafb;font-size:13px;line-height:1.45;border-radius:14px;box-shadow:0 4px 14px rgba(0,0,0,0.25);z-index:2147483648;pointer-events:none;';
    document.documentElement.appendChild(tooltipEl);
  }

  function showTooltip(pin, i, vx, vy) {
    ensureTooltip();
    activeTooltipIndex = i;
    var cat = pin.category ? '<div style="font-size:11px;opacity:0.9;margin-bottom:4px;text-transform:uppercase;">' + pin.category + '</div>' : '';
    var text = (pin.feedback || 'Comment ' + (i + 1)).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    tooltipEl.innerHTML = cat + '<div>' + text + '</div>';
    tooltipEl.style.display = 'block';
    tooltipEl.style.left = vx + 'px';
    tooltipEl.style.top = (vy - 10) + 'px';
    tooltipEl.style.transform = 'translate(-50%, -100%)';
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
    activeTooltipIndex = -1;
  }

  /* â”€â”€ Continuous repositioning of hotspots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   * Use requestAnimationFrame to continuously reposition all pins.
   * This handles ALL scroll containers, transforms, and layout changes
   * without needing to know the scroll container ahead of time.
   * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var rafId = null;
  var cachedScrollContainer = undefined; // undefined = not yet computed

  function updateAllPositions() {
    var pins = window.__AUDIT_VIEWER__ && window.__AUDIT_VIEWER__.pins;
    if (!pins) { rafId = requestAnimationFrame(updateAllPositions); return; }
    if (cachedScrollContainer === undefined) cachedScrollContainer = findScrollContainer();
    for (var i = 0; i < hotspotElements.length; i++) {
      var el = hotspotElements[i];
      if (!el) continue;
      var pos = computePinViewportPosition(pins[i], cachedScrollContainer);
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
      var tpos = computePinViewportPosition(pins[activeTooltipIndex], cachedScrollContainer);
      tooltipEl.style.left = tpos.vx + 'px';
      tooltipEl.style.top = (tpos.vy - 10) + 'px';
    }
    rafId = requestAnimationFrame(updateAllPositions);
  }

  /* â”€â”€ Render hotspots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function cleanupHotspots() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    hotspotElements.forEach(function(el) { if (el && el.parentNode) el.parentNode.removeChild(el); });
    hotspotElements = [];
    if (tooltipEl && tooltipEl.parentNode) tooltipEl.parentNode.removeChild(tooltipEl);
    tooltipEl = null;
    activeTooltipIndex = -1;
  }

  function renderHotspots() {
    // ALWAYS clean up old hotspots first (even if new pins are empty)
    cleanupHotspots();
    var pins = window.__AUDIT_VIEWER__ && window.__AUDIT_VIEWER__.pins;
    if (!pins || !pins.length) return;


    // Inject styles
    var styleEl = document.getElementById('audit-viewer-hotspot-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'audit-viewer-hotspot-styles';
      styleEl.textContent = '@keyframes audit-hotspot-pulse{0%,100%{box-shadow:0 2px 8px rgba(0,0,0,0.25),0 0 0 2px #fff}50%{box-shadow:0 4px 20px rgba(0,0,0,0.35),0 0 0 4px rgba(255,255,255,0.8)}}.audit-viewer-hotspot{display:block !important;width:24px !important;height:24px !important;min-width:24px !important;min-height:24px !important;animation:audit-hotspot-pulse 2.2s ease-in-out infinite !important;opacity:1 !important;visibility:visible !important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none !important;}html,body{-ms-overflow-style:none !important;scrollbar-width:none !important;}';
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
      el.style.cssText = 'display:block !important;position:fixed;left:' + pos.vx + 'px;top:' + pos.vy + 'px;transform:translate(-50%,-100%);width:24px !important;height:24px !important;border-radius:50%;background:' + (categoryColors[pin.category] || '#3b82f6') + ' !important;border:2px solid #fff;cursor:pointer;z-index:2147483640;';
      el.setAttribute('data-feedback', pin.feedback || '');
      el.setAttribute('data-category', pin.category || '');
      el.addEventListener('mouseenter', function() {
        var curPos = computePinViewportPosition(pin, cachedScrollContainer);
        showTooltip(pin, i, curPos.vx, curPos.vy);
      });
      el.addEventListener('mouseleave', function() {
        hideTooltip();
      });
      hotspotElements.push(el);
      document.documentElement.appendChild(el);
    });
    // Start the rAF loop
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updateAllPositions);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderHotspots);
  else renderHotspots();

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
      commentMode = e.data.value;
      document.body.style.cursor = commentMode ? 'crosshair' : '';
      if (document.documentElement) document.documentElement.style.cursor = commentMode ? 'crosshair' : '';
      if (commentMode) createHoverOverlay();
      else hideHoverOverlay();
    }
    if (e.data && e.data.type === 'UPDATE_PINS') {
      updateHotspotsFromPins(e.data.pins);
    }
    if (e.data && e.data.type === 'HIGHLIGHT') {
      var s = e.data.selector, x = e.data.x, y = e.data.y;
      if (s) {
        try {
          var el = document.querySelector(s);
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.outline = '3px solid #0ea5e9'; el.style.outlineOffset = '2px'; setTimeout(function() { el.style.outline = ''; el.style.outlineOffset = ''; }, 3000); }
        } catch (err) {}
      } else if (typeof x === 'number' && typeof y === 'number') {
        var vh = window.innerHeight, vw = window.innerWidth;
        var px = (x / 100) * vw, py = (y / 100) * vh;
        window.scrollTo({ left: px - vw/2, top: py - vh/2, behavior: 'smooth' });
      }
    }
    if (e.data && e.data.type === 'SHOW_TOOLTIP' && typeof e.data.pinIndex === 'number') {
      var idx = e.data.pinIndex;
      var pins = window.__AUDIT_VIEWER__ && window.__AUDIT_VIEWER__.pins;
      if (pins && pins[idx]) {
        var pin = pins[idx];
        var pos = computePinViewportPosition(pin, cachedScrollContainer);
        showTooltip(pin, idx, pos.vx, pos.vy);
        // Scroll to pin's target element if it has a selector
        var target = resolveTargetElement(pin);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
    if (e.data && e.data.type === 'SCROLL_TO' && typeof e.data.y === 'number') {
      // Try scrolling both the window and any inner scroll container
      var sc = cachedScrollContainer || findScrollContainer();
      if (sc) sc.scrollTo({ top: e.data.y, behavior: e.data.behavior || 'auto' });
      else window.scrollTo({ top: e.data.y, behavior: e.data.behavior || 'auto' });
    }
  });

  document.addEventListener('click', function(e) {
    if (!commentMode) return;
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
        pageUrl: window.__AUDIT_VIEWER__ && window.__AUDIT_VIEWER__.pageUrl ? window.__AUDIT_VIEWER__.pageUrl : window.location.href,
        viewportWidth: vw,
        viewportHeight: vh,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      }, '*');
    }
    hideHoverOverlay();
  }, true);

  if (window.parent !== window) {
    var pageUrl = window.__AUDIT_VIEWER__ && window.__AUDIT_VIEWER__.pageUrl ? window.__AUDIT_VIEWER__.pageUrl : window.location.href;
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
    }
    window.addEventListener('scroll', sendScrollData, { passive: true });
    window.addEventListener('resize', sendScrollData, { passive: true });
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

