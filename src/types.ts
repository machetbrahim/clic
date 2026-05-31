export type DriveType = 'document' | 'spreadsheet' | 'presentation' | 'folder' | 'file' | 'generic';
export type ExportType = 'redirect' | 'direct' | 'pdf' | 'office';

export interface ShortLink {
  id: string;
  originalUrl: string;
  shortId: string;
  title: string;
  driveType: DriveType;
  exportType: ExportType;
  createdAt: number;
  clickCount: number;
  password?: string;
  clickLimit?: number;
  expiresAt?: string; // ISO String
}

export interface ClickEvent {
  id: string;
  linkId: string;
  timestamp: number;
  userAgent: string;
  browser: string;
  os: string;
  device: 'desktop' | 'tablet' | 'mobile' | 'unknown';
  referer: string;
  country?: string;
}

export interface LinkStats {
  link: ShortLink;
  clicks: ClickEvent[];
}

export interface DashboardStats {
  totalLinks: number;
  totalClicks: number;
  driveTypesCount: Record<DriveType, number>;
  exportTypesCount: Record<ExportType, number>;
  clicksOverTime: { date: string; clicks: number }[];
  devicesCount: { name: string; value: number }[];
  browsersCount: { name: string; value: number }[];
}
