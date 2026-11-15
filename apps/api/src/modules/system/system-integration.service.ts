import { env } from "../../config/env.js";
import { ServiceHealthClient } from "./service-health.client.js";

export class SystemIntegrationService {
  constructor(
    private readonly client = new ServiceHealthClient(env.INTEGRATION_TIMEOUT_MS)
  ) {}

  async check(requestId: string) {
    const integrations = await Promise.all([
      this.client.check("ai-classifier", env.AI_CLASSIFIER_BASE_URL, requestId),
      this.client.check("rag", env.RAG_BASE_URL, requestId)
    ]);
    return {
      status: integrations.every((item) => item.readiness === "ready")
        ? "ready"
        : integrations.every((item) => item.reachable)
          ? "configuration_required"
          : "degraded",
      integrations
    };
  }
}
