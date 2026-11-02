import { execFile } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/** Runs agent-desktop with these arguments and returns what it printed on stdout. */
export type DesktopRun = (args: string[]) => Promise<{ stdout: string }>;

const MAX_ANSWER_CHARS = 60_000;

const name = z.string().min(1).max(200);
const ref = z
  .string()
  .regex(/^@[A-Za-z0-9._-]+:e\d+$/, "Use a ref from a snapshot, such as @abc123:e12.")
  .describe("An element ref from desktop_snapshot or desktop_find, like @abc123:e12");
const appName = name.describe("The application name, as desktop_list_apps shows it");

/** `--flag=value` keeps a value from ever being read as a flag of its own. */
const flag = (option: string, value: string | number | undefined) =>
  value === undefined ? [] : [`--${option}=${value}`];
const toggle = (option: string, on: boolean | undefined) => (on ? [`--${option}`] : []);

function answer(stdout: string) {
  let parsed: { ok?: unknown; error?: unknown };
  try {
    parsed = JSON.parse(stdout) as { ok?: unknown; error?: unknown };
  } catch {
    return {
      isError: true,
      content: [{ type: "text" as const, text: "Desktop control gave an unreadable answer." }],
    };
  }
  const text =
    stdout.length > MAX_ANSWER_CHARS
      ? `${stdout.slice(0, MAX_ANSWER_CHARS)}\n[truncated: ask for a smaller part of the screen, such as one window or interactive_only]`
      : stdout;
  return parsed.ok === true
    ? { content: [{ type: "text" as const, text }] }
    : { isError: true, content: [{ type: "text" as const, text }] };
}

/**
 * The desktop tools an agent may use, as an MCP server. Each tool maps to one fixed agent-desktop
 * command with a closed set of options: no tool passes through free-form arguments, and nothing
 * here asks for physical input, forced shortcuts, DevTools ports, or environment for a launched app.
 */
export function createDesktopControlServer(run: DesktopRun): McpServer {
  const server = new McpServer({ name: "corvo-desktop-control", version: "1.0.0" });
  const reading = { readOnlyHint: true, openWorldHint: true } as const;
  const acting = { readOnlyHint: false, destructiveHint: true, openWorldHint: true } as const;

  server.registerTool(
    "desktop_list_apps",
    {
      description: "List the applications running on this computer.",
      inputSchema: { app: name.optional().describe("Only this application") },
      annotations: reading,
    },
    async ({ app }) => answer((await run(["list-apps", ...flag("app", app)])).stdout),
  );

  server.registerTool(
    "desktop_list_windows",
    {
      description: "List the visible windows, with the ids other desktop tools accept.",
      inputSchema: { app: appName.optional() },
      annotations: reading,
    },
    async ({ app }) => answer((await run(["list-windows", ...flag("app", app)])).stdout),
  );

  server.registerTool(
    "desktop_snapshot",
    {
      description:
        "Read an app's screen as a tree of elements, each with a ref. Use the refs with the acting tools, then snapshot again to check the result. The content can include private information.",
      inputSchema: {
        app: appName.optional(),
        window_id: name.optional().describe("A window id from desktop_list_windows"),
        interactive_only: z.boolean().optional().describe("Only elements that can be acted on"),
        max_depth: z.number().int().min(1).max(20).optional(),
      },
      annotations: reading,
    },
    async (input) =>
      answer(
        (
          await run([
            "snapshot",
            ...flag("app", input.app),
            ...flag("window-id", input.window_id),
            ...toggle("interactive-only", input.interactive_only),
            ...flag("max-depth", input.max_depth),
          ])
        ).stdout,
      ),
  );

  server.registerTool(
    "desktop_find",
    {
      description: "Find elements in an app by role, name, text or value. Returns refs.",
      inputSchema: {
        app: appName.optional(),
        window_id: name.optional(),
        role: name.optional().describe("An accessibility role, such as button or textfield"),
        name: name.optional(),
        text: name.optional(),
        value: name.optional(),
        exact: z.boolean().optional().describe("Match names and values exactly, ignoring case"),
      },
      annotations: reading,
    },
    async (input) =>
      answer(
        (
          await run([
            "find",
            ...flag("app", input.app),
            ...flag("window-id", input.window_id),
            ...flag("role", input.role),
            ...flag("name", input.name),
            ...flag("text", input.text),
            ...flag("value", input.value),
            ...toggle("exact", input.exact),
          ])
        ).stdout,
      ),
  );

  server.registerTool(
    "desktop_click",
    {
      description: "Click an element by ref, using the app's accessibility actions.",
      inputSchema: { ref },
      annotations: acting,
    },
    async ({ ref: target }) => answer((await run(["click", "--", target])).stdout),
  );

  server.registerTool(
    "desktop_type",
    {
      description: "Type text into an element by ref.",
      inputSchema: { ref, text: z.string().min(1).max(4000) },
      annotations: acting,
    },
    async ({ ref: target, text }) => answer((await run(["type", "--", target, text])).stdout),
  );

  server.registerTool(
    "desktop_press",
    {
      description: "Press a key combination, such as return, escape, cmd+c or shift+tab.",
      inputSchema: {
        combo: z.string().regex(/^[A-Za-z0-9+_-]{1,40}$/, "Use a combo such as cmd+c or return."),
        app: appName.optional().describe("Send the keys to this application"),
      },
      annotations: acting,
    },
    async ({ combo, app }) =>
      answer((await run(["press", ...flag("app", app), "--", combo])).stdout),
  );

  server.registerTool(
    "desktop_launch",
    {
      description: "Open an application and wait for its window.",
      inputSchema: { app: appName },
      annotations: acting,
    },
    async ({ app }) => answer((await run(["launch", "--activate", "--", app])).stdout),
  );

  return server;
}

/** The runner for the real binary. A non-zero exit still carries the tool's JSON answer. */
export function agentDesktopRunner(binary: string): DesktopRun {
  return (args) =>
    new Promise((resolve) => {
      execFile(
        binary,
        args,
        { timeout: 60_000, maxBuffer: 8 * 1024 * 1024, env: minimalEnv() },
        (_error, stdout) => resolve({ stdout: String(stdout ?? "") }),
      );
    });
}

function minimalEnv(): NodeJS.ProcessEnv {
  const keep = [
    "HOME",
    "PATH",
    "TMPDIR",
    "USER",
    "LANG",
    "SystemRoot",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
  ];
  return Object.fromEntries(
    keep.flatMap((key) => (process.env[key] ? [[key, process.env[key]]] : [])),
  );
}
