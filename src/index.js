const API_BASE = 'https://phimapi.com';

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
      "name": "[VNStream] Mới cập nhật",
      "id": "vnstream-top",
      "extra": [
        { "name": "skip", "value": "24" },
        {
          "name": "genre",
          "optionsLimit": 16,
          "isRequired": false,
          "options": [
            "Hành Động", "Cổ Trang", "Chiến Tranh", "Viễn Tưởng", "Kinh Dị", "Tài Liệu",
            "Bí Ẩn", "Tình Cảm", "Tâm Lý", "Thể Thao", "Phiêu Lưu", "Âm Nhạc", "Gia Đình",
            "Học Đường", "Hài Hước", "Hình Sự", "Võ Thuật", "Khoa Học", "Thần Thoại", "Chính Kịch", "Kinh Điển"
          ]
        }
      ]
    },
    {
      "type": "movie",
      "name": "[VNStream] Phụ đề",
      "id": "vnstream-vietsub",
      "extra": [
        { "name": "skip", "value": "24" },
        { "name": "search" },
        {
          "name": "genre",
          "optionsLimit": 16,
          "isRequired": false,
          "options": [
            "Hành Động", "Cổ Trang", "Chiến Tranh", "Viễn Tưởng", "Kinh Dị", "Tài Liệu",
            "Bí Ẩn", "Tình Cảm", "Tâm Lý", "Thể Thao", "Phiêu Lưu", "Âm Nhạc", "Gia Đình",
            "Học Đường", "Hài Hước", "Hình Sự", "Võ Thuật", "Khoa Học", "Thần Thoại", "Chính Kịch", "Kinh Điển"
          ]
        }
      ]
    },
    {
      "type": "series",
      "name": "[VNStream] Mới cập nhật",
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
  "name": "VNStream",
  "description": "Xem phim hay Vietsub, thuyết minh, lồng tiếng tổng hợp từ nhiều nguồn miễn phí | Popular Vietsub Movies and TV shows",
  "logo": "https://films-addon.pages.dev/static/logo@256.png",
  "background": "https://films-addon.pages.dev/static/background.png"
};

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

    // 1. Manifest Endpoint
    if (path === '/manifest.json' || path === '/guest/manifest.json') {
      return new Response(JSON.stringify(manifest), { headers: corsHeaders });
    }

    // 2. Resolve Link & Redirect 302 to real m3u8 stream link
    // Route: /play/:id or /play?id=:id
    if (path.startsWith('/play/') || path === '/play') {
      let slug = path.replace('/play/', '').replace('/play', '');
      if (!slug && url.searchParams.has('id')) {
        slug = url.searchParams.get('id');
      }

      if (!slug) {
        return new Response('Missing movie ID', { status: 400 });
      }

      try {
        const res = await fetch(`${API_BASE}/phim/${slug}`);
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

        // 302 Redirect directly to real m3u8 link
        return Response.redirect(streamUrl, 302);
      } catch (err) {
        return new Response(`Error resolving stream: ${err.message}`, { status: 500 });
      }
    }

    // 3. Catalog Endpoint (/catalog/:type/:id.json or /catalog/:type/:id/:extra.json)
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

        const res = await fetch(fetchUrl);
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

    // 4. Meta Endpoint (/meta/:type/:id.json)
    if (path.startsWith('/meta/')) {
      const parts = path.replace('.json', '').split('/');
      const type = parts[2];
      const slug = parts[3];

      try {
        const res = await fetch(`${API_BASE}/phim/${slug}`);
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

        if (movie.episodes && movie.episodes.length > 0) {
          const videos = [];
          movie.episodes.forEach((epGroup) => {
            (epGroup.server_data || []).forEach((ep) => {
              videos.push({
                id: `${movie.slug}:${ep.slug}`,
                title: ep.name,
                released: new Date().toISOString(),
              });
            });
          });
          meta.videos = videos;
        }

        return new Response(JSON.stringify({ meta }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ meta: null }), { headers: corsHeaders });
      }
    }

    // 5. Stream Endpoint (/stream/:type/:id.json)
    if (path.startsWith('/stream/')) {
      const parts = path.replace('.json', '').split('/');
      const idStr = parts[3];
      const slug = idStr.split(':')[0];

      try {
        const res = await fetch(`${API_BASE}/phim/${slug}`);
        const data = await res.json();
        const movie = data.movie;

        const movieTitle = movie ? movie.name : slug;

        // Dynamic domain (e.g. films-addon.pages.dev or films-addon.kollersi.workers.dev)
        const domain = url.hostname;
        
        // Deep Link Scheme requirement: kfilms://{domain}/play/:id?kfname=...
        const playUrl = `https://${domain}/play/${slug}`;
        const kfilmsDeepLink = `kfilms://${domain}/play/${slug}?kfname=${encodeURIComponent(movieTitle)}`;

        const streams = [
          {
            name: 'KFilms Pro',
            title: `Thêm & Mở trên KFilms App\n${movieTitle}`,
            externalUrl: kfilmsDeepLink,
          },
          {
            name: 'KFilms Direct',
            title: `Xem Trực Tiếp (VLC / PotPlayer / Stremio)\n${movieTitle}`,
            url: playUrl,
          },
        ];

        return new Response(JSON.stringify({ streams }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ streams: [] }), { headers: corsHeaders });
      }
    }

    return new Response('KFilms VNStream Addon Active', { status: 200, headers: corsHeaders });
  },
};
