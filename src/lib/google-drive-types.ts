/** How the Drive archive looks from Booth control. */
export type DriveStatus =
  | { state: "off" }
  | { state: "disconnected" }
  | { state: "broken"; email: string }
  | { state: "connected"; email: string; folderUrl: string | null };
