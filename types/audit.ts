export type PinCategory = "SEO" | "Visual Design" | "CRO" | "Feedback";

export interface Pin {
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
  viewportWidth?: number;
  viewportHeight?: number;
  /** Scroll position when pin was added (so hotspot stays in document coordinates) */
  scrollX?: number;
  scrollY?: number;
}

export interface AuditData {
  id: string;
  url: string;
  goal: string;
  screenshotUrl: string;
  pins: Pin[];
  createdAt: Date;
}
