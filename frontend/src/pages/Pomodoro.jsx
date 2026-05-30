import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFocusSession, deleteFocusSession, getFocusSessions } from '../api';
import { dispatchPomodoroAlarm, preparePomodoroAlarm } from '../components/PomodoroAlarm';

const PRESETS = [
  { id: 'deep-focus', label: 'Deep focus', minutes: 25, type: 'focus' },
  { id: 'long-flow', label: 'Long flow', minutes: 50, type: 'focus' },
  { id: 'short-break', label: 'Short break', minutes: 5, type: 'break' },
  { id: 'long-break', label: 'Long break', minutes: 10, type: 'break' },
];

const MIN_TRACKED_SECONDS = 60;
const TIMER_STORAGE_KEY = 'pomodoro-active-timer';
const ALERT_SOUND_STORAGE_KEY = 'pomodoro-alert-sound';
const ALERT_VOLUME_STORAGE_KEY = 'pomodoro-alert-volume';
const ALERT_DURATION_STORAGE_KEY = 'pomodoro-alert-duration';
const GAIN_FLOOR = 0.0001;

const ALERT_DURATIONS = [5, 10, 15, 30];

const ALERT_SOUNDS = [
  {
    id: 'classic',
    label: 'Classic beep',
    tones: [
      { offset: 0, frequency: 880, duration: 0.2, type: 'sine', level: 0.52 },
      { offset: 0.24, frequency: 880, duration: 0.2, type: 'sine', level: 0.52 },
      { offset: 0.48, frequency: 880, duration: 0.24, type: 'sine', level: 0.56 },
    ],
  },
  {
    id: 'bright-chime',
    label: 'Bright chime',
    tones: [
      { offset: 0, frequency: 659.25, duration: 0.22, type: 'triangle', level: 0.48 },
      { offset: 0.18, frequency: 880, duration: 0.28, type: 'triangle', level: 0.5 },
      { offset: 0.38, frequency: 1318.51, duration: 0.34, type: 'sine', level: 0.46 },
    ],
  },
  {
    id: 'bell',
    label: 'Bell',
    tones: [
      { offset: 0, frequency: 987.77, duration: 0.7, type: 'sine', level: 0.5 },
      { offset: 0.03, frequency: 1975.53, duration: 0.55, type: 'triangle', level: 0.28 },
      { offset: 0.08, frequency: 1480, duration: 0.42, type: 'sine', level: 0.22 },
    ],
  },
  {
    id: 'digital',
    label: 'Digital alert',
    tones: [
      { offset: 0, frequency: 1046.5, duration: 0.12, type: 'square', level: 0.36 },
      { offset: 0.16, frequency: 784, duration: 0.12, type: 'square', level: 0.36 },
      { offset: 0.32, frequency: 1046.5, duration: 0.18, type: 'square', level: 0.4 },
      { offset: 0.54, frequency: 1318.51, duration: 0.2, type: 'square', level: 0.34 },
    ],
  },
  {
    id: 'soft-pulse',
    label: 'Soft pulse',
    tones: [
      { offset: 0, frequency: 523.25, duration: 0.24, type: 'sine', level: 0.44 },
      { offset: 0.28, frequency: 659.25, duration: 0.24, type: 'sine', level: 0.44 },
      { offset: 0.56, frequency: 783.99, duration: 0.36, type: 'sine', level: 0.48 },
    ],
  },
];

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

function getPresetById(presetId) {
  return PRESETS.find((preset) => preset.id === presetId) || PRESETS[0];
}

function getDefaultTimerState() {
  return {
    selectedPresetId: PRESETS[0].id,
    status: 'idle',
    durationSeconds: PRESETS[0].minutes * 60,
    remainingSeconds: PRESETS[0].minutes * 60,
    sessionStart: null,
    sessionEnd: null,
    trackedSeconds: 0,
  };
}

function getInitialTimerState() {
  const defaultState = getDefaultTimerState();

  try {
    const stored = window.sessionStorage.getItem(TIMER_STORAGE_KEY);
    if (!stored) return defaultState;

    const parsed = JSON.parse(stored);
    const preset = getPresetById(parsed.selectedPresetId);
    const status = ['running', 'paused', 'complete'].includes(parsed.status) ? parsed.status : 'idle';
    const durationSeconds = Number.isFinite(parsed.durationSeconds) && parsed.durationSeconds > 0
      ? parsed.durationSeconds
      : preset.minutes * 60;
    const sessionStart = Number.isFinite(parsed.sessionStart) ? parsed.sessionStart : null;
    const sessionEnd = Number.isFinite(parsed.sessionEnd) ? parsed.sessionEnd : null;
    const trackedSeconds = Number.isFinite(parsed.trackedSeconds)
      ? Math.max(0, Math.floor(parsed.trackedSeconds))
      : 0;

    if (status === 'running' && sessionStart && sessionEnd) {
      const now = Date.now();
      return {
        selectedPresetId: preset.id,
        status,
        durationSeconds,
        remainingSeconds: Math.max(0, Math.ceil((sessionEnd - now) / 1000)),
        sessionStart,
        sessionEnd,
        trackedSeconds: Math.max(0, Math.floor((now - sessionStart) / 1000)),
      };
    }

    if (status === 'paused' || status === 'complete') {
      const remainingSeconds = Number.isFinite(parsed.remainingSeconds)
        ? Math.max(0, Math.ceil(parsed.remainingSeconds))
        : Math.max(0, durationSeconds - trackedSeconds);

      return {
        selectedPresetId: preset.id,
        status,
        durationSeconds,
        remainingSeconds,
        sessionStart,
        sessionEnd: null,
        trackedSeconds,
      };
    }
  } catch (err) {
    console.error(err);
    window.sessionStorage.removeItem(TIMER_STORAGE_KEY);
  }

  return defaultState;
}

export default function Pomodoro() {
  const initialTimerState = useMemo(() => getInitialTimerState(), []);
  const [selectedPresetId, setSelectedPresetId] = useState(initialTimerState.selectedPresetId);
  const [status, setStatus] = useState(initialTimerState.status);
  const [durationSeconds, setDurationSeconds] = useState(initialTimerState.durationSeconds);
  const [remainingSeconds, setRemainingSeconds] = useState(initialTimerState.remainingSeconds);
  const [sessionStart, setSessionStart] = useState(initialTimerState.sessionStart);
  const [sessionEnd, setSessionEnd] = useState(initialTimerState.sessionEnd);
  const [trackedSeconds, setTrackedSeconds] = useState(initialTimerState.trackedSeconds);
  const [dailyFocus, setDailyFocus] = useState({ date: toDateKey(new Date()), total_seconds: 0, sessions: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [soundSettingsOpen, setSoundSettingsOpen] = useState(false);
  const [alertSoundId, setAlertSoundId] = useState(() => {
    const savedSound = window.localStorage.getItem(ALERT_SOUND_STORAGE_KEY);
    return ALERT_SOUNDS.some((sound) => sound.id === savedSound) ? savedSound : ALERT_SOUNDS[0].id;
  });
  const [alertVolume, setAlertVolume] = useState(() => {
    const savedVolume = Number(window.localStorage.getItem(ALERT_VOLUME_STORAGE_KEY));
    return Number.isFinite(savedVolume) ? Math.min(100, Math.max(0, savedVolume)) : 85;
  });
  const [alertDuration, setAlertDuration] = useState(() => {
    const savedDuration = Number(window.localStorage.getItem(ALERT_DURATION_STORAGE_KEY));
    return ALERT_DURATIONS.includes(savedDuration) ? savedDuration : 5;
  });
  const [notificationPermission, setNotificationPermission] = useState(() =>
    'Notification' in window ? window.Notification.permission : 'unsupported'
  );
  const completionSavedRef = useRef(false);
  const audioContextRef = useRef(null);
  const alertPlaybackIdRef = useRef(0);
  const activeAlertRef = useRef({ nodes: [], timeoutId: null });
  const titleTimerRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  const selectedPreset = useMemo(
    () => PRESETS.find((preset) => preset.id === selectedPresetId) || PRESETS[0],
    [selectedPresetId]
  );
  const isFocusPreset = selectedPreset.type === 'focus';
  const timerColor = isFocusPreset ? '#0c87f0' : '#34d399';
  const selectedAlertSound = useMemo(
    () => ALERT_SOUNDS.find((sound) => sound.id === alertSoundId) || ALERT_SOUNDS[0],
    [alertSoundId]
  );
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

  const stopCompletionSound = useCallback(() => {
    if (activeAlertRef.current.timeoutId) {
      window.clearTimeout(activeAlertRef.current.timeoutId);
      activeAlertRef.current.timeoutId = null;
    }

    activeAlertRef.current.nodes.forEach((node) => {
      try {
        if (typeof node.stop === 'function') node.stop();
      } catch (err) {
        // Oscillators throw if stopped twice; disconnect below still cleans up.
      }

      try {
        node.disconnect();
      } catch (err) {
        // Already-disconnected nodes are harmless.
      }
    });

    activeAlertRef.current.nodes = [];
  }, []);

  const stopCompletionAlarm = useCallback(() => {
    alertPlaybackIdRef.current += 1;
    stopCompletionSound();
    stopTitleAlert();
  }, [stopCompletionSound, stopTitleAlert]);

  useEffect(() => {
    window.localStorage.setItem(ALERT_SOUND_STORAGE_KEY, alertSoundId);
  }, [alertSoundId]);

  useEffect(() => {
    window.localStorage.setItem(ALERT_VOLUME_STORAGE_KEY, String(alertVolume));
  }, [alertVolume]);

  useEffect(() => {
    window.localStorage.setItem(ALERT_DURATION_STORAGE_KEY, String(alertDuration));
  }, [alertDuration]);

  const playAlertSound = useCallback(async (duration = alertDuration) => {
    try {
      const playbackId = alertPlaybackIdRef.current + 1;
      alertPlaybackIdRef.current = playbackId;
      stopCompletionSound();
      await prepareAudio();
      if (alertPlaybackIdRef.current !== playbackId) return;

      const audioContext = audioContextRef.current;
      if (!audioContext) return;

      const now = audioContext.currentTime;
      const playbackDuration = Math.max(0.5, duration);
      const volumeMultiplier = alertVolume / 100;
      const masterGain = audioContext.createGain();
      const limiter = audioContext.createDynamicsCompressor();
      const activeNodes = [masterGain, limiter];

      limiter.threshold.setValueAtTime(-10, now);
      limiter.knee.setValueAtTime(4, now);
      limiter.ratio.setValueAtTime(12, now);
      limiter.attack.setValueAtTime(0.003, now);
      limiter.release.setValueAtTime(0.12, now);

      masterGain.gain.setValueAtTime(volumeMultiplier, now);
      masterGain.connect(limiter);
      limiter.connect(audioContext.destination);

      const patternDuration = Math.max(...selectedAlertSound.tones.map((tone) => tone.offset + tone.duration));
      const repeatInterval = Math.max(patternDuration + 0.35, 1);
      const repeatCount = Math.max(1, Math.ceil(playbackDuration / repeatInterval));

      for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
        const repeatOffset = repeatIndex * repeatInterval;

        selectedAlertSound.tones.forEach((tone) => {
          const start = now + repeatOffset + tone.offset;
          if (start - now >= playbackDuration) return;

          const end = Math.min(start + tone.duration, now + playbackDuration);
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          activeNodes.push(oscillator, gain);

          oscillator.type = tone.type;
          oscillator.frequency.setValueAtTime(tone.frequency, start);
          gain.gain.setValueAtTime(GAIN_FLOOR, start);
          gain.gain.exponentialRampToValueAtTime(tone.level, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(GAIN_FLOOR, end);
          oscillator.connect(gain);
          gain.connect(masterGain);
          oscillator.start(start);
          oscillator.stop(end + 0.01);
        });
      }

      const disconnectAt = playbackDuration + 0.15;
      activeAlertRef.current.nodes = activeNodes;
      activeAlertRef.current.timeoutId = window.setTimeout(() => {
        activeAlertRef.current.nodes.forEach((node) => {
          try {
            node.disconnect();
          } catch (err) {
            // Already-disconnected nodes are harmless.
          }
        });
        activeAlertRef.current.nodes = [];
        activeAlertRef.current.timeoutId = null;
      }, disconnectAt * 1000);
    } catch (err) {
      console.error(err);
    }
  }, [alertDuration, alertVolume, selectedAlertSound, stopCompletionSound]);

  const testAlertSound = useCallback(() => playAlertSound(2), [playAlertSound]);

  const notifyTimerComplete = useCallback((preset) => {
    const title = `${preset.label} ended`;
    const body = preset.type === 'focus' ? 'Time for a break.' : 'Break is over.';

    dispatchPomodoroAlarm({ key: String(sessionEnd || Date.now()), title, body });

    if ('Notification' in window && window.Notification.permission === 'granted') {
      new window.Notification(title, { body });
    }
  }, [sessionEnd]);

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

  useEffect(() => {
    if (status === 'idle') {
      window.sessionStorage.removeItem(TIMER_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
      selectedPresetId,
      status,
      durationSeconds,
      remainingSeconds,
      sessionStart,
      sessionEnd,
      trackedSeconds,
    }));
  }, [durationSeconds, remainingSeconds, selectedPresetId, sessionEnd, sessionStart, status, trackedSeconds]);

  useEffect(() => () => {
    stopTitleAlert();
    stopCompletionSound();
  }, [stopCompletionSound, stopTitleAlert]);

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
    stopCompletionAlarm();
    setSelectedPresetId(preset.id);
    setDurationSeconds(preset.minutes * 60);
    setRemainingSeconds(preset.minutes * 60);
    setTrackedSeconds(0);
    setStatus('idle');
    setMessage('');
  };

  const startTimer = async () => {
    const now = Date.now();
    stopCompletionAlarm();
    await prepareAudio();
    preparePomodoroAlarm();
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
    stopCompletionAlarm();
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
              <button
                type="button"
                onClick={() => setSoundSettingsOpen((isOpen) => !isOpen)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2.5 py-1 font-bold text-gray-500 hover:bg-surface-50"
                aria-expanded={soundSettingsOpen}
                aria-controls="pomodoro-audio-settings"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                </svg>
                Audio
              </button>
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
            {soundSettingsOpen && (
              <div
                id="pomodoro-audio-settings"
                className="mt-4 grid w-full max-w-md gap-3 rounded-xl border border-surface-200 bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-end"
              >
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Alert sound</span>
                  <select
                    value={alertSoundId}
                    onChange={(event) => setAlertSoundId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-gray-300"
                  >
                    {ALERT_SOUNDS.map((sound) => (
                      <option key={sound.id} value={sound.id}>
                        {sound.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={testAlertSound}
                  className="rounded-lg border border-surface-200 bg-surface-50 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-white"
                >
                  Test sound
                </button>
                <label className="block sm:col-span-2">
                  <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400">
                    <span>Volume</span>
                    <span>{alertVolume}%</span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={alertVolume}
                    onChange={(event) => setAlertVolume(Number(event.target.value))}
                    className="mt-2 w-full accent-gray-800"
                    aria-label="Alert volume"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Alert duration</span>
                  <select
                    value={alertDuration}
                    onChange={(event) => setAlertDuration(Number(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-gray-300"
                  >
                    {ALERT_DURATIONS.map((duration) => (
                      <option key={duration} value={duration}>
                        {duration} seconds
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
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
