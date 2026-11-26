import React, { useState } from 'react';
import { CalendarClock, Plus, Volume2, VolumeX } from 'lucide-react';
import { useRadio } from '../context/RadioContext';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ZonesScheduleView: React.FC = () => {
  const {
    user,
    profile,
    signIn,
    audioZones,
    activeZoneId,
    setActiveZoneId,
    updateZoneVolume,
    toggleZoneMute,
    assignZonePlaylist,
    playlists,
    schedules,
    saveSchedule,
    toggleSchedule,
  } = useRadio();

  const canManageZones =
    profile?.role === 'staff' || profile?.role === 'manager' || profile?.role === 'admin';
  const canEditSchedules = profile?.role === 'manager' || profile?.role === 'admin';

  const [name, setName] = useState('');
  const [playlistId, setPlaylistId] = useState(playlists[1]?.id || 'lunch-comfort');
  const [daypart, setDaypart] = useState('Peak Dining');
  const [startTime, setStartTime] = useState('11:30');
  const [endTime, setEndTime] = useState('14:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Fri', 'Sat', 'Sun']);
  const [saving, setSaving] = useState(false);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? (prev.length > 1 ? prev.filter((d) => d !== day) : prev) : [...prev, day]
    );
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !canEditSchedules) return;
    setSaving(true);
    try {
      const id = `sched_${Date.now()}`;
      await saveSchedule({
        id,
        name: name.trim().slice(0, 100),
        playlistId,
        daypart: daypart.trim().slice(0, 60),
        startTime,
        endTime,
        days: selectedDays,
        enabled: true,
      });
      setName('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 font-display text-balance">
            Zone Volume & Peak Dining Schedules
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Remote volume control for kitchen and dining speakers, paired with automated peak-hour playlist blocks.
          </p>
        </div>

        {!user && (
          <button
            type="button"
            onClick={signIn}
            className="min-h-[44px] rounded-xl bg-[#1A1614] px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
          >
            Sign In to Sync Across Devices
          </button>
        )}
      </div>

      {/* Remote Volume Control */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-stone-900 font-display">
            Remote Restaurant Zone Volume
          </h2>
          <span className="text-xs text-stone-500">
            {canManageZones
              ? 'Synced live with Firestore'
              : 'Preview mode · Staff/Managers sync live'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {audioZones.map((zone) => {
            const isMonitored = activeZoneId === zone.id;
            return (
              <div
                key={zone.id}
                className={`rounded-2xl border bg-white p-5 space-y-4 transition-colors ${
                  isMonitored ? 'border-amber-600' : 'border-stone-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <span>Zone ID: {zone.id}</span>
                      {isMonitored && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-800 font-medium">Monitoring Output</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-stone-900 mt-0.5 font-display">
                      {zone.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveZoneId(zone.id)}
                      className={`min-h-[40px] rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        isMonitored
                          ? 'border-amber-600 bg-amber-50 text-amber-900'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {isMonitored ? 'Active Monitor' : 'Monitor'}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleZoneMute(zone.id)}
                      aria-label={zone.muted ? `Unmute ${zone.name}` : `Mute ${zone.name}`}
                      className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border transition-colors ${
                        zone.muted
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {zone.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">Speaker Gain Level</span>
                    <span className="font-mono tabular-nums font-semibold text-stone-900">
                      {zone.muted ? 'MUTED (0%)' : `${zone.volume}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label={`${zone.name} volume`}
                    min={0}
                    max={100}
                    value={zone.volume}
                    onChange={(e) => updateZoneVolume(zone.id, Number(e.target.value))}
                    className="w-full accent-amber-600 h-2.5 bg-stone-200 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-100">
                  <label className="text-xs font-medium text-stone-600 shrink-0">
                    Assigned Rotation
                  </label>
                  <select
                    aria-label={`Playlist for ${zone.name}`}
                    value={zone.activePlaylistId}
                    onChange={(e) => assignZonePlaylist(zone.id, e.target.value)}
                    className="min-h-[40px] flex-1 max-w-[230px] rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-900"
                  >
                    {playlists.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Peak Dining Hours Scheduler */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-stone-900 font-display">
                Peak Dining Playlist Blocks
              </h2>
              <p className="text-xs text-stone-500">
                Automated rotation shifts for breakfast, peak lunch, peak dinner, and kitchen prep.
              </p>
            </div>
            <CalendarClock className="w-5 h-5 text-amber-700 shrink-0" />
          </div>

          <ul className="divide-y divide-stone-100">
            {schedules.map((s) => {
              const pl = playlists.find((p) => p.id === s.playlistId);
              return (
                <li key={s.id} className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      <span>{s.daypart}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-stone-800 font-medium">
                        {s.startTime}–{s.endTime}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{s.days.join(', ')}</span>
                    </div>
                    <p className="text-sm font-semibold text-stone-900">{s.name}</p>
                    <p className="text-xs text-stone-600">Playlist: {pl?.name || s.playlistId}</p>
                  </div>

                  <button
                    type="button"
                    disabled={!canEditSchedules}
                    onClick={() => toggleSchedule(s.id, !s.enabled)}
                    className={`min-h-[40px] rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      s.enabled
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-stone-200 bg-stone-50 text-stone-600'
                    } disabled:opacity-60`}
                  >
                    {s.enabled ? 'Active' : 'Paused'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-900 font-display">
              Schedule Peak Hour Block
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {canEditSchedules
                ? 'Configure automatic playlist switching for peak dining periods.'
                : 'Manager or Admin role required to publish new schedule blocks.'}
            </p>
          </div>

          <form onSubmit={handleCreateSchedule} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Schedule Label
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekend Carving Rush"
                className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-sm text-stone-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Playlist
                </label>
                <select
                  value={playlistId}
                  onChange={(e) => setPlaylistId(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900"
                >
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Service Period
                </label>
                <select
                  value={daypart}
                  onChange={(e) => setDaypart(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900"
                >
                  <option value="Morning Service">Morning Service</option>
                  <option value="Peak Dining">Peak Dining</option>
                  <option value="Afternoon Flow">Afternoon Flow</option>
                  <option value="Back of House">Back of House</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-mono tabular-nums text-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-mono tabular-nums text-stone-900"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-stone-700 mb-1.5">Active Days</span>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`min-h-[38px] px-3 rounded-lg text-xs font-medium transition-colors ${
                      selectedDays.includes(day)
                        ? 'bg-[#1A1614] text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!canEditSchedules || saving || !name.trim()}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {saving ? 'Saving Schedule...' : 'Save Schedule Block'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};
