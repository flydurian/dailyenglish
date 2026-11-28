import React from 'react';

// Editorial Line: 24px grid · 1.6px stroke · rounded caps
const iconProps = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
    focusable: 'false',
} as const;

const SIZE_MAP: Record<string, number> = {
    'h-1.5 w-1.5': 8,
    'h-2 w-2': 10,
    'h-2.5 w-2.5': 12,
    'h-3 w-3': 12,
    'h-4 w-4': 16,
    'h-5 w-5': 20,
    'h-6 w-6': 24,
    'h-8 w-8': 32,
    'h-10 w-10': 40,
};

const resolveSize = (size: string | number): number => {
    if (typeof size === 'number') return size;
    return SIZE_MAP[size] ?? 24;
};

export const ChevronLeftIcon = () => (
    <svg {...iconProps} strokeWidth="1.6">
        <path d="m15 18-6-6 6-6" />
    </svg>
);

export const ChevronRightIcon = () => (
    <svg {...iconProps} strokeWidth="1.6">
        <path d="m9 18 6-6-6-6" />
    </svg>
);

export const Volume2Icon = ({ className }: { className?: string } = {}) => (
    <svg {...iconProps} strokeWidth="1.6" className={className}>
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
);

export const TranslateIcon = ({ className }: { className?: string } = {}) => (
    <svg {...iconProps} strokeWidth="1.6" className={className}>
        <path d="M4 6h8M8 4v2c0 4-2 6-5 7" />
        <path d="M4 10c1.5 2 4 3.5 6.5 4.5" />
        <path d="m14 20 4-9 4 9" />
        <path d="M15.5 17h5" />
    </svg>
);

export const LoaderIcon = ({ size = 'h-8 w-8' }: { size?: string | number } = {}) => {
    const px = resolveSize(size);
    return (
        <svg {...iconProps} width={px} height={px} strokeWidth="1.8" className="animate-spin">
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
    );
};

export const CalendarIcon = () => (
    <svg {...iconProps} width={18} height={18} strokeWidth="1.6" style={{ marginRight: 6 }}>
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
);

export const CloseIcon = () => (
    <svg {...iconProps} strokeWidth="1.7">
        <path d="M6 6 18 18M18 6 6 18" />
    </svg>
);

export const ArrowUpIcon = ({ className }: { className?: string } = {}) => (
    <svg {...iconProps} strokeWidth="1.7" width={20} height={20} className={className}>
        <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
);

export const BookOpenIcon = () => (
    <svg {...iconProps} strokeWidth="1.6">
        <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
        <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
    </svg>
);

export const ChevronDownIcon = () => (
    <svg {...iconProps} strokeWidth="1.7">
        <path d="m6 9 6 6 6-6" />
    </svg>
);

export const BookmarkIcon = ({ filled = false }: { filled?: boolean } = {}) => (
    <svg
        {...iconProps}
        strokeWidth="1.6"
        fill={filled ? 'currentColor' : 'none'}
    >
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
    </svg>
);

// 따라 읽기(음성 인식) 버튼
export const MicIcon = () => (
    <svg {...iconProps} strokeWidth="1.6">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v4M8 22h8" />
    </svg>
);

export const StopIcon = () => (
    <svg {...iconProps} strokeWidth="1.6">
        <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
);

export const RetryIcon = () => (
    <svg {...iconProps} strokeWidth="1.6">
        <path d="M20 11a8 8 0 1 0-2.3 5.7" />
        <path d="M20 4v7h-7" />
    </svg>
);

// 화면 잠금 방지: 꺼짐 방지(달에 슬래시) / 켜짐(해)
export const MoonOffIcon = () => (
    <svg {...iconProps} strokeWidth="1.6">
        <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5" />
        <path d="M4 4l16 16" />
    </svg>
);

export const SunIcon = () => (
    <svg {...iconProps} strokeWidth="1.6">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
);
