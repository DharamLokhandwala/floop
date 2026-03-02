import { getAuditById } from "@/lib/audits";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_PROTOCOLS = ["https:", "http:"];

/**
 * Proxies the audit's live website and injects the comment overlay script.
 * GET /audit/[id]/view?path=/about -> fetches audit.url + path, rewrites links, injects script.
 *
 * All sub-resource URLs (JS, CSS, fonts, images) pointing to the target origin
 * are rewritten to go through /audit/[id]/asset/… so the browser never makes
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
  // 1. Rewrite <a> navigation links → view proxy
  html = rewriteNavigationLinks(html, targetUrl.href, auditOrigin, proxyViewBase);
  // 2. Rewrite full-origin and absolute-path sub-resource URLs → asset proxy
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
 * Rewrites <a href="…"> links that point to the audit origin so navigation
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
 * - Full-origin refs: https://audit-origin/path → assetBase/path
 * - Absolute paths: /path (e.g. /assets/foo.js) → assetBase/path
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

  // 1) Full-origin refs on resource-like tags: https://origin/… → assetBase/…
  html = html.replace(
    new RegExp(
      `(<(?:script|link|img|source|video|audio|embed|object|iframe)\\s[^>]*?(?:src|href|srcset|poster|content|data-src)\\s*=\\s*["'])${escaped}(/[^"']*)`,
      "gi"
    ),
    (_m, prefix, path) => `${prefix}${assetBase}${path}`
  );

  // 2) Absolute-path refs on same tags: "/path" → "/audit/id/asset/path"
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

  // 5) form action (same-origin) → view proxy so submissions stay in proxy
  html = html.replace(
    /(<form\s[^>]*?\saction\s*=\s*["'])(\/[^"']*)(["'])/gi,
    (_m, prefix, path, suffix) => {
      if (path.startsWith("//")) return _m;
      return `${prefix}${proxyViewBase}?path=${encodeURIComponent(path)}${suffix}`;
    }
  );

  // 6) meta content (og:image, etc.) same-origin URLs → asset proxy
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
}

function getViewerScript(auditId: string, pageUrl: string, pins: PinForScript[]): string {
  const pinsJson = JSON.stringify(pins);
  const script = `
<script>
window.__AUDIT_VIEWER__ = { auditId: ${JSON.stringify(auditId)}, pageUrl: ${JSON.stringify(pageUrl)}, pins: ${pinsJson} };
(function() {
  var commentMode = false;
  var pinPositions = [];
  var categoryColors = { SEO: '#3b82f6', 'Visual Design': '#a855f7', CRO: '#22c55e', Feedback: '#3A3CFF' };
  function renderHotspots() {
    var pins = window.__AUDIT_VIEWER__ && window.__AUDIT_VIEWER__.pins;
    if (!pins || !pins.length) return;
    var wrap = document.getElementById('audit-viewer-hotspots');
    if (wrap) return;
    var styleEl = document.getElementById('audit-viewer-hotspot-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'audit-viewer-hotspot-styles';
      styleEl.textContent = '@keyframes audit-hotspot-pulse{0%,100%{transform:translate(-50%,-100%) scale(1);box-shadow:0 2px 8px rgba(0,0,0,0.25),0 0 0 2px #fff}50%{transform:translate(-50%,-100%) scale(1.12);box-shadow:0 4px 20px rgba(0,0,0,0.35),0 0 0 4px rgba(255,255,255,0.8)}}.audit-viewer-hotspot{animation:audit-hotspot-pulse 2.2s ease-in-out infinite}.audit-viewer-tooltip-bubble{position:absolute;display:none;max-width:280px;padding:10px 14px;background:#1f2937;color:#f9fafb;font-size:13px;line-height:1.45;border-radius:14px;box-shadow:0 4px 14px rgba(0,0,0,0.25);z-index:2147483648;pointer-events:none}.audit-viewer-tooltip-bubble::after{content:"";position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid #1f2937}';
      document.head.appendChild(styleEl);
    }
    wrap = document.createElement('div');
    wrap.id = 'audit-viewer-hotspots';
    var docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth || 0);
    var docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight || 0);
    wrap.style.cssText = 'position:absolute;left:0;top:0;width:' + docW + 'px;height:' + docH + 'px;pointer-events:none;z-index:2147483647;';
    var tooltip = document.createElement('div');
    tooltip.id = 'audit-viewer-tooltip';
    tooltip.className = 'audit-viewer-tooltip-bubble';
    tooltip.style.cssText = 'display:none;';
    wrap.appendChild(tooltip);
    pinPositions = [];
    var usedPositions = [];
    var MIN_DIST = 32;
    function dist(a, b) { return Math.sqrt((a.left - b.left) * (a.left - b.left) + (a.top - b.top) * (a.top - b.top)); }
    function collides(x, y) {
      for (var j = 0; j < usedPositions.length; j++) {
        if (dist({ left: x, top: y }, usedPositions[j]) < MIN_DIST) return true;
      }
      return false;
    }
    var nudges = [[28,0],[0,28],[-28,0],[0,-28],[28,28],[-28,28],[-28,-28],[28,-28],[56,0],[0,56],[-56,0],[0,-56]];
    pins.forEach(function(pin, i) {
      var leftPx, topPx;
      if (typeof pin.docX === 'number' && typeof pin.docY === 'number') {
        leftPx = pin.docX;
        topPx = pin.docY;
      } else if (pin.selector) {
        try {
          var target = document.querySelector(pin.selector);
          if (target) {
            var r = target.getBoundingClientRect();
            leftPx = r.left + window.scrollX + r.width / 2;
            topPx = r.top + window.scrollY;
          } else {
            var sx = pin.scrollX != null ? pin.scrollX : 0, sy = pin.scrollY != null ? pin.scrollY : 0;
            leftPx = sx + (pin.x/100)*(pin.viewportWidth||window.innerWidth); topPx = sy + (pin.y/100)*(pin.viewportHeight||window.innerHeight);
          }
        } catch (err) {
          var sx = pin.scrollX != null ? pin.scrollX : 0, sy = pin.scrollY != null ? pin.scrollY : 0;
          leftPx = sx + (pin.x/100)*(pin.viewportWidth||window.innerWidth); topPx = sy + (pin.y/100)*(pin.viewportHeight||window.innerHeight);
        }
      } else if (pin.scrollX != null && pin.scrollY != null && pin.viewportWidth && pin.viewportHeight) {
        leftPx = pin.scrollX + (pin.x/100)*pin.viewportWidth;
        topPx = pin.scrollY + (pin.y/100)*pin.viewportHeight;
      } else {
        leftPx = (pin.x/100)*docW;
        topPx = (pin.y/100)*docH;
      }
      while (collides(leftPx, topPx)) {
        var found = false;
        for (var k = 0; k < nudges.length; k++) {
          var nx = leftPx + nudges[k][0], ny = topPx + nudges[k][1];
          if (!collides(nx, ny)) { leftPx = nx; topPx = ny; found = true; break; }
        }
        if (!found) { leftPx += 28; topPx += 0; }
      }
      usedPositions.push({ left: leftPx, top: topPx });
      pinPositions[i] = { leftPx: leftPx, topPx: topPx };
      var el = document.createElement('div');
      el.className = 'audit-viewer-hotspot';
      el.setAttribute('data-pin-index', String(i));
      el.style.cssText = 'position:absolute;left:' + leftPx + 'px;top:' + topPx + 'px;transform:translate(-50%,-100%);width:24px;height:24px;border-radius:50%;background:' + (categoryColors[pin.category] || '#3b82f6') + ';border:2px solid #fff;pointer-events:auto;cursor:pointer;';
      el.setAttribute('data-feedback', pin.feedback || '');
      el.setAttribute('data-category', pin.category || '');
      el.addEventListener('mouseenter', function() {
        var cat = pin.category ? '<div style="font-size:11px;opacity:0.9;margin-bottom:4px;text-transform:uppercase;">' + pin.category + '</div>' : '';
        var text = (pin.feedback || 'Comment ' + (i + 1)).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        tooltip.innerHTML = cat + '<div>' + text + '</div>';
        tooltip.style.display = 'block';
        tooltip.style.left = leftPx + 'px';
        tooltip.style.top = (topPx - 10) + 'px';
        tooltip.style.transform = 'translate(-50%, -100%)';
      });
      el.addEventListener('mouseleave', function() {
        tooltip.style.display = 'none';
      });
      wrap.appendChild(el);
    });
    document.body.appendChild(wrap);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderHotspots);
  else renderHotspots();
  function getSelector(el) {
    if (!el || el === document.body) return null;
    if (el.id && /^[a-zA-Z][\\w.-]*$/.test(el.id)) return '#' + el.id;
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
    if (!newPins || !Array.isArray(newPins)) return;
    window.__AUDIT_VIEWER__.pins = newPins;
    var wrap = document.getElementById('audit-viewer-hotspots');
    if (wrap) wrap.remove();
    renderHotspots();
  }
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'SET_COMMENT_MODE') {
      commentMode = e.data.value;
      document.body.style.cursor = commentMode ? 'crosshair' : '';
      if (document.documentElement) document.documentElement.style.cursor = commentMode ? 'crosshair' : '';
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
      if (pins && pinPositions[idx]) {
        var pos = pinPositions[idx];
        var pin = pins[idx];
        var tooltipEl = document.getElementById('audit-viewer-tooltip');
        if (tooltipEl) {
          var cat = pin.category ? '<div style="font-size:11px;opacity:0.9;margin-bottom:4px;text-transform:uppercase;">' + pin.category + '</div>' : '';
          var text = (pin.feedback || 'Comment ' + (idx + 1)).replace(/</g, '&lt;').replace(/>/g, '&gt;');
          tooltipEl.innerHTML = cat + '<div>' + text + '</div>';
          tooltipEl.style.display = 'block';
          tooltipEl.style.left = pos.leftPx + 'px';
          tooltipEl.style.top = (pos.topPx - 10) + 'px';
          tooltipEl.style.transform = 'translate(-50%, -100%)';
          window.scrollTo({ left: Math.max(0, pos.leftPx - window.innerWidth / 2), top: Math.max(0, pos.topPx - 100), behavior: 'smooth' });
        }
      }
    }
  });
  document.addEventListener('click', function(e) {
    if (!commentMode) return;
    e.preventDefault();
    e.stopPropagation();
    var target = e.target;
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
  }, true);
  if (window.parent !== window) {
    var pageUrl = window.__AUDIT_VIEWER__ && window.__AUDIT_VIEWER__.pageUrl ? window.__AUDIT_VIEWER__.pageUrl : window.location.href;
    window.parent.postMessage({ type: 'AUDIT_VIEWER_READY', pageUrl: pageUrl }, '*');
  }
})();
</script>`;
  return script;
}
