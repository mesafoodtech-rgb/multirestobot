import { proxyPostJsonToBackend } from "../../lib/mesaProxy.js";

export default async function handler(req, res) {
  await proxyPostJsonToBackend(req, res, {
    upstreamPath: "/api/dashboard/validate-session",
    timeoutMs: 15000
  });
}
