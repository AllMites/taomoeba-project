/** The ranking rule, shown verbatim in the UI and used by scripts/rank/build.ts. At most five plain sentences. */
export const HOW_RANKING_WORKS =
  "Each experiment gets five checks for the habitat you pick: oxygen match and pressure match count double, while how directly it studies fire safety, whether it flew in space, and how well its stated goal fits count once. " +
  "Each check is worth 0 to 1; oxygen or pressure inside the tested range scores 1, and outside it falls in a straight line to 0 at a gap equal to the tested span (at least 5 points of oxygen or 10 kPa). " +
  "The score is the weighted average of the five (the weights add up to 7), and a check the record cannot answer counts as half, because unknown is neither a match nor a miss. " +
  "Equal scores are ordered by how many checks the record could answer, then by experiment id. " +
  "The goal-fit check is the only one an SI rates; the other four come straight from the record.";
