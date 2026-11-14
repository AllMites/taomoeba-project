// Flame API shared by every scene. Lane D owns the inside of this folder; the props below are the
// contract other scenes build against, so change them only through the integrator.
export type FlameProps = {
  /** Oxygen in the air, percent by volume. */
  o2Percent: number;
  /** Air pressure, kPa. */
  pressureKPa?: number;
  /** Air flow past the flame, cm/s. The flame leans downstream (+x in local space). */
  airflowCmS?: number;
  /** Flame diameter in metres at 21% oxygen, before the oxygen scaling. */
  size?: number;
  /** True: draw one still frame, no flicker. */
  calm?: boolean;
};

/** A microgravity flame: round, blue shell, pale core, no plume. Place it with a parent <group>. */
export function Flame({ o2Percent, size = 0.1 }: FlameProps) {
  // Placeholder from the integrator; Lane D replaces the body.
  return (
    <mesh scale={size * (0.6 + o2Percent / 50)}>
      <sphereGeometry args={[0.5, 24, 24]} />
      <meshBasicMaterial color="#3d7bff" transparent opacity={0.7} />
    </mesh>
  );
}
