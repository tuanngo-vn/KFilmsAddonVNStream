import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const AD_REGEX = /(?:^|\/|\.|\?|=|_|-)(?:ad|ads|qc|quangcao|quang_cao|promo|banner|intro|doubleclick|sponsor|bet88|fb88|789bet|okvip|hi88|jun88|shbet|new88|kubet|f8bet|bk8|88bet|nha-cai|nha_cai|song-bai|go88|sunwin|w88|fun88|dafabet|hitclub|rikvip|79king|b52|cwin|m88|12bet|188bet|v8club|ee88|789club|99ok|kg88|mb66|zoo88|6686|123b|888b|bj88|mu88|royal88|tf88|sbotop|king88|hello88|88clb|v9bet|win79|vinwin|k9win|iwin|k8|fi88)\b/i;

function extractCleanUrl(rawUrl) {
  if (!rawUrl) return '';
  const match = rawUrl.match(/^(https?:\/\/[^\s?#]+\.m3u8)/i);
  if (match) return match[1];
  try {
    const u = new URL(rawUrl);
    u.searchParams.delete('kfname');
    u.searchParams.delete('kftype');
    u.searchParams.delete('kfid');
    u.searchParams.delete('kfep');
    return u.toString();
  } catch (e) {
    return rawUrl.split('?kfname=')[0].split('&kfname=')[0];
  }
}

function rewriteM3u8Content(content, baseUrl, proxyHost) {
  const lines = content.split(/\r?\n/);
  const isMaster = content.includes('#EXT-X-STREAM-INF');

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
          const proxiedVariantUrl = `https://${proxyHost}/m3u8-proxy?url=${encodeURIComponent(absVariantUrl)}`;
          resultLines.push(proxiedVariantUrl);
        }
      } else {
        resultLines.push(lines[i]);
      }
    }
    return resultLines.join('\n');
  }

  const outputLines = [];
  let pendingTags = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#')) {
      pendingTags.push(line);
    } else {
      let absSegmentUrl;
      try {
        absSegmentUrl = new URL(line, baseUrl).href;
      } catch (e) {
        absSegmentUrl = line;
      }

      const isAdSegment = AD_REGEX.test(absSegmentUrl) || pendingTags.some(tag => AD_REGEX.test(tag));

      if (!isAdSegment) {
        outputLines.push(...pendingTags);
        outputLines.push(absSegmentUrl);
      }
      pendingTags = [];
    }
  }

  if (pendingTags.length > 0) {
    const endTags = pendingTags.filter(t => t.startsWith('#EXT-X-ENDLIST') || t.startsWith('#EXT-X-INDEPENDENT-SEGMENTS'));
    outputLines.push(...endTags);
  }

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

app.get('/health', (req, res) => {
  res.send('M3U8 VN Proxy Server Active');
});

app.get('/m3u8-proxy', async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl) {
    return res.status(400).send('Missing url parameter');
  }

  const cleanTargetUrl = extractCleanUrl(rawUrl);
  let targetObj;
  try {
    targetObj = new URL(cleanTargetUrl);
  } catch (e) {
    return res.status(400).send(`Invalid target URL: ${cleanTargetUrl}`);
  }

  const headerConfigs = [
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*'
    },
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://phimapi.com/',
      'Accept': '*/*'
    },
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': targetObj.origin + '/',
      'Accept': '*/*'
    }
  ];

  let fetchRes = null;
  let lastStatus = 500;

  for (const headers of headerConfigs) {
    try {
      const response = await fetch(cleanTargetUrl, { headers });
      if (response.ok) {
        fetchRes = response;
        break;
      }
      lastStatus = response.status;
    } catch (err) {
      // Continue
    }
  }

  if (!fetchRes) {
    return res.status(lastStatus).send(`Upstream fetch failed with status ${lastStatus}`);
  }

  try {
    const text = await fetchRes.text();
    const proxyHost = req.get('host');
    const cleanText = rewriteM3u8Content(text, cleanTargetUrl, proxyHost);

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(cleanText);
  } catch (err) {
    return res.status(500).send(`Proxy processing error: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`M3U8 VN Proxy Server running on port ${PORT}`);
});
