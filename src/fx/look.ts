// How the air changes the drawn flame. THIS IS AN ILLUSTRATION, NOT A COMBUSTION MODEL.
// It only encodes the direction of two well-known trends so a viewer can compare habitats:
//   more oxygen  -> a tighter, brighter flame
//   less pressure -> a larger, dimmer flame
// The exponents and clamps are picked for legibility, not fitted to any experiment. Scene captions
// that use it must say the flame look is illustrative.

/** Reference air: sea-level cabin air, the look every other value is relative to. */
export const REF_O2_PERCENT = 21;
export const REF_PRESSURE_KPA = 101.3;

export type FlameLook = {
  /** Multiplier on the flame's drawn diameter; 1 at reference air. */
  scale: number;
  /** Multiplier on the flame's drawn brightness; 1 at reference air. */
  brightness: number;
  /** False when the inputs cannot hold a flame at all (no oxygen or no pressure). */
  lit: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The one mapping from air to flame look. See the file comment: illustrative only. */
export function flameLook(o2Percent: number, pressureKPa: number = REF_PRESSURE_KPA): FlameLook {
  if (!(o2Percent > 0) || !(pressureKPa > 0)) return { scale: 0, brightness: 0, lit: false };
  const o = o2Percent / REF_O2_PERCENT;
  const p = pressureKPa / REF_PRESSURE_KPA;
  return {
    scale: clamp(o ** -0.5 * p ** -0.3, 0.6, 1.6),
    brightness: clamp(o ** 1.5 * p ** 0.5, 0.25, 2.5),
    lit: true,
  };
}

/** How far the flame leans downstream, as a stretch factor of its radius (0 = round). Illustrative. */
export function leanFromAirflow(airflowCmS: number | undefined): number {
  if (!airflowCmS || !(airflowCmS > 0)) return 0;
  return clamp((airflowCmS / 20) * 0.6, 0, 1.5);
}
