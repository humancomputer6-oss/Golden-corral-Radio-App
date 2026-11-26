import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Mail,
  Shield,
  SlidersHorizontal,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useRadio } from '../context/RadioContext';
import type { EmailReceipt, MusicSubmission, SubmissionType, UserRole } from '../types/radio';
import { extractIsoDate, isWithinDateRange } from '../utils/csvExport';

export const AdminView: React.FC = () => {
  const {
    user,
    profile,
    signIn,
    submissions,
    reviewSubmission,
    allUsers,
    updateUserRole,
  } = useRadio();

  const [typeFilter, setTypeFilter] = useState<'all' | SubmissionType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | MusicSubmission['status']>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [outbox, setOutbox] = useState<EmailReceipt[]>([]);

  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!isAdminOrManager) return;
    fetch('/api/emails/outbox')
      .then((r) => (r.ok ? r.json() : { receipts: [] }))
      .then((data: { receipts?: EmailReceipt[] }) => setOutbox(data.receipts || []))
      .catch(() => {});
  }, [isAdminOrManager, submissions.length]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (typeFilter !== 'all' && sub.submissionType !== typeFilter) return false;
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
      const createdDate = extractIsoDate(sub.createdAt);
      if (!isWithinDateRange(createdDate, dateFrom, dateTo)) return false;
      return true;
    });
  }, [submissions, typeFilter, statusFilter, dateFrom, dateTo]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 max-w-xl mx-auto text-center space-y-4">
        <Shield className="w-10 h-10 text-amber-700 mx-auto" />
        <h1 className="text-2xl font-bold text-stone-900 font-display">
          Broadcast Admin Console
        </h1>
        <p className="text-sm text-stone-600">
          Sign in with an authorized administrator or manager account to review incoming music submissions and manage RBAC permissions.
        </p>
        <button
          type="button"
          onClick={signIn}
          className="min-h-[44px] inline-flex items-center justify-center rounded-xl bg-[#1A1614] px-6 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  if (!isAdminOrManager) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 max-w-xl mx-auto text-center space-y-3">
        <Shield className="w-10 h-10 text-stone-500 mx-auto" />
        <h1 className="text-xl font-semibold text-stone-900 font-display">
          Role-Based Access Restricted
        </h1>
        <p className="text-sm text-stone-600">
          Your account role is <span className="font-semibold">{profile?.role}</span>. Only verified Administrators and Managers can access the submission moderation queue and RBAC controls.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 font-display">
          Broadcast Admin & Submission Moderation
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Audition incoming Clean Radio Edits, filter by date and submission type, and notify artists in real time.
        </p>
      </div>

      {/* Filters Toolbar */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <SlidersHorizontal className="w-4 h-4 text-amber-700" />
          <span>Filter Incoming Submissions</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Submission Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | SubmissionType)}
              className="w-full min-h-[42px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
            >
              <option value="all">All Types</option>
              <option value="Original">Original</option>
              <option value="Instrumental">Instrumental</option>
              <option value="Cover Clean Edit">Cover Clean Edit</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | MusicSubmission['status'])
              }
              className="w-full min-h-[42px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_review">In Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Declined</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-mono tabular-nums"
            />
          </div>
        </div>
      </section>

      {/* Incoming Submissions Queue */}
      <section className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900 font-display">
            Submission Queue (<span className="font-mono tabular-nums">{filteredSubmissions.length}</span>)
          </h2>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-500">
            No incoming submissions match the current date or type filters.
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {filteredSubmissions.map((sub) => {
              const noteVal = notesMap[sub.id] ?? sub.reviewerNotes ?? '';
              return (
                <li key={sub.id} className="p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span>{sub.submissionType}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{sub.audioFormat}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {extractIsoDate(sub.createdAt) || 'Today'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{sub.submitterEmail}</span>
                      </div>
                      <h3 className="text-base font-semibold text-stone-900 mt-1">
                        {sub.trackTitle} — {sub.artistName}
                      </h3>
                      <p className="text-xs text-stone-600 mt-0.5">
                        Genre: {sub.genre} · Clean Edit Certified: {sub.cleanEditCertified ? 'Yes' : 'No'}
                      </p>
                    </div>

                    <span className="text-xs font-semibold capitalize text-amber-800">
                      Status: {sub.status.replace('_', ' ')}
                    </span>
                  </div>

                  <audio controls preload="none" src={sub.fileUrl} className="w-full h-9" />

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                      type="text"
                      maxLength={500}
                      value={noteVal}
                      onChange={(e) =>
                        setNotesMap((prev) => ({ ...prev, [sub.id]: e.target.value }))
                      }
                      placeholder="Broadcast reviewer feedback note..."
                      className="flex-1 min-h-[42px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs"
                    />
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => reviewSubmission(sub, 'in_review', noteVal)}
                        className="min-h-[42px] rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 whitespace-nowrap"
                      >
                        Mark Audio QC
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewSubmission(sub, 'approved', noteVal)}
                        className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve & Air
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewSubmission(sub, 'rejected', noteVal)}
                        className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800 whitespace-nowrap"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Decline
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Role-Based Access Control Directory (Admin Only) & Automated Email Dispatch Outbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {isAdmin && (
          <section className="lg:col-span-6 rounded-2xl border border-stone-200 bg-white overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-stone-900 font-display">
                  User Role-Based Access Control
                </h2>
                <p className="text-xs text-stone-500">
                  Assign Admin, Manager, Staff, or Free Subscriber privileges.
                </p>
              </div>
              <UserCheck className="w-5 h-5 text-amber-700 shrink-0" />
            </div>
            <ul className="divide-y divide-stone-100">
              {allUsers.map((u) => (
                <li key={u.uid} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate">{u.displayName}</p>
                    <p className="text-xs text-stone-500 truncate">{u.email}</p>
                  </div>
                  <select
                    aria-label={`Role for ${u.email}`}
                    value={u.role}
                    onChange={(e) => updateUserRole(u.uid, e.target.value as UserRole)}
                    className="min-h-[40px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs font-medium text-stone-900"
                  >
                    <option value="subscriber">Subscriber</option>
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          className={`${
            isAdmin ? 'lg:col-span-6' : 'lg:col-span-12'
          } rounded-2xl border border-stone-200 bg-white overflow-hidden`}
        >
          <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-stone-900 font-display">
                Automated Email Outbox
              </h2>
              <p className="text-xs text-stone-500">
                Recent submission confirmations and scheduled report email dispatches.
              </p>
            </div>
            <Mail className="w-5 h-5 text-amber-700 shrink-0" />
          </div>
          {outbox.length === 0 ? (
            <div className="p-6 text-center text-xs text-stone-500">
              No automated emails dispatched in this server session yet.
            </div>
          ) : (
            <ul className="divide-y divide-stone-100 max-h-80 overflow-y-auto">
              {outbox.map((item) => (
                <li key={item.id} className="p-4 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-stone-900 truncate">{item.subject}</span>
                    <span className="font-mono text-stone-500 shrink-0">{item.status}</span>
                  </div>
                  <p className="text-stone-600">{item.summary}</p>
                  <p className="font-mono tabular-nums text-[11px] text-stone-400">
                    To: {item.to} · {item.sentAt.slice(0, 19).replace('T', ' ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
