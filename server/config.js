import { config as loadEnv } from "dotenv";
import {
  getNetworkPassphrase,
  getRpcUrl,
  getUsdcAddress,
  validateStellarDestinationAddress,
} from "@x402/stellar";

loadEnv({ quiet: true });

const DEFAULT_NETWORK = "stellar:testnet";
const DEFAULT_PORT = 4021;

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseUsdValue(price) {
  const match = String(price).match(/[\d.]+/);

  if (!match) {
    return 0;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildGatewayService({ description, id, method, name, path, price, profiles = [], publicOrigin, upstream }) {
  return {
    id,
    name,
    method,
    path,
    route: `${publicOrigin}${path}`,
    description,
    price,
    priceUsd: parseUsdValue(price),
    profiles,
    upstream,
  };
}

export function createAppConfig() {
  const network = process.env.STELLAR_NETWORK?.trim() || DEFAULT_NETWORK;
  const port = parseNumber(process.env.PORT, DEFAULT_PORT);
  const publicOrigin = process.env.PUBLIC_APP_ORIGIN?.trim() || `http://localhost:${port}`;
  const rpcUrl = process.env.STELLAR_RPC_URL?.trim() || getRpcUrl(network);
  const facilitatorUrl =
    process.env.X402_FACILITATOR_URL?.trim() ||
    (network === "stellar:testnet"
      ? "https://channels.openzeppelin.com/x402/testnet"
      : "https://channels.openzeppelin.com/x402");
  const facilitatorApiKey = process.env.X402_FACILITATOR_API_KEY?.trim() || "";
  const payTo = process.env.STELLAR_PAY_TO?.trim() || "";
  const tavilyApiKey = process.env.TAVILY_API_KEY?.trim() || "";
  const braveSearchApiKey = process.env.BRAVE_SEARCH_API_KEY?.trim() || "";
  const networkPassphrase = getNetworkPassphrase(network);
  const asset = getUsdcAddress(network);

  const searchPrice = process.env.X402_SEARCH_PRICE?.trim() || process.env.X402_PRICE?.trim() || "$0.01";
  const newsPrice = process.env.X402_NEWS_PRICE?.trim() || "$0.02";
  const missingConfiguration = [];

  if (!facilitatorApiKey) {
    missingConfiguration.push("X402_FACILITATOR_API_KEY");
  }

  if (!payTo) {
    missingConfiguration.push("STELLAR_PAY_TO");
  } else if (!validateStellarDestinationAddress(payTo)) {
    missingConfiguration.push("STELLAR_PAY_TO_INVALID");
  }

  const gatewayServices = [
    buildGatewayService({
      description:
        "Wrap live search behind a per-query x402 payment. Uses Tavily when configured, otherwise falls back to Brave Search, DuckDuckGo, and Wikipedia.",
      id: "search_gateway",
      method: "GET",
      name: "Search Gateway",
      path: "/x402/gateway/search",
      price: searchPrice,
      publicOrigin,
      upstream: tavilyApiKey
        ? "Tavily Search"
        : braveSearchApiKey
          ? "Brave Search"
          : "DuckDuckGo / Wikipedia",
    }),
    buildGatewayService({
      description:
        "Serve paid real-time news lookups for agent workflows using Google News RSS with a Hacker News fallback.",
      id: "news_gateway",
      method: "GET",
      name: "News Gateway",
      path: "/x402/gateway/news",
      price: newsPrice,
      publicOrigin,
      upstream: "Google News RSS / Hacker News",
    }),
  ];

  const serviceIndex = Object.fromEntries(gatewayServices.map((service) => [service.id, service]));

  return {
    appName: "Sentryx402",
    port,
    publicOrigin,
    network,
    networkPassphrase,
    rpcUrl,
    facilitatorUrl,
    facilitatorApiKey,
    payTo,
    asset,
    tavilyApiKey,
    braveSearchApiKey,
    gatewayServices,
    serviceIndex,
    policy: {
      maxUsdPerRequest: parseNumber(process.env.POLICY_MAX_USD_PER_REQUEST, 0.05),
      dailyUsdCap: parseNumber(process.env.POLICY_DAILY_USD_CAP, 1.0),
      approvedServiceIds: gatewayServices.map((service) => service.id),
      approvedHosts: [new URL(publicOrigin).host],
    },
    walletSupport: {
      live: ["Freighter Browser Extension"],
      compatible: [
        "Freighter Browser Extension",
        "Albedo",
        "Hana",
        "HOT",
        "Klever",
        "OneKey",
      ],
    },
    readiness: {
      paymentRailReady: missingConfiguration.length === 0,
      missingConfiguration,
    },
  };
}

export const appConfig = createAppConfig();
