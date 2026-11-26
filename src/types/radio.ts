export type UserRole = 'admin' | 'manager' | 'staff' | 'subscriber';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RadioTrack {
  id: string;
  title: string;
  artist: string;
  playlistId: string;
  genre: string;
  durationSeconds: number;
  bpm: number;
  audioUrl: string;
  coverUrl: string;
  isCommunity?: boolean;
  audioFormat?: 'MP3' | 'WAV';
}

export interface Playlist {
  id: string;
  name: string;
  daypart: string;
  description: string;
  coverUrl: string;
  trackCount: number;
}

export interface AudioZone {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  activePlaylistId: string;
  updatedBy: string;
  updatedAt?: unknown;
}

export interface PlaylistSchedule {
  id: string;
  name: string;
  playlistId: string;
  daypart: string;
  startTime: string;
  endTime: string;
  days: string[];
  enabled: boolean;
  updatedBy: string;
  updatedAt?: unknown;
}

export type ShiftStatus = 'scheduled' | 'active' | 'completed';

export interface StaffShift {
  id: string;
  employeeName: string;
  role: string;
  zone: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  notes?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type InventoryStatus = 'nominal' | 'low' | 'reorder';

export interface InventoryLog {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  parLevel: number;
  unit: string;
  status: InventoryStatus;
  loggedBy: string;
  loggedByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type SubmissionType = 'Original' | 'Instrumental' | 'Cover Clean Edit';
export type SubmissionStatus = 'pending' | 'in_review' | 'approved' | 'rejected';

export interface MusicSubmission {
  id: string;
  submitterId: string;
  submitterName: string;
  submitterEmail: string;
  artistName: string;
  trackTitle: string;
  genre: string;
  submissionType: SubmissionType;
  audioFormat: 'MP3' | 'WAV';
  fileUrl: string;
  fileSizeBytes: number;
  durationSeconds: number;
  cleanEditCertified: boolean;
  status: SubmissionStatus;
  reviewerNotes?: string;
  confirmationEmailSent: boolean;
  confirmationEmailId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ApprovedTrack {
  id: string;
  submissionId: string;
  artistName: string;
  trackTitle: string;
  genre: string;
  audioFormat: 'MP3' | 'WAV';
  fileUrl: string;
  durationSeconds: number;
  approvedAt?: unknown;
}

export interface TrackFeedback {
  id: string;
  trackId: string;
  userId: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt?: unknown;
}

export interface UserNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'submission_status' | 'report_ready' | 'system';
  read: boolean;
  relatedId?: string;
  createdAt?: unknown;
}

export type ReportScope = 'operations' | 'inventory' | 'submissions' | 'executive';

export interface ReportSchedule {
  id: string;
  name: string;
  reportScope: ReportScope;
  format: 'CSV' | 'JSON';
  dayOfMonth: number;
  recipientEmail: string;
  enabled: boolean;
  lastRunAt?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReportActivityLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: UserRole;
  action: 'export_csv' | 'export_json' | 'scheduled_monthly_run' | 'access_audit';
  reportScope: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  rowCount: number;
  privacyRedacted: boolean;
  emailDispatched: boolean;
  createdAt?: unknown;
}

export interface EmailReceipt {
  id: string;
  to: string;
  subject: string;
  category: 'submission_confirmation' | 'report_notification';
  status: 'sent_smtp' | 'dispatched_relay';
  summary: string;
  sentAt: string;
}

export const BLUEPRINT_LIMITS = {
  NAME_MAX: 100,
  TITLE_MAX: 120,
  EMAIL_MAX: 256,
  NOTES_MAX: 500,
  COMMENT_MAX: 400,
  MAX_UPLOAD_BYTES: 26214400,
} as const;
