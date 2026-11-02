import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDesktopControlServer } from "./desktop-control-mcp.js";

const envelope = (data: unknown) =>
  JSON.stringify({ ok: true, command: "x", data, version: "2.5" });

async function connect(stdout = envelope({})) {
  const run = vi.fn(async (_args: string[]) => ({ stdout }));
  const server = createDesktopControlServer(run);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return { client, run };
}

let open: Client | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function call(name: string, args: Record<string, unknown>, stdout?: string) {
  const { client, run } = await connect(stdout);
  open = client;
  const result = await client.callTool({ name, arguments: args });
  return { result, run };
}

describe("desktop control server", () => {
  it("offers reading tools that change nothing and acting tools that do", async () => {
    const { client } = await connect();
    open = client;
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    expect(Object.keys(byName).sort()).toEqual([
      "desktop_click",
      "desktop_find",
      "desktop_launch",
      "desktop_list_apps",
      "desktop_list_windows",
      "desktop_press",
      "desktop_snapshot",
      "desktop_type",
    ]);
    for (const name of [
      "desktop_list_apps",
      "desktop_list_windows",
      "desktop_snapshot",
      "desktop_find",
    ]) {
      expect(byName[name]?.annotations?.readOnlyHint, name).toBe(true);
    }
    for (const name of ["desktop_click", "desktop_type", "desktop_press", "desktop_launch"]) {
      expect(byName[name]?.annotations?.readOnlyHint, name).toBe(false);
    }
  });

  it("snapshots an app with fixed flags and the value attached to its flag", async () => {
    const { result, run } = await call("desktop_snapshot", {
      app: "Notes",
      interactive_only: true,
      max_depth: 4,
    });
    expect(run).toHaveBeenCalledWith([
      "snapshot",
      "--app=Notes",
      "--interactive-only",
      "--max-depth=4",
    ]);
    expect(result.isError).toBeFalsy();
  });

  it("cannot be talked into passing a flag through a value", async () => {
    const { run } = await call("desktop_find", { app: "--headed", name: "--force" });
    const args = run.mock.calls[0]?.[0] ?? [];
    expect(args).toEqual(["find", "--app=--headed", "--name=--force"]);
    expect(args).not.toContain("--headed");
  });

  it("refuses a malformed ref before running anything", async () => {
    const { result, run } = await call("desktop_click", { ref: "--headed" });
    expect(result.isError).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it("clicks a ref and types into one, with the positionals after a separator", async () => {
    const click = await call("desktop_click", { ref: "@s1:e12" });
    expect(click.run).toHaveBeenCalledWith(["click", "--", "@s1:e12"]);
    const type = await call("desktop_type", { ref: "@s1:e3", text: "-hello" });
    expect(type.run).toHaveBeenCalledWith(["type", "--", "@s1:e3", "-hello"]);
  });

  it("presses a key combo and launches an app without the risky options", async () => {
    const press = await call("desktop_press", { combo: "cmd+c", app: "Notes" });
    expect(press.run).toHaveBeenCalledWith(["press", "--app=Notes", "--", "cmd+c"]);
    const launch = await call("desktop_launch", { app: "Notes" });
    expect(launch.run).toHaveBeenCalledWith(["launch", "--activate", "--", "Notes"]);
    for (const { run } of [press, launch]) {
      const args = run.mock.calls[0]?.[0] ?? [];
      for (const risky of ["--force", "--headed", "--cdp", "--env", "--cwd", "--arg"]) {
        expect(
          args.some((arg) => arg.startsWith(risky)),
          risky,
        ).toBe(false);
      }
    }
  });

  it("refuses a malformed key combo", async () => {
    const { result, run } = await call("desktop_press", { combo: "cmd+c; rm -rf /" });
    expect(result.isError).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it("reports the tool's own error to the agent as an error", async () => {
    const failure = JSON.stringify({
      ok: false,
      error: { code: "STALE_REF", message: "The ref is stale." },
    });
    const { result } = await call("desktop_click", { ref: "@s1:e1" }, failure);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("STALE_REF");
  });

  it("cuts a very large answer short and says so", async () => {
    const huge = envelope({ tree: "x".repeat(200_000) });
    const { result } = await call("desktop_snapshot", {}, huge);
    const text = (result.content as { text: string }[])[0]?.text ?? "";
    expect(text.length).toBeLessThan(80_000);
    expect(text).toContain("truncated");
  });

  it("treats output that is not the tool's JSON as an error", async () => {
    const { result } = await call("desktop_snapshot", {}, "segfault");
    expect(result.isError).toBe(true);
  });
});
