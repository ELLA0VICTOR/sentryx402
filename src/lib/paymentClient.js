import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactStellarScheme } from "@x402/stellar";
import { createFreighterSigner } from "./freighter.js";

export function createPaymentFetcher({ address, network, networkPassphrase, rpcUrl }) {
  const signer = createFreighterSigner({ address, networkPassphrase });
  const client = new ExactStellarScheme(signer, rpcUrl ? { url: rpcUrl } : undefined);
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network, client }],
  });

  return async function fetchPaidResource(input, init) {
    const response = await fetchWithPayment(input, init);
    const header =
      response.headers.get("PAYMENT-RESPONSE") || response.headers.get("X-PAYMENT-RESPONSE");

    return {
      response,
      settlement: header ? decodePaymentResponseHeader(header) : null,
    };
  };
}
