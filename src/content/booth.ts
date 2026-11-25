/**
 * Photo Booth settings. Times are IST, like everything in content/wedding.ts.
 * opensAt, uploadsCloseAt, maxPerGuest and storageBudgetMB are only the
 * starting values: change them on the dashboard (Site settings → Photo booth).
 */
export const booth = {
  /** Guests can start sharing from here: travel snaps welcome. */
  opensAt: "2027-01-30T06:00:00+05:30",
  /** Uploads close here; after that the booth stays up as the photo album. */
  uploadsCloseAt: "2027-03-01T23:59:00+05:30",
  /** Photos a guest can share in one go. */
  maxPerBatch: 10,
  /**
   * Photos one guest can share in total. About 0.5–0.9 MB each, so 30 keen
   * guests at 100 apiece is roughly 2 GB.
   */
  maxPerGuest: 100,
  /**
   * New uploads pause when the booth's files reach this many MB, just under
   * ImageKit's free 3 GB, so the plan never runs out mid-wedding. If you
   * upgrade ImageKit (Lite has 10 GB), raise it.
   */
  storageBudgetMB: 2800,
  captionMax: 140,
};
