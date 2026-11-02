import type { AdapterContext } from "./types.js";

/** Proportions an image can ask for, as width:height. */
export const MEDIA_ASPECT_RATIOS = [
  "1:1",
  "4:5",
  "5:4",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
  "21:9",
] as const;
export type MediaAspectRatio = (typeof MEDIA_ASPECT_RATIOS)[number];
export type MediaGenerationInput = { prompt: string; aspectRatio?: MediaAspectRatio };
export type GeneratedMedia = {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "video/mp4";
  /** What the provider charged for this output, in US dollars, when it says. */
  costUsd?: number;
};
export type MediaVideoJob =
  | { id: string; status: "queued" | "running"; progress?: number }
  | { id: string; status: "completed"; output: GeneratedMedia }
  | { id: string; status: "failed" };
export interface MediaGenerationProvider {
  readonly id: string;
  /** The image model in use, for the credit record. */
  readonly imageModel?: string;
  readonly capabilities: { images: boolean; video: boolean; offline: boolean };
  generateImage(input: MediaGenerationInput, context: AdapterContext): Promise<GeneratedMedia>;
  generateVideo(input: MediaGenerationInput, context: AdapterContext): Promise<MediaVideoJob>;
  pollVideo(id: string, context: AdapterContext): Promise<MediaVideoJob>;
}
export type MediaGenerationErrorCode =
  | "invalid_input"
  | "unsupported"
  | "authentication"
  | "rate_limit"
  | "provider_failure"
  | "output_limit";
export class MediaGenerationError extends Error {
  /**
   * True when the provider may already have produced, and charged for, the output (the answer
   * never arrived or could not be read). False when it refused before generating anything.
   */
  readonly uncertain: boolean;
  constructor(
    public readonly code: MediaGenerationErrorCode,
    options: { uncertain?: boolean } = {},
  ) {
    super(`Media generation: ${code}`);
    this.name = "MediaGenerationError";
    this.uncertain = options.uncertain ?? false;
  }
}
