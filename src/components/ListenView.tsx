import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Headphones,
  MessageSquare,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Star,
  Trash2,
  Volume2,
  WifiOff,
} from 'lucide-react';
import { useRadio } from '../context/RadioContext';
import { HERO_STUDIO_IMAGE } from '../data/curatedCatalog';
import type { RadioTrack } from '../types/radio';

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

export const ListenView: React.FC = () => {
  const {
    user,
    signIn,
    playlists,
    tracks,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    isBuffering,
    playingFromOfflineCache,
    simulatedOffline,
    setSimulatedOffline,
    isOnline,
    playTrack,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seekTo,
    offlineTrackIds,
    cachingTrackIds,
    toggleTrackOffline,
    savePlaylistOffline,
    audioZones,
    activeZoneId,
    setActiveZoneId,
    feedbackList,
    submitTrackFeedback,
  } = useRadio();

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('all');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'offline' | 'community'>('all');
  const [feedbackTrack, setFeedbackTrack] = useState<RadioTrack | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const activeZone = audioZones.find((z) => z.id === activeZoneId) || audioZones[0];

  const filteredTracks = useMemo(() => {
    return tracks.filter((t) => {
      if (selectedPlaylistId !== 'all' && t.playlistId !== selectedPlaylistId) return false;
      if (libraryFilter === 'offline' && !offlineTrackIds.has(t.id)) return false;
      if (libraryFilter === 'community' && !t.isCommunity) return false;
      return true;
    });
  }, [tracks, selectedPlaylistId, libraryFilter, offlineTrackIds]);

  const trackFeedbacks = useMemo(() => {
    const targetId = feedbackTrack?.id || currentTrack.id;
    return feedbackList.filter((f) => f.trackId === targetId);
  }, [feedbackList, feedbackTrack, currentTrack.id]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !comment.trim()) return;
    setSubmittingFeedback(true);
    try {
      await submitTrackFeedback((feedbackTrack || currentTrack).id, rating, comment);
      setComment('');
      setRating(5);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Dominant Focal Anchor: Live Broadcast Hero Card */}
      <section className="relative overflow-hidden rounded-3xl border border-stone-200 bg-[#1A1614] text-white">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="relative lg:col-span-5 min-h-[210px] sm:min-h-[250px]">
            <img
              src={HERO_STUDIO_IMAGE}
              alt="Golden Corral Clean Radio broadcast studio overlooking dining room"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A1614] via-[#1A1614]/45 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-[#1A1614]/40 lg:to-[#1A1614]" />
            <div className="relative h-full flex flex-col justify-end p-5 lg:p-6">
              <p className="text-xs font-medium tracking-wide text-amber-300">
                Family-Friendly Royalty-Free Stream
              </p>
              <p className="text-sm text-stone-200 mt-0.5">
                {!isOnline || simulatedOffline
                  ? 'Offline Playback Active'
                  : playingFromOfflineCache
                  ? 'Playing Cached Local Audio'
                  : 'Live Broadcast Stream'}
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 p-5 sm:p-7 flex flex-col justify-between gap-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
                  <span>{currentTrack.genre}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{currentTrack.bpm} BPM</span>
                  <span aria-hidden="true">·</span>
                  <span>{currentTrack.isCommunity ? 'Local Clean Edit' : 'Royalty-Free Curated'}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1.5 text-balance">
                  {currentTrack.title}
                </h1>
                <p className="text-sm text-stone-300 mt-1">{currentTrack.artist}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleTrackOffline(currentTrack)}
                  disabled={cachingTrackIds.has(currentTrack.id)}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-800/80 px-3.5 py-2 text-xs font-medium text-stone-100 hover:bg-stone-700 transition-colors whitespace-nowrap shrink-0"
                >
                  {offlineTrackIds.has(currentTrack.id) ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-amber-400" />
                      Saved Offline
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-amber-400" />
                      {cachingTrackIds.has(currentTrack.id) ? 'Caching...' : 'Save Offline'}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Scrub Bar */}
            <div className="space-y-2">
              <input
                type="range"
                aria-label="Track playback position"
                min={0}
                max={Math.max(1, duration)}
                step={0.1}
                value={Math.min(currentTime, duration)}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="w-full accent-amber-500 h-2 bg-stone-800 rounded-lg cursor-pointer"
              />
              <div className="flex items-center justify-between text-xs font-mono tabular-nums text-stone-400">
                <span>{formatSeconds(currentTime)}</span>
                <span>{formatSeconds(duration)}</span>
              </div>
            </div>

            {/* Primary Transport & Active Zone Output */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={prevTrack}
                  aria-label="Previous track"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-stone-700 bg-stone-800/70 text-stone-200 hover:bg-stone-700 transition-colors"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? 'Pause broadcast' : 'Play broadcast'}
                  className="min-h-[48px] min-w-[116px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-stone-950 hover:bg-amber-400 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  {isBuffering ? 'Loading' : isPlaying ? 'Pause' : 'Play Radio'}
                </button>
                <button
                  type="button"
                  onClick={nextTrack}
                  aria-label="Next track"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-stone-700 bg-stone-800/70 text-stone-200 hover:bg-stone-700 transition-colors"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-stone-300">
                  <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="sr-only">Active monitor zone</span>
                  <select
                    value={activeZoneId}
                    onChange={(e) => setActiveZoneId(e.target.value)}
                    className="min-h-[40px] rounded-xl bg-stone-800 border border-stone-700 px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {audioZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.muted ? 'Muted' : `${z.volume}%`})
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => setSimulatedOffline(!simulatedOffline)}
                  className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    simulatedOffline
                      ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                      : 'border-stone-700 bg-stone-800/70 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  {simulatedOffline ? 'Offline Mode On' : 'Test Offline'}
                </button>
              </div>
            </div>
            {activeZone && (
              <p className="text-xs text-stone-400">
                Monitoring zone output: {activeZone.name} ·{' '}
                <span className="font-mono tabular-nums">
                  {activeZone.muted ? 'Muted' : `${activeZone.volume}% gain`}
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Curated Restaurant Ambiance Playlists */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-stone-900 font-display">
              Dining Ambiance Playlists
            </h2>
            <p className="text-sm text-stone-600">
              Royalty-free rotations tuned for every service rush. Save any playlist for offline playback.
            </p>
          </div>
          {selectedPlaylistId !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedPlaylistId('all')}
              className="min-h-[40px] text-xs font-semibold text-amber-800 hover:underline px-2"
            >
              Show All Playlists
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {playlists.map((pl) => {
            const plTracks = tracks.filter((t) => t.playlistId === pl.id);
            const allSaved =
              plTracks.length > 0 && plTracks.every((t) => offlineTrackIds.has(t.id));
            const isSelected = selectedPlaylistId === pl.id;

            return (
              <div
                key={pl.id}
                className={`rounded-2xl border bg-white p-4 flex flex-col justify-between gap-4 transition-colors ${
                  isSelected ? 'border-amber-600 ring-1 ring-amber-600' : 'border-stone-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedPlaylistId(isSelected ? 'all' : pl.id)}
                  className="text-left space-y-3 focus-visible:outline-none"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-amber-100 to-stone-200">
                    <img
                      src={pl.coverUrl}
                      alt={pl.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-stone-500">{pl.daypart}</p>
                    <h3 className="text-base font-semibold text-stone-900 mt-0.5 font-display">
                      {pl.name}
                    </h3>
                    <p className="text-xs text-stone-600 mt-1 line-clamp-2">{pl.description}</p>
                  </div>
                </button>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => {
                      const first = plTracks[0];
                      if (first) playTrack(first);
                    }}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[#1A1614] px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Stream
                  </button>
                  <button
                    type="button"
                    onClick={() => savePlaylistOffline(pl.id)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    {allSaved ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        Cached
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 text-amber-700" />
                        Offline
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Track Rotation & Listener Feedback Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-900 font-display">
                Station Rotation
              </h2>
              <p className="text-xs text-stone-500">
                <span className="font-mono tabular-nums">{filteredTracks.length}</span> tracks ·{' '}
                <span className="font-mono tabular-nums">{offlineTrackIds.size}</span> saved offline
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'community', label: 'Local Clean Edits' },
                  { id: 'offline', label: 'Offline' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLibraryFilter(tab.id)}
                  className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    libraryFilter === tab.id
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTracks.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Headphones className="w-8 h-8 text-stone-400 mx-auto" />
              <p className="text-sm font-medium text-stone-800">No tracks in this view yet</p>
              <p className="text-xs text-stone-500">
                {libraryFilter === 'offline'
                  ? 'Tap the download icon on any track to cache it for offline playback.'
                  : 'Approved local clean edits will appear here automatically.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {filteredTracks.map((track) => {
                const active = currentTrack.id === track.id;
                const saved = offlineTrackIds.has(track.id);
                const caching = cachingTrackIds.has(track.id);

                return (
                  <li
                    key={track.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
                      active ? 'bg-amber-50/70' : 'hover:bg-stone-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => playTrack(track)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left min-h-[44px]"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-200 shrink-0 relative flex items-center justify-center">
                        <img
                          src={track.coverUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        {active && isPlaying && (
                          <span className="absolute inset-0 bg-black/45 flex items-center justify-center text-white">
                            <Music2 className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">
                          {track.title}
                        </p>
                        <p className="text-xs text-stone-500 truncate">
                          {track.artist} · {track.genre} ·{' '}
                          <span className="font-mono tabular-nums">
                            {formatSeconds(track.durationSeconds)}
                          </span>
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setFeedbackTrack(track)}
                        aria-label={`Leave feedback for ${track.title}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTrackOffline(track)}
                        disabled={caching}
                        aria-label={saved ? `Remove ${track.title} from offline cache` : `Save ${track.title} offline`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"
                      >
                        {saved ? (
                          <Trash2 className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <Download className="w-4 h-4 text-amber-700" />
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Listener Feedback Panel */}
        <div className="lg:col-span-5 rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-900 font-display">
                Listener Feedback
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Commenting on: {(feedbackTrack || currentTrack).title}
              </p>
            </div>
            {feedbackTrack && (
              <button
                type="button"
                onClick={() => setFeedbackTrack(null)}
                className="text-xs font-medium text-amber-800 hover:underline"
              >
                Use Now Playing
              </button>
            )}
          </div>

          {!user ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
              <p className="text-xs text-stone-600 leading-relaxed">
                Free subscribers can stream all royalty-free playlists and save tracks offline. Sign in to rate local clean edits and share listener feedback.
              </p>
              <button
                type="button"
                onClick={signIn}
                className="w-full min-h-[44px] rounded-xl bg-[#1A1614] text-white text-xs font-semibold hover:bg-stone-800 transition-colors"
              >
                Sign In to Post Feedback
              </button>
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-700">Track Rating</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      aria-label={`Rate ${star} stars`}
                      className="min-h-[40px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-stone-100"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          star <= rating ? 'fill-amber-500 text-amber-500' : 'text-stone-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={2}
                maxLength={400}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share how this track fits the dining room vibe..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />

              <button
                type="submit"
                disabled={submittingFeedback || !comment.trim()}
                className="w-full min-h-[44px] rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {submittingFeedback ? 'Posting...' : 'Post Listener Feedback'}
              </button>
            </form>
          )}

          <div className="border-t border-stone-100 pt-3 space-y-3 max-h-64 overflow-y-auto">
            {trackFeedbacks.length === 0 ? (
              <p className="text-xs text-stone-500">
                No feedback yet for this track. Be the first to rate it.
              </p>
            ) : (
              trackFeedbacks.map((fb) => (
                <div key={fb.id} className="text-sm space-y-1 pb-3 border-b border-stone-100 last:border-b-0">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span className="font-medium text-stone-800">{fb.authorName}</span>
                    <span className="font-mono tabular-nums text-amber-700">{fb.rating}/5 ★</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{fb.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
