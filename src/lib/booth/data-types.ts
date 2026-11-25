/** Which window the top 3 covers. */
export type TopScope = "today" | "yesterday" | "weekend";
export type TopThree = { scope: TopScope; photos: import("@/lib/booth/types").TopPhoto[] };
