import { useEffect, useId, useRef, useState } from "react";
import type { MascotHue } from "../mascot";
import { MASCOT_LOOK } from "../mascot";

const INK = "#0f0f0f";

/** A small steady number from a name, so each chick blinks on its own beat. */
function beat(hue: string) {
  let hash = 0;
  for (let i = 0; i < hue.length; i += 1) hash = (hash * 31 + hue.charCodeAt(i)) >>> 0;
  return { every: `${(4.2 + (hash % 30) / 10).toFixed(1)}s`, delay: `-${((hash >> 5) % 47) / 10}s` };
}

/**
 * A baby crow: a rounded tile in its own shade with a crest, two eyes and a beak. It blinks and
 * hops when pointed at. With `interactive` (hydrated on the page) its eyes follow the pointer and it
 * smiles when pressed. Without it, it is plain markup and needs no script.
 */
export function Chick({
  hue,
  interactive = false,
  mood = "idle",
}: {
  hue: MascotHue;
  interactive?: boolean;
  /** Working scans with its eyes and bobs; happy closes them into a smile. The page decides. */
  mood?: "idle" | "working" | "happy";
}) {
  const look = MASCOT_LOOK[hue];
  const clip = useId();
  const root = useRef<SVGSVGElement>(null);
  const [happy, setHappy] = useState(false);
  const blink = beat(hue);
  const ry = look.sleepy ? 3 : 9.5;
  const cy = look.sleepy ? 45 : 43.5;

  useEffect(() => {
    const svg = root.current;
    if (!interactive || !svg) return;
    if (
      !window.matchMedia("(pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    let timer: number | undefined;
    const follow = (event: PointerEvent) => {
      const rect = svg.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, distance / 320) * 4;
      svg.style.setProperty("--gaze-x", `${((dx / distance) * reach).toFixed(2)}px`);
      svg.style.setProperty("--gaze-y", `${((dy / distance) * reach * 0.75).toFixed(2)}px`);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        svg.style.removeProperty("--gaze-x");
        svg.style.removeProperty("--gaze-y");
      }, 2500);
    };
    window.addEventListener("pointermove", follow, { passive: true });
    return () => {
      window.removeEventListener("pointermove", follow);
      window.clearTimeout(timer);
    };
  }, [interactive]);

  useEffect(() => {
    if (!happy) return;
    const timer = window.setTimeout(() => setHappy(false), 1100);
    return () => window.clearTimeout(timer);
  }, [happy]);

  return (
    <svg
      ref={root}
      className="chick"
      data-happy={happy || mood === "happy" ? "" : undefined}
      data-working={mood === "working" ? "" : undefined}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      overflow="visible"
      style={{ "--blink": blink.every, "--blink-delay": blink.delay } as React.CSSProperties}
      onClick={interactive ? () => setHappy(true) : undefined}
    >
      <defs>
        <clipPath id={clip}>
          <rect width="100" height="100" rx="36" />
        </clipPath>
      </defs>
      <g className="chick__bob">
        <g className="chick__body">
          <g className="chick__crest" fill={look.color}>
            <polygon points="37,-12 44,8 30,8" transform="rotate(-22 37 -2)" />
            <polygon points="48,-17 55,7 41,7" transform="rotate(-6 48 -5)" />
            <polygon points="58,-11 64,7 52,7" transform="rotate(14 58 -2)" />
          </g>
          <rect width="100" height="100" rx="36" fill={look.color} />
          <rect
            y="94"
            width="100"
            height="6"
            fill="#000"
            fillOpacity=".18"
            clipPath={`url(#${clip})`}
          />
          {look.blush ? (
            <g fill="#ff82a0" fillOpacity=".45">
              <ellipse cx="19.5" cy="64" rx="7.5" ry="4" />
              <ellipse cx="80.5" cy="64" rx="7.5" ry="4" />
            </g>
          ) : null}
          <g className="chick__eyes">
            {[32.5, 67.5].map((x) => (
              <g key={x}>
                <g className="chick__eye">
                  <ellipse cx={x} cy={cy} rx="7.5" ry={ry} fill={INK} />
                  {look.sleepy ? null : <circle cx={x - 2.3} cy={cy - 4} r="2.7" fill="#fff" />}
                </g>
                <path
                  className="chick__smile"
                  d={`M${x - 7.5} 47 Q${x} 37 ${x + 7.5} 47`}
                  fill="none"
                  stroke={INK}
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </g>
            ))}
          </g>
          <polygon points="42,56 58,56 50,68" fill="#f9b64f" />
          {look.accessory === "headset" ? (
            <>
              <rect x="-4" y="34" width="14" height="28" rx="4" fill="#1c1c1e" />
              <rect
                x="6"
                y="62"
                width="20"
                height="5"
                rx="2.5"
                fill="#1c1c1e"
                transform="rotate(28 16 64.5)"
              />
            </>
          ) : null}
          {look.accessory === "bow" ? (
            <>
              <polygon points="66,-2 81,7.5 66,17" fill="#c5256d" />
              <polygon points="99,-2 84,7.5 99,17" fill="#c5256d" />
            </>
          ) : null}
        </g>
      </g>
    </svg>
  );
}

/** A chick on its own box of the given size, the way the page places one. */
export function Pet({
  hue,
  size,
  mood,
  interactive,
  float,
}: {
  hue: MascotHue;
  size: number;
  mood?: "idle" | "working" | "happy";
  interactive?: boolean;
  float?: boolean;
}) {
  return (
    <span
      className="mascot"
      style={{ "--s": `${size}px` } as React.CSSProperties}
      data-float={float ? "" : undefined}
    >
      <Chick hue={hue} mood={mood} interactive={interactive} />
    </span>
  );
}
