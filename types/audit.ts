export type PinCategory = "SEO" | "Visual Design" | "CRO" | "Feedback";

export interface PinReply {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
  authorName?: string | null;
}

export interface Pin {
  /** Stable id for reply/delete APIs; assigned on read or at creation */
  id?: string;
  x: number;
  y: number;
  /** Optional; defaults to "Feedback" when not set */
  category?: PinCategory;
  feedback: string;
  /** Full URL of the page when comment was added (live view) */
  pageUrl?: string;
  /** CSS selector for the element (live view) */
  selector?: string;
  /** Screenshot of the comment location */
  screenshotUrl?: string;
  /** Vercel Blob URL of a voice recording attached to this pin */
  audioUrl?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  /** Scroll position when pin was added (so hotspot stays in document coordinates) */
  scrollX?: number;
  scrollY?: number;
  /** Exact document position in px (avoids percentage round-trip error in live view) */
  docX?: number;
  docY?: number;
  /** Thread replies from signed-in viewers */
  replies?: PinReply[];
}

export interface AuditData {
  id: string;
  url: string;
  goal: string;
  screenshotUrl: string;
  pins: Pin[];
  createdAt: Date;
}
