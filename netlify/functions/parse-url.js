const cheerio = require('cheerio');

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return respond(405, { success: false, reason: 'method_not_allowed' });
  }

  let targetUrl;
  try {
    const body = JSON.parse(event.body || '{}');
    targetUrl = body.url;
  } catch (e) {
    return respond(400, { success: false, reason: 'bad_request' });
  }

  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return respond(400, { success: false, reason: 'invalid_url' });
  }

  let html;
  try {
    const pageResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': DESKTOP_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow'
    });

    if (!pageResponse.ok) {
      return respond(200, { success: false, reason: 'fetch_failed', status: pageResponse.status });
    }
    html = await pageResponse.text();
  } catch (err) {
    return respond(200, { success: false, reason: 'network_error' });
  }

  try {
    const $ = cheerio.load(html);
    const result = { name: null, price: null, imageUrl: null, store: null };

    // ----- 1. JSON-LD Product schema (most reliable when present) -----
    $('script[type="application/ld+json"]').each((_, el) => {
      if (result.name && result.price && result.imageUrl) return;
      let parsed;
      try {
        parsed = JSON.parse($(el).contents().text());
      } catch (e) {
        return;
      }
      const candidates = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of candidates) {
        const nodes = item['@graph'] ? item['@graph'] : [item];
        for (const node of nodes) {
          const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
          if (!types.includes('Product')) continue;

          if (!result.name && typeof node.name === 'string') {
            result.name = node.name;
          }
          if (!result.imageUrl && node.image) {
            if (typeof node.image === 'string') result.imageUrl = node.image;
            else if (Array.isArray(node.image) && node.image.length) {
              result.imageUrl = typeof node.image[0] === 'string' ? node.image[0] : node.image[0].url;
            } else if (node.image.url) {
              result.imageUrl = node.image.url;
            }
          }
          if (!result.price && node.offers) {
            const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
            if (offer && offer.price) result.price = offer.price;
          }
        }
      }
    });

    // ----- 2. Open Graph / meta tag fallbacks -----
    if (!result.name) {
      result.name =
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        null;
    }
    if (!result.imageUrl) {
      result.imageUrl =
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') ||
        null;
    }
    if (!result.price) {
      result.price =
        $('meta[property="product:price:amount"]').attr('content') ||
        $('meta[property="og:price:amount"]').attr('content') ||
        null;
    }

    // ----- 3. Microdata fallback (schema.org itemprop attributes, common on eBay and older platforms) -----
    if (!result.price) {
      const priceEl = $('[itemprop="price"]').first();
      if (priceEl.length) {
        result.price = priceEl.attr('content') || priceEl.text();
      }
    }

    // ----- 4. Plain page content fallback, for sites with little/no metadata -----
    // Strip elements unlikely to contain the product's own name/price so we don't
    // pick up navigation links, ads, or unrelated prices from "related items" sections.
    const $content = cheerio.load(html);
    $content('script, style, nav, header, footer, noscript').remove();

    if (!result.name) {
      result.name = $content('h1').first().text() || $('title').first().text() || null;
    }

    if (!result.imageUrl) {
      let fallbackImg = null;
      $content('img').each((_, el) => {
        if (fallbackImg) return;
        const src = $content(el).attr('src') || $content(el).attr('data-src');
        if (!src) return;
        // Skip obvious non-product images (logos, icons, tracking pixels).
        if (/logo|icon|sprite|spacer|pixel|avatar/i.test(src)) return;
        fallbackImg = src;
      });
      if (fallbackImg) {
        try {
          result.imageUrl = new URL(fallbackImg, targetUrl).href;
        } catch (e) {
          result.imageUrl = fallbackImg;
        }
      }
    }

    if (!result.price) {
      const bodyText = $content('body').text();
      // Prefer an explicit "US $X.XX" style match (common on eBay) before a bare "$X.XX".
      const usMatch = bodyText.match(/US\s?\$\s?[\d,]+\.\d{2}/);
      const allMatches = bodyText.match(/\$\s?\d{1,5}(?:,\d{3})*(?:\.\d{2})?/g);

      if (usMatch) {
        result.price = usMatch[0];
      } else if (allMatches && allMatches.length) {
        // If the same price repeats (e.g. across product variants), trust the
        // most frequent value; otherwise fall back to the first one found.
        const counts = {};
        allMatches.forEach(m => { counts[m] = (counts[m] || 0) + 1; });
        result.price = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      }
    }

    // Normalize price to a plain number
    if (result.price) {
      const match = String(result.price).match(/[\d,.]+/);
      result.price = match ? parseFloat(match[0].replace(/,/g, '')) : null;
    }

    // Guess a store name from the hostname
    try {
      const host = new URL(targetUrl).hostname.replace(/^www\./, '');
      if (host.includes('amazon')) result.store = 'Amazon';
      else if (host.includes('ebay')) result.store = 'eBay';
      else {
        const label = host.split('.')[0];
        result.store = label.charAt(0).toUpperCase() + label.slice(1);
      }
    } catch (e) {
      result.store = null;
    }

    if (result.name) {
      result.name = result.name.trim().replace(/\s+/g, ' ').slice(0, 200);
    }

    const foundAnything = !!(result.name || result.price || result.imageUrl);
    return respond(200, { success: foundAnything, ...result });

  } catch (err) {
    return respond(200, { success: false, reason: 'parse_error' });
  }
};

function respond(statusCode, bodyObj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyObj)
  };
}
