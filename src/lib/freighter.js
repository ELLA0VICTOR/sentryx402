import freighterApi from "@stellar/freighter-api";

const {
  getAddress,
  getNetworkDetails,
  isAllowed,
  isConnected,
  requestAccess,
  signAuthEntry,
  signTransaction: freighterSignTransaction,
} = freighterApi;

function getErrorMessage(result, fallback) {
  return result?.error?.message || fallback;
}

export function formatFreighterError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Freighter could not complete the request.";
}

export async function connectFreighter(expectedNetworkPassphrase) {
  const connectionResult = await isConnected();

  if (connectionResult.error || !connectionResult.isConnected) {
    throw new Error(
      getErrorMessage(
        connectionResult,
        "Freighter browser extension is required for the live Stellar x402 flow.",
      ),
    );
  }

  const permissionResult = await isAllowed();
  const addressResult = permissionResult.error || !permissionResult.isAllowed
    ? await requestAccess()
    : await getAddress();

  if (addressResult.error || !addressResult.address) {
    throw new Error(getErrorMessage(addressResult, "Freighter did not return an address."));
  }

  const networkResult = await getNetworkDetails();

  if (networkResult.error) {
    throw new Error(getErrorMessage(networkResult, "Freighter did not return network details."));
  }

  return {
    address: addressResult.address,
    network: networkResult.network,
    networkPassphrase: networkResult.networkPassphrase,
    networkUrl: networkResult.networkUrl,
    sorobanRpcUrl: networkResult.sorobanRpcUrl || null,
    networkMismatch:
      Boolean(expectedNetworkPassphrase) &&
      networkResult.networkPassphrase !== expectedNetworkPassphrase,
  };
}

export function createFreighterSigner({ address, networkPassphrase }) {
  return {
    address,
    async signAuthEntry(authEntry, opts = {}) {
      const result = await signAuthEntry(authEntry, {
        address,
        networkPassphrase: opts.networkPassphrase || networkPassphrase,
      });

      if (result.error || !result.signedAuthEntry) {
        throw new Error(getErrorMessage(result, "Freighter rejected the auth entry request."));
      }

      return {
        signedAuthEntry: result.signedAuthEntry,
        signerAddress: result.signerAddress,
      };
    },
    async signTransaction(xdr, opts = {}) {
      const result = await freighterSignTransaction(xdr, {
        address,
        networkPassphrase: opts.networkPassphrase || networkPassphrase,
        submit: opts.submit,
        submitUrl: opts.submitUrl,
      });

      if (result.error || !result.signedTxXdr) {
        throw new Error(getErrorMessage(result, "Freighter rejected the transaction request."));
      }

      return {
        signedTxXdr: result.signedTxXdr,
        signerAddress: result.signerAddress,
      };
    },
  };
}
