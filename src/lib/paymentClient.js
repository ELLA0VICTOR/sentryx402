import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactStellarScheme } from "@x402/stellar";
import { createFreighterSigner } from "./freighter.js";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function buildPaidUrl(input) {
  if (typeof input !== "string") {
    return input;
  }

  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  return API_BASE_URL ? `${API_BASE_URL}${input}` : input;
}

export function createPaymentFetcher({ address, network, networkPassphrase, rpcUrl }) {
  const signer = createFreighterSigner({ address, networkPassphrase });
  const client = new ExactStellarScheme(signer, rpcUrl ? { url: rpcUrl } : undefined);
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network, client }],
  });

  return async function fetchPaidResource(input, init) {
    const response = await fetchWithPayment(buildPaidUrl(input), init);
    const header =
      response.headers.get("PAYMENT-RESPONSE") || response.headers.get("X-PAYMENT-RESPONSE");

    return {
      response,
      settlement: header ? decodePaymentResponseHeader(header) : null,
    };
  };
}
