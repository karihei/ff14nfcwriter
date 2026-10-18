const CHARACTER_PATH = /^\/api\/character\/(\d+)\/?$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(CHARACTER_PATH);

    if (match) {
      return lookupCharacter(match[1]);
    }

    return env.ASSETS.fetch(request);
  },
};

async function lookupCharacter(id) {
  const lodestoneUrl = `https://jp.finalfantasyxiv.com/lodestone/character/${id}/`;

  let res;
  try {
    res = await fetch(lodestoneUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });
  } catch (err) {
    return jsonResponse({ found: false, error: "lodestone_unreachable" }, 502);
  }

  if (res.status !== 200) {
    return jsonResponse({ found: false });
  }

  const html = await res.text();
  const nameMatch = html.match(/class="frame__chara__name">([^<]+)<\/p>/);

  if (!nameMatch) {
    return jsonResponse({ found: false });
  }

  const imageMatch = html.match(/js__image_popup"><img src="([^"]+)"/);

  return jsonResponse({
    found: true,
    name: decodeHtmlEntities(nameMatch[1].trim()),
    imageUrl: imageMatch ? imageMatch[1] : null,
  });
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
