export const SITE_NAME = "Corvo";
export const SITE_URL = "https://bots.corvo.tech";
export const SITE_DESCRIPTION =
  "Corvo is an open source team of AI agents that lives in channels on your computer, remembers what matters and asks before it touches anything real.";

export const CONTACT_EMAIL = "legal@corvo.tech";
export const SECURITY_EMAIL = "security@corvo.tech";

/** The open source repository. */
export const GITHUB_URL = "https://github.com/corvo-technology/corvo";

/** The macOS installer (Apple silicon), attached to the release it was built for. */
export const DESKTOP_VERSION = "0.1.1";
export const DOWNLOAD_URL = `${GITHUB_URL}/releases/download/v${DESKTOP_VERSION}/corvo-mac-arm64.dmg`;

/** Direct installers with stable names, so the links never need a version. */
export const DOWNLOAD_URL_WINDOWS = `${GITHUB_URL}/releases/latest/download/corvo-win-x64.exe`;
export const DOWNLOAD_URL_LINUX = `${GITHUB_URL}/releases/latest/download/corvo-linux-x86_64.AppImage`;

/**
 * The one-line installs. They download from the latest release, so they only work once a release
 * with the install scripts and the app files is published as the latest one.
 */
export const INSTALL_COMMAND = `curl -fsSL ${GITHUB_URL}/releases/latest/download/install.sh | sh`;
export const INSTALL_COMMAND_WINDOWS = `irm ${GITHUB_URL}/releases/latest/download/install.ps1 | iex`;
