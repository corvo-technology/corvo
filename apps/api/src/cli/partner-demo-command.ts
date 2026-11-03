const TENANT = "demo-shop";

type Env = Record<string, string | undefined>;

/**
 * Stands in for a partner's server: creates one customer with a sample connector, two agents and
 * a monthly allowance, then asks for a link that opens the app as that customer. The connector
 * address is a placeholder, so its tools will not answer; it exists to show the wiring.
 */
export async function runPartnerDemo(env: Env, fetchFn: typeof fetch = fetch): Promise<string> {
  const base = env.PARTNER_API_URL?.replace(/\/+$/, "");
  const key = env.PARTNER_API_KEY;
  if (!base) throw new Error("Set PARTNER_API_URL to the Rook API address.");
  if (!key) throw new Error("Set PARTNER_API_KEY to the key printed by `partner create`.");

  const call = async (method: string, path: string, body: unknown) => {
    const response = await fetchFn(`${base}/api/partner/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    // The response body is not echoed: it may carry detail meant for logs, not a terminal.
    if (!response.ok) throw new Error(`${method} ${path} was refused (${response.status}).`);
    return (await response.json()) as Record<string, unknown>;
  };

  const tenant = await call("PUT", `/tenants/${TENANT}`, {
    name: "Demo Shop",
    connector: {
      slug: "demo-system",
      name: "Demo system",
      endpoint: env.DEMO_CONNECTOR_URL ?? "https://example.com/mcp",
      token: env.DEMO_CONNECTOR_TOKEN ?? "demo-connector-token",
    },
    agents: [
      {
        key: "manager",
        name: "Manager",
        instructions: "You run the day for the shop. Use the demo system to look things up.",
        usesConnector: true,
      },
      {
        key: "writer",
        name: "Writer",
        instructions: "You write short, friendly replies to customers.",
        usesConnector: false,
      },
    ],
    allowanceCents: 500,
  });
  const session = await call("POST", "/sessions", {
    externalTenantId: TENANT,
    externalUserId: "demo-user",
  });
  return [
    tenant.created ? "Created the demo customer." : "The demo customer already existed.",
    `Open this within a minute, once: ${String(session.url)}`,
  ].join("\n");
}
