import React from 'react';

/**
 * Slide 1: 3D Green Book with Graduation Cap + Floating Video Player Card
 * Exact match to the user's uploaded reference image.
 */
export const Slide1Illustration: React.FC = () => (
  <svg
    viewBox="0 0 340 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full max-h-[250px] sm:max-h-[280px] drop-shadow-sm select-none"
  >
    <defs>
      {/* Background Soft Glow */}
      <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.4" />
        <stop offset="60%" stopColor="#E6F5F4" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>

      {/* Book Cover Gradient */}
      <linearGradient id="bookCoverGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0B8B7F" />
        <stop offset="40%" stopColor="#0A9D8F" />
        <stop offset="100%" stopColor="#065F56" />
      </linearGradient>

      {/* Book Spine Shadow */}
      <linearGradient id="bookSpineGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#054A43" />
        <stop offset="100%" stopColor="#03322D" />
      </linearGradient>

      {/* Book Pages Edge */}
      <linearGradient id="bookPagesGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#E2E8F0" />
        <stop offset="50%" stopColor="#F8FAFC" />
        <stop offset="100%" stopColor="#CBD5E1" />
      </linearGradient>

      {/* Card Drop Shadow */}
      <filter id="cardShadow" x="-15%" y="-15%" width="130%" height="135%" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#0A9D8F" floodOpacity="0.16" />
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.06" />
      </filter>

      {/* Cap Drop Shadow */}
      <filter id="capShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#04443E" floodOpacity="0.35" />
      </filter>
    </defs>

    {/* Ambient Mint Glow Ellipse */}
    <ellipse cx="170" cy="180" rx="130" ry="75" fill="url(#glow1)" />

    {/* Radiating Spark Marks (Top Right) */}
    <g stroke="#046A60" strokeWidth="4.5" strokeLinecap="round">
      <line x1="205" y1="62" x2="208" y2="44" />
      <line x1="225" y1="73" x2="242" y2="62" />
      <line x1="230" y1="92" x2="248" y2="88" />
    </g>

    {/* BOOK GRAPHIC */}
    <g transform="translate(10, 10)">
      {/* 3D Book Base / Pages Bottom Edge */}
      <path
        d="M 96 66 L 96 226 Q 96 235 110 238 L 180 226 L 180 72 Z"
        fill="url(#bookSpineGrad)"
      />
      {/* Pages Block Bottom/Sides */}
      <path
        d="M 110 238 Q 140 242 186 228 L 184 218 Q 140 230 110 228 Z"
        fill="url(#bookPagesGrad)"
      />
      <path
        d="M 98 80 L 108 234 L 114 233 L 104 78 Z"
        fill="#CBD5E1"
      />

      {/* Book Spine (Left rounded edge) */}
      <rect
        x="92"
        y="60"
        width="18"
        height="164"
        rx="9"
        fill="url(#bookSpineGrad)"
      />
      <rect
        x="97"
        y="64"
        width="5"
        height="156"
        rx="2.5"
        fill="#11756B"
        opacity="0.6"
      />

      {/* Main Front Cover */}
      <rect
        x="104"
        y="56"
        width="98"
        height="166"
        rx="14"
        fill="url(#bookCoverGrad)"
      />

      {/* Cover subtle highlight / sheen border */}
      <rect
        x="105.5"
        y="57.5"
        width="95"
        height="163"
        rx="13"
        stroke="#34D399"
        strokeWidth="1.5"
        strokeOpacity="0.3"
        fill="none"
      />

      {/* Embossed Graduation Cap on Book Cover */}
      <g filter="url(#capShadow)">
        {/* Cap Skull Under-cap */}
        <path
          d="M 137 137 C 137 148 169 148 169 137 Z"
          fill="#FFFFFF"
          opacity="0.9"
        />
        {/* Diamond Mortarboard */}
        <polygon
          points="153,114 180,126 153,138 126,126"
          fill="#FFFFFF"
        />
        {/* Center Button */}
        <circle cx="153" cy="126" r="2.5" fill="#E2E8F0" />
        {/* Tassel cord dangling left */}
        <path
          d="M 153 126 Q 166 130 168 143"
          stroke="#FFFFFF"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="168" cy="144" r="2" fill="#FFFFFF" />
      </g>
    </g>

    {/* FLOATING VIDEO LESSON CARD */}
    <g transform="translate(172, 88)" filter="url(#cardShadow)">
      {/* Card Base */}
      <rect
        x="0"
        y="0"
        width="104"
        height="108"
        rx="18"
        fill="#FFFFFF"
      />
      {/* Subtle Card Border */}
      <rect
        x="0.5"
        y="0.5"
        width="103"
        height="107"
        rx="17.5"
        stroke="#E2E8F0"
        strokeWidth="1"
        fill="none"
      />

      {/* Green Play Button Circle */}
      <circle cx="52" cy="40" r="18" fill="#0A9D8F" />
      {/* White Play Icon Triangle */}
      <polygon
        points="48,32 60,40 48,48"
        fill="#FFFFFF"
      />

      {/* Content Skeleton Lines */}
      {/* Primary line: Dark Green */}
      <rect
        x="18"
        y="68"
        width="38"
        height="5"
        rx="2.5"
        fill="#0A9D8F"
      />
      {/* Secondary lines: Soft slate */}
      <rect
        x="18"
        y="78"
        width="68"
        height="5"
        rx="2.5"
        fill="#CBD5E1"
      />
      <rect
        x="18"
        y="88"
        width="54"
        height="5"
        rx="2.5"
        fill="#E2E8F0"
      />
    </g>
  </svg>
);

/**
 * Slide 2: 3D Tech Curriculum & Interactive Course Modules
 * Shares the exact same palette, isometric perspective, white floating card, and sparkle accents.
 */
export const Slide2Illustration: React.FC = () => (
  <svg
    viewBox="0 0 340 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full max-h-[250px] sm:max-h-[280px] drop-shadow-sm select-none"
  >
    <defs>
      <radialGradient id="glow2" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.4" />
        <stop offset="60%" stopColor="#E6F5F4" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>

      <linearGradient id="curriculumCover" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0B8B7F" />
        <stop offset="50%" stopColor="#0A9D8F" />
        <stop offset="100%" stopColor="#065F56" />
      </linearGradient>

      <linearGradient id="codePillGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#0A9D8F" />
      </linearGradient>

      <filter id="shadowSlide2" x="-15%" y="-15%" width="130%" height="135%">
        <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#0A9D8F" floodOpacity="0.16" />
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.06" />
      </filter>
    </defs>

    {/* Ambient Glow */}
    <ellipse cx="170" cy="180" rx="130" ry="75" fill="url(#glow2)" />

    {/* Spark Marks (Top Right) */}
    <g stroke="#046A60" strokeWidth="4.5" strokeLinecap="round">
      <line x1="210" y1="58" x2="214" y2="40" />
      <line x1="230" y1="68" x2="248" y2="56" />
      <line x1="236" y1="88" x2="254" y2="84" />
    </g>

    {/* 3D Code Tablet / Course Folder */}
    <g transform="translate(18, 12)">
      {/* 3D Depth Base */}
      <rect
        x="80"
        y="62"
        width="116"
        height="160"
        rx="16"
        fill="#04443E"
      />
      {/* Main Tablet Surface */}
      <rect
        x="86"
        y="56"
        width="116"
        height="160"
        rx="16"
        fill="url(#curriculumCover)"
      />
      {/* Subtle border */}
      <rect
        x="87.5"
        y="57.5"
        width="113"
        height="157"
        rx="14.5"
        stroke="#34D399"
        strokeWidth="1.5"
        strokeOpacity="0.3"
        fill="none"
      />

      {/* Code Emblem on Tablet */}
      <circle cx="144" cy="108" r="26" fill="#04443E" opacity="0.4" />
      <g stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {/* < > code bracket symbols */}
        <path d="M 134 100 L 126 108 L 134 116" />
        <path d="M 154 100 L 162 108 L 154 116" />
        <line x1="148" y1="98" x2="140" y2="118" />
      </g>

      {/* Course curriculum tags */}
      <rect x="106" y="148" width="76" height="6" rx="3" fill="#FFFFFF" opacity="0.9" />
      <rect x="114" y="162" width="60" height="5" rx="2.5" fill="#34D399" opacity="0.8" />
      <rect x="122" y="174" width="44" height="5" rx="2.5" fill="#FFFFFF" opacity="0.6" />
    </g>

    {/* FLOATING COURSE PROGRESS CARD */}
    <g transform="translate(170, 92)" filter="url(#shadowSlide2)">
      <rect
        x="0"
        y="0"
        width="106"
        height="112"
        rx="18"
        fill="#FFFFFF"
      />
      <rect
        x="0.5"
        y="0.5"
        width="105"
        height="111"
        rx="17.5"
        stroke="#E2E8F0"
        strokeWidth="1"
        fill="none"
      />

      {/* Progress Ring */}
      <circle cx="53" cy="40" r="20" stroke="#E2E8F0" strokeWidth="4.5" fill="none" />
      <circle
        cx="53"
        cy="40"
        r="20"
        stroke="#0A9D8F"
        strokeWidth="4.5"
        strokeDasharray="125"
        strokeDashoffset="30"
        strokeLinecap="round"
        fill="none"
        transform="rotate(-90 53 40)"
      />
      {/* Center 85% text */}
      <text
        x="53"
        y="44"
        textAnchor="middle"
        fontSize="11"
        fontWeight="800"
        fill="#0A9D8F"
        fontFamily="sans-serif"
      >
        85%
      </text>

      {/* Module Level Badge */}
      <rect x="16" y="72" width="46" height="5" rx="2.5" fill="#0A9D8F" />
      <rect x="16" y="82" width="74" height="5" rx="2.5" fill="#CBD5E1" />
      <rect x="16" y="92" width="58" height="5" rx="2.5" fill="#E2E8F0" />
    </g>
  </svg>
);

/**
 * Slide 3: 3D Flexible Schedules & Live Training Clocks
 * Matches the exact same palette, 3D calendar binder, floating clock card, and sparkle accents.
 */
export const Slide3Illustration: React.FC = () => (
  <svg
    viewBox="0 0 340 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full max-h-[250px] sm:max-h-[280px] drop-shadow-sm select-none"
  >
    <defs>
      <radialGradient id="glow3" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.4" />
        <stop offset="60%" stopColor="#E6F5F4" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>

      <linearGradient id="calCover" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0B8B7F" />
        <stop offset="50%" stopColor="#0A9D8F" />
        <stop offset="100%" stopColor="#065F56" />
      </linearGradient>

      <filter id="shadowSlide3" x="-15%" y="-15%" width="130%" height="135%">
        <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#0A9D8F" floodOpacity="0.16" />
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.06" />
      </filter>
    </defs>

    {/* Ambient Glow */}
    <ellipse cx="170" cy="180" rx="130" ry="75" fill="url(#glow3)" />

    {/* Spark Marks (Top Right) */}
    <g stroke="#046A60" strokeWidth="4.5" strokeLinecap="round">
      <line x1="208" y1="60" x2="212" y2="42" />
      <line x1="228" y1="70" x2="246" y2="58" />
      <line x1="234" y1="90" x2="252" y2="86" />
    </g>

    {/* 3D CALENDAR BINDER */}
    <g transform="translate(18, 12)">
      {/* 3D Base Thickness */}
      <rect x="80" y="62" width="116" height="158" rx="16" fill="#04443E" />
      {/* Front Calendar Body */}
      <rect x="86" y="56" width="116" height="158" rx="16" fill="url(#calCover)" />
      {/* White Spiral Rings on Top */}
      <g fill="#FFFFFF" stroke="#04443E" strokeWidth="1">
        <rect x="102" y="48" width="6" height="14" rx="3" />
        <rect x="122" y="48" width="6" height="14" rx="3" />
        <rect x="142" y="48" width="6" height="14" rx="3" />
        <rect x="162" y="48" width="6" height="14" rx="3" />
        <rect x="182" y="48" width="6" height="14" rx="3" />
      </g>

      {/* Calendar Grid Sheet on Front */}
      <rect x="96" y="80" width="96" height="118" rx="10" fill="#FFFFFF" />
      {/* Calendar Header Band */}
      <rect x="96" y="80" width="96" height="24" rx="8" fill="#E6F5F4" />
      <rect x="106" y="90" width="32" height="4" rx="2" fill="#0A9D8F" />

      {/* Days Grid Dots/Pills */}
      <g fill="#CBD5E1">
        <circle cx="112" cy="120" r="3.5" />
        <circle cx="128" cy="120" r="3.5" />
        <circle cx="144" cy="120" r="3.5" />
        <circle cx="160" cy="120" r="3.5" />
        <circle cx="176" cy="120" r="3.5" />

        <circle cx="112" cy="138" r="3.5" />
        <circle cx="128" cy="138" r="3.5" />
        {/* Highlighted active session day: Green */}
        <circle cx="144" cy="138" r="5" fill="#0A9D8F" />
        <circle cx="160" cy="138" r="3.5" />
        <circle cx="176" cy="138" r="3.5" />

        <circle cx="112" cy="156" r="3.5" />
        <circle cx="128" cy="156" r="3.5" />
        <circle cx="144" cy="156" r="3.5" />
        <circle cx="160" cy="156" r="3.5" />
        <circle cx="176" cy="156" r="3.5" />
      </g>

      {/* Selected Slot Pill */}
      <rect x="108" y="172" width="72" height="14" rx="7" fill="#E6F5F4" />
      <circle cx="116" cy="179" r="3" fill="#0A9D8F" />
      <rect x="124" y="177" width="46" height="4" rx="2" fill="#0A9D8F" />
    </g>

    {/* FLOATING CLOCK / TIMEZONE CARD */}
    <g transform="translate(170, 92)" filter="url(#shadowSlide3)">
      <rect x="0" y="0" width="104" height="110" rx="18" fill="#FFFFFF" />
      <rect x="0.5" y="0.5" width="103" height="109" rx="17.5" stroke="#E2E8F0" strokeWidth="1" fill="none" />

      {/* Dial Circle */}
      <circle cx="52" cy="40" r="20" fill="#0A9D8F" />
      <circle cx="52" cy="40" r="18" fill="#FFFFFF" />
      {/* Clock Hands at 10:10 */}
      <line x1="52" y1="40" x2="52" y2="28" stroke="#0A9D8F" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="52" y1="40" x2="62" y2="40" stroke="#0A9D8F" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="52" cy="40" r="2" fill="#04443E" />

      {/* Live Badge */}
      <rect x="18" y="70" width="40" height="5" rx="2.5" fill="#0A9D8F" />
      <rect x="18" y="80" width="68" height="5" rx="2.5" fill="#CBD5E1" />
      <rect x="18" y="90" width="50" height="5" rx="2.5" fill="#E2E8F0" />
    </g>
  </svg>
);

/**
 * Slide 4: 3D Academic Journey & Accredited Certification
 * Matches the exact same palette, 3D parchment scroll, floating trophy card, and sparkle accents.
 */
export const Slide4Illustration: React.FC = () => (
  <svg
    viewBox="0 0 340 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full max-h-[250px] sm:max-h-[280px] drop-shadow-sm select-none"
  >
    <defs>
      <radialGradient id="glow4" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.4" />
        <stop offset="60%" stopColor="#E6F5F4" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>

      <linearGradient id="certCover" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0B8B7F" />
        <stop offset="50%" stopColor="#0A9D8F" />
        <stop offset="100%" stopColor="#065F56" />
      </linearGradient>

      <filter id="shadowSlide4" x="-15%" y="-15%" width="130%" height="135%">
        <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#0A9D8F" floodOpacity="0.16" />
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.06" />
      </filter>
    </defs>

    {/* Ambient Glow */}
    <ellipse cx="170" cy="180" rx="130" ry="75" fill="url(#glow4)" />

    {/* Spark Marks (Top Right) */}
    <g stroke="#046A60" strokeWidth="4.5" strokeLinecap="round">
      <line x1="210" y1="58" x2="214" y2="40" />
      <line x1="230" y1="68" x2="248" y2="56" />
      <line x1="236" y1="88" x2="254" y2="84" />
    </g>

    {/* 3D CERTIFICATE DIPLOMA BASE */}
    <g transform="translate(18, 12)">
      {/* 3D Depth */}
      <rect x="80" y="62" width="116" height="158" rx="16" fill="#04443E" />
      {/* Front Certificate Plaque */}
      <rect x="86" y="56" width="116" height="158" rx="16" fill="url(#certCover)" />

      {/* Certificate Paper Insert */}
      <rect x="94" y="66" width="100" height="138" rx="10" fill="#FFFFFF" />
      <rect x="98" y="70" width="92" height="130" rx="8" stroke="#E6F5F4" strokeWidth="1.5" fill="none" />

      {/* Certificate Header Banner */}
      <rect x="120" y="80" width="48" height="6" rx="3" fill="#0A9D8F" />
      <rect x="110" y="92" width="68" height="4" rx="2" fill="#CBD5E1" />
      <rect x="116" y="100" width="56" height="4" rx="2" fill="#E2E8F0" />

      {/* Gold/Emerald Stamp Wax Ribbon */}
      <circle cx="144" cy="132" r="14" fill="#0A9D8F" />
      <circle cx="144" cy="132" r="11" fill="#046A60" />
      {/* Ribbon tails */}
      <polygon points="139,144 144,158 141,162 135,145" fill="#0A9D8F" />
      <polygon points="149,144 144,158 147,162 153,145" fill="#065F56" />
      {/* Center Star */}
      <polygon
        points="144,124 146,130 152,130 147,133 149,139 144,135 139,139 141,133 136,130 142,130"
        fill="#FFFFFF"
      />

      <rect x="108" y="174" width="72" height="4" rx="2" fill="#CBD5E1" />
      <rect x="124" y="182" width="40" height="4" rx="2" fill="#E2E8F0" />
    </g>

    {/* FLOATING SUCCESS / ACCREDITATION BADGE CARD */}
    <g transform="translate(170, 92)" filter="url(#shadowSlide4)">
      <rect x="0" y="0" width="104" height="110" rx="18" fill="#FFFFFF" />
      <rect x="0.5" y="0.5" width="103" height="109" rx="17.5" stroke="#E2E8F0" strokeWidth="1" fill="none" />

      {/* Verified Cap / Ribbon Icon Circle */}
      <circle cx="52" cy="40" r="18" fill="#0A9D8F" />
      {/* White Graduation Cap on Card */}
      <polygon points="52,30 62,35 52,40 42,35" fill="#FFFFFF" />
      <path d="M 46 39.5 C 46 44 58 44 58 39.5 Z" fill="#FFFFFF" opacity="0.9" />
      <path d="M 52 35 Q 58 37 59 42" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />

      {/* Verified label skeleton lines */}
      <rect x="18" y="70" width="46" height="5" rx="2.5" fill="#0A9D8F" />
      <rect x="18" y="80" width="68" height="5" rx="2.5" fill="#CBD5E1" />
      <rect x="18" y="90" width="50" height="5" rx="2.5" fill="#E2E8F0" />
    </g>
  </svg>
);
