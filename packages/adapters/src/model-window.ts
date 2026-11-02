import { resolveRuntimeModel } from "./pi-runtime-models.js";

/**
 * How many tokens a model can read at once, from the runtime's catalog, or null when the model
 * is not in it (a custom connection sets its own window, which the catalog cannot see).
 */
export function modelContextWindow(provider: string, modelId: string): number | null {
  const window = resolveRuntimeModel({ provider, id: modelId }).model?.contextWindow;
  return typeof window === "number" && Number.isFinite(window) && window > 0 ? window : null;
}
