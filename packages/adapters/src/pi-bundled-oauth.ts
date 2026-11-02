import { registerBunOAuthFlows } from "@earendil-works/pi-ai/bun-oauth";

// pi-ai loads each sign-in flow through a variable import, which a bundler cannot follow. A bundled
// engine injects this file so the flows are embedded instead of looked up next to the output.
registerBunOAuthFlows();
