import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFocusSession, deleteFocusSession, getFocusSessions } from '../api';

const PRESETS = [
  { id: 'deep-focus', label: 'Deep focus', minutes: 25, type: 'focus' },
  { id: 'long-flow', label: 'Long flow', minutes: 50, type: 'focus' },
  { id: 'short-break', label: 'Short break', minutes: 5, type: 'break' },
  { id: 'long-break', label: 'Long break', minutes: 10, type: 'break' },
];

const MIN_TRACKED_SECONDS = 60;

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Pomodoro() {
  const [selectedPresetId, setSelectedPresetId] = useState(PRESETS[0].id);
  const [status, setStatus] = useState('idle');
  const [durationSeconds, setDurationSeconds] = useState(PRESETS[0].minutes * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(PRESETS[0].minutes * 60);
  const [sessionStart, setSessionStart] = useState(null);
  const [sessionEnd, setSessionEnd] = useState(null);
  const [trackedSeconds, setTrackedSeconds] = useState(0);
  const [dailyFocus, setDailyFocus] = useState({ date: toDateKey(new Date()), total_seconds: 0, sessions: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(() =>
    'Notification' in window ? window.Notification.permission : 'unsupported'
  );
  const completionSavedRef = useRef(false);
  const audioContextRef = useRef(null);
  const titleTimerRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  const selectedPreset = useMemo(
    () => PRESETS.find((preset) => preset.id === selectedPresetId) || PRESETS[0],
    [selectedPresetId]
  );
  const isFocusPreset = selectedPreset.type === 'focus';
  const timerColor = isFocusPreset ? '#0c87f0' : '#34d399';
  const progress = durationSeconds > 0
    ? ((durationSeconds - remainingSeconds) / durationSeconds) * 100
    : 0;

  const stopTitleAlert = useCallback(() => {
    if (titleTimerRef.current) {
      window.clearInterval(titleTimerRef.current);
      titleTimerRef.current = null;
    }
    document.title = originalTitleRef.current;
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return 'unsupported';
    }

    if (window.Notification.permission !== 'default') {
      setNotificationPermission(window.Notification.permission);
      return window.Notification.permission;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
    return permission;
  };

  const prepareAudio = async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  const playCompletionSound = useCallback(async () => {
    try {
      await prepareAudio();
      const audioContext = audioContextRef.current;
      if (!audioContext) return;

      const now = audioContext.currentTime;
      [0, 0.22, 0.44].forEach((offset) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + 0.18);
      });
    } catch (err) {
      console.error(err);
    }
  }, []);

  const notifyTimerComplete = useCallback((preset) => {
    const title = `${preset.label} ended`;
    const body = preset.type === 'focus' ? 'Time for a break.' : 'Break is over.';

    playCompletionSound();

    if ('Notification' in window && window.Notification.permission === 'granted') {
      new window.Notification(title, { body });
    }

    stopTitleAlert();
    let showAlertTitle = true;
    document.title = title;
    titleTimerRef.current = window.setInterval(() => {
      document.title = showAlertTitle ? title : originalTitleRef.current;
      showAlertTitle = !showAlertTitle;
    }, 1200);
  }, [playCompletionSound, stopTitleAlert]);

  const fetchDailyFocus = useCallback(async () => {
    try {
      const data = await getFocusSessions(toDateKey(new Date()));
      setDailyFocus(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyFocus();
  }, [fetchDailyFocus]);

  useEffect(() => () => stopTitleAlert(), [stopTitleAlert]);

  useEffect(() => {
    if (status !== 'running' || !sessionEnd) return undefined;

    const tick = () => {
      const nextRemaining = Math.max(0, Math.ceil((sessionEnd - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);
      setTrackedSeconds(Math.max(0, Math.floor((Date.now() - sessionStart) / 1000)));
    };

    tick();
    const timerId = window.setInterval(tick, 250);
    return () => window.clearInterval(timerId);
  }, [sessionEnd, sessionStart, status]);

  const saveSession = useCallback(async (durationSeconds, startedAt, endedAt, preset = selectedPreset) => {
    const duration = Math.floor(durationSeconds);
    if (duration < MIN_TRACKED_SECONDS) {
      setMessage('Focus sessions under 1 minute are not logged.');
      return false;
    }

    setSaving(true);
    try {
      await createFocusSession({
        preset_name: preset.label,
        duration_seconds: duration,
        started_at: new Date(startedAt).toISOString(),
        ended_at: new Date(endedAt).toISOString(),
      });
      await fetchDailyFocus();
      setMessage('Focus time saved.');
      return true;
    } catch (err) {
      console.error(err);
      setMessage('Could not save focus time.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchDailyFocus, selectedPreset]);

  useEffect(() => {
    if (status !== 'running' || remainingSeconds > 0 || completionSavedRef.current) return;

    completionSavedRef.current = true;
    const endedAt = Date.now();
    notifyTimerComplete(selectedPreset);

    const saveCompletion = isFocusPreset
      ? saveSession(durationSeconds, sessionStart, endedAt, selectedPreset)
      : Promise.resolve().then(() => setMessage('Break complete.'));

    saveCompletion.finally(() => {
      setStatus('complete');
      setSessionEnd(null);
      setTrackedSeconds(durationSeconds);
    });
  }, [durationSeconds, isFocusPreset, notifyTimerComplete, remainingSeconds, saveSession, selectedPreset, sessionStart, status]);

  const selectPreset = (preset) => {
    if (status === 'running') return;
    stopTitleAlert();
    setSelectedPresetId(preset.id);
    setDurationSeconds(preset.minutes * 60);
    setRemainingSeconds(preset.minutes * 60);
    setTrackedSeconds(0);
    setStatus('idle');
    setMessage('');
  };

  const startTimer = async () => {
    const now = Date.now();
    stopTitleAlert();
    await prepareAudio();
    requestNotificationPermission();
    completionSavedRef.current = false;
    setSessionStart(now - trackedSeconds * 1000);
    setSessionEnd(now + remainingSeconds * 1000);
    setStatus('running');
    setMessage('');
  };

  const pauseTimer = () => {
    if (status !== 'running') return;
    const elapsed = Math.max(0, Math.floor((Date.now() - sessionStart) / 1000));
    setTrackedSeconds(elapsed);
    setRemainingSeconds(Math.max(0, Math.ceil((sessionEnd - Date.now()) / 1000)));
    setSessionEnd(null);
    setStatus('paused');
  };

  const resetTimer = ({ keepMessage = false } = {}) => {
    completionSavedRef.current = false;
    stopTitleAlert();
    setStatus('idle');
    setRemainingSeconds(durationSeconds);
    setTrackedSeconds(0);
    setSessionStart(null);
    setSessionEnd(null);
    if (!keepMessage) setMessage('');
  };

  const adjustTimer = (deltaSeconds) => {
    if (status === 'complete') return;

    const nextRemaining = Math.max(60, remainingSeconds + deltaSeconds);
    const elapsedSeconds = Math.max(0, durationSeconds - remainingSeconds);
    const nextDuration = Math.max(60, elapsedSeconds + nextRemaining);

    setDurationSeconds(nextDuration);
    setRemainingSeconds(nextRemaining);
    if (status === 'running') setSessionEnd(Date.now() + nextRemaining * 1000);
  };

  const stopAndSave = async () => {
    if (status === 'idle') return;
    if (!isFocusPreset) {
      resetTimer();
      return;
    }

    const endedAt = Date.now();
    const duration = status === 'running'
      ? Math.max(0, Math.floor((endedAt - sessionStart) / 1000))
      : trackedSeconds;
    await saveSession(duration, sessionStart || endedAt - duration * 1000, endedAt);
    resetTimer({ keepMessage: true });
  };

  const removeSession = async (id) => {
    try {
      await deleteFocusSession(id);
      await fetchDailyFocus();
    } catch (err) {
      console.error(err);
      setMessage('Could not delete focus record.');
    }
  };

  return (
    <div className="pt-6">
      <div className="mb-5">
        <p className="text-sm font-medium text-gray-400">Focus timer</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-800">Pomodoro</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESETS.map((preset) => {
              const isSelected = preset.id === selectedPresetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => selectPreset(preset)}
                  disabled={status === 'running'}
                  className={`rounded-xl border px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSelected
                      ? 'border-gray-300 bg-white text-gray-800 shadow-sm'
                      : 'border-surface-200 bg-surface-50 text-gray-500 hover:bg-white'
                  }`}
                >
                  <span className="block text-xs font-bold uppercase tracking-wider">{preset.label}</span>
                  <span className="mt-1 block text-lg font-bold">{preset.minutes}m</span>
                  <span className="mt-1 block text-[11px] font-bold uppercase tracking-wider opacity-60">
                    {preset.type}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center rounded-2xl bg-surface-50 px-4 py-8">
            <div
              className="group/clock grid h-56 w-56 place-items-center rounded-full"
              style={{
                background: `conic-gradient(${timerColor} ${progress}%, #e9ecf0 ${progress}% 100%)`,
              }}
            >
              <div className="relative grid h-48 w-48 place-items-center rounded-full bg-white shadow-inner">
                <button
                  type="button"
                  onClick={() => adjustTimer(-300)}
                  disabled={remainingSeconds <= 60 || saving}
                  className="absolute left-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-surface-200 bg-white text-lg font-bold opacity-0 shadow-sm hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-0 group-hover/clock:opacity-100 group-focus-within/clock:opacity-100"
                  style={{ color: timerColor }}
                  title="Subtract 5 minutes"
                  aria-label="Subtract 5 minutes"
                >
                  -
                </button>
                <div className="pointer-events-none absolute inset-0 z-10 text-center">
                  <p className="absolute bottom-[calc(50%+42px)] left-1/2 w-full -translate-x-1/2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    {status === 'running' ? (isFocusPreset ? 'Focusing' : 'On break') : status === 'paused' ? 'Paused' : status === 'complete' ? 'Complete' : selectedPreset.label}
                  </p>
                  <p className="absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-[54%] text-center text-5xl font-bold leading-none tabular-nums text-gray-800">
                    {formatClock(remainingSeconds)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => adjustTimer(300)}
                  disabled={saving}
                  className="absolute right-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-surface-200 bg-white text-lg font-bold opacity-0 shadow-sm hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-0 group-hover/clock:opacity-100 group-focus-within/clock:opacity-100"
                  style={{ color: timerColor }}
                  title="Add 5 minutes"
                  aria-label="Add 5 minutes"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {status === 'running' ? (
                <button
                  type="button"
                  onClick={pauseTimer}
                  className="rounded-xl bg-gray-800 px-5 py-3 text-sm font-bold text-white hover:bg-gray-700"
                >
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startTimer}
                  className="rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg"
                  style={{ backgroundColor: timerColor }}
                >
                  {status === 'paused' ? 'Resume' : 'Start'}
                </button>
              )}
              <button
                type="button"
                onClick={stopAndSave}
                disabled={status === 'idle' || saving}
                className="rounded-xl border border-surface-200 bg-white px-5 py-3 text-sm font-bold text-gray-600 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isFocusPreset ? 'Stop & Save' : 'Stop'}
              </button>
              <button
                type="button"
                onClick={resetTimer}
                disabled={saving}
                className="rounded-xl border border-surface-200 bg-white px-5 py-3 text-sm font-bold text-gray-500 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reset
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-gray-400">
              <span>
                Alerts: {notificationPermission === 'granted' ? 'browser on' : notificationPermission === 'denied' ? 'browser blocked' : notificationPermission === 'unsupported' ? 'sound only' : 'sound on'}
              </span>
              {notificationPermission === 'default' && (
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="rounded-lg border border-surface-200 bg-white px-2.5 py-1 font-bold text-gray-500 hover:bg-surface-50"
                >
                  Enable browser alerts
                </button>
              )}
            </div>
            {message && <p className="mt-4 text-sm font-semibold text-gray-400">{message}</p>}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Today</p>
            <p className="mt-2 text-3xl font-bold text-gray-800">
              {formatDuration(dailyFocus.total_seconds || 0)}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-400">
              {dailyFocus.sessions.length} focus {dailyFocus.sessions.length === 1 ? 'record' : 'records'}
            </p>
          </section>

          <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800">Focus Records</h2>
              <span className="text-xs font-semibold text-gray-300">{dailyFocus.date}</span>
            </div>
            {loading ? (
              <div className="py-8 text-center text-sm font-semibold text-gray-400">Loading...</div>
            ) : dailyFocus.sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 px-3 py-8 text-center text-sm font-semibold text-gray-400">
                No focus time logged today.
              </div>
            ) : (
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {dailyFocus.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-700">{session.preset_name}</p>
                      <p className="text-xs font-medium text-gray-400">
                        {formatTime(session.started_at)} - {formatTime(session.ended_at)}
                      </p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-gray-700">
                      {formatDuration(session.duration_seconds)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSession(session.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 hover:bg-white hover:text-red-400"
                      title="Delete record"
                      aria-label="Delete focus record"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
