import React, { useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  CheckCircle2,
  Clock,
  FileAudio,
  Mail,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { useRadio } from '../context/RadioContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { EmailReceipt, SubmissionStatus, SubmissionType } from '../types/radio';
import { extractIsoDate } from '../utils/csvExport';

const STATUS_LABELS: Record<SubmissionStatus, { label: string; tone: string }> = {
  pending: { label: 'Pending Review', tone: 'text-amber-800' },
  in_review: { label: 'In Audio QC', tone: 'text-sky-800' },
  approved: { label: 'Approved & On Air', tone: 'text-emerald-800' },
  rejected: { label: 'Declined', tone: 'text-red-700' },
};

export const SubmitView: React.FC = () => {
  const { user, profile, signIn, submissions } = useRadio();

  const [artistName, setArtistName] = useState('');
  const [trackTitle, setTrackTitle] = useState('');
  const [genre, setGenre] = useState('Acoustic Folk');
  const [submissionType, setSubmissionType] = useState<SubmissionType>('Original');
  const [submitterEmail, setSubmitterEmail] = useState(user?.email || '');
  const [cleanEditCertified, setCleanEditCertified] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailConfirmation, setEmailConfirmation] = useState<EmailReceipt | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionStatus>('all');

  const mySubmissions = useMemo(() => {
    if (!user) return [];
    return submissions
      .filter((s) => s.submitterId === user.uid)
      .filter((s) => statusFilter === 'all' || s.status === statusFilter);
  }, [submissions, user, statusFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'mp3' && ext !== 'wav') {
      setErrorMessage('Only high-quality MP3 or WAV audio files are accepted.');
      setSelectedFile(null);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('File exceeds the 25 MB broadcast upload limit.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setErrorMessage(null);
    setEmailConfirmation(null);

    if (!cleanEditCertified) {
      setErrorMessage('You must certify that this track is a family-friendly Clean Radio Edit.');
      return;
    }
    if (!selectedFile) {
      setErrorMessage('Please select an MP3 or WAV audio file to upload.');
      return;
    }

    const emailToUse = (submitterEmail || user.email || '').trim();
    if (!emailToUse.includes('@')) {
      setErrorMessage('Please provide a valid email address for automated confirmation.');
      return;
    }

    setUploading(true);
    setUploadProgress(5);

    try {
      const formData = new FormData();
      formData.append('audioFile', selectedFile);
      formData.append('artistName', artistName.trim());
      formData.append('trackTitle', trackTitle.trim());
      formData.append('submitterEmail', emailToUse);
      formData.append('genre', genre);
      formData.append('submissionType', submissionType);
      formData.append('cleanEditCertified', 'true');

      const uploadResult = await new Promise<{
        fileUrl: string;
        audioFormat: 'MP3' | 'WAV';
        fileSizeBytes: number;
        durationSeconds: number;
        confirmationEmailSent: boolean;
        confirmationEmailId: string;
        emailReceipt: EmailReceipt;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/submissions/upload');
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const pct = Math.round((ev.loaded / ev.total) * 92);
            setUploadProgress(pct);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error('Invalid server response during upload.'));
            }
          } else {
            try {
              const errBody = JSON.parse(xhr.responseText) as { error?: string };
              reject(new Error(errBody.error || `Upload failed (${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          }
        };
        xhr.onerror = () => reject(new Error('Network error while uploading audio file.'));
        xhr.send(formData);
      });

      setUploadProgress(96);
      const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      try {
        await setDoc(doc(db, 'submissions', subId), {
          id: subId,
          submitterId: user.uid,
          submitterName: profile.displayName.slice(0, 100),
          submitterEmail: emailToUse.slice(0, 256),
          artistName: artistName.trim().slice(0, 100),
          trackTitle: trackTitle.trim().slice(0, 120),
          genre,
          submissionType,
          audioFormat: uploadResult.audioFormat,
          fileUrl: uploadResult.fileUrl,
          fileSizeBytes: uploadResult.fileSizeBytes,
          durationSeconds: uploadResult.durationSeconds,
          cleanEditCertified: true,
          status: 'pending',
          confirmationEmailSent: uploadResult.confirmationEmailSent,
          confirmationEmailId: uploadResult.confirmationEmailId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, `submissions/${subId}`);
      }

      setUploadProgress(100);
      setEmailConfirmation(uploadResult.emailReceipt);
      setArtistName('');
      setTrackTitle('');
      setSelectedFile(null);
      setCleanEditCertified(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 font-display text-balance">
          Submit Clean Music for On-Air Broadcast
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Submit family-friendly Clean Radio Edits in high-quality MP3 or WAV format. Track your submission status in real time.
        </p>
      </div>

      {!user ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 max-w-xl mx-auto text-center space-y-4">
          <UploadCloud className="w-10 h-10 text-amber-700 mx-auto" />
          <h2 className="text-xl font-semibold text-stone-900 font-display">
            Sign In to Submit & Track Your Music
          </h2>
          <p className="text-sm text-stone-600">
            Verify your artist or listener account to upload Clean Radio Edits, receive automated email confirmations, and monitor review progress.
          </p>
          <button
            type="button"
            onClick={signIn}
            className="min-h-[44px] inline-flex items-center justify-center rounded-xl bg-[#1A1614] px-6 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
          >
            Sign In with Google
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Music Submission Form */}
          <div className="lg:col-span-6 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-900 font-display">
                  Clean Radio Edit Submission
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  MP3 or WAV · Max 25 MB · Strictly zero explicit lyrics or profanity
                </p>
              </div>
              <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0" />
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 flex items-start gap-2">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {emailConfirmation && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-1.5 text-xs text-emerald-900">
                <div className="flex items-center gap-2 font-semibold">
                  <Mail className="w-4 h-4 shrink-0" />
                  Automated Email Confirmation Dispatched
                </div>
                <p>{emailConfirmation.summary}</p>
                <p className="font-mono tabular-nums text-[11px] text-emerald-800">
                  To: {emailConfirmation.to} · Ref: {emailConfirmation.id}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Artist / Band Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    placeholder="e.g. Oakwood Trio"
                    className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Track Title (Clean Edit)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={trackTitle}
                    onChange={(e) => setTrackTitle(e.target.value)}
                    placeholder="e.g. Sunday Porch Song"
                    className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Genre</label>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
                  >
                    <option value="Acoustic Folk">Acoustic Folk</option>
                    <option value="Hospitality Jazz">Hospitality Jazz</option>
                    <option value="Clean Country">Clean Country</option>
                    <option value="Heartland Pop">Heartland Pop</option>
                    <option value="Instrumental Groove">Instrumental Groove</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Submission Type
                  </label>
                  <select
                    value={submissionType}
                    onChange={(e) => setSubmissionType(e.target.value as SubmissionType)}
                    className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
                  >
                    <option value="Original">Original</option>
                    <option value="Instrumental">Instrumental</option>
                    <option value="Cover Clean Edit">Cover Clean Edit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Confirmation Email Address
                </label>
                <input
                  type="email"
                  required
                  maxLength={256}
                  value={submitterEmail || user.email || ''}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  High-Quality Audio File (MP3 or WAV)
                </label>
                <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 cursor-pointer hover:border-amber-600 transition-colors">
                  <FileAudio className="w-7 h-7 text-amber-700" />
                  <span className="text-xs font-medium text-stone-800 text-center">
                    {selectedFile
                      ? `${selectedFile.name} (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)`
                      : 'Tap to choose an MP3 or WAV Clean Radio Edit'}
                  </span>
                  <input
                    type="file"
                    accept=".mp3,.wav,audio/mpeg,audio/wav"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanEditCertified}
                  onChange={(e) => setCleanEditCertified(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-amber-600 rounded"
                />
                <span className="text-xs text-stone-700 leading-relaxed">
                  I certify this recording is a <strong>Clean Radio Edit</strong> free of profanity, explicit themes, or jarring volume spikes, suitable for all Golden Corral family dining guests.
                </span>
              </label>

              {uploading && (
                <div className="space-y-1.5" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="flex items-center justify-between text-xs font-medium text-stone-700">
                    <span>Uploading & Verifying Audio...</span>
                    <span className="font-mono tabular-nums">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-stone-200 overflow-hidden">
                    <div
                      className="h-full bg-amber-600 transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                {uploading ? `Uploading (${uploadProgress}%)` : 'Submit Clean Track for Broadcast'}
              </button>
            </form>
          </div>

          {/* User Submission Status Dashboard */}
          <div className="lg:col-span-6 rounded-2xl border border-stone-200 bg-white overflow-hidden">
            <div className="p-5 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-900 font-display">
                  Your Submission History
                </h2>
                <p className="text-xs text-stone-500">
                  Live processing status and broadcast reviewer feedback
                </p>
              </div>
              <select
                aria-label="Filter submissions by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | SubmissionStatus)}
                className="min-h-[38px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs text-stone-800"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="in_review">In Audio QC</option>
                <option value="approved">Approved & On Air</option>
                <option value="rejected">Declined</option>
              </select>
            </div>

            {mySubmissions.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Clock className="w-8 h-8 text-stone-400 mx-auto" />
                <p className="text-sm font-medium text-stone-800">No submissions found</p>
                <p className="text-xs text-stone-500">
                  Submit a Clean Radio Edit using the form to start tracking its broadcast review status.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {mySubmissions.map((sub) => {
                  const st = STATUS_LABELS[sub.status];
                  return (
                    <li key={sub.id} className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                            <span>{sub.submissionType}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{sub.audioFormat}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {extractIsoDate(sub.createdAt) || 'Just now'}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-stone-900 mt-0.5">
                            {sub.trackTitle} — {sub.artistName}
                          </h3>
                        </div>

                        <span className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${st.tone}`}>
                          {sub.status === 'approved' ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : sub.status === 'rejected' ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                          {st.label}
                        </span>
                      </div>

                      <audio controls preload="none" src={sub.fileUrl} className="w-full h-9" />

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
                        <span>
                          {sub.confirmationEmailSent
                            ? `Email receipt confirmed (${sub.confirmationEmailId || 'Dispatched'})`
                            : 'Queued'}
                        </span>
                        {sub.reviewerNotes && (
                          <span className="text-stone-700 font-medium">
                            Note: {sub.reviewerNotes}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
