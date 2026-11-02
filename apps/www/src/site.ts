export const SITE_NAME = "Corvo";
export const SITE_URL = "https://bots.corvo.tech";
export const SITE_DESCRIPTION =
  "Corvo is an open source team of AI agents that lives in channels on your computer, remembers what matters and asks before it touches anything real.";

/**
 * The macOS beta installer, shared as a public link. Replace it with the release download when
 * the beta builds are published there.
 */
export const DOWNLOAD_URL =
  "https://drive.google.com/file/d/1aowMdsXt4SugIkZYrFQV76tNLrr0aHDY/view?usp=drive_link";
export const CONTACT_EMAIL = "legal@corvo.tech";
export const SECURITY_EMAIL = "security@corvo.tech";

/** The open source repository. TODO(content): point this at the public repository once it exists. */
export const GITHUB_URL = "https://github.com/corvo-technology/corvo";

/**
 * The one-line installs. They download from the latest release, so they only work once the release
 * files are public. TODO(content): publish the releases where GITHUB_URL points.
 */
export const INSTALL_COMMAND = `curl -fsSL ${GITHUB_URL}/releases/latest/download/install.sh | sh`;
export const INSTALL_COMMAND_WINDOWS = `irm ${GITHUB_URL}/releases/latest/download/install.ps1 | iex`;
