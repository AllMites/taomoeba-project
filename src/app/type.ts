/** Names this short are set in uppercase display type; longer ones keep their case so they stay readable. */
export const UPPER_MAX = 14;

/** Class names for a name set in display type: "t-display", plus "t-upper" when the name is short. */
export const displayClass = (name: string) => (name.trim().length <= UPPER_MAX ? "t-display t-upper" : "t-display");
