import React from 'react';

// Editorial Line: 24px grid · 1.6px stroke · rounded caps
const iconProps = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
    focusable: 'false',
};

export const ChevronLeftIcon = () => (
    <svg {...iconProps} strokeWidth="1.6" className="h-5 w-5 sm:h-6 sm:w-6">
        <path d="m15 18-6-6 6-6" />
    </svg>
);

export const ChevronRightIcon = () => (
    <svg {...iconProps} strokeWidth="1.6" className="h-5 w-5 sm:h-6 sm:w-6">
        <path d="m9 18 6-6-6-6" />
    </svg>
);

export const Volume2Icon = () => (
    <svg {...iconProps} strokeWidth="1.6" className="h-5 w-5 sm:h-6 sm:w-6">
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
);

export const TranslateIcon = () => (
    <svg {...iconProps} strokeWidth="1.6" className="h-5 w-5 sm:h-6 sm:w-6">
        <path d="M4 6h8M8 4v2c0 4-2 6-5 7" />
        <path d="M4 10c1.5 2 4 3.5 6.5 4.5" />
        <path d="m14 20 4-9 4 9" />
        <path d="M15.5 17h5" />
    </svg>
);

export const LoaderIcon = ({ size = 'h-8 w-8' }) => (
    <svg {...iconProps} strokeWidth="1.8" className={`animate-spin ${size}`}>
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

export const CalendarIcon = () => (
    <svg {...iconProps} strokeWidth="1.6" className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
);

export const CloseIcon = () => (
    <svg {...iconProps} strokeWidth="1.7" className="w-5 h-5">
        <path d="M6 6 18 18M18 6 6 18" />
    </svg>
);

export const ArrowUpIcon = () => (
    <svg {...iconProps} strokeWidth="1.7" width="20" height="20" className="h-6 w-6">
        <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
);

export const BookOpenIcon = () => (
    <svg {...iconProps} strokeWidth="1.6" className="h-5 w-5">
        <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
        <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
    </svg>
);

export const ChevronDownIcon = () => (
    <svg {...iconProps} strokeWidth="1.7">
        <path d="m6 9 6 6 6-6" />
    </svg>
);
