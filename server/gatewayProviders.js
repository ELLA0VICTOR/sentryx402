const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 8;

function normalizeQuery(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function parseLimit(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.round(parsed), 1), MAX_LIMIT);
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtmlLoose(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTitleAndPublisher(title) {
  const normalized = stripHtml(title);
  const parts = normalized.split(" - ");

  if (parts.length < 2) {
    return {
      publisher: "",
      title: normalized,
    };
  }

  return {
    publisher: parts[parts.length - 1],
    title: parts.slice(0, -1).join(" - "),
  };
}

function getHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
}

function uniqueItems(items) {
  const seen = new Set();

  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) {
      return false;
    }

    seen.add(item.url);
    return true;
  });
}

function getByPath(value, path) {
  if (!path) {
    return value;
  }

  return String(path)
    .split(".")
    .filter(Boolean)
    .reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), value);
}

function formatCompactNumber(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: parsed >= 1000 ? 0 : 2,
    notation: parsed >= 1000 ? "compact" : "standard",
  }).format(parsed);
}

function formatCurrency(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: parsed >= 100 ? 0 : 2,
    style: "currency",
  }).format(parsed);
}

function formatPercent(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return "n/a";
  }

  return `${parsed >= 0 ? "+" : ""}${parsed.toFixed(2)}%`;
}

function createJsonPreview(value) {
  const preview = JSON.stringify(value);

  if (!preview) {
    return "Structured JSON response.";
  }

  return preview.length > 180 ? `${preview.slice(0, 177)}...` : preview;
}

function deriveItemTitle(item, index) {
  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    return `Result ${index + 1}`;
  }

  return (
    item?.title ||
    item?.name ||
    item?.full_name ||
    item?.symbol ||
    item?.id ||
    item?.key ||
    `Result ${index + 1}`
  );
}

function deriveItemSnippet(item) {
  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    return String(item);
  }

  return (
    item?.description ||
    item?.summary ||
    item?.snippet ||
    item?.headline ||
    item?.body ||
    item?.message ||
    item?.overview ||
    createJsonPreview(item)
  );
}

function deriveItemUrl(item, fallbackUrl) {
  if (!item || typeof item !== "object") {
    return fallbackUrl;
  }

  return item.html_url || item.url || item.link || item.external_url || item.homepage || fallbackUrl;
}

function deriveItemMeta(item, fallbackUrl) {
  if (!item || typeof item !== "object") {
    return getHost(fallbackUrl);
  }

  return item.updated_at || item.language || item.type || item.symbol || getHost(deriveItemUrl(item, fallbackUrl));
}

function buildResultSummary(kind, query, items) {
  const first = items?.[0];

  if (!first) {
    return kind === "news"
      ? `No current news matches were found for "${query}".`
      : `No search matches were found for "${query}".`;
  }

  return kind === "news"
    ? `Top current result for "${query}": ${first.title}.`
    : `Best search match for "${query}": ${first.title}.`;
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Gateway provider returned ${response.status}`);
  }

  return response.json();
}

async function fetchText(url, init) {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Gateway provider returned ${response.status}`);
  }

  return response.text();
}

function extractDuckDuckGoUrl(href) {
  const value = decodeHtmlEntities(href || "").replace(/^\/\//, "https://");

  try {
    const resolved = new URL(value);
    const uddg = resolved.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : resolved.toString();
  } catch {
    return value;
  }
}

function parseDuckDuckGoHtml(html, limit) {
  const pattern =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  const items = [];
  let match;

  while ((match = pattern.exec(html)) && items.length < limit) {
    const url = extractDuckDuckGoUrl(match[1]);
    const title = stripHtml(match[2]);
    const snippet = stripHtml(match[3]);

    if (!url || !title) {
      continue;
    }

    items.push({
      id: `${items.length}-${url}`,
      meta: getHost(url),
      snippet,
      title,
      url,
    });
  }

  return uniqueItems(items);
}

async function runDuckDuckGoSearch(query, limit) {
  const params = new URLSearchParams({ q: query });
  const html = await fetchText(`https://html.duckduckgo.com/html/?${params.toString()}`, {
    headers: {
      "User-Agent": "Sentryx402/1.0 (+Stellar x402 demo)",
    },
  });

  const items = parseDuckDuckGoHtml(html, limit);

  return {
    itemCount: items.length,
    items,
    limit,
    provider: "DuckDuckGo Search",
    query,
    source: "duckduckgo",
  };
}

async function runWikipediaSearch(query, limit) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    list: "search",
    origin: "*",
    srlimit: String(limit),
    srsearch: query,
    utf8: "1",
  });

  const data = await fetchJson(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
  const items = (data?.query?.search || []).map((item) => ({
    id: String(item.pageid || item.title),
    meta: "wikipedia.org",
    snippet: stripHtmlLoose(item.snippet),
    title: item.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(item.title || "").replace(/\s+/g, "_"))}`,
  }));

  return {
    itemCount: items.length,
    items,
    limit,
    provider: "Wikipedia Search",
    query,
    source: "wikipedia",
  };
}

async function runBraveSearch(query, limit, apiKey) {
  const params = new URLSearchParams({
    count: String(limit),
    q: query,
    search_lang: "en",
    text_decorations: "false",
  });

  const data = await fetchJson(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  const items = (data?.web?.results || []).map((item, index) => ({
    id: String(item?.profile?.name || item?.url || index),
    meta: getHost(item.url),
    snippet: stripHtmlLoose(item.description),
    title: item.title || item.url || "Untitled result",
    url: item.url,
  }));

  return {
    itemCount: items.length,
    items,
    limit,
    provider: "Brave Search",
    query,
    source: "brave",
  };
}

function parseGoogleNewsRss(xml, limit) {
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  const items = [];
  let match;

  while ((match = itemPattern.exec(xml)) && items.length < limit) {
    const block = match[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "";
    const url = stripHtml(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "");
    const snippet = stripHtmlLoose(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "");
    const publisher =
      stripHtmlLoose(block.match(/<font[^>]*>([\s\S]*?)<\/font>/i)?.[1] || "") ||
      splitTitleAndPublisher(title).publisher ||
      getHost(url);
    const normalizedTitle = splitTitleAndPublisher(title).title;

    if (!normalizedTitle || !url) {
      continue;
    }

    items.push({
      id: `${items.length}-${url}`,
      meta: publisher,
      snippet,
      title: normalizedTitle,
      url,
    });
  }

  return uniqueItems(items);
}

async function runGoogleNewsSearch(query, limit) {
  const params = new URLSearchParams({
    ceid: "US:en",
    gl: "US",
    hl: "en-US",
    q: query,
  });

  const xml = await fetchText(`https://news.google.com/rss/search?${params.toString()}`, {
    headers: {
      "User-Agent": "Sentryx402/1.0 (+Stellar x402 demo)",
    },
  });
  const items = parseGoogleNewsRss(xml, limit);

  return {
    itemCount: items.length,
    items,
    limit,
    provider: "Google News RSS",
    query,
    source: "google_news",
  };
}

async function runHackerNewsSearch(query, limit) {
  const params = new URLSearchParams({
    hitsPerPage: String(limit),
    query,
    tags: "story",
  });

  const data = await fetchJson(`https://hn.algolia.com/api/v1/search_by_date?${params.toString()}`);
  const items = (data?.hits || []).map((item, index) => ({
    id: String(item.objectID || index),
    meta: item.author ? `@${item.author}` : "news.ycombinator.com",
    snippet: stripHtmlLoose(item.story_text || item.comment_text || item.title),
    title: item.title || item.story_title || "Untitled story",
    url: item.url || item.story_url || `https://news.ycombinator.com/item?id=${item.objectID}`,
  }));

  return {
    itemCount: items.length,
    items,
    limit,
    provider: "Hacker News Search",
    query,
    source: "hacker_news",
  };
}

async function runGitHubRepoProfile(input, limit) {
  const [owner, repo] = input.split("/");

  if (!owner || !repo) {
    throw new Error("GitHub repo input should look like owner/repo.");
  }

  const data = await fetchJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Sentryx402/1.0 (+Stellar x402 demo)",
    },
  });

  const repoUrl = data.html_url || `https://github.com/${owner}/${repo}`;
  const issuesUrl = `${repoUrl}/issues`;

  const items = [
    {
      id: `${data.full_name}-overview`,
      meta: "github.com",
      snippet: data.description || "Repository metadata fetched through the paid API gateway.",
      title: data.full_name || `${owner}/${repo}`,
      url: repoUrl,
    },
    {
      id: `${data.full_name}-activity`,
      meta: "repo activity",
      snippet: `Stars ${formatCompactNumber(data.stargazers_count)} / forks ${formatCompactNumber(data.forks_count)} / last push ${new Date(
        data.pushed_at || data.updated_at || Date.now(),
      ).toLocaleDateString()}`,
      title: "Repository activity snapshot",
      url: `${repoUrl}/pulse`,
    },
    {
      id: `${data.full_name}-issues`,
      meta: "open issues",
      snippet: `${formatCompactNumber(data.open_issues_count)} open issues / default branch ${data.default_branch || "main"} / language ${
        data.language || "n/a"
      }`,
      title: "Issue and branch state",
      url: issuesUrl,
    },
    {
      id: `${data.full_name}-topics`,
      meta: "topics",
      snippet: (data.topics || []).length
        ? data.topics.join(", ")
        : "No public topics were attached to this repository.",
      title: "Repository topics",
      url: `${repoUrl}/topics`,
    },
  ].slice(0, limit);

  return {
    input,
    itemCount: items.length,
    items,
    limit,
    profileId: "github_repo",
    profileName: "GitHub Repository",
    provider: "GitHub Repo API",
    query: `github_repo:${input}`,
    source: "github_api",
  };
}

async function runStellarAccountProfile(input, limit) {
  const data = await fetchJson(`https://horizon-testnet.stellar.org/accounts/${encodeURIComponent(input)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Sentryx402/1.0 (+Stellar x402 demo)",
    },
  });

  const explorerUrl = `https://stellar.expert/explorer/testnet/account/${input}`;
  const balanceItems = (data.balances || [])
    .slice(0, Math.max(1, limit - 2))
    .map((balance, index) => {
      const assetCode = balance.asset_type === "native" ? "XLM" : balance.asset_code || balance.asset_type;
      const issuer = balance.asset_issuer ? ` / ${balance.asset_issuer.slice(0, 6)}...${balance.asset_issuer.slice(-4)}` : "";

      return {
        id: `${input}-balance-${index}`,
        meta: assetCode,
        snippet: `Balance ${balance.balance}${issuer}`,
        title: `${assetCode} balance`,
        url: explorerUrl,
      };
    });

  const items = [
    {
      id: `${input}-summary`,
      meta: "horizon-testnet",
      snippet: `${(data.balances || []).length} balances / ${(data.signers || []).length} signers / sequence ${data.sequence || "n/a"}`,
      title: "Account summary",
      url: explorerUrl,
    },
    ...balanceItems,
    {
      id: `${input}-thresholds`,
      meta: "thresholds",
      snippet: `Low ${data.thresholds?.low_threshold ?? "n/a"} / medium ${data.thresholds?.med_threshold ?? "n/a"} / high ${
        data.thresholds?.high_threshold ?? "n/a"
      }`,
      title: "Signer thresholds",
      url: explorerUrl,
    },
  ].slice(0, limit);

  return {
    input,
    itemCount: items.length,
    items,
    limit,
    profileId: "stellar_account",
    profileName: "Stellar Testnet Account",
    provider: "Stellar Horizon API",
    query: `stellar_account:${input}`,
    source: "stellar_horizon",
  };
}

async function runMarketSnapshotProfile(input, limit) {
  const params = new URLSearchParams({
    ids: input,
    order: "market_cap_desc",
    page: "1",
    per_page: "1",
    price_change_percentage: "24h",
    sparkline: "false",
    vs_currency: "usd",
  });

  const data = await fetchJson(`https://api.coingecko.com/api/v3/coins/markets?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Sentryx402/1.0 (+Stellar x402 demo)",
    },
  });

  const coin = data?.[0];

  if (!coin) {
    throw new Error("No market snapshot was found for that asset id.");
  }

  const coinUrl = `https://www.coingecko.com/en/coins/${coin.id}`;
  const items = [
    {
      id: `${coin.id}-price`,
      meta: coin.symbol?.toUpperCase() || "market",
      snippet: `Current price ${formatCurrency(coin.current_price)} / 24h change ${formatPercent(
        coin.price_change_percentage_24h_in_currency,
      )}`,
      title: `${coin.name} price snapshot`,
      url: coinUrl,
    },
    {
      id: `${coin.id}-market-cap`,
      meta: "market cap",
      snippet: `Market cap ${formatCurrency(coin.market_cap)} / rank ${coin.market_cap_rank || "n/a"}`,
      title: "Market cap and rank",
      url: coinUrl,
    },
    {
      id: `${coin.id}-range`,
      meta: "24h range",
      snippet: `Low ${formatCurrency(coin.low_24h)} / high ${formatCurrency(coin.high_24h)} / volume ${formatCurrency(
        coin.total_volume,
      )}`,
      title: "Range and volume",
      url: coinUrl,
    },
  ].slice(0, limit);

  return {
    input,
    itemCount: items.length,
    items,
    limit,
    profileId: "market_snapshot",
    profileName: "Market Snapshot",
    provider: "CoinGecko API",
    query: `market_snapshot:${input}`,
    source: "coingecko",
  };
}

async function runCustomHttpProfile(definition, input, limit) {
  const requestUrl = definition.urlTemplate.replaceAll("{input}", encodeURIComponent(input));
  const data = await fetchJson(requestUrl, {
    headers: {
      Accept: "application/json",
      ...(definition.apiKeyHeaderName && definition.apiKeyValue
        ? { [definition.apiKeyHeaderName]: definition.apiKeyValue }
        : {}),
    },
  });

  const selected = getByPath(data, definition.responsePath);
  const source = Array.isArray(selected) ? selected : selected && typeof selected === "object" ? [selected] : [data];
  const items = source.slice(0, limit).map((item, index) => ({
    id: `${definition.id}-${index}`,
    meta: deriveItemMeta(item, requestUrl),
    snippet: deriveItemSnippet(item),
    title: deriveItemTitle(item, index),
    url: deriveItemUrl(item, requestUrl),
  }));

  return {
    input,
    itemCount: items.length,
    items,
    limit,
    profileId: definition.id,
    profileName: definition.name,
    provider: definition.name,
    query: `${definition.id}:${input}`,
    source: "custom_http",
  };
}

async function runSearchGateway(query, limit, braveSearchApiKey) {
  if (braveSearchApiKey) {
    const brave = await runBraveSearch(query, limit, braveSearchApiKey);
    if (brave.itemCount > 0) {
      return {
        ...brave,
        summary: buildResultSummary("search", query, brave.items),
      };
    }
  }

  const duck = await runDuckDuckGoSearch(query, limit);
  if (duck.itemCount > 0) {
    return {
      ...duck,
      summary: buildResultSummary("search", query, duck.items),
    };
  }

  const wiki = await runWikipediaSearch(query, limit);
  return {
    ...wiki,
    summary: buildResultSummary("search", query, wiki.items),
  };
}

async function runNewsGateway(query, limit) {
  const google = await runGoogleNewsSearch(query, limit);
  if (google.itemCount > 0) {
    return {
      ...google,
      summary: buildResultSummary("news", query, google.items),
    };
  }

  const hackerNews = await runHackerNewsSearch(query, limit);
  return {
    ...hackerNews,
    summary: buildResultSummary("news", query, hackerNews.items),
  };
}

async function runApiGateway(profileId, input, limit, customGatewayDefinitions = []) {
  if (profileId === "github_repo") {
    return runGitHubRepoProfile(input, limit);
  }

  if (profileId === "stellar_account") {
    return runStellarAccountProfile(input, limit);
  }

  if (profileId === "market_snapshot") {
    return runMarketSnapshotProfile(input, limit);
  }

  const customDefinition = customGatewayDefinitions.find((item) => item.id === profileId);

  if (customDefinition) {
    return runCustomHttpProfile(customDefinition, input, limit);
  }

  throw new Error("Unknown API profile.");
}

export async function runGatewayQuery({ braveSearchApiKey, customGatewayDefinitions = [], input, limit, profileId, query, serviceId }) {
  const normalizedLimit = parseLimit(limit);

  try {
    let result;

    if (serviceId === "api_gateway") {
      const normalizedInput = normalizeQuery(input);

      if (!profileId) {
        return {
          ok: false,
          status: 400,
          message: "API profile is required.",
        };
      }

      if (!normalizedInput) {
        return {
          ok: false,
          status: 400,
          message: "API input is required.",
        };
      }

      result = await runApiGateway(profileId, normalizedInput, normalizedLimit, customGatewayDefinitions);
    } else {
      const normalizedQuery = normalizeQuery(query);

      if (!normalizedQuery) {
        return {
          ok: false,
          status: 400,
          message: "Query is required.",
        };
      }

      result =
        serviceId === "news_gateway"
          ? await runNewsGateway(normalizedQuery, normalizedLimit)
          : await runSearchGateway(normalizedQuery, normalizedLimit, braveSearchApiKey);
    }

    return {
      ok: true,
      result,
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      message: error instanceof Error ? error.message : "Gateway request failed.",
    };
  }
}
