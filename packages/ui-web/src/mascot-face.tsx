import type { MascotId, MascotMood } from "@corvo/core";
import { MASCOT_EYES, MASCOT_LOOKS } from "@corvo/core";
import { useId } from "react";

const INK = "#0f0f0f";
const BEAK = "#f9b64f";
const BOW = "#c5256d";
const HEADSET = "#1c1c1e";

/**
 * A chick: a rounded tile in the agent's shade with a crest, two eyes and a beak. The eyes are
 * drawn here so they can move: they follow the pointer, blink on their own, scan while the agent
 * works, widen when it waits for you, droop when it failed and close into a smile for a moment
 * when it finished. `detailed` adds the crest and the accessory, which are too fine for a tiny one.
 */
export function MascotFace({
  mascot,
  mood,
  blink,
  detailed,
}: {
  mascot: MascotId;
  mood: MascotMood;
  blink: { every: string; delay: string };
  detailed: boolean;
}) {
  const look = MASCOT_LOOKS[mascot];
  const clip = useId();
  const ry = look.sleepy ? MASCOT_EYES.sleepyRy : MASCOT_EYES.ry;
  const cy = look.sleepy ? MASCOT_EYES.sleepyY : MASCOT_EYES.centers[0].y;
  return (
    <svg
      className="corvo-mascot-eyes"
      data-mood={mood}
      viewBox="0 0 100 100"
      aria-hidden="true"
      overflow="visible"
      style={{ "--blink-every": blink.every, "--blink-delay": blink.delay } as React.CSSProperties}
    >
      <defs>
        <clipPath id={clip}>
          <rect width="100" height="100" rx="36" />
        </clipPath>
      </defs>
      {detailed ? (
        <g className="corvo-mascot-crest" fill={look.color}>
          <polygon points="37,-12 44,8 30,8" transform="rotate(-22 37 -2)" />
          <polygon points="48,-17 55,7 41,7" transform="rotate(-6 48 -5)" />
          <polygon points="58,-11 64,7 52,7" transform="rotate(14 58 -2)" />
        </g>
      ) : null}
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
      <g className="corvo-mascot-gaze">
        <g className="corvo-mascot-scan">
          {MASCOT_EYES.centers.map((center) =>
            mood === "happy" ? (
              <path
                key={center.x}
                className="corvo-mascot-smile"
                d={`M ${center.x - 7.5} 47 Q ${center.x} 37 ${center.x + 7.5} 47`}
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
              />
            ) : (
              <g key={center.x} className="corvo-mascot-eye">
                <g className="corvo-mascot-blink">
                  <ellipse
                    className="corvo-mascot-eye-ball"
                    cx={center.x}
                    cy={cy}
                    rx={MASCOT_EYES.rx}
                    ry={ry}
                  />
                  {look.sleepy ? null : (
                    <circle
                      className="corvo-mascot-eye-light"
                      cx={center.x - 2.3}
                      cy={cy - 4}
                      r="2.7"
                    />
                  )}
                </g>
              </g>
            ),
          )}
        </g>
      </g>
      <polygon points="42,56 58,56 50,68" fill={BEAK} />
      {detailed && look.accessory === "headset" ? (
        <>
          <rect x="-4" y="34" width="14" height="28" rx="4" fill={HEADSET} />
          <rect
            x="6"
            y="62"
            width="20"
            height="5"
            rx="2.5"
            fill={HEADSET}
            transform="rotate(28 16 64.5)"
          />
        </>
      ) : null}
      {detailed && look.accessory === "bow" ? (
        <>
          <polygon points="66,-2 81,7.5 66,17" fill={BOW} />
          <polygon points="99,-2 84,7.5 99,17" fill={BOW} />
        </>
      ) : null}
    </svg>
  );
}
