import { passkeyClient } from "@better-auth/passkey/client";
import type { OrganizationClientOptions } from "better-auth/client/plugins";
import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import type { ReactAuthClient } from "better-auth/react";
import { createAuthClient } from "better-auth/react";
import { embedToken } from "./embed";

export const authClient: ReactAuthClient<{
  // An uninstantiated generic resolves to `any`, which would erase every plugin's actions.
  plugins: [
    ReturnType<typeof organizationClient<OrganizationClientOptions>>,
    ReturnType<typeof emailOTPClient>,
    ReturnType<typeof passkeyClient>,
  ];
}> = createAuthClient({
  plugins: [organizationClient(), emailOTPClient(), passkeyClient()],
  // Inside a partner's frame there is no cookie, so the session travels as a bearer token.
  fetchOptions: { auth: { type: "Bearer" as const, token: () => embedToken() } },
});
