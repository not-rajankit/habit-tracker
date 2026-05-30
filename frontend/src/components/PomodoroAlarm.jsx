import { useCallback, useEffect, useRef, useState } from 'react';

const TIMER_STORAGE_KEY = 'pomodoro-active-timer';
const DISMISSED_ALARM_STORAGE_KEY = 'pomodoro-dismissed-alarm';
const ALERT_SOUND_STORAGE_KEY = 'pomodoro-alert-sound';
const ALERT_VOLUME_STORAGE_KEY = 'pomodoro-alert-volume';
const ALERT_DURATION_STORAGE_KEY = 'pomodoro-alert-duration';
const POMODORO_ALARM_EVENT = 'pomodoro-alarm';
const POMODORO_PREPARE_ALARM_EVENT = 'pomodoro-prepare-alarm';
const GAIN_FLOOR = 0.0001;

const PRESETS = [
  { id: 'deep-focus', label: 'Deep focus', type: 'focus' },
  { id: 'long-flow', label: 'Long flow', type: 'focus' },
  { id: 'short-break', label: 'Short break', type: 'break' },
  { id: 'long-break', label: 'Long break', type: 'break' },
];

const ALERT_SOUNDS = [
  {
    id: 'classic',
    tones: [
      { offset: 0, frequency: 880, duration: 0.2, type: 'sine', level: 0.52 },
      { offset: 0.24, frequency: 880, duration: 0.2, type: 'sine', level: 0.52 },
      { offset: 0.48, frequency: 880, duration: 0.24, type: 'sine', level: 0.56 },
    ],
  },
  {
    id: 'bright-chime',
    tones: [
      { offset: 0, frequency: 659.25, duration: 0.22, type: 'triangle', level: 0.48 },
      { offset: 0.18, frequency: 880, duration: 0.28, type: 'triangle', level: 0.5 },
      { offset: 0.38, frequency: 1318.51, duration: 0.34, type: 'sine', level: 0.46 },
    ],
  },
  {
    id: 'bell',
    tones: [
      { offset: 0, frequency: 987.77, duration: 0.7, type: 'sine', level: 0.5 },
      { offset: 0.03, frequency: 1975.53, duration: 0.55, type: 'triangle', level: 0.28 },
      { offset: 0.08, frequency: 1480, duration: 0.42, type: 'sine', level: 0.22 },
    ],
  },
  {
    id: 'digital',
    tones: [
      { offset: 0, frequency: 1046.5, duration: 0.12, type: 'square', level: 0.36 },
      { offset: 0.16, frequency: 784, duration: 0.12, type: 'square', level: 0.36 },
      { offset: 0.32, frequency: 1046.5, duration: 0.18, type: 'square', level: 0.4 },
      { offset: 0.54, frequency: 1318.51, duration: 0.2, type: 'square', level: 0.34 },
    ],
  },
  {
    id: 'soft-pulse',
    tones: [
      { offset: 0, frequency: 523.25, duration: 0.24, type: 'sine', level: 0.44 },
      { offset: 0.28, frequency: 659.25, duration: 0.24, type: 'sine', level: 0.44 },
      { offset: 0.56, frequency: 783.99, duration: 0.36, type: 'sine', level: 0.48 },
    ],
  },
];

function getPresetById(presetId) {
  return PRESETS.find((preset) => preset.id === presetId) || PRESETS[0];
}

function readStoredTimer() {
  try {
    const stored = window.sessionStorage.getItem(TIMER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function readAlertSettings() {
  const soundId = window.localStorage.getItem(ALERT_SOUND_STORAGE_KEY);
  const sound = ALERT_SOUNDS.find((item) => item.id === soundId) || ALERT_SOUNDS[0];
  const volume = Number(window.localStorage.getItem(ALERT_VOLUME_STORAGE_KEY));
  const duration = Number(window.localStorage.getItem(ALERT_DURATION_STORAGE_KEY));

  return {
    sound,
    volume: Number.isFinite(volume) ? Math.min(100, Math.max(0, volume)) : 85,
    duration: [5, 10, 15, 30].includes(duration) ? duration : 5,
  };
}

function getAlarmFromTimer(timer) {
  if (!timer || timer.status !== 'running' || !Number.isFinite(timer.sessionEnd)) return null;
  if (timer.sessionEnd > Date.now()) return null;

  const preset = getPresetById(timer.selectedPresetId);
  return {
    key: String(timer.sessionEnd),
    title: `${preset.label} ended`,
    body: preset.type === 'focus' ? 'Time for a break.' : 'Break is over.',
  };
}

export function dispatchPomodoroAlarm(alarm) {
  window.dispatchEvent(new CustomEvent(POMODORO_ALARM_EVENT, { detail: alarm }));
}

export function preparePomodoroAlarm() {
  window.dispatchEvent(new CustomEvent(POMODORO_PREPARE_ALARM_EVENT));
}

export default function PomodoroAlarm() {
  const [alarmToast, setAlarmToast] = useState(null);
  const [alarmPlaying, setAlarmPlaying] = useState(false);
  const audioContextRef = useRef(null);
  const playbackIdRef = useRef(0);
  const activeAlertRef = useRef({ nodes: [], timeoutId: null });
  const titleTimerRef = useRef(null);
  const originalTitleRef = useRef(document.title);
  const activeAlarmKeyRef = useRef(null);
  const dismissedAlarmKeyRef = useRef(window.sessionStorage.getItem(DISMISSED_ALARM_STORAGE_KEY));

  const stopTitleAlert = useCallback(() => {
    if (titleTimerRef.current) {
      window.clearInterval(titleTimerRef.current);
      titleTimerRef.current = null;
    }
    document.title = originalTitleRef.current;
  }, []);

  const stopCompletionSound = useCallback(() => {
    if (activeAlertRef.current.timeoutId) {
      window.clearTimeout(activeAlertRef.current.timeoutId);
      activeAlertRef.current.timeoutId = null;
    }

    activeAlertRef.current.nodes.forEach((node) => {
      try {
        if (typeof node.stop === 'function') node.stop();
      } catch (err) {
        // Oscillators throw if stopped twice.
      }

      try {
        node.disconnect();
      } catch (err) {
        // Already-disconnected nodes are harmless.
      }
    });

    activeAlertRef.current.nodes = [];
    setAlarmPlaying(false);
  }, []);

  const prepareAudioContext = useCallback(async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  const playCompletionSound = useCallback(async () => {
    try {
      const playbackId = playbackIdRef.current + 1;
      playbackIdRef.current = playbackId;
      stopCompletionSound();

      const audioContext = await prepareAudioContext();
      if (!audioContext) return;
      if (playbackIdRef.current !== playbackId) return;

      const { duration, sound, volume } = readAlertSettings();
      const now = audioContext.currentTime;
      const playbackDuration = Math.max(0.5, duration);
      const volumeMultiplier = volume / 100;
      const masterGain = audioContext.createGain();
      const limiter = audioContext.createDynamicsCompressor();
      const activeNodes = [masterGain, limiter];
      setAlarmPlaying(true);

      limiter.threshold.setValueAtTime(-10, now);
      limiter.knee.setValueAtTime(4, now);
      limiter.ratio.setValueAtTime(12, now);
      limiter.attack.setValueAtTime(0.003, now);
      limiter.release.setValueAtTime(0.12, now);

      masterGain.gain.setValueAtTime(volumeMultiplier, now);
      masterGain.connect(limiter);
      limiter.connect(audioContext.destination);

      const patternDuration = Math.max(...sound.tones.map((tone) => tone.offset + tone.duration));
      const repeatInterval = Math.max(patternDuration + 0.35, 1);
      const repeatCount = Math.max(1, Math.ceil(playbackDuration / repeatInterval));

      for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
        const repeatOffset = repeatIndex * repeatInterval;

        sound.tones.forEach((tone) => {
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

      activeAlertRef.current.nodes = activeNodes;
      activeAlertRef.current.timeoutId = window.setTimeout(() => {
        if (playbackIdRef.current !== playbackId) return;

        activeAlertRef.current.nodes.forEach((node) => {
          try {
            node.disconnect();
          } catch (err) {
            // Already-disconnected nodes are harmless.
          }
        });
        activeAlertRef.current.nodes = [];
        activeAlertRef.current.timeoutId = null;
        setAlarmPlaying(false);
      }, (playbackDuration + 0.15) * 1000);
    } catch (err) {
      console.error(err);
      setAlarmPlaying(false);
    }
  }, [prepareAudioContext, stopCompletionSound]);

  const startAlarm = useCallback((alarm) => {
    if (!alarm || alarm.key === dismissedAlarmKeyRef.current || alarm.key === activeAlarmKeyRef.current) return;

    activeAlarmKeyRef.current = alarm.key;
    setAlarmToast(alarm);
    setAlarmPlaying(false);
    playCompletionSound();
    stopTitleAlert();

    let showAlertTitle = true;
    document.title = alarm.title;
    titleTimerRef.current = window.setInterval(() => {
      document.title = showAlertTitle ? alarm.title : originalTitleRef.current;
      showAlertTitle = !showAlertTitle;
    }, 1200);
  }, [playCompletionSound, stopTitleAlert]);

  const stopCompletionAlarm = useCallback(() => {
    if (activeAlarmKeyRef.current) {
      dismissedAlarmKeyRef.current = activeAlarmKeyRef.current;
      window.sessionStorage.setItem(DISMISSED_ALARM_STORAGE_KEY, activeAlarmKeyRef.current);
    }
    activeAlarmKeyRef.current = null;
    playbackIdRef.current += 1;
    stopCompletionSound();
    stopTitleAlert();
    setAlarmToast(null);
    setAlarmPlaying(false);
  }, [stopCompletionSound, stopTitleAlert]);

  useEffect(() => {
    const handleAlarm = (event) => startAlarm(event.detail);
    const handlePrepareAlarm = () => {
      prepareAudioContext().catch((err) => console.error(err));
    };

    window.addEventListener(POMODORO_ALARM_EVENT, handleAlarm);
    window.addEventListener(POMODORO_PREPARE_ALARM_EVENT, handlePrepareAlarm);
    return () => {
      window.removeEventListener(POMODORO_ALARM_EVENT, handleAlarm);
      window.removeEventListener(POMODORO_PREPARE_ALARM_EVENT, handlePrepareAlarm);
    };
  }, [prepareAudioContext, startAlarm]);

  useEffect(() => {
    const checkTimer = () => {
      const timer = readStoredTimer();
      const nextAlarm = getAlarmFromTimer(timer);
      if (nextAlarm) {
        startAlarm(nextAlarm);
        return;
      }

      if (timer?.status !== 'running') {
        activeAlarmKeyRef.current = null;
      }
    };

    checkTimer();
    const timerId = window.setInterval(checkTimer, 1000);
    return () => window.clearInterval(timerId);
  }, [startAlarm]);

  useEffect(() => () => {
    stopCompletionSound();
    stopTitleAlert();
  }, [stopCompletionSound, stopTitleAlert]);

  if (!alarmToast) return null;

  return (
    <div className="group/alarm-toast fixed inset-x-4 top-4 z-[70] mx-auto max-w-md rounded-2xl border border-gray-900/10 bg-gray-950 p-4 text-white shadow-2xl sm:right-6 sm:left-auto sm:mx-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg">
          !
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{alarmToast.title}</p>
          <p className="mt-1 text-sm font-medium text-white/70">{alarmToast.body}</p>
        </div>
        {alarmPlaying ? (
          <button
            type="button"
            onClick={stopCompletionAlarm}
            className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
          >
            Stop alarm
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white/80">
              Timer ended
            </span>
            <button
              type="button"
              onClick={stopCompletionAlarm}
              className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-lg leading-none text-white/80 opacity-0 hover:bg-white/15 hover:text-white focus:opacity-100 group-hover/alarm-toast:opacity-100"
              aria-label="Dismiss timer alert"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
