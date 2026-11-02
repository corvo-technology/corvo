import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * macOS only installs an update through its own updater when the new app satisfies the old app's
 * designated requirement. A build signed without a developer identity has the exact hash of its own
 * files as that requirement, so no other build ever satisfies it and the update is refused, silently.
 * Until the app is signed, the update is installed here instead: the downloaded file, already checked
 * against the checksum the release published, replaces the app once it has quit.
 */

/** The app a running executable belongs to, or null when it is not inside one. */
export function macBundleFromExecutable(executable: string): string | null {
  const parts = executable.split("/");
  const at = parts.lastIndexOf("MacOS");
  if (at < 3 || parts[at - 1] !== "Contents" || !parts[at - 2]?.endsWith(".app")) return null;
  if (at !== parts.length - 2) return null;
  return parts.slice(0, at - 1).join("/");
}

/** Whether `codesign -dv` output describes a build signed without a developer identity. */
export function isAdHocSigned(codesignOutput: string): boolean {
  return /Signature=adhoc/.test(codesignOutput);
}

/**
 * The update the updater downloaded, once its file matches the checksum the release published, or
 * null when there is none or it does not match. Reads synchronously so a failure can be reported to
 * the person who asked to install.
 */
export function readPendingUpdate(cacheDir: string): { zip: string } | null {
  try {
    const pending = path.join(cacheDir, "pending");
    const info = JSON.parse(readFileSync(path.join(pending, "update-info.json"), "utf8")) as {
      fileName?: unknown;
      sha512?: unknown;
    };
    if (typeof info.fileName !== "string" || typeof info.sha512 !== "string") return null;
    // The name comes from a file on disk; it must name a file in this folder and nothing else.
    if (path.basename(info.fileName) !== info.fileName) return null;
    const zip = path.join(pending, info.fileName);
    if (!existsSync(zip)) return null;
    const actual = createHash("sha512").update(readFileSync(zip)).digest("base64");
    return actual === info.sha512 ? { zip } : null;
  } catch {
    return null;
  }
}

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

/** The script that waits for the app to quit, swaps the bundle, and opens the new one. */
export function updateScript(input: {
  pid: number;
  zip: string;
  bundle: string;
  log: string;
  relaunch: boolean;
}): string {
  const open = input.relaunch ? 'open "$BUNDLE"' : ":";
  return `#!/bin/sh
ZIP=${quote(input.zip)}
BUNDLE=${quote(input.bundle)}
exec >>${quote(input.log)} 2>&1
echo "$(date) updating $BUNDLE"
i=0
while kill -0 ${input.pid} 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 120 ]; then echo "the app did not quit"; exit 1; fi
  sleep 0.5
done
STAGE="$(mktemp -d "$(dirname "$BUNDLE")/.corvo-update.XXXXXX")" || { echo "cannot write next to the app"; exit 1; }
if ! ditto -x -k "$ZIP" "$STAGE"; then echo "could not unpack the update"; rm -rf "$STAGE"; ${open}; exit 1; fi
NEW="$STAGE/$(basename "$BUNDLE")"
if [ ! -d "$NEW" ]; then echo "no app in the update"; rm -rf "$STAGE"; ${open}; exit 1; fi
xattr -cr "$NEW"
rm -rf "$BUNDLE.old"
if ! mv "$BUNDLE" "$BUNDLE.old"; then echo "could not move the old app"; rm -rf "$STAGE"; ${open}; exit 1; fi
if mv "$NEW" "$BUNDLE"; then
  rm -rf "$BUNDLE.old" "$STAGE"
  echo "updated"
else
  echo "rollback: putting the old app back"
  mv "$BUNDLE.old" "$BUNDLE"
  rm -rf "$STAGE"
  ${open}
  exit 1
fi
${open}
`;
}

/** Starts the script detached, so it outlives the app that started it. */
export function startMacUpdate(script: string): void {
  const child = spawn("/bin/sh", ["-c", script], { detached: true, stdio: "ignore" });
  child.unref();
}
