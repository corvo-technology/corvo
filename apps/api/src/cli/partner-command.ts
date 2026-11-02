const USAGE = [
  "Usage:",
  '  partner create <slug> "<name>"   register a partner and print its key once',
  "  partner rotate <slug>            issue a new key; the old one stops working",
  "  partner disable <slug>           stop accepting the partner's key",
  "  partner enable <slug>",
].join("\n");

const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

type Issued = { partner: { slug: string; name: string }; key: string };

export interface PartnerCommandDeps {
  createPartner(input: { slug: string; name: string }): Promise<Issued>;
  rotatePartnerKey(slug: string): Promise<Issued>;
  setPartnerEnabled(slug: string, enabled: boolean): Promise<void>;
}

/** Runs one command and returns what to print. Nothing is touched until the arguments are valid. */
export async function runPartnerCommand(
  argv: readonly string[],
  deps: PartnerCommandDeps,
): Promise<string> {
  const [command, slug, name, ...extra] = argv;
  if (!command || !slug || extra.length > 0) throw new Error(USAGE);
  if (!SLUG.test(slug)) {
    throw new Error("The slug must be 3 to 40 lowercase letters, digits or hyphens.");
  }
  switch (command) {
    case "create": {
      if (!name?.trim()) throw new Error(USAGE);
      const { partner, key } = await deps.createPartner({ slug, name: name.trim() });
      return `Created ${partner.slug}.\nKey: ${key}\nThis key will not be shown again. Store it in the partner's server secrets.`;
    }
    case "rotate": {
      if (name) throw new Error(USAGE);
      const { partner, key } = await deps.rotatePartnerKey(slug);
      return `New key for ${partner.slug}: ${key}\nThe old key no longer works. This key will not be shown again.`;
    }
    case "disable":
    case "enable": {
      if (name) throw new Error(USAGE);
      await deps.setPartnerEnabled(slug, command === "enable");
      return `${slug} is ${command}d.`;
    }
    default:
      throw new Error(USAGE);
  }
}
