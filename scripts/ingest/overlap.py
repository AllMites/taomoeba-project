"""Habitat presets and the condition-overlap score. Pure functions, no I/O."""

# id, label, O2 %, pressure kPa, one plain sentence. Mars base omitted: no cited planned atmosphere.
HABITATS = [
    ("iss", "ISS", 21.0, 101.3, "Sea-level cabin air, the atmosphere almost all station fire tests use."),
    ("moon", "Moon Base", 30.0, 70.3, "Planned lunar cabin: less pressure and more oxygen than the station."),
    ("rover", "Pressurized rover", 30.0, 70.3, "Same cabin atmosphere as the Moon Base preset."),
    ("suit-ref", "Suit reference", 100.0, 29.6, "Pure oxygen at low pressure, as in a spacesuit (reference only)."),
]

# Distance floor when a tested range has zero span (single test value).
FLOOR = {"o2": 5.0, "pressure": 10.0}


def dim_score(value, rng, floor):
    """Score one dimension, 0..1.

    rng = (lo, hi) tested range, or None when the table has no such column.
      * None                      -> None (unknown, never 0)
      * lo <= value <= hi         -> 1
      * else d = distance to the nearest bound, span = max(hi - lo, floor)
                                  -> max(0, 1 - d / span)
    O2 is in percentage points, pressure in kPa. floor is 5 points / 10 kPa.
    """
    if rng is None:
        return None
    lo, hi = rng
    d = lo - value if value < lo else value - hi if value > hi else 0.0
    if d == 0.0:
        return 1.0
    return max(0.0, 1.0 - d / max(hi - lo, floor))


def overlap(habitat, o2_range, pressure_range):
    """One investigation x one habitat.

    Returns (overlap, dimsUsed). dimsUsed = number of (O2, pressure) the table has.
    overlap = mean of the available per-dimension scores; None when dimsUsed == 0.
    Hand check: habitat O2 30 %, tested O2 [21, 21] (span 0 -> floor 5): d = 9,
    score = max(0, 1 - 9/5) = 0.  Tested pressure [101.3, 101.3] vs 70.3 kPa: d = 31 >= 10 -> 0.
    """
    scores = [s for s in (dim_score(habitat["o2Percent"], o2_range, FLOOR["o2"]),
                          dim_score(habitat["pressureKPa"], pressure_range, FLOOR["pressure"]))
              if s is not None]
    if not scores:
        return None, 0
    return round(sum(scores) / len(scores), 3), len(scores)


def overlap_rows(investigations, habitats):
    return [{"investigationId": inv["id"], "habitat": h["id"],
             "overlap": ov, "dimsUsed": n,
             "o2Tested": inv["o2Range"], "pressureTestedKPa": inv["pressureRange"]}
            for inv in investigations for h in habitats
            for ov, n in [overlap(h, inv["o2Range"], inv["pressureRange"])]]
