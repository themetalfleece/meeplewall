const SKELETON_CARD_COUNT = 12;

/** Stable keys for the skeleton's placeholder cards. */
export const SKELETON_CARD_KEYS = [...Array(SKELETON_CARD_COUNT).keys()].map(
  (index) => `slot-${index}`,
);
