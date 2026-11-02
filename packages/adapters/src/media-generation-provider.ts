import type {
  AdapterContext,
  GeneratedMedia,
  MediaGenerationInput,
  MediaGenerationProvider,
  MediaVideoJob,
} from "@corvo/adapter-kit";
import { MEDIA_ASPECT_RATIOS, MediaGenerationError } from "@corvo/adapter-kit";
import { ATTACHMENT_MAX_BYTES } from "@corvo/contracts";
import { z } from "zod";
import { FAKE_VIDEO_BASE64 } from "./fake-media-assets.js";

/** What the image tool accepts: a prompt and, optionally, the proportion of the picture. */
export const mediaPromptSchema = z
  .object({
    prompt: z.string().trim().min(1).max(4000),
    aspect_ratio: z.enum(MEDIA_ASPECT_RATIOS).optional(),
  })
  .transform(({ prompt, aspect_ratio }) => ({
    prompt,
    ...(aspect_ratio ? { aspectRatio: aspect_ratio } : {}),
  }));
export function validateGeneratedMedia(
  output: GeneratedMedia,
  mimeType: GeneratedMedia["mimeType"] | readonly GeneratedMedia["mimeType"][],
) {
  const allowed: readonly string[] = Array.isArray(mimeType) ? mimeType : [mimeType];
  if (!allowed.includes(output.mimeType) || !output.bytes.byteLength) {
    throw new MediaGenerationError("provider_failure");
  }
  if (output.bytes.byteLength > ATTACHMENT_MAX_BYTES) {
    throw new MediaGenerationError("output_limit");
  }
}

async function boundedBytes(response: Response, limit: number): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw new MediaGenerationError("output_limit");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new MediaGenerationError("provider_failure");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw new MediaGenerationError("output_limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

const OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images";
const imageResponse = z.object({
  data: z.array(z.object({ b64_json: z.string().min(1) })).min(1),
  usage: z.object({ cost: z.number().finite().nonnegative().optional() }).optional(),
});

/** The picture formats an attachment can hold, told apart by their first bytes. */
function imageFormat(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | undefined {
  const head = Buffer.from(bytes.subarray(0, 12));
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WEBP")
    return "image/webp";
  return undefined;
}

/**
 * OpenRouter's image API: one request, the picture back as base64, billed to the caller's key.
 * No output format is asked for: most models do not list the option, so the model's own choice
 * is taken and read from the bytes.
 */
export class OpenRouterMediaGenerationProvider implements MediaGenerationProvider {
  readonly id = "openrouter";
  readonly capabilities = { images: true, video: false, offline: false };
  readonly imageModel: string;
  constructor(
    private readonly options: { apiKey: string; imageModel: string; fetch?: typeof fetch },
  ) {
    if (
      !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*(?:\/[a-zA-Z0-9_-][a-zA-Z0-9_.:-]*)+$/.test(options.imageModel)
    )
      throw new Error("Invalid image model");
    this.imageModel = options.imageModel;
  }
  async generateImage(
    input: MediaGenerationInput,
    context: AdapterContext,
  ): Promise<GeneratedMedia> {
    const parsed = mediaPromptSchema.safeParse({
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio,
    });
    if (!parsed.success) throw new MediaGenerationError("invalid_input");
    context.signal.throwIfAborted();
    let response: Response;
    try {
      response = await (this.options.fetch ?? fetch)(OPENROUTER_IMAGES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.imageModel,
          prompt: parsed.data.prompt,
          n: 1,
          ...(parsed.data.aspectRatio ? { aspect_ratio: parsed.data.aspectRatio } : {}),
        }),
        signal: AbortSignal.any([context.signal, AbortSignal.timeout(180_000)]),
        redirect: "error",
      });
    } catch {
      context.signal.throwIfAborted();
      // The request may have reached the provider before the connection failed.
      throw new MediaGenerationError("provider_failure", { uncertain: true });
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new MediaGenerationError(
        response.status === 429
          ? "rate_limit"
          : [401, 403].includes(response.status)
            ? "authentication"
            : "provider_failure",
      );
    }
    // Base64 is a third larger than the bytes it carries.
    const limit = Math.ceil((ATTACHMENT_MAX_BYTES * 4) / 3) + 64_000;
    let body: z.infer<typeof imageResponse>;
    try {
      const text = new TextDecoder().decode(await boundedBytes(response, limit));
      const result = imageResponse.safeParse(JSON.parse(text));
      if (!result.success) throw new Error("unreadable");
      body = result.data;
    } catch (error) {
      context.signal.throwIfAborted();
      if (error instanceof MediaGenerationError) throw error;
      throw new MediaGenerationError("provider_failure", { uncertain: true });
    }
    const bytes = Buffer.from(body.data[0]!.b64_json, "base64");
    const mimeType = imageFormat(bytes);
    // An answer that is not a picture was still charged for.
    if (!mimeType) throw new MediaGenerationError("provider_failure", { uncertain: true });
    const output: GeneratedMedia = {
      bytes,
      mimeType,
      ...(body.usage?.cost !== undefined ? { costUsd: body.usage.cost } : {}),
    };
    validateGeneratedMedia(output, mimeType);
    return output;
  }
  async generateVideo(
    _input: MediaGenerationInput,
    _context: AdapterContext,
  ): Promise<MediaVideoJob> {
    throw new MediaGenerationError("unsupported");
  }
  async pollVideo(_id: string, _context: AdapterContext): Promise<MediaVideoJob> {
    throw new MediaGenerationError("unsupported");
  }
}

/** Deterministic provider; no network or billing. */
export class FakeMediaGenerationProvider implements MediaGenerationProvider {
  readonly id = "fake";
  readonly capabilities = { images: true, video: true, offline: true };
  async generateImage(
    _input: MediaGenerationInput,
    context: AdapterContext,
  ): Promise<GeneratedMedia> {
    context.signal.throwIfAborted();
    return {
      mimeType: "image/png",
      bytes: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0u8AAAAASUVORK5CYII=",
        "base64",
      ),
    };
  }
  async generateVideo(
    _input: MediaGenerationInput,
    context: AdapterContext,
  ): Promise<MediaVideoJob> {
    context.signal.throwIfAborted();
    return { id: "fake-video", status: "queued", progress: 0 };
  }
  async pollVideo(id: string, context: AdapterContext): Promise<MediaVideoJob> {
    context.signal.throwIfAborted();
    return {
      id,
      status: "completed",
      output: {
        mimeType: "video/mp4",
        bytes: Buffer.from(FAKE_VIDEO_BASE64, "base64"),
      },
    };
  }
}
