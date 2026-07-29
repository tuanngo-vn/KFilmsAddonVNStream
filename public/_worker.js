const API_PRIMARY = 'https://phimapi.com';
const API_FALLBACK = 'https://ophim1.com';
const IMG_BASE = 'https://phimimg.com';

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json'
};

async function fetchJsonSingle(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.status !== false && data.status !== 'error' && data.msg !== 'slug error' && data.msg !== 'hmmm!') {
        return data;
      }
    }
  } catch (e) {
    // Timeout or network error — fail fast
  } finally {
    clearTimeout(timer);
  }
  return null;
}

async function fetchWithFallback(path, { timeoutMs = 4000 } = {}) {
  // Try primary API (phimapi.com) with 4s timeout
  let data = await fetchJsonSingle(`${API_PRIMARY}${path}`, timeoutMs);
  if (data) return { data, source: 'primary' };

  // Fallback immediately to secondary API (ophim1.com) if primary fails or returns error JSON
  data = await fetchJsonSingle(`${API_FALLBACK}${path}`, timeoutMs);
  if (data) return { data, source: 'fallback' };

  return { data: null, source: null };
}

function formatImageUrl(imgPath, cdnDomain = 'https://phimimg.com') {
  if (!imgPath) return '';
  if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
    return imgPath;
  }
  const cleanPath = imgPath.replace(/^\/+/, '');
  let base = cdnDomain.replace(/\/+$/, '');

  if (base.includes('ophim')) {
    if (!cleanPath.startsWith('uploads/')) {
      base = 'https://img.ophim.live/uploads/movies';
    } else {
      base = 'https://img.ophim.live';
    }
  }

  if (cleanPath.startsWith('uploads/') && base.endsWith('/uploads')) {
    return `${base.replace(/\/uploads$/, '')}/${cleanPath}`;
  }
  return `${base}/${cleanPath}`;
}

function rewriteM3u8Content(content, baseUrl, workerDomain) {
  const lines = content.split(/\r?\n/);
  const isMaster = content.includes('#EXT-X-STREAM-INF');
  const adRegex = /(?:^|\/|\.|\?|=)(?:ad|ads|qc|quangcao|promo|banner|intro|doubleclick|bet88|fb88|789bet|okvip|hi88|jun88|shbet|new88|kubet|f8bet|bk8|88bet|nha-cai|song-bai)\b/i;

  if (isMaster) {
    const resultLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        resultLines.push(lines[i]);
        if (i + 1 < lines.length && !lines[i + 1].trim().startsWith('#')) {
          i++;
          const variantPath = lines[i].trim();
          let absVariantUrl;
          try {
            absVariantUrl = new URL(variantPath, baseUrl).href;
          } catch (e) {
            absVariantUrl = variantPath;
          }
          const proxiedVariantUrl = `https://${workerDomain}/m3u8-proxy?url=${encodeURIComponent(absVariantUrl)}`;
          resultLines.push(proxiedVariantUrl);
        }
      } else {
        resultLines.push(lines[i]);
      }
    }
    return resultLines.join('\n');
  }

  // Media Playlist processing
  const outputLines = [];
  let pendingTags = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#')) {
      pendingTags.push(line);
    } else {
      // Segment URL line
      let absSegmentUrl;
      try {
        absSegmentUrl = new URL(line, baseUrl).href;
      } catch (e) {
        absSegmentUrl = line;
      }

      // Check if this segment or any of its tags matches ad patterns
      const isAdSegment = adRegex.test(absSegmentUrl) || pendingTags.some(tag => adRegex.test(tag));

      if (!isAdSegment) {
        outputLines.push(...pendingTags);
        outputLines.push(absSegmentUrl);
      }
      pendingTags = [];
    }
  }

  // Push trailing tags (e.g. #EXT-X-ENDLIST)
  if (pendingTags.length > 0) {
    const endTags = pendingTags.filter(t => t.startsWith('#EXT-X-ENDLIST') || t.startsWith('#EXT-X-INDEPENDENT-SEGMENTS'));
    outputLines.push(...endTags);
  }

  // Remove leading or consecutive #EXT-X-DISCONTINUITY tags resulting from ad segment removal
  const finalLines = [];
  let prevWasDiscontinuity = false;

  for (const line of outputLines) {
    if (line === '#EXT-X-DISCONTINUITY') {
      if (!prevWasDiscontinuity && finalLines.length > 0) {
        finalLines.push(line);
        prevWasDiscontinuity = true;
      }
    } else {
      finalLines.push(line);
      if (!line.startsWith('#')) {
        prevWasDiscontinuity = false;
      }
    }
  }

  return finalLines.join('\n');
}

async function handleM3u8Proxy(request, targetUrl, workerDomain) {
  try {
    let cleanTargetUrl = targetUrl;
    
    // Clean up extra KFilms App parameters appended to targetUrl if any
    try {
      const parsed = new URL(targetUrl);
      parsed.searchParams.delete('kfname');
      parsed.searchParams.delete('kftype');
      parsed.searchParams.delete('kfid');
      parsed.searchParams.delete('kfep');
      cleanTargetUrl = parsed.toString();
    } catch (e) {
      cleanTargetUrl = targetUrl.split('?kfname=')[0].split('&kfname=')[0]
                               .split('?kftype=')[0].split('&kftype=')[0];
    }

    let targetObj;
    try {
      targetObj = new URL(cleanTargetUrl);
    } catch (e) {
      return new Response(`Invalid target URL: ${cleanTargetUrl}`, { status: 400 });
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': targetObj.origin + '/',
      'Origin': targetObj.origin,
      'Accept': '*/*'
    };

    let res = await fetch(cleanTargetUrl, { headers });

    // Fallback: If original fetch failed, try stripping query parameters
    if (!res.ok && cleanTargetUrl.includes('?')) {
      const urlNoQuery = cleanTargetUrl.split('?')[0];
      const resFallback = await fetch(urlNoQuery, { headers });
      if (resFallback.ok) {
        res = resFallback;
        cleanTargetUrl = urlNoQuery;
      }
    }

    if (!res.ok) {
      return new Response(`Upstream fetch failed with status ${res.status}`, { status: res.status });
    }

    const text = await res.text();
    const cleanText = rewriteM3u8Content(text, cleanTargetUrl, workerDomain);

    return new Response(cleanText, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (err) {
    return new Response(`M3U8 Proxy Error: ${err.message}`, { status: 500 });
  }
}



const manifest = {
  "id": "community.VNStream",
  "version": "1.6.0",
  "behaviorHints": {
    "configurable": false,
    "configurationRequired": false
  },
  "config": [
    {
      "key": "children_mode",
      "type": "text",
      "title": "Children Mode",
      "required": "false",
      "default": "0"
    }
  ],
  "catalogs": [
    {
      "type": "movie",
      "name": "[FILMS ADDON] Mới cập nhật",
      "id": "vnstream-top",
      "extra": [{ "name": "skip", "value": "24" }, { "name": "search" }]
    },
    {
      "type": "movie",
      "name": "[FILMS ADDON] Phim Lẻ",
      "id": "vnstream-single",
      "extra": [{ "name": "skip", "value": "24" }, { "name": "search" }]
    },
    {
      "type": "series",
      "name": "[FILMS ADDON] Phim Bộ",
      "id": "vnstream-series",
      "extra": [{ "name": "skip", "value": "24" }, { "name": "search" }]
    },
    {
      "type": "series",
      "name": "[FILMS ADDON] Hoạt Hình",
      "id": "vnstream-anime",
      "extra": [{ "name": "skip", "value": "24" }, { "name": "search" }]
    },
    {
      "type": "series",
      "name": "[FILMS ADDON] TV Shows",
      "id": "vnstream-tvshows",
      "extra": [{ "name": "skip", "value": "24" }, { "name": "search" }]
    }
  ],
  "resources": [
    "catalog",
    "stream",
    "meta"
  ],
  "types": [
    "movie",
    "series"
  ],
  "name": "FILMS ADDON",
  "description": "Xem phim hay Vietsub, thuyết minh, lồng tiếng tổng hợp từ nhiều nguồn miễn phí",
  "logo": "https://films-addon.pages.dev/static/logo@256.png",
  "background": "https://films-addon.pages.dev/static/background.png"
};

function getHtmlPage(domain) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FILMS ADDON | Thư Viện Phim Hay</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #07090e;
      --bg-secondary: #0f1420;
      --bg-card: #151c2d;
      --bg-glass: rgba(21, 28, 45, 0.75);
      --border-glass: rgba(255, 255, 255, 0.08);
      --accent-grad: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
      --accent-glow: rgba(168, 85, 247, 0.35);
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    body {
      background-color: var(--bg-primary);
      color: var(--text-main);
      min-height: 100vh;
      overflow-x: hidden;
      background-image: 
        radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 40%),
        radial-gradient(circle at 85% 80%, rgba(236, 72, 153, 0.12) 0%, transparent 40%);
    }

    h1, h2, h3, h4, .brand-logo {
      font-family: 'Outfit', sans-serif;
    }

    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(7, 9, 14, 0.85);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-glass);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1.5rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
    }

    .brand-icon {
      width: 40px;
      height: 40px;
      background: var(--accent-grad);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 1.2rem;
      color: white;
      box-shadow: 0 4px 20px var(--accent-glow);
    }

    .brand-title {
      font-size: 1.4rem;
      font-weight: 800;
      background: var(--accent-grad);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }

    .search-box {
      position: relative;
      flex: 1;
      max-width: 480px;
    }

    .search-input {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border-glass);
      padding: 0.75rem 1.25rem 0.75rem 2.8rem;
      border-radius: 99px;
      color: var(--text-main);
      font-size: 0.95rem;
      outline: none;
      transition: all 0.3s ease;
    }

    .search-input:focus {
      border-color: #a855f7;
      box-shadow: 0 0 15px rgba(168, 85, 247, 0.25);
    }

    .search-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }

    main {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    .hero-banner {
      background: linear-gradient(180deg, rgba(15, 20, 32, 0.4) 0%, var(--bg-card) 100%),
                  radial-gradient(circle at top right, rgba(168, 85, 247, 0.2), transparent);
      border: 1px solid var(--border-glass);
      border-radius: 24px;
      padding: 2.5rem;
      margin-bottom: 2.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 2rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }

    .hero-text h2 {
      font-size: 2.2rem;
      font-weight: 800;
      margin-bottom: 0.75rem;
      line-height: 1.2;
    }

    .hero-text p {
      color: var(--text-muted);
      font-size: 1.05rem;
      line-height: 1.6;
      max-width: 650px;
    }

    .badge-app {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(236, 72, 153, 0.15);
      border: 1px solid rgba(236, 72, 153, 0.3);
      color: #f472b6;
      padding: 0.4rem 0.9rem;
      border-radius: 99px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .tabs-container {
      display: flex;
      gap: 0.75rem;
      overflow-x: auto;
      padding-bottom: 0.75rem;
      margin-bottom: 1.5rem;
      scrollbar-width: none;
    }

    .tabs-container::-webkit-scrollbar {
      display: none;
    }

    .tab-btn {
      background: var(--bg-card);
      border: 1px solid var(--border-glass);
      color: var(--text-muted);
      padding: 0.65rem 1.25rem;
      border-radius: 99px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.3s ease;
    }

    .tab-btn:hover {
      color: var(--text-main);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .tab-btn.active {
      background: var(--accent-grad);
      color: white;
      border-color: transparent;
      box-shadow: 0 4px 15px var(--accent-glow);
    }

    .section-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .section-title::before {
      content: '';
      width: 4px;
      height: 24px;
      background: var(--accent-grad);
      border-radius: 4px;
    }

    .movie-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1.5rem;
    }

    .movie-card {
      background: var(--bg-card);
      border: 1px solid var(--border-glass);
      border-radius: 16px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .movie-card:hover {
      transform: translateY(-8px) scale(1.02);
      border-color: rgba(168, 85, 247, 0.5);
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(168, 85, 247, 0.2);
    }

    .poster-wrapper {
      position: relative;
      width: 100%;
      aspect-ratio: 2/3;
      background: var(--bg-secondary);
      overflow: hidden;
    }

    .poster-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.5s ease;
    }

    .movie-card:hover .poster-img {
      transform: scale(1.08);
    }

    .play-overlay {
      position: absolute;
      inset: 0;
      background: rgba(7, 9, 14, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .movie-card:hover .play-overlay {
      opacity: 1;
    }

    .btn-play-icon {
      width: 54px;
      height: 54px;
      background: var(--accent-grad);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      box-shadow: 0 4px 20px var(--accent-glow);
    }

    .movie-info {
      padding: 1rem;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .movie-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 0.4rem;
    }

    .movie-meta {
      font-size: 0.8rem;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .load-more-container {
      text-align: center;
      margin-top: 3rem;
      margin-bottom: 2rem;
    }

    .btn-load-more {
      background: var(--bg-card);
      border: 1px solid var(--border-glass);
      color: var(--text-main);
      padding: 0.9rem 2.5rem;
      border-radius: 99px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .btn-load-more:hover {
      background: var(--accent-grad);
      border-color: transparent;
      box-shadow: 0 8px 25px var(--accent-glow);
      transform: translateY(-2px);
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(7, 9, 14, 0.85);
      backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }

    .modal-backdrop.active {
      opacity: 1;
      pointer-events: auto;
    }

    .modal-content {
      background: var(--bg-card);
      border: 1px solid var(--border-glass);
      border-radius: 28px;
      max-width: 680px;
      width: 100%;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      position: relative;
      transform: scale(0.9);
      transition: transform 0.3s ease;
    }

    .modal-backdrop.active .modal-content {
      transform: scale(1);
    }

    .modal-header-bg {
      width: 100%;
      height: 220px;
      object-fit: cover;
      background: var(--bg-secondary);
      position: relative;
    }

    .modal-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 36px;
      height: 36px;
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      font-size: 1.2rem;
    }

    .modal-body {
      padding: 1.75rem;
      margin-top: -60px;
      position: relative;
    }

    .modal-movie-header {
      display: flex;
      gap: 1.5rem;
      align-items: flex-end;
      margin-bottom: 1.5rem;
    }

    .modal-poster {
      width: 110px;
      height: 165px;
      object-fit: cover;
      border-radius: 16px;
      border: 3px solid var(--bg-card);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      flex-shrink: 0;
    }

    .modal-title-area h3 {
      font-size: 1.6rem;
      font-weight: 800;
      margin-bottom: 0.3rem;
    }

    .modal-subtitle {
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .modal-desc {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 2rem;
      max-height: 120px;
      overflow-y: auto;
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }

    .btn-primary-kfilms {
      width: 100%;
      background: var(--accent-grad);
      border: none;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 16px;
      font-size: 1.1rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      box-shadow: 0 8px 25px var(--accent-glow);
      transition: all 0.3s ease;
      text-decoration: none;
    }

    .btn-primary-kfilms:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 30px rgba(168, 85, 247, 0.5);
    }

    .player-support-note {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: 0.4rem;
      padding: 0.75rem 1rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px dashed var(--border-glass);
      border-radius: 12px;
      line-height: 1.4;
    }

    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: #10b981;
      color: white;
      padding: 0.9rem 1.5rem;
      border-radius: 12px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s ease;
      z-index: 2000;
    }

    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }

    .loading-spinner {
      text-align: center;
      padding: 4rem;
      color: var(--text-muted);
      font-size: 1.1rem;
      grid-column: 1 / -1;
    }

    @media (max-width: 640px) {
      header {
        padding: 1rem;
        flex-direction: column;
      }
      .search-box {
        width: 100%;
      }
      .hero-banner {
        padding: 1.5rem;
        flex-direction: column;
      }
      .movie-grid {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 1rem;
      }
    }
  </style>
</head>
<body>

  <header>
    <a href="#" class="brand">
      <div class="brand-icon">FA</div>
      <span class="brand-title">FILMS ADDON</span>
    </a>
    <div class="search-box">
      <svg class="search-icon" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      <input type="text" id="searchInput" class="search-input" placeholder="Tìm kiếm phim hay...">
    </div>
  </header>

  <main>
    <div class="hero-banner">
      <div class="hero-text">
        <div class="badge-app">⚠️ Yêu cầu KFILMS Pro</div>
        <h2>FILMS ADDON</h2>
        <p>Chọn bất kỳ bộ phim nào bên dưới, nhấn <b>"Mở trong KFilms Pro"</b> để tự động thêm phim vào Mediabox và thưởng thức ngay!</p>
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="tabs-container">
      <button class="tab-btn active" onclick="switchCategory('vnstream-top', this)">🔥 Mới Cập Nhật</button>
      <button class="tab-btn" onclick="switchCategory('vnstream-single', this)">🎬 Phim Lẻ</button>
      <button class="tab-btn" onclick="switchCategory('vnstream-series', this)">📺 Phim Bộ</button>
      <button class="tab-btn" onclick="switchCategory('vnstream-anime', this)">🎨 Hoạt Hình</button>
      <button class="tab-btn" onclick="switchCategory('vnstream-tvshows', this)">⭐ TV Shows</button>
    </div>

    <div class="section-title" id="sectionTitle">Danh Sách Phim Mới Cập Nhật</div>
    
    <div id="movieGrid" class="movie-grid">
      <div class="loading-spinner">Đang tải danh sách phim...</div>
    </div>

    <div class="load-more-container">
      <button id="btnLoadMore" class="btn-load-more" onclick="loadNextPage()">Tải Thêm Phim 🔽</button>
    </div>
  </main>

  <div id="movieModal" class="modal-backdrop">
    <div class="modal-content">
      <button class="modal-close" onclick="closeModal()">✕</button>
      <img id="modalBg" class="modal-header-bg" src="" alt="Backdrop">
      <div class="modal-body">
        <div class="modal-movie-header">
          <img id="modalPoster" class="modal-poster" src="" alt="Poster">
          <div class="modal-title-area">
            <h3 id="modalTitle">Tên Phim</h3>
            <div id="modalSub" class="modal-subtitle">Tên gốc (Năm)</div>
          </div>
        </div>

        <p id="modalDesc" class="modal-desc">Đang tải nội dung...</p>

        <div class="action-buttons">
          <button id="btnKFilms" class="btn-primary-kfilms" onclick="openInKFilms()">
            <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            Mở với KFilms Pro
          </button>

          <div class="player-support-note">
            💡 Sẽ sớm support thêm các player khác: VLC, IINA, PotPlayer, Stremio
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="toast" class="toast">Đang chuyển hướng sang KFilms Pro...</div>

  <script>
    let currentMovie = null;
    let currentCatalog = 'vnstream-top';
    let currentPage = 1;
    let currentSearch = '';
    let isLoading = false;
    let allMovies = [];

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    async function loadMovies(reset = true) {
      if (isLoading) return;
      isLoading = true;

      const grid = document.getElementById('movieGrid');
      const btnLoadMore = document.getElementById('btnLoadMore');

      if (reset) {
        currentPage = 1;
        allMovies = [];
        grid.innerHTML = '<div class="loading-spinner">Đang tải danh sách phim...</div>';
      }

      btnLoadMore.innerText = 'Đang tải...';

      try {
        let skip = (currentPage - 1) * 24;
        let url = '/catalog/movie/' + currentCatalog + '/skip=' + skip + '.json';
        if (currentSearch) {
          url = '/catalog/movie/' + currentCatalog + '/search=' + encodeURIComponent(currentSearch) + '.json';
        }
        
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        
        const newMovies = data.metas || [];

        if (reset && newMovies.length === 0) {
          grid.innerHTML = '<div class="loading-spinner">Không tìm thấy phim nào.</div>';
          btnLoadMore.style.display = 'none';
          isLoading = false;
          return;
        }

        allMovies = reset ? newMovies : [...allMovies, ...newMovies];

        grid.innerHTML = allMovies.map(movie => \`
          <div class="movie-card" onclick="openMovieDetail('\${escapeHtml(movie.id)}')">
            <div class="poster-wrapper">
              <img class="poster-img" src="\${escapeHtml(movie.poster)}" alt="\${escapeHtml(movie.name)}" loading="lazy">
              <div class="play-overlay">
                <div class="btn-play-icon">
                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
              </div>
            </div>
            <div class="movie-info">
              <div class="movie-title">\${escapeHtml(movie.name)}</div>
              <div class="movie-meta">\${escapeHtml(movie.description) || 'Vietsub'}</div>
            </div>
          </div>
        \`).join('');

        btnLoadMore.style.display = newMovies.length < 24 ? 'none' : 'inline-block';
        btnLoadMore.innerText = 'Tải Thêm Phim 🔽 (Đã hiển thị ' + allMovies.length + ' phim)';
      } catch (err) {
        if (reset) grid.innerHTML = '<div class="loading-spinner">Lỗi khi tải dữ liệu phim. Hãy thử tải lại trang.</div>';
      } finally {
        isLoading = false;
      }
    }

    function loadNextPage() {
      currentPage++;
      loadMovies(false);
    }

    const CATEGORY_NAMES = {
      'vnstream-top': 'Danh Sách Phim Mới Cập Nhật',
      'vnstream-single': 'Danh Sách Phim Lẻ',
      'vnstream-series': 'Danh Sách Phim Bộ',
      'vnstream-anime': 'Danh Sách Hoạt Hình',
      'vnstream-tvshows': 'Danh Sách TV Shows'
    };

    function switchCategory(catalogId, btn) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCatalog = catalogId;
      currentSearch = '';
      document.getElementById('searchInput').value = '';
      const cleanTitle = CATEGORY_NAMES[catalogId] || btn.innerText.trim();
      document.getElementById('sectionTitle').innerText = cleanTitle;
      loadMovies(true);
    }

    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentSearch = e.target.value.trim();
        if (currentSearch) {
          document.getElementById('sectionTitle').innerText = 'Kết quả tìm kiếm: "' + currentSearch + '"';
        } else {
          document.getElementById('sectionTitle').innerText = CATEGORY_NAMES[currentCatalog] || 'Danh Sách Phim';
        }
        loadMovies(true);
      }, 500);
    });

    async function openMovieDetail(id) {
      const modal = document.getElementById('movieModal');
      modal.classList.add('active');

      document.getElementById('modalTitle').innerText = 'Đang tải...';
      document.getElementById('modalSub').innerText = '';
      document.getElementById('modalDesc').innerText = 'Đang lấy thông tin...';

      try {
        const res = await fetch('/meta/movie/' + id + '.json');
        const data = await res.json();
        const movie = data.meta;
        // /meta/ returns {meta: null} (still HTTP 200) when the upstream
        // phimapi.com lookup failed or timed out — reading movie.name below
        // would throw, and the generic catch couldn't tell this apart from
        // a real network error, leaving modalDesc stuck on "Đang lấy thông
        // tin..." next to "Lỗi thông tin" forever.
        if (!movie) throw new Error('meta_null');
        currentMovie = movie;

        document.getElementById('modalTitle').innerText = movie.name;
        document.getElementById('modalSub').innerText = (movie.genres ? movie.genres.join(', ') : '') + ' • ' + (movie.releaseInfo || '');
        document.getElementById('modalDesc').innerText = movie.description || 'Chưa có mô tả chi tiết cho phim này.';
        document.getElementById('modalPoster').src = movie.poster;
        document.getElementById('modalBg').src = movie.background || movie.poster;
      } catch (err) {
        currentMovie = null;
        document.getElementById('modalTitle').innerText = 'Lỗi thông tin';
        document.getElementById('modalSub').innerText = '';
        document.getElementById('modalDesc').innerText = 'Không lấy được thông tin phim (nguồn dữ liệu đang chậm), vui lòng đóng và thử lại sau.';
      }
    }

    function closeModal() {
      document.getElementById('movieModal').classList.remove('active');
    }

    async function openInKFilms() {
      if (!currentMovie) return;
      const domainHost = window.location.hostname;
      const kfname = 'kfname=' + encodeURIComponent(currentMovie.name);

      if (currentMovie.type === 'series') {
        // Series: hand off the /episodes/{id}.json list (&kftype=group) so
        // KFilms imports every episode as one group in a single shot.
        const episodesUrl = 'https://' + domainHost + '/episodes/' + currentMovie.id + '.json';
        window.location.href = 'kfilms://' + episodesUrl + '?' + kfname + '&kftype=group';
        showToast('Đang kích hoạt KFilms Pro...');
        return;
      }

      // Movie: resolve the raw stream link up front (via the same
      // /episodes/ endpoint, which already retries phimapi.com's flaky
      // upstream) instead of handing KFilms a link that still depends on
      // this site being reachable every time the user presses play later.
      try {
        const res = await fetch('https://' + domainHost + '/episodes/' + currentMovie.id + '.json');
        const data = await res.json();
        const rawUrl = data.episodes && data.episodes[0] && data.episodes[0].url;
        if (!rawUrl) throw new Error('no stream url');
        window.location.href = 'kfilms://' + rawUrl + '?' + kfname;
        showToast('Đang kích hoạt KFilms Pro...');
      } catch (err) {
        showToast('Không lấy được link phát, thử lại sau.');
      }
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    loadMovies(true);
  </script>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=180, s-maxage=360, stale-while-revalidate=60',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (path === '/' || path === '/index.html') {
      return new Response(getHtmlPage(url.hostname), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    if (path === '/manifest.json' || path === '/guest/manifest.json') {
      return new Response(JSON.stringify(manifest), { headers: corsHeaders });
    }

    if (path.startsWith('/m3u8-proxy') || path.startsWith('/proxy-m3u8')) {
      let targetUrl = url.searchParams.get('url');
      if (!targetUrl) {
        const rawMatch = request.url.match(/[?&]url=([^&]+)/);
        if (rawMatch) {
          try {
            targetUrl = decodeURIComponent(rawMatch[1]);
          } catch (e) {
            targetUrl = rawMatch[1];
          }
        }
      }

      if (!targetUrl) {
        return new Response('Missing url parameter', { status: 400, headers: corsHeaders });
      }
      return await handleM3u8Proxy(request, targetUrl, url.hostname);
    }

    // Endpoint /episodes/:slug.json (Trả về thông tin chi tiết và danh sách các tập phim cho KFilms App)
    if (path.startsWith('/episodes/')) {
      const slug = path.replace('/episodes/', '').replace('.json', '');

      if (!slug) {
        return new Response(JSON.stringify({ error: 'Missing movie slug' }), { status: 400, headers: corsHeaders });
      }

      try {
        const { data, source } = await fetchWithFallback(`/phim/${slug}`);
        if (!data) {
          return new Response(JSON.stringify({ error: 'Movie not found' }), { status: 404, headers: corsHeaders });
        }

        const movie = data.movie || {};
        const cdnDomain = source === 'fallback' 
          ? (data.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || 'https://img.ophim.live/uploads/movies')
          : (data.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || 'https://phimimg.com');

        const domain = url.hostname;
        const formattedEpisodes = [];
        if (data.episodes && Array.isArray(data.episodes)) {
          const hasMultipleServers = data.episodes.length > 1;
          data.episodes.forEach(server => {
            const serverName = server.server_name || 'Vietsub';
            (server.server_data || []).forEach(ep => {
              const rawM3u8 = ep.link_m3u8 || '';
              const proxiedUrl = rawM3u8 ? `https://${domain}/m3u8-proxy?url=${encodeURIComponent(rawM3u8)}` : '';
              formattedEpisodes.push({
                name: hasMultipleServers ? `${ep.name} [${serverName}]` : ep.name,
                slug: ep.slug,
                filename: ep.filename,
                url: proxiedUrl,
                raw_url: rawM3u8,
                link_embed: ep.link_embed,
                server_name: serverName
              });
            });
          });
        }

        return new Response(JSON.stringify({
          title: movie.name || slug,
          origin_name: movie.origin_name || '',
          slug: movie.slug || slug,
          poster: formatImageUrl(movie.poster_url || movie.thumb_url, cdnDomain),
          banner: formatImageUrl(movie.thumb_url || movie.poster_url, cdnDomain),
          episodes: formattedEpisodes
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (path.startsWith('/play/') || path === '/play') {
      let slug = path.replace('/play/', '').replace('/play', '');
      if (!slug && url.searchParams.has('id')) {
        slug = url.searchParams.get('id');
      }

      if (!slug) {
        return new Response('Missing movie ID', { status: 400 });
      }

      try {
        const { data } = await fetchWithFallback(`/phim/${slug}`);
        if (!data) {
          return new Response('Movie not found', { status: 404 });
        }

        let streamUrl = null;
        const epSlug = url.searchParams.get('ep');

        if (data.episodes && Array.isArray(data.episodes)) {
          for (const server of data.episodes) {
            const episodeList = server.server_data || [];
            const episode = epSlug
              ? episodeList.find((e) => e.slug === epSlug)
              : episodeList[0];
            if (episode && episode.link_m3u8) {
              streamUrl = episode.link_m3u8;
              break;
            }
          }
        }

        if (!streamUrl) {
          return new Response('Stream link not found', { status: 404 });
        }

        const proxiedStreamUrl = `https://${url.hostname}/m3u8-proxy?url=${encodeURIComponent(streamUrl)}`;
        return Response.redirect(proxiedStreamUrl, 302);
      } catch (err) {
        return new Response(`Error resolving stream: ${err.message}`, { status: 500 });
      }
    }

    if (path.startsWith('/catalog/')) {
      const parts = path.replace('.json', '').split('/');
      const type = parts[2];
      const catalogId = parts[3];
      const extraStr = parts[4] || '';

      let page = 1;
      let searchQuery = '';

      if (extraStr.startsWith('search=')) {
        searchQuery = decodeURIComponent(extraStr.replace('search=', ''));
      } else if (extraStr.startsWith('skip=')) {
        const skip = parseInt(extraStr.replace('skip=', ''), 10) || 0;
        page = Math.floor(skip / 24) + 1;
      }

      try {
        let fetchUrlPath = `/danh-sach/phim-moi-cap-nhat?page=${page}`;
        
        if (searchQuery) {
          fetchUrlPath = `/v1/api/tim-kiem?keyword=${encodeURIComponent(searchQuery)}&page=${page}`;
        } else if (catalogId === 'vnstream-single') {
          fetchUrlPath = `/v1/api/danh-sach/phim-le?page=${page}`;
        } else if (catalogId === 'vnstream-series') {
          fetchUrlPath = `/v1/api/danh-sach/phim-bo?page=${page}`;
        } else if (catalogId === 'vnstream-anime') {
          fetchUrlPath = `/v1/api/danh-sach/hoat-hinh?page=${page}`;
        } else if (catalogId === 'vnstream-tvshows') {
          fetchUrlPath = `/v1/api/danh-sach/tv-shows?page=${page}`;
        }

        const { data, source } = await fetchWithFallback(fetchUrlPath);
        if (!data) {
          return new Response(JSON.stringify({ metas: [] }), { headers: corsHeaders });
        }

        let items = [];
        if (data.items) {
          items = data.items;
        } else if (data.data && data.data.items) {
          items = data.data.items;
        }

        const cdnDomain = source === 'fallback' 
          ? (data.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || 'https://img.ophim.live/uploads/movies')
          : (data.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || 'https://phimimg.com');

        const metas = items.map((item) => {
          const posterUrl = formatImageUrl(item.poster_url || item.thumb_url, cdnDomain);

          return {
            id: item.slug,
            type: item.type === 'single' ? 'movie' : 'series',
            name: item.name,
            poster: posterUrl,
            description: `${item.origin_name || ''} (${item.year || ''})`,
          };
        });

        return new Response(JSON.stringify({ metas }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ metas: [] }), { headers: corsHeaders });
      }
    }

    if (path.startsWith('/meta/')) {
      const parts = path.replace('.json', '').split('/');
      const type = parts[2];
      const slug = parts[3];

      try {
        const { data, source } = await fetchWithFallback(`/phim/${slug}`);
        if (!data || !data.movie) {
          return new Response(JSON.stringify({ meta: null }), { headers: corsHeaders });
        }

        const movie = data.movie;

        const cdnDomain = source === 'fallback'
          ? (data.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || 'https://img.ophim.live/uploads/movies')
          : (data.pathImage || data.data?.APP_DOMAIN_CDN_IMAGE || 'https://phimimg.com');

        const posterUrl = formatImageUrl(movie.poster_url || movie.thumb_url, cdnDomain);
        const backgroundUrl = formatImageUrl(movie.thumb_url || movie.poster_url, cdnDomain);

        const meta = {
          id: movie.slug,
          type: movie.type === 'single' ? 'movie' : 'series',
          name: movie.name,
          poster: posterUrl,
          background: backgroundUrl,
          description: movie.content?.replace(/<[^>]*>?/gm, '') || '',
          genres: movie.category?.map((c) => c.name) || [],
          releaseInfo: `${movie.year}`,
        };

        return new Response(JSON.stringify({ meta }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ meta: null }), { headers: corsHeaders });
      }
    }

    if (path.startsWith('/stream/')) {
      const parts = path.replace('.json', '').split('/');
      const idStr = parts[3];
      const slug = idStr.split(':')[0];

      try {
        const { data } = await fetchWithFallback(`/phim/${slug}`);
        let movieTitle = slug;
        if (data && data.movie && data.movie.name) {
          movieTitle = data.movie.name;
        }

        const domain = url.hostname;
        
        const episodesUrl = `https://${domain}/episodes/${slug}.json`;
        const kfilmsDeepLink = `kfilms://${episodesUrl}?kfname=${encodeURIComponent(movieTitle)}&kftype=group`;

        const streams = [
          {
            name: 'KFilms Pro',
            title: `Mở với KFilms Pro\n(Sẽ sớm support thêm các player khác: VLC, IINA, PotPlayer, Stremio)\n${movieTitle}`,
            externalUrl: kfilmsDeepLink,
          }
        ];

        return new Response(JSON.stringify({ streams }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ streams: [] }), { headers: corsHeaders });
      }
    }

    return new Response('FILMS ADDON Active', { status: 200, headers: corsHeaders });
  },
};
