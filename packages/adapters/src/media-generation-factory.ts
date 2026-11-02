import type { MediaGenerationProvider } from "@corvo/adapter-kit";
import {
  FakeMediaGenerationProvider,
  OpenRouterMediaGenerationProvider,
} from "./media-generation-provider.js";

/**
 * Images come from OpenRouter, with the deployment's own key, whenever an image model is named.
 * `MEDIA_GENERATION_PROVIDER` can switch it off (`disabled`) or swap in the offline `fake`.
 */
export function createMediaGenerationProvider(
  env: NodeJS.ProcessEnv = process.env,
): MediaGenerationProvider | undefined {
  const kind = env.MEDIA_GENERATION_PROVIDER?.trim().toLowerCase();
  if (kind === "disabled") return undefined;
  if (kind === "fake") return new FakeMediaGenerationProvider();
  if (kind && kind !== "openrouter") throw new Error("Unknown media generation provider");
  const imageModel = env.MEDIA_GENERATION_IMAGE_MODEL?.trim();
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!imageModel || !apiKey) return undefined;
  return new OpenRouterMediaGenerationProvider({ apiKey, imageModel });
}
