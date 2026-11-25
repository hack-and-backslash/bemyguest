export type PhotoExt = "webp" | "jpg";

/** One photo as the feed shows it. */
export type FeedPhoto = {
  id: string;
  guestId: string;
  authorName: string;
  authorAvatar: string | null;
  caption: string;
  createdAt: string;
  width: number;
  height: number;
  thumbUrl: string;
  fullUrl: string;
  /** The untouched file, for saving and the couple's ZIPs. */
  downloadUrl: string;
  ext: PhotoExt;
  hearts: number;
  hearted: boolean;
  mine: boolean;
  hidden: boolean;
  /** Copied to Google Drive; the booth shows a lighter copy. */
  archived: boolean;
};

export type TopPhoto = FeedPhoto & { rank: 1 | 2 | 3 };

export type FeedPage = { photos: FeedPhoto[]; nextCursor: string | null };

export type BoothStats = { photos: number; snappers: number };

/** What the upload step hands back to the phone: where to send the photo. */
export type UploadTicket = {
  photoId: string;
  ext: PhotoExt;
  token: string;
  upload: { url: string; fields: Record<string, string> };
};

export type AdminPhoto = FeedPhoto & { bytes: number };
