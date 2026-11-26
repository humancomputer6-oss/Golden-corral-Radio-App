import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  Mail,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useRadio } from '../context/RadioContext';
import type { InventoryLog, ReportScope, StaffShift } from '../types/radio';
import {
  extractIsoDate,
  generateCsvContent,
  isWithinDateRange,
  maskEmailForPrivacy,
  triggerFileDownload,
} from '../utils/csvExport';

export const OperationsView: React.FC = () => {
  const {
    user,
    profile,
    signIn,
    shifts,
    inventoryLogs,
    submissions,
    createShift,
    updateShiftStatus,
    upsertInventoryLog,
    reportSchedules,
    reportLogs,
    saveReportSchedule,
    toggleReportSchedule,
    recordReportActivity,
    updateScheduleLastRun,
  } = useRadio();

  const [subTab, setSubTab] = useState<'shifts' | 'inventory' | 'reports'>('shifts');

  // Shift form state
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('Line Cook');
  const [empZone, setEmpZone] = useState('Kitchen Prep Line');
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().slice(0, 10));
  const [shiftStart, setShiftStart] = useState('10:00');
  const [shiftEnd, setShiftEnd] = useState('18:00');
  const [shiftFilter, setShiftFilter] = useState<'all' | StaffShift['status']>('all');

  // Inventory form state
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Protein');
  const [itemQty, setItemQty] = useState(12);
  const [itemPar, setItemPar] = useState(10);
  const [itemUnit, setItemUnit] = useState('cases');

  // Reports & CSV export state
  const [reportScope, setReportScope] = useState<ReportScope>('executive');
  const [exportFormat, setExportFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [privacyRedacted, setPrivacyRedacted] = useState(true);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // Monthly schedule form
  const [schedName, setSchedName] = useState('');
  const [schedScope, setSchedScope] = useState<ReportScope>('executive');
  const [schedFormat, setSchedFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [schedDay, setSchedDay] = useState(1);
  const [schedEmail, setSchedEmail] = useState(profile?.email || '');
  const [runningSchedId, setRunningSchedId] = useState<string | null>(null);

  const isStaffOrAbove =
    profile?.role === 'staff' || profile?.role === 'manager' || profile?.role === 'admin';
  const isManagerOrAdmin = profile?.role === 'manager' || profile?.role === 'admin';

  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => shiftFilter === 'all' || s.status === shiftFilter);
  }, [shifts, shiftFilter]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 max-w-xl mx-auto text-center space-y-4">
        <Users className="w-10 h-10 text-amber-700 mx-auto" />
        <h1 className="text-2xl font-bold text-stone-900 font-display">
          Kitchen Operations & Reporting
        </h1>
        <p className="text-sm text-stone-600">
          Sign in with your restaurant staff, manager, or admin account to view shift schedules, update inventory logs, and export compliance reports.
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

  if (!isStaffOrAbove) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 max-w-xl mx-auto text-center space-y-3">
        <ShieldCheck className="w-10 h-10 text-stone-500 mx-auto" />
        <h1 className="text-xl font-semibold text-stone-900 font-display">
          Staff & Management Access Required
        </h1>
        <p className="text-sm text-stone-600">
          Your current role is <span className="font-semibold">{profile?.role || 'subscriber'}</span>. Staff shift schedules, inventory logs, and executive CSV exports are restricted to authorized restaurant staff and managers.
        </p>
      </div>
    );
  }

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || !isManagerOrAdmin) return;
    await createShift({
      employeeName: empName.trim().slice(0, 100),
      role: empRole,
      zone: empZone,
      shiftDate,
      startTime: shiftStart,
      endTime: shiftEnd,
      status: 'scheduled',
    });
    setEmpName('');
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    const status: InventoryLog['status'] =
      itemQty >= itemPar ? 'nominal' : itemQty >= Math.ceil(itemPar * 0.5) ? 'low' : 'reorder';
    await upsertInventoryLog({
      itemName: itemName.trim().slice(0, 100),
      category: itemCategory,
      quantity: Math.max(0, Number(itemQty)),
      parLevel: Math.max(0, Number(itemPar)),
      unit: itemUnit.trim() || 'units',
      status,
    });
    setItemName('');
  };

  const adjustInventoryQty = async (item: InventoryLog, delta: number) => {
    const nextQty = Math.max(0, item.quantity + delta);
    const nextStatus: InventoryLog['status'] =
      nextQty >= item.parLevel
        ? 'nominal'
        : nextQty >= Math.ceil(item.parLevel * 0.5)
        ? 'low'
        : 'reorder';
    await upsertInventoryLog(
      {
        itemName: item.itemName,
        category: item.category,
        quantity: nextQty,
        parLevel: item.parLevel,
        unit: item.unit,
        status: nextStatus,
      },
      item.id
    );
  };

  const buildReportDataset = (scope: ReportScope, start: string, end: string, redact: boolean) => {
    const shiftRows = shifts
      .filter((s) => isWithinDateRange(s.shiftDate, start, end))
      .map((s) => [
        'Shift',
        s.shiftDate,
        redact ? `${s.employeeName.split(' ')[0]} ${s.employeeName.split(' ')[1]?.[0] || ''}.` : s.employeeName,
        s.role,
        s.zone,
        `${s.startTime}-${s.endTime}`,
        s.status,
      ]);

    const invRows = inventoryLogs
      .filter((i) => isWithinDateRange(extractIsoDate(i.updatedAt) || new Date().toISOString().slice(0, 10), start, end))
      .map((i) => [
        'Inventory',
        extractIsoDate(i.updatedAt) || new Date().toISOString().slice(0, 10),
        i.itemName,
        i.category,
        `${i.quantity} / ${i.parLevel} ${i.unit}`,
        redact ? 'Staff Verified' : i.loggedByName,
        i.status,
      ]);

    const subRows = submissions
      .filter((sub) => isWithinDateRange(extractIsoDate(sub.createdAt), start, end))
      .map((sub) => [
        'Submission',
        extractIsoDate(sub.createdAt) || new Date().toISOString().slice(0, 10),
        sub.trackTitle,
        sub.artistName,
        `${sub.submissionType} (${sub.audioFormat})`,
        redact ? maskEmailForPrivacy(sub.submitterEmail) : sub.submitterEmail,
        sub.status,
      ]);

    if (scope === 'operations') {
      return {
        headers: ['Type', 'Date', 'Staff Member', 'Role', 'Zone', 'Hours', 'Status'],
        rows: shiftRows,
      };
    }
    if (scope === 'inventory') {
      return {
        headers: ['Type', 'Date', 'Item', 'Category', 'Quantity / Par', 'Logged By', 'Status'],
        rows: invRows,
      };
    }
    if (scope === 'submissions') {
      return {
        headers: ['Type', 'Date', 'Track Title', 'Artist', 'Format', 'Contact Email', 'Status'],
        rows: subRows,
      };
    }
    return {
      headers: ['Dataset', 'Date', 'Subject', 'Detail', 'Metric / Zone', 'Attribution', 'Status'],
      rows: [...shiftRows, ...invRows, ...subRows],
    };
  };

  const handleExportReport = async () => {
    if (!isManagerOrAdmin) return;
    const { headers, rows } = buildReportDataset(reportScope, startDate, endDate, privacyRedacted);
    const stamp = new Date().toISOString().slice(0, 10);

    if (exportFormat === 'CSV') {
      const csv = generateCsvContent(headers, rows);
      triggerFileDownload(csv, `gc-radio-${reportScope}-${stamp}.csv`, 'text/csv;charset=utf-8;');
    } else {
      const jsonObjects = rows.map((r) =>
        Object.fromEntries(headers.map((h, idx) => [h, r[idx]]))
      );
      triggerFileDownload(
        JSON.stringify({ reportScope, privacyRedacted, generatedAt: new Date().toISOString(), data: jsonObjects }, null, 2),
        `gc-radio-${reportScope}-${stamp}.json`,
        'application/json'
      );
    }

    await recordReportActivity({
      action: exportFormat === 'CSV' ? 'export_csv' : 'export_json',
      reportScope,
      dateRangeStart: startDate || 'all',
      dateRangeEnd: endDate || 'all',
      rowCount: rows.length,
      privacyRedacted,
      emailDispatched: false,
    });

    setExportFeedback(
      `Exported ${rows.length} ${exportFormat} records (${privacyRedacted ? 'PII redacted' : 'full audit'}) and recorded in the access log.`
    );
  };

  const handleCreateMonthlySchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedName.trim() || !schedEmail.trim() || !isManagerOrAdmin) return;
    await saveReportSchedule({
      name: schedName.trim().slice(0, 100),
      reportScope: schedScope,
      format: schedFormat,
      dayOfMonth: Math.max(1, Math.min(28, Number(schedDay))),
      recipientEmail: schedEmail.trim().slice(0, 256),
      enabled: true,
      lastRunAt: '',
    });
    setSchedName('');
  };

  const handleRunMonthlyNow = async (schedId: string) => {
    const sched = reportSchedules.find((s) => s.id === schedId);
    if (!sched || !isManagerOrAdmin) return;
    setRunningSchedId(schedId);
    try {
      const { rows } = buildReportDataset(sched.reportScope, '', '', true);
      const res = await fetch('/api/emails/report-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: sched.recipientEmail,
          reportName: sched.name,
          reportScope: sched.reportScope,
          format: sched.format,
          rowCount: rows.length,
        }),
      });
      const ok = res.ok;
      await updateScheduleLastRun(sched.id);
      await recordReportActivity({
        action: 'scheduled_monthly_run',
        reportScope: sched.reportScope,
        dateRangeStart: 'monthly',
        dateRangeEnd: new Date().toISOString().slice(0, 10),
        rowCount: rows.length,
        privacyRedacted: true,
        emailDispatched: ok,
      });
      setExportFeedback(
        `Monthly schedule "${sched.name}" executed (${rows.length} rows). Email notification dispatched to ${sched.recipientEmail}.`
      );
    } finally {
      setRunningSchedId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 font-display">
            Restaurant Operations & Reporting
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Staff shift coverage, kitchen stock tracking, privacy-safe CSV exports, and report access history.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-xl">
          {(
            [
              { id: 'shifts', label: 'Staff Shifts' },
              { id: 'inventory', label: 'Inventory Logs' },
              { id: 'reports', label: 'Reports & Audit' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                subTab === t.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* STAFF SHIFTS TAB */}
      {subTab === 'shifts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 rounded-2xl border border-stone-200 bg-white overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-900 font-display">
                  Staff Shift Schedule
                </h2>
                <p className="text-xs text-stone-500 font-mono tabular-nums">
                  {filteredShifts.length} shifts listed
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl">
                {(['all', 'scheduled', 'active', 'completed'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setShiftFilter(st)}
                    className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg capitalize transition-colors whitespace-nowrap ${
                      shiftFilter === st ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500 bg-stone-50/70">
                    <th className="py-3 px-4 font-medium">Employee</th>
                    <th className="py-3 px-4 font-medium">Role & Zone</th>
                    <th className="py-3 px-4 font-medium">Date & Hours</th>
                    <th className="py-3 px-4 font-medium text-right">Status Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {filteredShifts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-stone-500">
                        No shifts match this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredShifts.map((shift) => {
                      const nextStatus: StaffShift['status'] =
                        shift.status === 'scheduled'
                          ? 'active'
                          : shift.status === 'active'
                          ? 'completed'
                          : 'scheduled';
                      return (
                        <tr key={shift.id} className="hover:bg-stone-50/70">
                          <td className="py-3 px-4 font-medium text-stone-900">
                            {shift.employeeName}
                          </td>
                          <td className="py-3 px-4 text-xs text-stone-600">
                            {shift.role} · {shift.zone}
                          </td>
                          <td className="py-3 px-4 text-xs font-mono tabular-nums text-stone-700">
                            {shift.shiftDate} · {shift.startTime}–{shift.endTime}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => updateShiftStatus(shift.id, nextStatus)}
                              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                                shift.status === 'active'
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                  : shift.status === 'completed'
                                  ? 'border-stone-200 bg-stone-100 text-stone-600'
                                  : 'border-amber-300 bg-amber-50 text-amber-800'
                              }`}
                            >
                              {shift.status}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-4 rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-stone-900 font-display">Assign Staff Shift</h2>
            <form onSubmit={handleAddShift} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Employee Name
                </label>
                <input
                  type="text"
                  required
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  placeholder="Full name"
                  className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Role</label>
                  <select
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
                  >
                    <option value="Line Cook">Line Cook</option>
                    <option value="Prep Chef">Prep Chef</option>
                    <option value="Shift Supervisor">Shift Supervisor</option>
                    <option value="Buffet Attendant">Buffet Attendant</option>
                    <option value="Host">Host</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Zone</label>
                  <select
                    value={empZone}
                    onChange={(e) => setEmpZone(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
                  >
                    <option value="Kitchen Prep Line">Kitchen Prep Line</option>
                    <option value="Main Dining Room">Main Dining Room</option>
                    <option value="Buffet & Salad Bar">Buffet & Salad Bar</option>
                    <option value="Lobby & Patio">Lobby & Patio</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Shift Date</label>
                <input
                  type="date"
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-mono tabular-nums"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Start</label>
                  <input
                    type="time"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">End</label>
                  <input
                    type="time"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-mono tabular-nums"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!isManagerOrAdmin || !empName.trim()}
                className="w-full min-h-[44px] rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {isManagerOrAdmin ? 'Add Shift to Schedule' : 'Manager Role Required'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* INVENTORY LOGS TAB */}
      {subTab === 'inventory' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 rounded-2xl border border-stone-200 bg-white overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-stone-900 font-display">
                  Kitchen & Floor Inventory Logs
                </h2>
                <p className="text-xs text-stone-500">
                  Adjust live counts with one tap; par thresholds flag low or reorder items automatically.
                </p>
              </div>
              <Package className="w-5 h-5 text-amber-700 shrink-0" />
            </div>

            <ul className="divide-y divide-stone-100">
              {inventoryLogs.length === 0 ? (
                <li className="p-8 text-center text-xs text-stone-500">
                  No inventory logs recorded yet.
                </li>
              ) : (
                inventoryLogs.map((item) => (
                  <li
                    key={item.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-stone-50/70"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <span>{item.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>Par: <span className="font-mono tabular-nums">{item.parLevel}</span> {item.unit}</span>
                        <span aria-hidden="true">·</span>
                        <span>Logged by {item.loggedByName}</span>
                      </div>
                      <p className="text-sm font-semibold text-stone-900 mt-0.5">
                        {item.itemName}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          item.status === 'nominal'
                            ? 'text-emerald-700'
                            : item.status === 'low'
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {item.status === 'nominal' ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                        {item.status === 'nominal'
                          ? 'Nominal'
                          : item.status === 'low'
                          ? 'Low Stock'
                          : 'Reorder'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustInventoryQty(item, -1)}
                          aria-label={`Decrease ${item.itemName}`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-stone-100"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="min-w-[54px] text-center font-mono tabular-nums text-sm font-semibold text-stone-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustInventoryQty(item, 1)}
                          aria-label={`Increase ${item.itemName}`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-stone-100"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="lg:col-span-4 rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-stone-900 font-display">Log Inventory Item</h2>
            <form onSubmit={handleAddInventory} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Fresh Strawberry Flats"
                  className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Category</label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
                  >
                    <option value="Protein">Protein</option>
                    <option value="Produce">Produce</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Beverage">Beverage</option>
                    <option value="Audio Hardware">Audio Hardware</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Current Qty</label>
                  <input
                    type="number"
                    min={0}
                    value={itemQty}
                    onChange={(e) => setItemQty(Number(e.target.value))}
                    className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Par Level</label>
                  <input
                    type="number"
                    min={0}
                    value={itemPar}
                    onChange={(e) => setItemPar(Number(e.target.value))}
                    className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-mono tabular-nums"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!itemName.trim()}
                className="w-full min-h-[44px] rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                Save Inventory Entry
              </button>
            </form>
          </div>
        </div>
      )}

      {/* REPORTS, CSV EXPORT, MONTHLY SCHEDULING & AUDIT LOGS TAB */}
      {subTab === 'reports' && (
        <div className="space-y-6">
          {!isManagerOrAdmin ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
              Manager or Admin access is required to export operational CSV reports and view audit access history.
            </div>
          ) : (
            <>
              {exportFeedback && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{exportFeedback}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* On-Demand Privacy-Safe Export */}
                <div className="lg:col-span-6 rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-stone-900 font-display">
                        Export Performance & Compliance Data
                      </h2>
                      <p className="text-xs text-stone-500">
                        Filter by date range and format. Enforces CSV formula-injection protection and PII redaction.
                      </p>
                    </div>
                    <Download className="w-5 h-5 text-amber-700 shrink-0" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">Dataset</label>
                      <select
                        value={reportScope}
                        onChange={(e) => setReportScope(e.target.value as ReportScope)}
                        className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
                      >
                        <option value="executive">Executive Combined Report</option>
                        <option value="operations">Staff Shift Schedules</option>
                        <option value="inventory">Kitchen Inventory Logs</option>
                        <option value="submissions">Music Submissions</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">Format</label>
                      <select
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value as 'CSV' | 'JSON')}
                        className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
                      >
                        <option value="CSV">CSV (Spreadsheet Safe)</option>
                        <option value="JSON">JSON (Structured Archive)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">From Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">To Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-mono tabular-nums"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 text-xs text-stone-700 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={privacyRedacted}
                      onChange={(e) => setPrivacyRedacted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-amber-600 rounded"
                    />
                    <span>
                      Enforce strict PII privacy redaction (masks submitter emails and abbreviates staff last names).
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={handleExportReport}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#1A1614] text-white text-sm font-semibold hover:bg-stone-800 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download {exportFormat} Report
                  </button>
                </div>

                {/* Automated Monthly Report Scheduling */}
                <div className="lg:col-span-6 rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-stone-900 font-display">
                        Automated Monthly Report Schedules
                      </h2>
                      <p className="text-xs text-stone-500">
                        Recurring monthly generation with automated email notifications upon completion.
                      </p>
                    </div>
                    <Calendar className="w-5 h-5 text-amber-700 shrink-0" />
                  </div>

                  <div className="space-y-2.5">
                    {reportSchedules.map((rs) => (
                      <div
                        key={rs.id}
                        className="rounded-xl border border-stone-200 p-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-900">{rs.name}</p>
                          <p className="text-xs text-stone-500 mt-0.5">
                            Day {rs.dayOfMonth} monthly · {rs.format} · {rs.recipientEmail}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRunMonthlyNow(rs.id)}
                            disabled={runningSchedId === rs.id}
                            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            {runningSchedId === rs.id ? 'Sending...' : 'Run & Email'}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleReportSchedule(rs.id, !rs.enabled)}
                            className={`min-h-[38px] rounded-lg border px-2.5 py-1 text-xs font-medium ${
                              rs.enabled
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                : 'border-stone-200 text-stone-600'
                            }`}
                          >
                            {rs.enabled ? 'Active' : 'Paused'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleCreateMonthlySchedule} className="pt-3 border-t border-stone-100 space-y-3">
                    <p className="text-xs font-semibold text-stone-800">Add Monthly Schedule</p>
                    <input
                      type="text"
                      required
                      value={schedName}
                      onChange={(e) => setSchedName(e.target.value)}
                      placeholder="Schedule title (e.g. Monthly Kitchen Par Audit)"
                      className="w-full min-h-[42px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={schedScope}
                        onChange={(e) => setSchedScope(e.target.value as ReportScope)}
                        className="min-h-[42px] rounded-xl border border-stone-200 bg-stone-50 px-2.5 text-xs"
                      >
                        <option value="executive">Executive</option>
                        <option value="operations">Operations</option>
                        <option value="inventory">Inventory</option>
                        <option value="submissions">Submissions</option>
                      </select>
                      <select
                        value={schedFormat}
                        onChange={(e) => setSchedFormat(e.target.value as 'CSV' | 'JSON')}
                        className="min-h-[42px] rounded-xl border border-stone-200 bg-stone-50 px-2.5 text-xs"
                      >
                        <option value="CSV">CSV</option>
                        <option value="JSON">JSON</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={schedDay}
                        onChange={(e) => setSchedDay(Number(e.target.value))}
                        aria-label="Day of month"
                        className="min-h-[42px] rounded-xl border border-stone-200 bg-stone-50 px-2.5 text-xs font-mono tabular-nums"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        required
                        value={schedEmail}
                        onChange={(e) => setSchedEmail(e.target.value)}
                        placeholder="Recipient email"
                        className="flex-1 min-h-[42px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
                      />
                      <button
                        type="submit"
                        className="min-h-[42px] rounded-xl bg-[#1A1614] px-4 text-xs font-semibold text-white hover:bg-stone-800 whitespace-nowrap"
                      >
                        Save Schedule
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Secure Report Activity & Access History Dashboard */}
              <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-stone-900 font-display">
                      Report Activity & Access History
                    </h2>
                    <p className="text-xs text-stone-500">
                      Immutable audit log of all report downloads, scheduled monthly dispatches, and access events.
                    </p>
                  </div>
                  <ClipboardList className="w-5 h-5 text-amber-700 shrink-0" />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 text-xs text-stone-500 bg-stone-50/70">
                        <th className="py-3 px-4 font-medium">Actor</th>
                        <th className="py-3 px-4 font-medium">Action & Scope</th>
                        <th className="py-3 px-4 font-medium">Date Filter</th>
                        <th className="py-3 px-4 font-medium text-right">Rows</th>
                        <th className="py-3 px-4 font-medium">Privacy & Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-xs">
                      {reportLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-stone-500">
                            Export or run a scheduled report to create the first audit entry.
                          </td>
                        </tr>
                      ) : (
                        reportLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-stone-50/70">
                            <td className="py-3 px-4">
                              <p className="font-medium text-stone-900">{log.actorEmail}</p>
                              <p className="text-stone-500 capitalize">{log.actorRole}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-stone-800">{log.action}</p>
                              <p className="text-stone-500 capitalize">{log.reportScope}</p>
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-stone-600">
                              {log.dateRangeStart || 'all'} → {log.dateRangeEnd || 'all'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-stone-900">
                              {log.rowCount}
                            </td>
                            <td className="py-3 px-4 text-stone-600">
                              {log.privacyRedacted ? 'PII Redacted' : 'Full Audit'} ·{' '}
                              {log.emailDispatched ? 'Email Sent' : 'Direct Download'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
