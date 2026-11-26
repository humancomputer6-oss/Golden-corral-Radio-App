import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  CURATED_PLAYLISTS,
  CURATED_TRACKS,
  DEFAULT_AUDIO_ZONES,
  DEFAULT_SCHEDULES,
  SAMPLE_INVENTORY,
  SAMPLE_REPORT_SCHEDULES,
  SAMPLE_SHIFTS,
} from '../data/curatedCatalog';
import type {
  ApprovedTrack,
  AudioZone,
  InventoryLog,
  MusicSubmission,
  Playlist,
  PlaylistSchedule,
  RadioTrack,
  ReportActivityLog,
  ReportSchedule,
  StaffShift,
  TrackFeedback,
  UserNotification,
  UserProfile,
  UserRole,
} from '../types/radio';
import {
  getOfflineTracks,
  removeTrackOffline,
  resolvePlayableAudioUrl,
  saveTrackOffline,
} from '../utils/offlineStorage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface RadioContextValue {
  // Auth & RBAC
  user: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  signingIn: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  allUsers: UserProfile[];
  updateUserRole: (uid: string, role: UserRole) => Promise<void>;

  // Player & Streaming
  playlists: Playlist[];
  tracks: RadioTrack[];
  currentTrack: RadioTrack;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
  playingFromOfflineCache: boolean;
  simulatedOffline: boolean;
  setSimulatedOffline: (val: boolean) => void;
  isOnline: boolean;
  playTrack: (track: RadioTrack) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  seekTo: (seconds: number) => void;

  // Offline storage
  offlineTrackIds: Set<string>;
  offlineTracks: RadioTrack[];
  cachingTrackIds: Set<string>;
  toggleTrackOffline: (track: RadioTrack) => Promise<void>;
  savePlaylistOffline: (playlistId: string) => Promise<void>;

  // Zones & Peak Schedules
  audioZones: AudioZone[];
  activeZoneId: string;
  setActiveZoneId: (zoneId: string) => void;
  updateZoneVolume: (zoneId: string, volume: number) => Promise<void>;
  toggleZoneMute: (zoneId: string) => Promise<void>;
  assignZonePlaylist: (zoneId: string, playlistId: string) => Promise<void>;
  schedules: PlaylistSchedule[];
  saveSchedule: (schedule: Omit<PlaylistSchedule, 'updatedBy' | 'updatedAt'>) => Promise<void>;
  toggleSchedule: (scheduleId: string, enabled: boolean) => Promise<void>;

  // Operations
  shifts: StaffShift[];
  inventoryLogs: InventoryLog[];
  createShift: (shift: Omit<StaffShift, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateShiftStatus: (shiftId: string, status: StaffShift['status']) => Promise<void>;
  upsertInventoryLog: (item: Omit<InventoryLog, 'id' | 'loggedBy' | 'loggedByName' | 'createdAt' | 'updatedAt'>, existingId?: string) => Promise<void>;

  // Submissions, Feedback & Notifications
  submissions: MusicSubmission[];
  approvedTracks: ApprovedTrack[];
  feedbackList: TrackFeedback[];
  notifications: UserNotification[];
  unreadNotificationCount: number;
  submitTrackFeedback: (trackId: string, rating: number, comment: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  reviewSubmission: (
    submission: MusicSubmission,
    nextStatus: MusicSubmission['status'],
    notes: string
  ) => Promise<void>;

  // Reporting & Audit
  reportSchedules: ReportSchedule[];
  reportLogs: ReportActivityLog[];
  saveReportSchedule: (sched: Omit<ReportSchedule, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  toggleReportSchedule: (id: string, enabled: boolean) => Promise<void>;
  recordReportActivity: (entry: Omit<ReportActivityLog, 'id' | 'actorUid' | 'actorEmail' | 'actorRole' | 'createdAt'>) => Promise<void>;
  updateScheduleLastRun: (id: string) => Promise<void>;
}

const RadioContext = createContext<RadioContextValue | null>(null);

export const RadioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isOnline = useOnlineStatus();
  const [simulatedOffline, setSimulatedOffline] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  const [audioZones, setAudioZones] = useState<AudioZone[]>(DEFAULT_AUDIO_ZONES);
  const [activeZoneId, setActiveZoneId] = useState<string>('dining-room');
  const [schedules, setSchedules] = useState<PlaylistSchedule[]>(DEFAULT_SCHEDULES);
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [submissions, setSubmissions] = useState<MusicSubmission[]>([]);
  const [approvedTracks, setApprovedTracks] = useState<ApprovedTrack[]>([]);
  const [feedbackList, setFeedbackList] = useState<TrackFeedback[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [reportSchedules, setReportSchedules] = useState<ReportSchedule[]>([]);
  const [reportLogs, setReportLogs] = useState<ReportActivityLog[]>([]);

  const [offlineTracks, setOfflineTracks] = useState<RadioTrack[]>([]);
  const [cachingTrackIds, setCachingTrackIds] = useState<Set<string>>(new Set());

  const [currentTrack, setCurrentTrack] = useState<RadioTrack>(CURATED_TRACKS[2]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(CURATED_TRACKS[2].durationSeconds);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playingFromOfflineCache, setPlayingFromOfflineCache] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const seededRef = useRef(false);

  // Combine curated royalty-free tracks + approved local community submissions
  const tracks = useMemo<RadioTrack[]>(() => {
    const community: RadioTrack[] = approvedTracks.map((a) => ({
      id: a.id,
      title: a.trackTitle,
      artist: a.artistName,
      playlistId: 'community-spotlight',
      genre: a.genre,
      durationSeconds: a.durationSeconds,
      bpm: 100,
      audioUrl: a.fileUrl,
      coverUrl: '/src/assets/images/album_lunch_rush_1795666169379.jpg',
      isCommunity: true,
      audioFormat: a.audioFormat,
    }));
    return [...CURATED_TRACKS, ...community];
  }, [approvedTracks]);

  const playlists = useMemo<Playlist[]>(() => {
    const communityCount = approvedTracks.length;
    if (communityCount === 0) return CURATED_PLAYLISTS;
    return [
      ...CURATED_PLAYLISTS,
      {
        id: 'community-spotlight',
        name: 'Local Clean Edits On-Air',
        daypart: 'Community Rotation · Verified Clean',
        description: 'Approved local artist tracks cleared for family-friendly broadcast.',
        coverUrl: '/src/assets/images/album_lunch_rush_1795666169379.jpg',
        trackCount: communityCount,
      },
    ];
  }, [approvedTracks.length]);

  const offlineTrackIds = useMemo(
    () => new Set(offlineTracks.map((t) => t.id)),
    [offlineTracks]
  );

  // Load offline tracks from IndexedDB on mount
  useEffect(() => {
    getOfflineTracks().then(setOfflineTracks).catch(() => {});
  }, []);

  // Initialize HTMLAudioElement once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.loop = false;
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  // Sync active AudioZone volume & mute to live <audio> output
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const zone = audioZones.find((z) => z.id === activeZoneId) || audioZones[0];
    if (zone) {
      audio.volume = zone.muted ? 0 : Math.max(0, Math.min(1, zone.volume / 100));
    }
  }, [audioZones, activeZoneId]);

  const playTrack = useCallback(async (track: RadioTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTrack(track);
    setDuration(track.durationSeconds);
    setCurrentTime(0);
    setIsBuffering(true);

    try {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      const resolved = await resolvePlayableAudioUrl(track);
      if (resolved.fromOfflineCache) {
        objectUrlRef.current = resolved.url;
      }
      setPlayingFromOfflineCache(resolved.fromOfflineCache);
      audio.src = resolved.url;
      await audio.play();
    } catch (err) {
      console.error('Playback error:', err);
      setIsPlaying(false);
    } finally {
      setIsBuffering(false);
    }
  }, []);

  const nextTrack = useCallback(async () => {
    const pool = simulatedOffline || !isOnline
      ? tracks.filter((t) => offlineTrackIds.has(t.id))
      : tracks;
    const list = pool.length > 0 ? pool : tracks;
    const idx = list.findIndex((t) => t.id === currentTrack.id);
    const next = list[(idx + 1) % list.length];
    if (next) await playTrack(next);
  }, [tracks, currentTrack.id, playTrack, simulatedOffline, isOnline, offlineTrackIds]);

  const prevTrack = useCallback(async () => {
    const pool = simulatedOffline || !isOnline
      ? tracks.filter((t) => offlineTrackIds.has(t.id))
      : tracks;
    const list = pool.length > 0 ? pool : tracks;
    const idx = list.findIndex((t) => t.id === currentTrack.id);
    const prev = list[(idx - 1 + list.length) % list.length];
    if (prev) await playTrack(prev);
  }, [tracks, currentTrack.id, playTrack, simulatedOffline, isOnline, offlineTrackIds]);

  // Auto-advance on track end
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      nextTrack();
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [nextTrack]);

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      return;
    }
    if (!audio.src) {
      await playTrack(currentTrack);
      return;
    }
    try {
      await audio.play();
    } catch {
      await playTrack(currentTrack);
    }
  }, [isPlaying, playTrack, currentTrack]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || duration));
    setCurrentTime(audio.currentTime);
  }, [duration]);

  const toggleTrackOffline = useCallback(async (track: RadioTrack) => {
    setCachingTrackIds((prev) => new Set(prev).add(track.id));
    try {
      if (offlineTrackIds.has(track.id)) {
        await removeTrackOffline(track);
      } else {
        await saveTrackOffline(track);
      }
      const updated = await getOfflineTracks();
      setOfflineTracks(updated);
    } finally {
      setCachingTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  }, [offlineTrackIds]);

  const savePlaylistOffline = useCallback(async (playlistId: string) => {
    const list = tracks.filter((t) => t.playlistId === playlistId);
    for (const track of list) {
      if (!offlineTrackIds.has(track.id)) {
        setCachingTrackIds((prev) => new Set(prev).add(track.id));
        await saveTrackOffline(track);
        setCachingTrackIds((prev) => {
          const next = new Set(prev);
          next.delete(track.id);
          return next;
        });
      }
    }
    const updated = await getOfflineTracks();
    setOfflineTracks(updated);
  }, [tracks, offlineTrackIds]);

  // --- Firebase Auth & Profile Hydration ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setAuthReady(true);
        return;
      }

      const userRef = doc(db, 'users', firebaseUser.uid);
      try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          // Ensure bootstrap admin always retains admin role
          if (
            firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL &&
            firebaseUser.emailVerified &&
            data.role !== 'admin'
          ) {
            await updateDoc(userRef, { role: 'admin', updatedAt: serverTimestamp() });
            setProfile({ ...data, role: 'admin' });
          } else {
            setProfile(data);
          }
        } else {
          const initialRole: UserRole =
            firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL && firebaseUser.emailVerified
              ? 'admin'
              : 'subscriber';
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || 'subscriber@goldencorral.local',
            displayName: (
              firebaseUser.displayName ||
              firebaseUser.email?.split('@')[0] ||
              'Radio Subscriber'
            ).slice(0, 100),
            role: initialRole,
          };
          await setDoc(userRef, {
            ...newProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setProfile(newProfile);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Seed initial operational collections once when an Admin/Manager signs in
  useEffect(() => {
    if (!authReady || !user || !profile) return;
    if (profile.role !== 'admin' && profile.role !== 'manager') return;
    if (seededRef.current) return;
    seededRef.current = true;

    const seedIfEmpty = async () => {
      try {
        const zoneSnap = await getDocs(collection(db, 'audioZones'));
        if (zoneSnap.empty) {
          for (const z of DEFAULT_AUDIO_ZONES) {
            await setDoc(doc(db, 'audioZones', z.id), {
              ...z,
              updatedBy: user.uid,
              updatedAt: serverTimestamp(),
            });
          }
        }

        const schedSnap = await getDocs(collection(db, 'playlistSchedules'));
        if (schedSnap.empty) {
          for (const s of DEFAULT_SCHEDULES) {
            await setDoc(doc(db, 'playlistSchedules', s.id), {
              ...s,
              updatedBy: user.uid,
              updatedAt: serverTimestamp(),
            });
          }
        }

        const shiftSnap = await getDocs(collection(db, 'staffShifts'));
        if (shiftSnap.empty) {
          for (const sh of SAMPLE_SHIFTS) {
            await setDoc(doc(db, 'staffShifts', sh.id), {
              ...sh,
              createdBy: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        const invSnap = await getDocs(collection(db, 'inventoryLogs'));
        if (invSnap.empty) {
          for (const inv of SAMPLE_INVENTORY) {
            await setDoc(doc(db, 'inventoryLogs', inv.id), {
              ...inv,
              loggedBy: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        const rSchedSnap = await getDocs(collection(db, 'reportSchedules'));
        if (rSchedSnap.empty) {
          for (const rs of SAMPLE_REPORT_SCHEDULES) {
            await setDoc(doc(db, 'reportSchedules', rs.id), {
              ...rs,
              createdBy: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        console.error('Seed check error:', err);
      }
    };

    seedIfEmpty();
  }, [authReady, user, profile]);

  // Attach real-time Firestore listeners ONLY when auth is ready & user authenticated
  useEffect(() => {
    if (!authReady || !user || !profile) {
      setShifts([]);
      setInventoryLogs([]);
      setSubmissions([]);
      setNotifications([]);
      setReportSchedules([]);
      setReportLogs([]);
      setAllUsers([]);
      return;
    }

    const unsubs: (() => void)[] = [];

    // 1. Audio Zones
    unsubs.push(
      onSnapshot(
        collection(db, 'audioZones'),
        (snap) => {
          if (!snap.empty) {
            setAudioZones(snap.docs.map((d) => d.data() as AudioZone));
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'audioZones')
      )
    );

    // 2. Playlist Schedules
    unsubs.push(
      onSnapshot(
        collection(db, 'playlistSchedules'),
        (snap) => {
          if (!snap.empty) {
            setSchedules(snap.docs.map((d) => d.data() as PlaylistSchedule));
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'playlistSchedules')
      )
    );

    // 3. Approved Community Tracks
    unsubs.push(
      onSnapshot(
        collection(db, 'approvedTracks'),
        (snap) => {
          setApprovedTracks(snap.docs.map((d) => d.data() as ApprovedTrack));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'approvedTracks')
      )
    );

    // 4. Listener Track Feedback
    unsubs.push(
      onSnapshot(
        query(collection(db, 'trackFeedback'), orderBy('createdAt', 'desc')),
        (snap) => {
          setFeedbackList(snap.docs.map((d) => d.data() as TrackFeedback));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'trackFeedback')
      )
    );

    // 5. Real-Time User Notifications
    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('userId', '==', user.uid)),
        (snap) => {
          const items = snap.docs.map((d) => d.data() as UserNotification);
          setNotifications(items);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      )
    );

    // 6. Submissions (All for Admin/Manager; Own for Subscribers/Staff)
    const subQuery =
      profile.role === 'admin' || profile.role === 'manager'
        ? collection(db, 'submissions')
        : query(collection(db, 'submissions'), where('submitterId', '==', user.uid));

    unsubs.push(
      onSnapshot(
        subQuery,
        (snap) => {
          setSubmissions(snap.docs.map((d) => d.data() as MusicSubmission));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'submissions')
      )
    );

    // 7. Staff & Operations (Staff, Manager, Admin)
    if (profile.role === 'staff' || profile.role === 'manager' || profile.role === 'admin') {
      unsubs.push(
        onSnapshot(
          collection(db, 'staffShifts'),
          (snap) => {
            setShifts(snap.docs.map((d) => d.data() as StaffShift));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'staffShifts')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'inventoryLogs'),
          (snap) => {
            setInventoryLogs(snap.docs.map((d) => d.data() as InventoryLog));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'inventoryLogs')
        )
      );
    }

    // 8. Report Schedules & Activity Logs (Manager, Admin)
    if (profile.role === 'manager' || profile.role === 'admin') {
      unsubs.push(
        onSnapshot(
          collection(db, 'reportSchedules'),
          (snap) => {
            setReportSchedules(snap.docs.map((d) => d.data() as ReportSchedule));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'reportSchedules')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'reportActivityLogs'),
          (snap) => {
            setReportLogs(snap.docs.map((d) => d.data() as ReportActivityLog));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'reportActivityLogs')
        )
      );
    }

    // 9. User RBAC Directory (Admin only)
    if (profile.role === 'admin') {
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            setAllUsers(snap.docs.map((d) => d.data() as UserProfile));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'users')
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, user, profile]);

  const signIn = useCallback(async () => {
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } finally {
      setSigningIn(false);
    }
  }, []);

  const logOut = useCallback(async () => {
    await signOut(auth);
  }, []);

  const updateUserRole = useCallback(async (uid: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  }, []);

  const updateZoneVolume = useCallback(
    async (zoneId: string, volume: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(volume)));
      setAudioZones((prev) =>
        prev.map((z) => (z.id === zoneId ? { ...z, volume: clamped } : z))
      );
      if (!user || !profile || profile.role === 'subscriber') return;
      try {
        await updateDoc(doc(db, 'audioZones', zoneId), {
          volume: clamped,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `audioZones/${zoneId}`);
      }
    },
    [user, profile]
  );

  const toggleZoneMute = useCallback(
    async (zoneId: string) => {
      const current = audioZones.find((z) => z.id === zoneId);
      const nextMuted = !current?.muted;
      setAudioZones((prev) =>
        prev.map((z) => (z.id === zoneId ? { ...z, muted: nextMuted } : z))
      );
      if (!user || !profile || profile.role === 'subscriber') return;
      try {
        await updateDoc(doc(db, 'audioZones', zoneId), {
          muted: nextMuted,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `audioZones/${zoneId}`);
      }
    },
    [audioZones, user, profile]
  );

  const assignZonePlaylist = useCallback(
    async (zoneId: string, playlistId: string) => {
      setAudioZones((prev) =>
        prev.map((z) => (z.id === zoneId ? { ...z, activePlaylistId: playlistId } : z))
      );
      if (!user || !profile || profile.role === 'subscriber') return;
      try {
        await updateDoc(doc(db, 'audioZones', zoneId), {
          activePlaylistId: playlistId,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `audioZones/${zoneId}`);
      }
    },
    [user, profile]
  );

  const saveSchedule = useCallback(
    async (schedule: Omit<PlaylistSchedule, 'updatedBy' | 'updatedAt'>) => {
      if (!user) return;
      try {
        await setDoc(doc(db, 'playlistSchedules', schedule.id), {
          ...schedule,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `playlistSchedules/${schedule.id}`);
      }
    },
    [user]
  );

  const toggleSchedule = useCallback(
    async (scheduleId: string, enabled: boolean) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'playlistSchedules', scheduleId), {
          enabled,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `playlistSchedules/${scheduleId}`);
      }
    },
    [user]
  );

  const createShift = useCallback(
    async (shift: Omit<StaffShift, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
      if (!user) return;
      const id = `shift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        await setDoc(doc(db, 'staffShifts', id), {
          ...shift,
          id,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `staffShifts/${id}`);
      }
    },
    [user]
  );

  const updateShiftStatus = useCallback(async (shiftId: string, status: StaffShift['status']) => {
    try {
      await updateDoc(doc(db, 'staffShifts', shiftId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `staffShifts/${shiftId}`);
    }
  }, []);

  const upsertInventoryLog = useCallback(
    async (
      item: Omit<InventoryLog, 'id' | 'loggedBy' | 'loggedByName' | 'createdAt' | 'updatedAt'>,
      existingId?: string
    ) => {
      if (!user || !profile) return;
      const id = existingId || `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        if (existingId) {
          await updateDoc(doc(db, 'inventoryLogs', existingId), {
            quantity: item.quantity,
            parLevel: item.parLevel,
            status: item.status,
            loggedBy: user.uid,
            loggedByName: profile.displayName,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'inventoryLogs', id), {
            ...item,
            id,
            loggedBy: user.uid,
            loggedByName: profile.displayName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `inventoryLogs/${id}`);
      }
    },
    [user, profile]
  );

  const submitTrackFeedback = useCallback(
    async (trackId: string, rating: number, comment: string) => {
      if (!user || !profile) return;
      const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        await setDoc(doc(db, 'trackFeedback', id), {
          id,
          trackId,
          userId: user.uid,
          authorName: profile.displayName.slice(0, 80),
          rating: Math.max(1, Math.min(5, Math.round(rating))),
          comment: comment.trim().slice(0, 400),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `trackFeedback/${id}`);
      }
    },
    [user, profile]
  );

  const markNotificationRead = useCallback(async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  }, []);

  const reviewSubmission = useCallback(
    async (
      submission: MusicSubmission,
      nextStatus: MusicSubmission['status'],
      notes: string
    ) => {
      try {
        await updateDoc(doc(db, 'submissions', submission.id), {
          status: nextStatus,
          reviewerNotes: notes.trim().slice(0, 500),
          updatedAt: serverTimestamp(),
        });

        // If approved, publish to public clean rotation without PII
        if (nextStatus === 'approved') {
          const trackId = `local_${submission.id}`;
          await setDoc(doc(db, 'approvedTracks', trackId), {
            id: trackId,
            submissionId: submission.id,
            artistName: submission.artistName,
            trackTitle: submission.trackTitle,
            genre: submission.genre,
            audioFormat: submission.audioFormat,
            fileUrl: submission.fileUrl,
            durationSeconds: submission.durationSeconds,
            approvedAt: serverTimestamp(),
          });
        }

        // Dispatch real-time notification to submitter
        const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const statusLabel =
          nextStatus === 'approved'
            ? 'Approved & Live On Air'
            : nextStatus === 'in_review'
            ? 'In Audio Quality Review'
            : nextStatus === 'rejected'
            ? 'Declined'
            : 'Pending';

        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: submission.submitterId,
          title: `Submission ${statusLabel}: ${submission.trackTitle}`,
          message: notes.trim()
            ? `Broadcast desk update: ${notes.trim().slice(0, 300)}`
            : `Your track "${submission.trackTitle}" status changed to ${statusLabel}.`,
          type: 'submission_status',
          read: false,
          relatedId: submission.id,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `submissions/${submission.id}`);
      }
    },
    []
  );

  const saveReportSchedule = useCallback(
    async (sched: Omit<ReportSchedule, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
      if (!user) return;
      const id = `rsched_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        await setDoc(doc(db, 'reportSchedules', id), {
          ...sched,
          id,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `reportSchedules/${id}`);
      }
    },
    [user]
  );

  const toggleReportSchedule = useCallback(async (id: string, enabled: boolean) => {
    try {
      await updateDoc(doc(db, 'reportSchedules', id), {
        enabled,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reportSchedules/${id}`);
    }
  }, []);

  const updateScheduleLastRun = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, 'reportSchedules', id), {
        lastRunAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reportSchedules/${id}`);
    }
  }, []);

  const recordReportActivity = useCallback(
    async (
      entry: Omit<ReportActivityLog, 'id' | 'actorUid' | 'actorEmail' | 'actorRole' | 'createdAt'>
    ) => {
      if (!user || !profile) return;
      const id = `rlog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        await setDoc(doc(db, 'reportActivityLogs', id), {
          ...entry,
          id,
          actorUid: user.uid,
          actorEmail: profile.email,
          actorRole: profile.role,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `reportActivityLogs/${id}`);
      }
    },
    [user, profile]
  );

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value: RadioContextValue = {
    user,
    profile,
    authReady,
    signingIn,
    signIn,
    logOut,
    allUsers,
    updateUserRole,
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
    offlineTracks,
    cachingTrackIds,
    toggleTrackOffline,
    savePlaylistOffline,
    audioZones,
    activeZoneId,
    setActiveZoneId,
    updateZoneVolume,
    toggleZoneMute,
    assignZonePlaylist,
    schedules,
    saveSchedule,
    toggleSchedule,
    shifts,
    inventoryLogs,
    createShift,
    updateShiftStatus,
    upsertInventoryLog,
    submissions,
    approvedTracks,
    feedbackList,
    notifications,
    unreadNotificationCount,
    submitTrackFeedback,
    markNotificationRead,
    reviewSubmission,
    reportSchedules,
    reportLogs,
    saveReportSchedule,
    toggleReportSchedule,
    recordReportActivity,
    updateScheduleLastRun,
  };

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
};

export function useRadio(): RadioContextValue {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used inside RadioProvider');
  return ctx;
}
