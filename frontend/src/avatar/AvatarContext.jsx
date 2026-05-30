import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'habit-tracker-avatar-style';

export const avatarStyles = [
  {
    value: 'monogram',
    label: 'Monogram',
    description: 'Your initials in a clean badge.',
    glyph: null,
    className: 'bg-brand-600 text-white shadow-lg shadow-brand-200',
  },
  {
    value: 'spark',
    label: 'Spark',
    description: 'A sharp, energetic mark.',
    glyph: '✦',
    className: 'bg-slate-900 text-white shadow-lg shadow-slate-200',
  },
  {
    value: 'orbit',
    label: 'Orbit',
    description: 'A soft, rounded symbol.',
    glyph: '◎',
    className: 'bg-sky-600 text-white shadow-lg shadow-sky-200',
  },
  {
    value: 'leaf',
    label: 'Leaf',
    description: 'A calmer, organic feel.',
    glyph: '❦',
    className: 'bg-emerald-600 text-white shadow-lg shadow-emerald-200',
  },
  {
    value: 'sun',
    label: 'Sun',
    description: 'Warm and bright for a softer profile tab.',
    glyph: '☼',
    className: 'bg-amber-500 text-white shadow-lg shadow-amber-200',
  },
];

const AvatarContext = createContext(null);

function readStoredAvatarStyle() {
  if (typeof window === 'undefined') return 'monogram';

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (avatarStyles.some((style) => style.value === stored)) {
      return stored;
    }
  } catch {
    // Ignore storage failures and fall back to the default avatar style.
  }

  return 'monogram';
}

function getAvatarLabel(user) {
  return (user?.name || user?.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
}

function getAvatarStyle(value) {
  return avatarStyles.find((style) => style.value === value) || avatarStyles[0];
}

export function AvatarProvider({ children }) {
  const [avatarStyle, setAvatarStyle] = useState(readStoredAvatarStyle);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, avatarStyle);
    } catch {
      // Ignore storage failures; the selected avatar still works for this session.
    }
  }, [avatarStyle]);

  const value = useMemo(() => ({
    avatarStyle,
    setAvatarStyle,
    avatarStyles,
  }), [avatarStyle]);

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useAvatar() {
  const value = useContext(AvatarContext);
  if (!value) throw new Error('useAvatar must be used within AvatarProvider');
  return value;
}

export function AvatarBadge({ user, variant, size = 'md', className = '' }) {
  const { avatarStyle } = useAvatar();
  const style = getAvatarStyle(variant || avatarStyle);
  const label = getAvatarLabel(user);

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  };

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full font-black ${sizeClasses[size]} ${style.className} ${className}`}
      aria-hidden="true"
    >
      {style.glyph || label}
    </div>
  );
}

export function getAvatarStyleLabel(value) {
  return getAvatarStyle(value).label;
}
