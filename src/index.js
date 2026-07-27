const API_BASE = 'https://phimapi.com';

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json'
};

const manifest = {
  "id": "community.VNStream",
  "version": "1.5.3",
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
      "extra": [
        { "name": "skip", "value": "24" }
      ]
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

    .btn-secondary {
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-glass);
      color: var(--text-main);
      padding: 0.85rem 1.5rem;
      border-radius: 16px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      transition: all 0.3s ease;
      text-decoration: none;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
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
        <p>Chọn bất kỳ bộ phim nào bên dưới, nhấn <b>"Mở Trong KFilms App"</b> để tự động thêm phim vào Mediabox và thưởng thức ngay!</p>
      </div>
    </div>

    <div class="section-title">Danh Sách Phim Mới Cập Nhật</div>
    <div id="movieGrid" class="movie-grid">
      <div class="loading-spinner">Đang tải danh sách phim...</div>
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
            ▶ Mở Trong KFilms App
          </button>
          
          <button class="btn-secondary" onclick="copyKFilmsLink()">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            Sao Chép Link KFilms (kfilms://)
          </button>

          <a id="btnDirect" class="btn-secondary" href="#" target="_blank">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            Xem Trực Tiếp Trên Web / Player
          </a>
        </div>
      </div>
    </div>
  </div>

  <div id="toast" class="toast">Đã sao chép link kfilms:// thành công!</div>

  <script>
    let currentMovie = null;

    async function loadMovies(search = '') {
      const grid = document.getElementById('movieGrid');
      grid.innerHTML = '<div class="loading-spinner">Đang tải danh sách phim...</div>';
      
      try {
        let url = '/catalog/movie/vnstream-top.json';
        if (search) {
          url = '/catalog/movie/vnstream-vietsub/search=' + encodeURIComponent(search) + '.json';
        }
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (!data.metas || data.metas.length === 0) {
          grid.innerHTML = '<div class="loading-spinner">Không tìm thấy phim nào.</div>';
          return;
        }

        grid.innerHTML = data.metas.map(movie => \`
          <div class="movie-card" onclick="openMovieDetail('\${movie.id}')">
            <div class="poster-wrapper">
              <img class="poster-img" src="\${movie.poster}" alt="\${movie.name}" loading="lazy">
              <div class="play-overlay">
                <div class="btn-play-icon">
                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
              </div>
            </div>
            <div class="movie-info">
              <div class="movie-title">\${movie.name}</div>
              <div class="movie-meta">\${movie.description || 'Vietsub'}</div>
            </div>
          </div>
        \`).join('');
      } catch (err) {
        grid.innerHTML = '<div class="loading-spinner">Lỗi khi tải dữ liệu phim.</div>';
      }
    }

    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadMovies(e.target.value.trim());
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
        currentMovie = movie;

        document.getElementById('modalTitle').innerText = movie.name;
        document.getElementById('modalSub').innerText = (movie.genres ? movie.genres.join(', ') : '') + ' • ' + (movie.releaseInfo || '');
        document.getElementById('modalDesc').innerText = movie.description || 'Chưa có mô tả chi tiết cho phim này.';
        document.getElementById('modalPoster').src = movie.poster;
        document.getElementById('modalBg').src = movie.background || movie.poster;

        const directPlayUrl = 'https://' + window.location.hostname + '/play/' + movie.id;
        document.getElementById('btnDirect').href = directPlayUrl;
      } catch (err) {
        document.getElementById('modalTitle').innerText = 'Lỗi thông tin';
      }
    }

    function closeModal() {
      document.getElementById('movieModal').classList.remove('active');
    }

    function openInKFilms() {
      if (!currentMovie) return;
      const domainHost = window.location.hostname;
      const playUrl = 'https://' + domainHost + '/play/' + currentMovie.id;
      const kfilmsUrl = 'kfilms://' + playUrl + '?kfname=' + encodeURIComponent(currentMovie.name);

      window.location.href = kfilmsUrl;
      showToast('Đang kích hoạt ứng dụng KFilms...');
    }

    function copyKFilmsLink() {
      if (!currentMovie) return;
      const domainHost = window.location.hostname;
      const playUrl = 'https://' + domainHost + '/play/' + currentMovie.id;
      const kfilmsUrl = 'kfilms://' + playUrl + '?kfname=' + encodeURIComponent(currentMovie.name);

      navigator.clipboard.writeText(kfilmsUrl);
      showToast('Đã copy link: ' + kfilmsUrl);
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    loadMovies();
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

    if (path.startsWith('/play/') || path === '/play') {
      let slug = path.replace('/play/', '').replace('/play', '');
      if (!slug && url.searchParams.has('id')) {
        slug = url.searchParams.get('id');
      }

      if (!slug) {
        return new Response('Missing movie ID', { status: 400 });
      }

      try {
        const res = await fetch(`${API_BASE}/phim/${slug}`, { headers: FETCH_HEADERS });
        if (!res.ok) {
          return new Response('Movie not found', { status: 404 });
        }

        const data = await res.json();
        let streamUrl = null;

        if (data.episodes && data.episodes.length > 0) {
          const episodeList = data.episodes[0].server_data || [];
          if (episodeList.length > 0) {
            streamUrl = episodeList[0].link_m3u8;
          }
        }

        if (!streamUrl) {
          return new Response('Stream link not found', { status: 404 });
        }

        return Response.redirect(streamUrl, 302);
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
        let fetchUrl = `${API_BASE}/danh-sach/phim-moi-cap-nhat?page=${page}`;
        if (searchQuery) {
          fetchUrl = `${API_BASE}/v1/api/tim-kiem?keyword=${encodeURIComponent(searchQuery)}&page=${page}`;
        }

        const res = await fetch(fetchUrl, { headers: FETCH_HEADERS });
        const data = await res.json();

        let items = [];
        if (data.items) {
          items = data.items;
        } else if (data.data && data.data.items) {
          items = data.data.items;
        }

        const metas = items.map((item) => {
          const posterUrl = item.poster_url?.startsWith('http')
            ? item.poster_url
            : `${API_BASE}/uploads/movies/${item.poster_url || item.thumb_url}`;

          return {
            id: item.slug,
            type: item.type === 'single' ? 'movie' : 'series',
            name: item.name,
            poster: posterUrl,
            description: `${item.origin_name} (${item.year || ''})`,
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
        const res = await fetch(`${API_BASE}/phim/${slug}`, { headers: FETCH_HEADERS });
        const data = await res.json();
        const movie = data.movie;

        if (!movie) {
          return new Response(JSON.stringify({ meta: null }), { headers: corsHeaders });
        }

        const posterUrl = movie.poster_url?.startsWith('http')
          ? movie.poster_url
          : `${API_BASE}/uploads/movies/${movie.poster_url || movie.thumb_url}`;

        const meta = {
          id: movie.slug,
          type: movie.type === 'single' ? 'movie' : 'series',
          name: movie.name,
          poster: posterUrl,
          background: movie.thumb_url?.startsWith('http')
            ? movie.thumb_url
            : `${API_BASE}/uploads/movies/${movie.thumb_url}`,
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
        const res = await fetch(`${API_BASE}/phim/${slug}`, { headers: FETCH_HEADERS });
        const data = await res.json();
        const movie = data.movie;

        const movieTitle = movie ? movie.name : slug;
        const domain = url.hostname;
        
        const playUrl = `https://${domain}/play/${slug}`;
        const kfilmsDeepLink = `kfilms://${domain}/play/${slug}?kfname=${encodeURIComponent(movieTitle)}`;

        const streams = [
          {
            name: 'FILMS ADDON',
            title: `Mở Trong KFilms App\n(Yêu cầu KFILMS Pro)\n${movieTitle}`,
            externalUrl: kfilmsDeepLink,
          },
          {
            name: 'Direct Stream',
            title: `Xem Trực Tiếp\n${movieTitle}`,
            url: playUrl,
          },
        ];

        return new Response(JSON.stringify({ streams }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ streams: [] }), { headers: corsHeaders });
      }
    }

    return new Response('FILMS ADDON Active', { status: 200, headers: corsHeaders });
  },
};
