import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { paymentMiddleware } from "@x402/express";
import { ExactStellarScheme as ExactStellarServerScheme } from "@x402/stellar/exact/server";
import { appConfig } from "./config.js";
import { runGatewayQuery } from "./gatewayProviders.js";
import { evaluatePolicy } from "./policyEngine.js";
import { createPlaygroundPlan, createPlaygroundRun } from "./playground.js";
import { createRuntimeStore } from "./runtimeStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const app = express();
const runtimeStore = createRuntimeStore(appConfig);
const serviceByRoute = Object.fromEntries(appConfig.gatewayServices.map((service) => [service.route, service]));

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : null;

if (corsOrigin?.length) {
  app.use(cors({ origin: corsOrigin }));
}

app.use(express.json());
app.use((_, res, next) => {
  res.setHeader(
    "Access-Control-Expose-Headers",
    "PAYMENT-REQUIRED,X-PAYMENT-REQUIRED,PAYMENT-RESPONSE,X-PAYMENT-RESPONSE",
  );
  next();
});

const paymentRoutes = Object.fromEntries(
  appConfig.gatewayServices.map((service) => [
    `${service.method} ${service.path}`,
    {
      accepts: {
        scheme: "exact",
        price: service.price,
        network: appConfig.network,
        payTo: appConfig.payTo,
        maxTimeoutSeconds: 90,
      },
      description: service.description,
      resource: service.route,
      mimeType: "application/json",
      unpaidResponseBody: async () => ({
        contentType: "application/json",
        body: {
          ok: false,
          message: `Payment required before ${service.name.toLowerCase()} can run.`,
          service: {
            id: service.id,
            route: service.path,
            price: service.price,
            network: appConfig.network,
            asset: appConfig.asset,
            upstream: service.upstream,
          },
        },
      }),
    },
  ]),
);

let paymentRail = {
  ready: false,
  reason: appConfig.readiness.paymentRailReady
    ? "not_initialized"
    : `missing ${appConfig.readiness.missingConfiguration.join(", ")}`,
};

if (appConfig.readiness.paymentRailReady) {
  try {
    const facilitatorClient = new HTTPFacilitatorClient({
      url: appConfig.facilitatorUrl,
      createAuthHeaders: async () => ({
        verify: { Authorization: `Bearer ${appConfig.facilitatorApiKey}` },
        settle: { Authorization: `Bearer ${appConfig.facilitatorApiKey}` },
        supported: { Authorization: `Bearer ${appConfig.facilitatorApiKey}` },
      }),
    });

    const resourceServer = new x402ResourceServer(facilitatorClient)
      .register(appConfig.network, new ExactStellarServerScheme())
      .onAfterSettle(async ({ requirements, result }) => {
        const service = serviceByRoute[requirements.resource] || appConfig.gatewayServices[0];

        runtimeStore.recordReceipt({
          serviceId: service?.id || "gateway_call",
          serviceName: service?.name || "Gateway Call",
          network: result.network,
          payer: result.payer || "unknown",
          transaction: result.transaction,
          amount: `${service?.price || "$0.00"} ${appConfig.asset}`,
          rawAmount: result.amount || requirements.amount,
          asset: requirements.asset,
        });
      });

    await resourceServer.initialize();

    app.use(paymentMiddleware(paymentRoutes, resourceServer, undefined, undefined, false));

    paymentRail = {
      ready: true,
      reason: "initialized",
    };
  } catch (error) {
    paymentRail = {
      ready: false,
      reason: error instanceof Error ? error.message : "unknown x402 initialization failure",
    };
  }
}

function buildAppResponse() {
  const snapshot = runtimeStore.getSnapshot();

  return {
    ok: true,
    paymentRail,
    ...snapshot,
  };
}

function ensurePaymentRailReady(res) {
  if (paymentRail.ready) {
    return true;
  }

  res.status(503).json({
    ok: false,
    message: "The x402 payment rail is not ready yet.",
    reason: paymentRail.reason,
    missingConfiguration: appConfig.readiness.missingConfiguration,
  });

  return false;
}

app.get("/api/health", (_, res) => {
  res.json({
    ok: true,
    service: appConfig.appName,
    paymentRail,
    network: appConfig.network,
  });
});

app.get("/api/app", (_, res) => {
  res.json(buildAppResponse());
});

app.get("/api/runtime", (_, res) => {
  res.json(buildAppResponse());
});

app.post("/api/session/wallet", (req, res) => {
  const address = req.body?.address?.trim();
  const network = req.body?.network?.trim();
  const networkPassphrase = req.body?.networkPassphrase?.trim();

  if (!address || !network || !networkPassphrase) {
    res.status(400).json({
      ok: false,
      message: "address, network, and networkPassphrase are required",
    });
    return;
  }

  const session = runtimeStore.registerWalletSession({
    address,
    network,
    networkPassphrase,
    networkUrl: req.body?.networkUrl?.trim() || null,
    sorobanRpcUrl: req.body?.sorobanRpcUrl?.trim() || null,
  });

  res.json({
    ok: true,
    session,
    expectedPassphrase: appConfig.networkPassphrase,
  });
});

app.post("/api/policy/evaluate", (req, res) => {
  const result = evaluatePolicy({
    config: appConfig,
    runtimeStore,
    input: req.body,
  });

  res.json({
    ok: true,
    ...result,
  });
});

app.post("/api/playground/plan", (req, res) => {
  const plan = createPlaygroundPlan({
    services: appConfig.serviceIndex,
    task: req.body?.task,
  });

  if (!plan.ok) {
    res.status(plan.status).json({
      ok: false,
      message: plan.message,
    });
    return;
  }

  res.json({
    ok: true,
    plan: plan.plan,
  });
});

app.post("/api/playground/report", (req, res) => {
  const run = createPlaygroundRun({
    outputs: req.body?.outputs,
    plan: req.body?.plan,
    task: req.body?.task,
  });

  if (!run.ok) {
    res.status(run.status).json({
      ok: false,
      message: run.message,
    });
    return;
  }

  const recorded = runtimeStore.recordTaskRun(run.run);

  res.json({
    ok: true,
    run: recorded,
  });
});

async function handleGatewayRequest(req, res, serviceId) {
  if (!ensurePaymentRailReady(res)) {
    return;
  }

  const service = appConfig.serviceIndex[serviceId];

  const gateway = await runGatewayQuery({
    braveSearchApiKey: appConfig.braveSearchApiKey,
    input: req.query?.input,
    limit: req.query?.limit,
    profileId: req.query?.profile,
    query: req.query?.q,
    serviceId,
  });

  if (!gateway.ok) {
    console.error(`[gateway:${serviceId}] ${gateway.message}`);
    res.status(gateway.status).json({
      ok: false,
      message: gateway.message,
    });
    return;
  }

  const result = runtimeStore.recordGatewayResult({
    ...gateway.result,
    price: service.price,
    priceUsd: service.priceUsd,
    serviceId,
    serviceName: service.name,
  });

  res.json({
    ok: true,
    service: {
      id: service.id,
      route: service.path,
      description: service.description,
      network: appConfig.network,
      asset: appConfig.asset,
      payTo: appConfig.payTo,
      price: service.price,
      upstream: service.upstream,
    },
    result,
  });
}

app.get("/x402/gateway/search", async (req, res) => {
  await handleGatewayRequest(req, res, "search_gateway");
});

app.get("/x402/gateway/news", async (req, res) => {
  await handleGatewayRequest(req, res, "news_gateway");
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/x402/")) {
      next();
      return;
    }

    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(appConfig.port, () => {
  console.log(
    `${appConfig.appName} listening on http://localhost:${appConfig.port} (${paymentRail.ready ? "x402 ready" : paymentRail.reason})`,
  );
});
