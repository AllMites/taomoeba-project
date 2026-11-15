import { useEffect, useRef, type KeyboardEvent } from "react";
import { BASE_ORDER, habitatOf, pickBase, type BaseId } from "../app/console.ts";
import type { HabitatPreset } from "../contracts/index.ts";
import { Icon } from "./icons.tsx";
import { baseForKey, stepBase } from "./logic.ts";

/** Names shown before the habitat data arrives, and Earth's, which is not a habitat preset. */
const FALLBACK: Record<BaseId, string> = { iss: "ISS", moon: "Moon Base", rover: "Pressurized rover", earth: "Earth" };
const num = (n: number) => `${Math.round(n * 10) / 10}`;

/**
 * Base carousel, top center over the replay: ISS, Moon Base, Pressurized rover, then Earth as a bonus card.
 * One radio group. Click, the two arrow buttons, or Left/Right all pick a base; it never advances by itself,
 * because every pick re-ranks. Self-contained so a 3D version can replace the visuals later.
 */
export default function Carousel({ base, habitats }: { base: BaseId; habitats: HabitatPreset[] | null }) {
  const track = useRef<HTMLDivElement>(null);
  const label = (b: BaseId) => (b === "earth" ? FALLBACK.earth : (habitats?.find((h) => h.id === b)?.label ?? FALLBACK[b]));
  const air = habitats?.find((h) => h.id === habitatOf(base));

  // Keep the picked card in view on a narrow screen, and keep keyboard focus on it after an arrow key.
  useEffect(() => {
    const picked = track.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!picked) return;
    if (track.current!.contains(document.activeElement)) picked.focus({ preventScroll: true });
    picked.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [base]);

  const onKey = (e: KeyboardEvent) => {
    const next = baseForKey(e.key, base);
    if (!next) return;
    e.preventDefault();
    pickBase(next);
  };

  return (
    <div className="console-carousel glass">
      <div className="carousel-row">
        <button type="button" className="icon-btn" aria-label="Previous base" onClick={() => pickBase(stepBase(base, -1))}>
          <Icon name="left" />
        </button>
        <div className="carousel-track" role="radiogroup" aria-label="Base" ref={track} onKeyDown={onKey}>
          {BASE_ORDER.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={b === base}
              tabIndex={b === base ? 0 : -1}
              className={b === "earth" ? "base base-bonus t-display t-upper" : "base t-display t-upper"}
              onClick={() => pickBase(b)}
            >
              {label(b)}
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn" aria-label="Next base" onClick={() => pickBase(stepBase(base, 1))}>
          <Icon name="right" />
        </button>
      </div>
      <p className="carousel-air t-readout" aria-live="polite">
        {air ? (
          <>
            <span>
              O₂ <b>{num(air.o2Percent)}%</b>
            </span>
            <span>
              <b>{num(air.pressureKPa)}</b> kPa
            </span>
            {base === "earth" && <span>Same air as the ISS</span>}
          </>
        ) : (
          <span>&nbsp;</span>
        )}
      </p>
    </div>
  );
}
