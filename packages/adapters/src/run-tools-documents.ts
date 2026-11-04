import type { ToolHandlers } from "./run-tool-gate.js";
import { readThreadDocument } from "./thread-documents.js";

/**
 * Reads a file attached in this chat without a computer: on a machine with no Docker the agent has
 * none, and a file it cannot open is a file it cannot be asked about.
 */
export const documentTools: ToolHandlers = {
  async read_document(ctx, call) {
    const { deps, thread, context } = ctx;
    if (!deps.artifacts) return call.finish({ error: "Attached files are not available here." });
    const file = typeof call.args.file === "string" ? call.args.file : undefined;
    const offset = typeof call.args.offset === "number" ? call.args.offset : undefined;
    return call.finish(
      await readThreadDocument(
        {
          prisma: deps.prisma,
          artifacts: deps.artifacts,
          maxUploadSizeBytes: deps.maxUploadSizeBytes,
        },
        { threadId: thread.id, context, file, offset },
      ),
    );
  },
};
