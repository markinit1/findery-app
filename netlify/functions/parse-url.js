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
        $('title').first().text() ||
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
