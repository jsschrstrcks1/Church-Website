// Newsletter Public View Component
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiNewsletterGet, apiPollVote, apiFormResponse } from '../../api/client';
import { SITE_URL, CHURCH_NAME } from '../../firebase/config';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../../hooks/usePageMeta';
import NewsletterFooter from './NewsletterFooter';
import FormFieldInput from './FormFieldInput';
import PollResults from './PollResults';
import PrintOptionsModal from './PrintOptionsModal';
import EventCard from './EventCard';
import NewsletterBackground from './NewsletterBackground';
import { getReadableTextColor } from '../../utils/colorContrast';

const LANGUAGES = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
];

const WINTER_HEADER_IMAGE = '/images/winter-header.png';

const QUICK_BLOCK_TEMPLATES = [
  { id: 'upcoming-events', label: 'Upcoming Events', icon: 'calendar' },
  { id: 'class-spotlight', label: 'Ministry Spotlight', icon: 'sparkle' },
  { id: 'parent-reminder', label: 'Reminder', icon: 'pin' },
  { id: 'parent-resource', label: 'Helpful Resource', icon: 'bulb' },
  { id: 'photo-card', label: 'Photo Card', icon: 'photo' },
];

const CONTENT_LIBRARY = [
  { id: 'weekly-update', label: 'Weekly Update', icon: 'note' },
  { id: 'field-trip', label: 'Trip Notice', icon: 'bus' },
  { id: 'homework', label: 'Bible Reading', icon: 'book' },
  { id: 'classroom-win', label: 'Praise Report', icon: 'trophy' },
  { id: 'community-note', label: 'Community Note', icon: 'people' },
];

const LEGACY_ICON_MAP = {
  '📅': 'calendar', '🌟': 'sparkle', '📌': 'pin', '💡': 'bulb', '📝': 'note',
  '🚌': 'bus', '📚': 'book', '🏆': 'trophy', '🤝': 'people', '🎉': 'sparkle',
  '📣': 'megaphone', '❤️': 'heart',
};

const CardIcon = ({ name }) => {
  const iconName = LEGACY_ICON_MAP[name] || name;
  const paths = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    sparkle: <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm6.5 11.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />,
    pin: <><path d="M20 10c0 5.2-8 11-8 11S4 15.2 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    bulb: <><path d="M9 18h6M10 22h4M8.5 15.5A7 7 0 1 1 15.5 15.5c-1 1-1.5 1.7-1.5 2.5h-4c0-.8-.5-1.5-1.5-2.5Z" /></>,
    note: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 12h6M9 16h6" /></>,
    bus: <><path d="M5 18V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12" /><path d="M3 11h18M5 18h14M8 18v2M16 18v2" /><path d="M8 8h3M13 8h3" /><circle cx="8" cy="15" r="1.25" /><circle cx="16" cy="15" r="1.25" /></>,
    book: <><path d="M3.5 5.5A2.5 2.5 0 0 1 6 3h5.5v16H6a2.5 2.5 0 0 0-2.5 2.5v-16Z" /><path d="M20.5 5.5A2.5 2.5 0 0 0 18 3h-5.5v16H18a2.5 2.5 0 0 1 2.5 2.5v-16Z" /><path d="M7 7h2.5M15 7h2" /></>,
    trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-3.5-5.5" /></>,
    megaphone: <><path d="M4 11v2a2 2 0 0 0 2 2h2l2 4h2l-1.5-4H12l6 3V6l-6 3H6a2 2 0 0 0-2 2Z" /><path d="M20 9.5a4 4 0 0 1 0 5" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z" />,
    photo: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 18 5-5 3.5 3.5 2.5-2.5L20 19" /></>,
  };

  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[iconName] || paths.sparkle}</svg>;
};

const getQuickBlockTemplate = (section) => {
  const sectionText = `${section.heading || ''} ${section.content || ''}`
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .toLowerCase();

  return QUICK_BLOCK_TEMPLATES.find((template) => (
    template.id === section.quickBlockType
    || template.label.toLowerCase() === (section.heading || '').toLowerCase()
    || sectionText.includes(template.label.toLowerCase())
    || (template.id === 'parent-reminder' && sectionText.includes('reminder'))
    || (template.id === 'parent-resource' && (sectionText.includes('helpful resource') || sectionText.includes('parent resource')))
  ));
};

const getContentLibraryTemplate = (section) => {
  const sectionText = `${section.heading || ''} ${section.content || ''}`
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .toLowerCase();

  return CONTENT_LIBRARY.find((template) => (
    template.id === section.contentBlockType
    || template.label.toLowerCase() === (section.heading || '').toLowerCase()
    || sectionText.includes(template.label.toLowerCase())
    || (template.id === 'field-trip' && (sectionText.includes('field trip') || sectionText.includes('trip reminder')))
    || (template.id === 'community-note' && sectionText.includes('community connection'))
  ));
};

const getStyledBlockTemplate = (section) => getQuickBlockTemplate(section) || getContentLibraryTemplate(section);

const CARD_COLOR_DEFAULTS = {
  'upcoming-events': { accent: '#1d4ed8', start: '#dbeafe', end: '#ffffff' },
  'class-spotlight': { accent: '#9a6700', start: '#fef3c7', end: '#fffdf5' },
  'parent-reminder': { accent: '#b42318', start: '#fee2e2', end: '#fffafa' },
  'parent-resource': { accent: '#047857', start: '#d1fae5', end: '#f7fffb' },
  'weekly-update': { accent: '#4338ca', start: '#ede9fe', end: '#fafaff' },
  'field-trip': { accent: '#0f766e', start: '#ccfbf1', end: '#f7fffe' },
  homework: { accent: '#7c3aed', start: '#f3e8ff', end: '#fdfaff' },
  'classroom-win': { accent: '#a16207', start: '#fef3c7', end: '#fffdf5' },
  'community-note': { accent: '#be185d', start: '#fce7f3', end: '#fffaff' },
  'photo-card': { accent: '#334155', start: '#e2e8f0', end: '#f8fafc' },
};

const getCardAppearance = (section) => {
  const template = getStyledBlockTemplate(section);
  if (!template) return null;

  const selectedTemplate = [...QUICK_BLOCK_TEMPLATES, ...CONTENT_LIBRARY].find(
    (cardTemplate) => cardTemplate.id === section.cardStyle
  ) || template;

  return {
    ...selectedTemplate,
    icon: section.cardIcon || section.quickBlockIcon || selectedTemplate.icon,
    colors: {
      ...CARD_COLOR_DEFAULTS[selectedTemplate.id],
      accent: section.cardAccentColor || CARD_COLOR_DEFAULTS[selectedTemplate.id]?.accent,
      start: section.cardGradientStart || CARD_COLOR_DEFAULTS[selectedTemplate.id]?.start,
      end: section.cardGradientEnd || CARD_COLOR_DEFAULTS[selectedTemplate.id]?.end,
    },
  };
};

const getCardBackground = (colors) => [
  `radial-gradient(ellipse at 92% 4%, ${colors.accent}4d 0%, ${colors.accent}1a 23%, transparent 48%)`,
  `radial-gradient(circle at 4% 100%, ${colors.accent}33 0%, transparent 43%)`,
  `radial-gradient(ellipse at 70% 85%, ${colors.end}cc 0%, transparent 50%)`,
  `linear-gradient(118deg, ${colors.start} 0%, ${colors.end} 52%, #ffffff 100%)`,
].join(', ');

const getCardLayoutClass = (section) => [
  `quick-block-layout-${section.cardLayout || 'standard'}`,
  `quick-block-icon-${section.cardIconPosition || 'left'}`,
  `quick-block-pattern-${section.cardBackgroundPattern || 'none'}`,
  `quick-block-border-${section.cardBorderStyle || 'soft'}`,
].join(' ');

const renderDivider = (section, newsletter) => {
  const color = section.dividerColor || newsletter.accentColor;
  const style = section.dividerStyle || 'solid';
  const pattern = section.dividerPattern || 'none';
  const patternIcons = {
    stars: '⭐',
    hearts: '❤',
    leaves: '🌿',
    dots: '•',
    checkmarks: '✓',
    scissors: '✂',
    swirls: '✺',
    waves: '∿',
    petals: '✿',
    sunflowers: '🌼',
  };

  if (style === 'glow') {
    return <div className="glow-divider my-8" style={{ '--divider-color': color }} />;
  }

  if (pattern === 'sparkles') {
    return (
      <div className="my-8 flex items-center justify-center gap-2 text-xl text-center" style={{ color }}>
        <span className="shrink-0">✦</span>
        <div className="h-px min-w-0 flex-1 max-w-24" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        <span className="shrink-0">✦</span>
        <div className="h-px min-w-0 flex-1 max-w-24" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        <span className="shrink-0">✦</span>
      </div>
    );
  }

  if (pattern !== 'none') {
    return (
      <div className="my-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-2xl leading-none" style={{ color }}>
        {[...Array(5)].map((_, index) => (
          <span key={index} className="shrink-0">{patternIcons[pattern] || '🌼'}</span>
        ))}
      </div>
    );
  }

  if (style === 'wavy' || style === 'sketched') {
    const isWavy = style === 'wavy';
    const path = isWavy
      ? 'M0,5 Q25,0 50,5 T100,5'
      : 'M0,2 C10,0 20,4 30,2 S50,0 60,2 S80,4 90,2 L100,2';
    const height = isWavy ? '10px' : '4px';
    return (
      <div
        className="my-8 w-full"
        style={{
          height,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 ${isWavy ? 10 : 4}'%3E%3Cpath d='${path}' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='2'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat-x',
          backgroundSize: isWavy ? '50px 10px' : '100px 4px',
        }}
      />
    );
  }

  if (style === 'soft') {
    return <div className="my-8 h-2 w-full rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />;
  }

  return (
    <hr
      className="my-8"
      style={{
        borderColor: color,
        borderWidth: '2px',
        borderStyle: ['solid', 'dashed', 'dotted', 'double'].includes(style) ? style : 'solid',
        opacity: 0.9,
      }}
    />
  );
};

const SnowfallIntro = () => (
  <div className="snowfall-intro pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
    {Array.from({ length: 32 }, (_, index) => (
      <span
        key={index}
        className="snowflake"
        style={{
          left: `${(index * 37) % 100}%`,
          animationDelay: `${(index % 10) * 0.22}s`,
          animationDuration: `${3.2 + (index % 5) * 0.35}s`,
          fontSize: `${12 + (index % 4) * 4}px`,
        }}
      >
        ❄
      </span>
    ))}
  </div>
);

const FallingLeavesIntro = () => (
  <div className="falling-leaves-intro pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
    {Array.from({ length: 24 }, (_, index) => (
      <span
        key={index}
        className="falling-leaf"
        style={{
          left: `${(index * 29) % 100}%`,
          animationDelay: `${(index % 9) * 0.28}s`,
          animationDuration: `${3.5 + (index % 5) * 0.4}s`,
          fontSize: `${16 + (index % 4) * 4}px`,
        }}
      >
        {['🍂', '🍁', '🍃'][index % 3]}
      </span>
    ))}
  </div>
);

const EMOJI_INTROS = {
  holidays: { emojis: ['❄', '🎄', '⭐', '🎁'], rise: false },
  valentines: { emojis: ['💗', '💝', '💕', '❤'], rise: true },
  'end-of-year': { emojis: ['🎓', '🎉', '⭐', '🎊'], rise: false },
};

const EmojiIntro = ({ themeId }) => {
  const config = EMOJI_INTROS[themeId];
  if (!config) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 26 }, (_, index) => (
        <span
          key={index}
          className={config.rise ? 'emoji-rise' : 'falling-leaf'}
          style={{
            left: `${(index * 31) % 100}%`,
            animationDelay: `${(index % 9) * 0.28}s`,
            animationDuration: `${3.5 + (index % 5) * 0.4}s`,
            fontSize: `${16 + (index % 4) * 4}px`,
          }}
        >
          {config.emojis[index % config.emojis.length]}
        </span>
      ))}
    </div>
  );
};

const BackToSchoolIntro = () => {
  const confettiColors = ['#f59e0b', '#ef4444', '#2563eb', '#16a34a', '#a855f7'];

  return (
    <div className="back-to-school-intro pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      <div className="back-to-school-message absolute left-1/2 top-1/2 w-[min(90%,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/95 px-6 py-7 text-center shadow-2xl">
        <p className="text-2xl font-bold text-blue-800 sm:text-3xl">Welcome back!</p>
        <p className="mt-2 text-base font-medium text-slate-700 sm:text-lg">We&apos;re excited for a great year.</p>
      </div>
      {Array.from({ length: 44 }, (_, index) => (
        <span
          key={`confetti-${index}`}
          className="paper-confetti"
          style={{
            left: `${(index * 19 + 2) % 100}%`,
            bottom: `${(index % 4) * -4}px`,
            width: `${6 + (index % 3) * 3}px`,
            height: `${9 + (index % 4) * 3}px`,
            backgroundColor: confettiColors[index % confettiColors.length],
            animationDelay: `${(index % 11) * 0.1}s`,
            animationDuration: `${2.4 + (index % 4) * 0.25}s`,
          }}
        />
      ))}
    </div>
  );
};

const SpringIntro = () => {
  const petalColors = ['#f9a8d4', '#fda4af', '#fef08a', '#c4b5fd', '#fbcfe8'];

  return (
    <div className="spring-intro pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      <div className="spring-message absolute left-1/2 top-1/2 w-[min(90%,34rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/95 px-6 py-7 text-center shadow-2xl">
        <p className="text-2xl font-bold text-pink-700 sm:text-3xl">Hello, Spring!</p>
        <p className="mt-2 text-base font-medium text-slate-700 sm:text-lg">Here&apos;s to fresh ideas and a wonderful season of learning.</p>
      </div>
      {Array.from({ length: 30 }, (_, index) => (
        <span
          key={index}
          className="spring-petal"
          style={{
            left: `${(index * 23 + 3) % 100}%`,
            bottom: `${(index % 5) * -5}px`,
            width: `${10 + (index % 3) * 3}px`,
            height: `${15 + (index % 4) * 3}px`,
            backgroundColor: petalColors[index % petalColors.length],
            animationDelay: `${(index % 10) * 0.16}s`,
            animationDuration: `${3 + (index % 4) * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
};

const SummerIntro = () => (
  <div className="summer-intro pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
    <div className="summer-message absolute left-1/2 top-1/2 w-[min(90%,34rem)] -translate-x-1/2 -translate-y-1/2     rounded-2xl bg-white/95 px-6 pb-7 pt-4 text-center shadow-2xl">
      <div className="mx-auto flex items-end justify-center gap-2">
        <svg viewBox="0 0 120 120" className="summer-sun h-28 w-28 sm:h-36 sm:w-36" aria-hidden="true">
          <g className="summer-sun-rays" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round">
            {Array.from({ length: 12 }, (_, i) => (
              <line key={i} x1="60" y1="8" x2="60" y2="22" transform={`rotate(${i * 30} 60 60)`} />
            ))}
          </g>
          <circle cx="60" cy="60" r="28" fill="#fbbf24" />
          <circle cx="50" cy="55" r="3" fill="#92400e" />
          <circle cx="70" cy="55" r="3" fill="#92400e" />
          <path d="M48 68 Q60 79 72 68" stroke="#92400e" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
        <svg viewBox="0 0 40 120" className="h-28 w-8 sm:h-36 sm:w-10" aria-hidden="true">
          <rect x="13" y="6" width="14" height="82" rx="7" fill="#fff" stroke="#475569" strokeWidth="3" />
          <circle cx="20" cy="98" r="14" fill="#ef4444" stroke="#475569" strokeWidth="3" />
          <rect className="summer-mercury" x="17" y="14" width="6" height="84" rx="3" fill="#ef4444" />
        </svg>
      </div>
      <p className="text-2xl font-bold text-orange-700 sm:text-3xl">Hello, Summer!</p>
      <p className="mt-2 text-base font-medium text-slate-700 sm:text-lg">Wishing you a bright and joyful season of learning.</p>
    </div>
    {Array.from({ length: 28 }, (_, index) => (
      <span
        key={index}
        className="summer-bubble"
        style={{
          left: `${(index * 23 + 3) % 100}%`,
          bottom: `${(index % 5) * -6}px`,
          width: `${12 + (index % 4) * 5}px`,
          height: `${12 + (index % 4) * 5}px`,
          animationDelay: `${(index % 10) * 0.15}s`,
          animationDuration: `${3 + (index % 4) * 0.3}s`,
        }}
      />
    ))}
  </div>
);

const NewsletterPublicView = () => {
  const { memberId, newsletterId, archiveId } = useParams();
  const resolvedNewsletterId = newsletterId || 'primary';
  const buildNewsletterPath = (suffix = '') => (
    newsletterId ? `/newsletter/${memberId}/${newsletterId}${suffix}` : `/newsletter/${memberId}${suffix}`
  );
  const [newsletter, setNewsletter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isArchived, setIsArchived] = useState(false);
  const [carouselIndexes, setCarouselIndexes] = useState({}); // Track carousel position per section

  // Translation state
  const [activeLanguage, setActiveLanguage] = useState('en');
  const [translatedNewsletter, setTranslatedNewsletter] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(null);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [translationCache, setTranslationCache] = useState({});
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [submittedResponses, setSubmittedResponses] = useState({});
  const [submittingResponseId, setSubmittingResponseId] = useState(null);
  const [formAnswers, setFormAnswers] = useState({});
  const [submittedForms, setSubmittedForms] = useState({});
  const [submittingFormId, setSubmittingFormId] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [showSnowfall, setShowSnowfall] = useState(false);
  const [showFallingLeaves, setShowFallingLeaves] = useState(false);
  const [showEmojiIntro, setShowEmojiIntro] = useState(false);
  const [showBackToSchoolIntro, setShowBackToSchoolIntro] = useState(false);
  const [showSpringIntro, setShowSpringIntro] = useState(false);
  const [showSummerIntro, setShowSummerIntro] = useState(false);
  const [photoLightbox, setPhotoLightbox] = useState(null);
  const [carouselTouchStart, setCarouselTouchStart] = useState({});

  // Update page metadata for link previews
  usePageMeta({
    title: newsletter?.title || 'Newsletter',
    description: newsletter?.subtitle || 'Check out the latest newsletter',
    image: newsletter?.backgroundImage,
    type: 'article'
  });

  // Helper function to convert hex color to rgba
  const hexToRgba = (hex, alpha) => {
    if (!hex) return `rgba(255, 255, 255, ${alpha})`;
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Retry function
  const retryLoad = () => {
    setError(null);
    setLoading(true);
    setRetryCount(prev => prev + 1);
    // Force re-run of useEffect by updating a dependency
    window.location.reload();
  };

  const changeCarouselPhoto = (sectionId, imageCount, direction) => {
    setCarouselIndexes(prev => {
      const currentIndex = prev[sectionId] || 0;
      const nextIndex = direction === 'next'
        ? (currentIndex + 1) % imageCount
        : (currentIndex - 1 + imageCount) % imageCount;
      return { ...prev, [sectionId]: nextIndex };
    });
  };

  const submitFamilyResponse = async (section, option) => {
    if (!memberId || archiveId) return;

    const responseKey = `newsletter-response:${memberId}:${resolvedNewsletterId}:${section.id}`;
    if (localStorage.getItem(responseKey)) {
      setSubmittedResponses(prev => ({ ...prev, [section.id]: localStorage.getItem(responseKey) }));
      return;
    }

    setSubmittingResponseId(section.id);
    try {
      await apiPollVote(section.id, option);
      localStorage.setItem(responseKey, option);
      setSubmittedResponses(prev => ({ ...prev, [section.id]: option }));
    } catch (responseError) {
      console.error('Error submitting family response:', responseError);
      setError('We could not save your response. Please try again.');
    } finally {
      setSubmittingResponseId(null);
    }
  };

  const updateFormAnswer = (sectionId, fieldId, value) => {
    setFormAnswers(prev => ({ ...prev, [sectionId]: { ...(prev[sectionId] || {}), [fieldId]: value } }));
  };

  const submitCustomForm = async (section) => {
    if (!memberId || archiveId) return;

    // No once-per-browser lock: a family may need to submit the form once per person.
    const answers = formAnswers[section.id] || {};
    const missingRequired = (section.fields || []).find(field => field.required && !String(answers[field.id] || '').trim());
    const badEmail = (section.fields || []).find(field => field.type === 'email' && String(answers[field.id] || '').trim() && !/^\S+@\S+\.\S+$/.test(String(answers[field.id]).trim()));
    if (!missingRequired && badEmail) {
      setFormErrors(prev => ({ ...prev, [section.id]: `Please enter a valid email address for "${badEmail.label}".` }));
      return;
    }
    if (missingRequired) {
      setFormErrors(prev => ({ ...prev, [section.id]: `Please fill out "${missingRequired.label}" before submitting.` }));
      return;
    }
    setFormErrors(prev => ({ ...prev, [section.id]: null }));

    setSubmittingFormId(section.id);
    try {
      await apiFormResponse(section.id, { answers });
      setSubmittedForms(prev => ({ ...prev, [section.id]: true }));
    } catch (formError) {
      console.error('Error submitting form:', formError);
      setFormErrors(prev => ({ ...prev, [section.id]: 'We could not save your response. Please try again.' }));
    } finally {
      setSubmittingFormId(null);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // Single 'church' space: newsletters are fetched by id. The "archive" is a
        // previously published (now status='archived') issue, also keyed by id.
        let targetId = archiveId || newsletterId;
        if (!targetId) {
          // No id in the URL: resolve the primary (default) newsletter.
          const list = await apiNewsletters();
          const primary = list.find((n) => n.isPrimary) || list.find((n) => n.published) || list[0];
          targetId = primary?.id;
        }
        if (!targetId) { setError('No newsletter available at this time.'); return; }
        const data = await apiNewsletterGet(targetId);
        setIsArchived(Boolean(archiveId));

        if (data) {
          // Archived newsletters always show; current ones only when published.
          if (archiveId || data.published) {
            // A newsletter saved without sections still shows (as an empty page) instead of crashing
            setNewsletter({ ...data, sections: Array.isArray(data.sections) ? data.sections : [] });
          } else {
            setError('This newsletter has not been published yet.');
          }
        } else {
          setError(archiveId ? 'This archived newsletter could not be found.' : 'No newsletter available at this time.');
        }
      } catch (err) {
        console.error('Error loading newsletter data:', err);
        setError('Failed to load newsletter. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [memberId, newsletterId, archiveId]);

  useEffect(() => {
    if (newsletter?.themePack !== 'winter' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    setShowSnowfall(true);
    const timeoutId = window.setTimeout(() => setShowSnowfall(false), 4200);
    return () => window.clearTimeout(timeoutId);
  }, [newsletter?.themePack]);

  useEffect(() => {
    if (newsletter?.themePack !== 'summer' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    setShowSummerIntro(true);
    const timeoutId = window.setTimeout(() => setShowSummerIntro(false), 4300);
    return () => window.clearTimeout(timeoutId);
  }, [newsletter?.themePack]);

  useEffect(() => {
    if (newsletter?.themePack !== 'spring' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    setShowSpringIntro(true);
    const timeoutId = window.setTimeout(() => setShowSpringIntro(false), 4300);
    return () => window.clearTimeout(timeoutId);
  }, [newsletter?.themePack]);

  useEffect(() => {
    if (newsletter?.themePack !== 'back-to-school' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    setShowBackToSchoolIntro(true);
    const timeoutId = window.setTimeout(() => setShowBackToSchoolIntro(false), 4300);
    return () => window.clearTimeout(timeoutId);
  }, [newsletter?.themePack]);

  useEffect(() => {
    if (newsletter?.themePack !== 'fall' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    setShowFallingLeaves(true);
    const timeoutId = window.setTimeout(() => setShowFallingLeaves(false), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [newsletter?.themePack]);

  useEffect(() => {
    if (!EMOJI_INTROS[newsletter?.themePack] || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    setShowEmojiIntro(true);
    const timeoutId = window.setTimeout(() => setShowEmojiIntro(false), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [newsletter?.themePack]);

  // Export to PDF function
  const exportToPDF = () => {
    setShowPrintOptions(true);
  };

  // Copy shareable link
  const copyShareableLink = () => {
    const version = newsletter.publishedDate
      ? new Date(newsletter.publishedDate).getTime()
      : Date.now();

    // Include memberId (and newsletterId, if this isn't the primary newsletter) in the URL
    const baseUrl = `${SITE_URL}${buildNewsletterPath()}`;
    const shareableUrl = `${baseUrl}?v=${version}`;

    navigator.clipboard.writeText(shareableUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    }).catch(err => {
      console.error('Failed to copy link:', err);
      alert('Failed to copy link. Please copy manually: ' + shareableUrl);
    });
  };

  // Reset translation state when navigating to a different newsletter
  useEffect(() => {
    setActiveLanguage('en');
    setTranslatedNewsletter(null);
    setTranslationCache({});
  }, [memberId, newsletterId, archiveId]);

  const handleTranslate = async (targetLang) => {
    setShowLangDropdown(false);
    setTranslationError(null);
    if (targetLang === 'en') {
      setActiveLanguage('en');
      return;
    }
    // Use in-memory cached translation if available
    if (translationCache[targetLang]) {
      setTranslatedNewsletter(translationCache[targetLang].newsletter);
      setActiveLanguage(targetLang);
      return;
    }
    setIsTranslating(true);
    setActiveLanguage(targetLang);
    try {
      // No server-side translation endpoint exists on the Worker yet, so in-browser
      // translation is not available. Fail gracefully and keep the original content.
      throw new Error('translation-unavailable');
    } catch (err) {
      console.error('Translation failed:', err);
      setTranslationError('Translation is not available for this newsletter right now.');
      setActiveLanguage('en');
    } finally {
      setIsTranslating(false);
    }
  };

  // Bilingual church: open in Spanish when the link asks for it (?lang=es) or when the visitor
  // chose Español on the home page (the EN/ES switch there saves 'lang' in localStorage).
  const [autoTranslated, setAutoTranslated] = useState(false);
  useEffect(() => {
    if (!newsletter || autoTranslated) return;
    setAutoTranslated(true);
    let preferred = new URLSearchParams(window.location.search).get('lang');
    if (!preferred) {
      try { preferred = localStorage.getItem('lang'); } catch { preferred = null; }
    }
    if (preferred === 'es') handleTranslate('es');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsletter, autoTranslated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-church-cream to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-church-navy mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading newsletter...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-church-cream to-purple-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Newsletter Not Available</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={retryLoad}
                className="px-6 py-3 bg-church-navy hover:bg-church-navy-deep text-white rounded-lg font-medium transition"
              >
                Try Again
              </button>
              <Link
                to="/"
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
              >
                Go Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use translated content when available, original otherwise
  const displayNewsletter = activeLanguage !== 'en' && translatedNewsletter ? translatedNewsletter : newsletter;

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#dbeafe' }}>
      {showSnowfall && <SnowfallIntro />}
      {showFallingLeaves && <FallingLeavesIntro />}
      {showEmojiIntro && <EmojiIntro themeId={newsletter.themePack} />}
      {showBackToSchoolIntro && <BackToSchoolIntro />}
      {showSpringIntro && <SpringIntro />}
      {showSummerIntro && <SummerIntro />}
      {/* Background Image - using the shared component for iOS compatibility (screen only; hidden for print) */}
      <NewsletterBackground newsletter={newsletter} alt="Background" />
      {/* Print-only background layer - a real CSS background-image prints far more reliably
          than a fixed-position <img>, which most browsers drop or mishandle when printing. */}
      {newsletter.backgroundImage && (
        <div
          className="page-background"
          style={{ display: 'none', backgroundImage: `url("${newsletter.backgroundImage}")` }}
        />
      )}

      {/* Print-only and font styles */}
      <style>{`
        /* Ensure fonts render consistently across devices */
        * {
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          text-rendering: optimizeLegibility !important;
        }

        /* Prevent iOS text size adjustment */
        html {
          -webkit-text-size-adjust: 100% !important;
          text-size-adjust: 100% !important;
        }

        /* Ensure inline font-family styles are respected on iOS */
        [style*="font-family"] {
          -webkit-text-size-adjust: 100% !important;
        }

        /* Force long URLs and links to wrap on mobile */
        .newsletter-content a,
        .newsletter-content p,
        .newsletter-content div,
        .newsletter-section a,
        .newsletter-section p,
        .newsletter-section div {
          /* Wrap whole words to the next line; only split a word (e.g. a very long URL)
             when it can't fit on a line by itself. No hyphenation or mid-word breaks. */
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          word-break: normal !important;
          -webkit-hyphens: none;
          hyphens: none;
        }

        /* Specifically target links - make them clickable and visible */
        /* Quick-block buttons (.quick-block-cta) are links too, but they style their own
           colors and must not pick up the blue text-link look, so they're excluded here. */
        a {
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          word-break: normal !important;
          cursor: pointer !important;
          pointer-events: auto !important;
        }

        a:not(.quick-block-cta) {
          color: #4f46e5 !important;
          text-decoration: underline !important;
        }

        a:not(.quick-block-cta):hover {
          color: #3730a3 !important;
          text-decoration: underline !important;
        }

        /* Ensure newsletter content links are clickable */
        .newsletter-content a:not(.quick-block-cta),
        .newsletter-section a:not(.quick-block-cta) {
          color: #4f46e5 !important;
          text-decoration: underline !important;
          cursor: pointer !important;
          pointer-events: auto !important;
        }

        .newsletter-content a:not(.quick-block-cta):hover,
        .newsletter-section a:not(.quick-block-cta):hover {
          color: #3730a3 !important;
        }

        @media print {
          @page {
            margin: 0.5in;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          body {
            background: white !important;
            margin: 0;
            padding: 0;
          }

          .no-print {
            display: none !important;
          }

          .print-container {
            width: 100%;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 0;
          }

          /* Page background for print */
          .page-background {
            display: block !important;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-repeat: no-repeat !important;
            background-size: cover !important;
            background-position: center !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            z-index: 0;
          }

          .newsletter-inner {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .newsletter-header {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .newsletter-content {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Ensure images print */
          img {
            max-width: 100%;
            page-break-inside: avoid;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Page break control */
          .newsletter-section {
            page-break-inside: avoid;
          }

          /* Remove shadows for print */
          .shadow-lg, .shadow-md {
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Header Bar (No Print) */}
      <div className="no-print bg-white shadow-md" style={{ position: 'relative', zIndex: 10 }}>
        <div className="container mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center space-x-2 min-w-0">
              <img src="/images/logo.png" alt="" className="w-8 h-8 sm:w-10 sm:h-10 object-contain flex-shrink-0" />
              <span className="text-base sm:text-xl font-serif text-church-navy truncate">{CHURCH_NAME}</span>
            </a>
            {/* Hamburger Menu */}
            <div className="relative">
              <button
                onClick={() => { setShowHeaderMenu(!showHeaderMenu); setShowLangDropdown(false); }}
                className="p-2 rounded-lg hover:bg-gray-100 transition"
                aria-label="Menu"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {showHeaderMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => { setShowHeaderMenu(false); setShowLangDropdown(false); }} />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border z-20 py-1 overflow-hidden">
                    {/* Share */}
                    <button
                      onClick={() => { copyShareableLink(); setShowHeaderMenu(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 transition"
                    >
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      <span className="font-medium text-gray-700">{linkCopied ? 'Link Copied!' : 'Share Newsletter'}</span>
                    </button>
                    {/* Download PDF */}
                    <button
                      onClick={() => { exportToPDF(); setShowHeaderMenu(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 border-t transition"
                    >
                      <svg className="w-5 h-5 text-church-navy flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-medium text-gray-700">Download PDF</span>
                    </button>
                    {/* Translate — expander */}
                    <button
                      onClick={() => setShowLangDropdown(!showLangDropdown)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between border-t transition"
                    >
                      <div className="flex items-center space-x-3">
                        <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
                        <span className="font-medium text-gray-700">
                          {isTranslating ? 'Translating...' : activeLanguage === 'en' ? 'Translate' : `Translated: ${LANGUAGES.find(l => l.code === activeLanguage)?.name}`}
                        </span>
                      </div>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${showLangDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {/* Language List (expandable) */}
                    {showLangDropdown && (
                      <div className="bg-gray-50 border-t max-h-64 overflow-y-auto">
                        {activeLanguage !== 'en' && (
                          <button
                            onClick={() => { handleTranslate('en'); setShowHeaderMenu(false); }}
                            className="w-full text-left px-6 py-2 hover:bg-gray-100 font-medium text-church-navy border-b text-sm"
                          >
                            View Original (English)
                          </button>
                        )}
                        {LANGUAGES.map(lang => (
                          <button
                            key={lang.code}
                            onClick={() => { handleTranslate(lang.code); setShowHeaderMenu(false); }}
                            className={`w-full text-left px-6 py-2 hover:bg-gray-100 text-sm ${activeLanguage === lang.code ? 'bg-church-cream font-medium text-church-navy-deep' : 'text-gray-700'}`}
                          >
                            {lang.flag} {lang.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Translating Overlay */}
      {isTranslating && (
        <div className="no-print fixed inset-0 bg-black/30 flex items-center justify-center" style={{ zIndex: 50 }}>
          <div className="bg-white rounded-xl shadow-2xl p-8 text-center max-w-sm mx-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-church-navy mx-auto"></div>
            <p className="mt-4 text-lg font-medium text-gray-800">Translating newsletter...</p>
            <p className="mt-1 text-sm text-gray-500">
              {LANGUAGES.find(l => l.code === activeLanguage)?.flag} {LANGUAGES.find(l => l.code === activeLanguage)?.name}
            </p>
          </div>
        </div>
      )}

      {/* Translation Error Toast */}
      {translationError && (
        <div className="no-print fixed top-4 right-4 bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2" style={{ zIndex: 50 }}>
          <span className="text-sm">{translationError}</span>
          <button onClick={() => setTranslationError(null)} className="text-red-600 hover:text-red-800 font-bold">x</button>
        </div>
      )}

      <PrintOptionsModal open={showPrintOptions} onClose={() => setShowPrintOptions(false)} />

      {/* Newsletter Content */}
      <div className="container mx-auto px-6 py-8 print-container" style={{ position: 'relative', zIndex: 1 }}>
        {/* Newsletter container */}
        <div
          className="newsletter-inner max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden"
          style={{
            backgroundColor: `rgba(255, 255, 255, ${newsletter.contentOpacity || 1})`,
            position: 'relative',
            zIndex: 1
          }}
        >
            {/* Translation Banner */}
            {activeLanguage !== 'en' && !isTranslating && (
              <div className="no-print bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
                <span className="text-sm text-amber-800 flex items-center gap-2">
                  <span>{LANGUAGES.find(l => l.code === activeLanguage)?.flag}</span>
                  <span>Translated to {LANGUAGES.find(l => l.code === activeLanguage)?.name}</span>
                </span>
                <button
                  onClick={() => handleTranslate('en')}
                  className="text-sm text-church-navy hover:text-church-navy-deep font-medium"
                >
                  View Original
                </button>
              </div>
            )}

            {/* Newsletter Header */}
            <div className={`newsletter-header p-8 ${newsletter.themePack === 'winter' && !newsletter.headerImage ? 'winter-image-header' : ''}`} style={{
              backgroundColor: hexToRgba(newsletter.headerBackgroundColor || '#4f46e5', newsletter.headerOpacity || 1),
              ...(newsletter.headerImage ? { aspectRatio: '16 / 5' } : {}),
              ...((newsletter.headerImage || newsletter.themePack === 'winter')
                ? {
                    backgroundImage: `url("${newsletter.headerImage || WINTER_HEADER_IMAGE}")`,
                    backgroundPosition: 'center top',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: newsletter.headerImage ? '100% 100%' : 'cover',
                  }
                : {}),
            }}>
              {displayNewsletter.title && (
                <h1 className="text-4xl font-bold mb-2" style={{ color: newsletter.headerTextColor || '#ffffff', fontFamily: newsletter.titleFont || 'Arial, sans-serif' }}>
                  {displayNewsletter.title}
                </h1>
              )}
              {displayNewsletter.subtitle && (
                <p className="text-lg" style={{ color: newsletter.headerTextColor || '#ffffff', opacity: 0.9, fontFamily: newsletter.subtitleFont || 'Arial, sans-serif' }}>
                  {displayNewsletter.subtitle}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-8 py-3 text-sm text-slate-600">
              {newsletter.publishedDate && (
                <span>Published: {new Date(newsletter.publishedDate).toLocaleDateString()}</span>
              )}
              {memberId && !isArchived && (
                <Link to={buildNewsletterPath('/archive')} className="font-semibold text-church-navy-deep underline underline-offset-4">
                  Browse past newsletters
                </Link>
              )}
              {isArchived && (
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-amber-800">
                  <span className="font-medium">Archived Newsletter</span>
                  {memberId && <a href={buildNewsletterPath()} className="underline">View Latest →</a>}
                </div>
              )}
            </div>

            {/* Newsletter Sections */}
            <div className="newsletter-content p-8 space-y-6" style={{
              backgroundColor: hexToRgba(newsletter.contentBackgroundColor || '#ffffff', newsletter.contentOpacity || 1)
            }}>
            {displayNewsletter.sections.map((section) => (
              <div key={section.id} className="newsletter-section">
                {/* Header Section */}
                {section.type === 'header' && (
                  <h2
                    className={`text-3xl ${section.headerBold !== false ? 'font-bold' : 'font-normal'}`}
                    style={{
                      color: section.headerColor || newsletter.accentColor,
                      textAlign: section.headerAlignment || 'center',
                      fontFamily: section.fontFamily || newsletter.contentFont || 'Arial, sans-serif'
                    }}
                  >
                    {section.headerText}
                  </h2>
                )}

                {/* Text Section */}
                {section.type === 'text' && (
                  (() => {
                    const quickBlock = getCardAppearance(section);

                    return (
                      <div
                        className={`max-w-none ${quickBlock ? `quick-block quick-block-${quickBlock.id} ${getCardLayoutClass(section)} quick-block-animate-${section.cardAnimation || 'none'}` : ''}`}
                        style={{
                          color: quickBlock?.colors.accent || newsletter.textColor || '#000000',
                          '--card-accent': quickBlock?.colors.accent,
                          background: quickBlock ? getCardBackground(quickBlock.colors) : undefined,
                          borderColor: quickBlock?.colors.accent,
                          boxShadow: quickBlock ? `0 18px 35px ${quickBlock.colors.accent}24, 0 4px 10px rgba(15, 23, 42, 0.08)` : undefined,
                          fontFamily: section.fontFamily || newsletter.contentFont || 'Arial, sans-serif',
                        }}
                      >
                        {quickBlock && section.cardBackgroundPattern !== 'none' && (
                          <span className={`quick-block-decoration quick-block-decoration-${section.cardBackgroundPattern}`} aria-hidden="true" />
                        )}
                        {quickBlock && <span className="quick-block-icon"><CardIcon name={quickBlock.icon} /></span>}
                        {quickBlock && section.cardImageUrl && section.cardPhotoMode !== 'carousel' && (
                          <button type="button" className="quick-block-photo-button" onClick={() => setPhotoLightbox({ images: [{ url: section.cardImageUrl, caption: section.cardImageAlt || '' }], index: 0 })} aria-label="View photo larger">
                            <img className="quick-block-photo" src={section.cardImageUrl} alt={section.cardImageAlt || ''} />
                          </button>
                        )}
                        {quickBlock?.id === 'photo-card' && section.cardPhotoMode === 'carousel' && section.cardImages?.length > 0 && (
                          <div
                            className="quick-block-carousel"
                            onTouchStart={(event) => setCarouselTouchStart(prev => ({ ...prev, [section.id]: event.touches[0].clientX }))}
                            onTouchEnd={(event) => {
                              const startX = carouselTouchStart[section.id];
                              const distance = event.changedTouches[0].clientX - startX;
                              if (Math.abs(distance) >= 40) changeCarouselPhoto(section.id, section.cardImages.length, distance < 0 ? 'next' : 'previous');
                            }}
                          >
                            <button type="button" className="quick-block-photo-button" onClick={() => setPhotoLightbox({ images: section.cardImages, index: carouselIndexes[section.id] || 0 })} aria-label="View photo larger">
                              <img src={section.cardImages[carouselIndexes[section.id] || 0]?.url} alt={section.cardImages[carouselIndexes[section.id] || 0]?.caption || section.cardImageAlt || 'Newsletter photo'} />
                            </button>
                            {section.cardImages.length > 1 && (
                              <>
                                <button className="quick-block-carousel-arrow quick-block-carousel-previous" onClick={() => changeCarouselPhoto(section.id, section.cardImages.length, 'previous')} aria-label="Previous photo">‹</button>
                                <button className="quick-block-carousel-arrow quick-block-carousel-next" onClick={() => changeCarouselPhoto(section.id, section.cardImages.length, 'next')} aria-label="Next photo">›</button>
                                <div className="quick-block-carousel-dots">{section.cardImages.map((_, imageIndex) => <button key={imageIndex} onClick={() => setCarouselIndexes(prev => ({ ...prev, [section.id]: imageIndex }))} className={imageIndex === (carouselIndexes[section.id] || 0) ? 'active' : ''} aria-label={`Show photo ${imageIndex + 1}`} />)}</div>
                              </>
                            )}
                            {section.cardImages[carouselIndexes[section.id] || 0]?.caption && <p className="quick-block-carousel-caption">{section.cardImages[carouselIndexes[section.id] || 0].caption}</p>}
                          </div>
                        )}
                        {quickBlock && (section.eventDate || section.eventTime || section.eventLocation) && (
                          <div className="quick-block-event-details">
                            {section.eventDate && <span>{section.eventDate}</span>}
                            {section.eventTime && <span>{section.eventTime}</span>}
                            {section.eventLocation && <span>{section.eventLocation}</span>}
                          </div>
                        )}
                        <div dangerouslySetInnerHTML={{ __html: section.content }} />
                        {quickBlock && section.ctaLabel && section.ctaUrl && (
                          <a className="quick-block-cta" style={{ '--card-cta-text': getReadableTextColor(quickBlock.colors.accent) }} href={section.ctaUrl} target="_blank" rel="noreferrer">{section.ctaLabel}</a>
                        )}
                      </div>
                    );
                  })()
                )}

                {/* Image Section */}
                {section.type === 'image' && section.imageUrl && (
                  <div>
                    <img
                      src={section.imageUrl}
                      alt={section.imageAltText || 'Newsletter content'}
                      className="w-full rounded-lg shadow-sm"
                      style={{
                        width: '100%',
                        aspectRatio: section.imageAspectRatio === 'square' ? '1 / 1' : section.imageAspectRatio === 'portrait' ? '3 / 4' : section.imageAspectRatio === 'landscape' ? '4 / 3' : section.imageAspectRatio === 'banner' ? '21 / 9' : '16 / 9',
                        objectFit: section.imageFit === 'contain' ? 'contain' : section.imageFit === 'fill' ? 'fill' : 'cover',
                        backgroundColor: '#f3f4f6',
                        display: 'block'
                      }}
                    />
                    {section.imageCaption && (
                      <p className="mt-2 text-sm italic text-gray-600">{section.imageCaption}</p>
                    )}
                  </div>
                )}

                {/* Image + Text Section */}
                {section.type === 'imageText' && (
                  <div>
                    {section.imageUrl && (
                      <img
                        src={section.imageUrl}
                        alt={section.imageAltText || 'Newsletter content'}
                        className="rounded-lg shadow-sm"
                        style={{
                          float: section.imagePosition === 'right' ? 'right' : 'left',
                          width: '45%',
                          marginBottom: '1rem',
                          aspectRatio: section.imageAspectRatio === 'square' ? '1 / 1' : section.imageAspectRatio === 'portrait' ? '3 / 4' : section.imageAspectRatio === 'landscape' ? '4 / 3' : section.imageAspectRatio === 'banner' ? '21 / 9' : '16 / 9',
                          objectFit: section.imageFit === 'contain' ? 'contain' : section.imageFit === 'fill' ? 'fill' : 'cover',
                          ...(section.imagePosition === 'right' ? { marginLeft: '1.5rem' } : { marginRight: '1.5rem' })
                        }}
                      />
                    )}
                    {section.heading && (
                      <h3 className="text-2xl font-bold mb-3" style={{ color: newsletter.accentColor }}>
                        {section.heading}
                      </h3>
                    )}
                    <div
                      style={{ color: newsletter.textColor || '#000000', fontFamily: section.fontFamily || newsletter.contentFont || 'Arial, sans-serif' }}
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />
                    <div style={{ clear: 'both' }} />
                  </div>
                )}

                {/* Text + Image Section (Text on left, Image on right) */}
                {section.type === 'textImage' && (
                  <div>
                    {section.imageUrl && (
                      <img
                        src={section.imageUrl}
                        alt={section.imageAltText || 'Newsletter content'}
                        className="rounded-lg shadow-sm"
                        style={{
                          float: 'right',
                          width: '45%',
                          marginLeft: '1.5rem',
                          marginBottom: '1rem',
                          aspectRatio: section.imageAspectRatio === 'square' ? '1 / 1' : section.imageAspectRatio === 'portrait' ? '3 / 4' : section.imageAspectRatio === 'landscape' ? '4 / 3' : section.imageAspectRatio === 'banner' ? '21 / 9' : '16 / 9',
                          objectFit: section.imageFit === 'contain' ? 'contain' : section.imageFit === 'fill' ? 'fill' : 'cover'
                        }}
                      />
                    )}
                    {section.heading && (
                      <h3 className="text-2xl font-bold mb-3" style={{ color: newsletter.accentColor }}>
                        {section.heading}
                      </h3>
                    )}
                    <div
                      style={{ color: newsletter.textColor || '#000000', fontFamily: section.fontFamily || newsletter.contentFont || 'Arial, sans-serif' }}
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />
                    <div style={{ clear: 'both' }} />
                  </div>
                )}

                {/* Two Column Text Section */}
                {section.type === 'twoColumn' && (
                  <div className="flex flex-row gap-6">
                    <div className="w-1/2">
                      <div
                        style={{ color: newsletter.textColor || '#000000', fontFamily: section.fontFamily || newsletter.contentFont || 'Arial, sans-serif' }}
                        dangerouslySetInnerHTML={{ __html: section.leftContent }}
                      />
                    </div>
                    <div className="w-1/2">
                      <div
                        style={{ color: newsletter.textColor || '#000000', fontFamily: section.fontFamily || newsletter.contentFont || 'Arial, sans-serif' }}
                        dangerouslySetInnerHTML={{ __html: section.rightContent }}
                      />
                    </div>
                    {photoLightbox && (
                      <div className="newsletter-photo-lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => setPhotoLightbox(null)}>
                        <div className="newsletter-photo-lightbox-content" onClick={(event) => event.stopPropagation()}>
                          <button type="button" className="newsletter-photo-lightbox-close" onClick={() => setPhotoLightbox(null)} aria-label="Close photo viewer">×</button>
                          <img src={photoLightbox.images[photoLightbox.index].url} alt={photoLightbox.images[photoLightbox.index].caption || 'Newsletter photo'} />
                          {photoLightbox.images.length > 1 && (
                            <>
                              <button type="button" className="newsletter-photo-lightbox-arrow newsletter-photo-lightbox-previous" onClick={() => setPhotoLightbox(prev => ({ ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length }))} aria-label="Previous photo">‹</button>
                              <button type="button" className="newsletter-photo-lightbox-arrow newsletter-photo-lightbox-next" onClick={() => setPhotoLightbox(prev => ({ ...prev, index: (prev.index + 1) % prev.images.length }))} aria-label="Next photo">›</button>
                            </>
                          )}
                          {photoLightbox.images[photoLightbox.index].caption && <p>{photoLightbox.images[photoLightbox.index].caption}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Quote Section */}
                {section.type === 'quote' && (
                  <div
                    className="rounded-lg p-6 border-l-4 italic"
                    style={{ borderColor: newsletter.accentColor }}
                  >
                    <div
                      className="text-xl"
                      style={{ color: newsletter.textColor || '#000000', fontFamily: section.fontFamily || newsletter.contentFont || 'Arial, sans-serif' }}
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />
                  </div>
                )}

                {/* Divider Section */}
                {section.type === 'divider' && (
                  renderDivider(section, newsletter)
                )}

                {section.type === 'response' && (
                  <div className="rounded-xl border-2 p-5" style={{ borderColor: newsletter.accentColor, backgroundColor: `${newsletter.contentBackgroundColor || '#ffffff'}` }}>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: newsletter.accentColor }}>Poll</p>
                    <h3 className="mt-1 text-xl font-bold" style={{ color: newsletter.textColor || '#111827' }}>{section.responsePrompt}</h3>
                    {submittedResponses[section.id] ? (
                      <>
                        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                          Thank you! Your response, “{submittedResponses[section.id]},” has been recorded.
                        </p>
                        {section.showPollResults !== false && memberId && (
                          <PollResults
                            memberId={memberId}
                            newsletterId={resolvedNewsletterId}
                            sectionId={section.id}
                            options={(section.responseOptions || []).filter(Boolean)}
                            accentColor={newsletter.accentColor}
                            textColor={newsletter.textColor}
                          />
                        )}
                      </>
                    ) : archiveId ? (
                      <p className="mt-4 text-sm text-gray-500">Responses are available while this newsletter is current.</p>
                    ) : (
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        {(section.responseOptions || []).filter(Boolean).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => submitFamilyResponse(section, option)}
                            disabled={submittingResponseId === section.id}
                            className="rounded-lg px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-60 sm:py-2"
                            style={{ backgroundColor: newsletter.accentColor }}
                          >
                            {submittingResponseId === section.id ? 'Saving...' : option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Custom Form Section */}
                {section.type === 'event' && (
                  <EventCard
                    section={section}
                    preview={Boolean(archiveId)}
                    memberId={memberId}
                    newsletterId={resolvedNewsletterId}
                    accentColor={newsletter.accentColor}
                    textColor={newsletter.textColor}
                    backgroundColor={newsletter.contentBackgroundColor}
                  />
                )}
                {section.type === 'customForm' && (
                  <div className="rounded-xl border-2 p-5" style={{ borderColor: newsletter.accentColor, backgroundColor: `${newsletter.contentBackgroundColor || '#ffffff'}` }}>
                    <h3 className="text-xl font-bold" style={{ color: newsletter.textColor || '#111827' }}>{section.formTitle || 'Form'}</h3>
                    {section.formDescription && (
                      <p className="mt-1 text-sm" style={{ color: newsletter.textColor || '#374151' }}>{section.formDescription}</p>
                    )}
                    {submittedForms[section.id] ? (
                      <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                        <p>{section.confirmationMessage || 'Thank you! Your response has been recorded.'}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setFormAnswers(prev => ({ ...prev, [section.id]: {} }));
                            setSubmittedForms(prev => ({ ...prev, [section.id]: false }));
                          }}
                          className="mt-2 underline hover:no-underline"
                        >
                          Submit another response (for another child)
                        </button>
                      </div>
                    ) : archiveId ? (
                      <p className="mt-4 text-sm text-gray-500">Responses are available while this newsletter is current.</p>
                    ) : (
                      <div className="mt-4 space-y-4">
                        {(section.fields || []).map(field => (
                          <div key={field.id}>
                            <label className="block text-sm font-medium mb-1" style={{ color: newsletter.textColor || '#374151' }}>
                              {field.label}{field.required && <span className="text-red-500"> *</span>}
                            </label>
                            <FormFieldInput field={field} value={formAnswers[section.id]?.[field.id] || ''} onChange={(next) => updateFormAnswer(section.id, field.id, next)} />
                          </div>
                        ))}
                        {formErrors[section.id] && (
                          <p className="text-sm font-medium text-red-600">{formErrors[section.id]}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => submitCustomForm(section)}
                          disabled={submittingFormId === section.id}
                          className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-60"
                          style={{ backgroundColor: newsletter.accentColor }}
                        >
                          {submittingFormId === section.id ? 'Saving...' : (section.submitButtonLabel || 'Submit')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Image Grid Section */}
                {section.type === 'imageGrid' && section.gridImages && section.gridImages.length > 0 && (
                  <div className="grid gap-4 grid-cols-3">
                    {section.gridImages.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={img.url}
                          alt={img.caption || `Grid image ${idx + 1}`}
                          className="w-full h-40 object-cover rounded-lg"
                        />
                        {img.caption && (
                          <p className="text-sm text-gray-600 text-center mt-1">{img.caption}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Image Carousel Section */}
                {section.type === 'imageCarousel' && section.carouselImages && section.carouselImages.length > 0 && (
                  <div
                    className="relative"
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      e.currentTarget.dataset.touchStartX = touch.clientX;
                    }}
                    onTouchEnd={(e) => {
                      const startX = parseFloat(e.currentTarget.dataset.touchStartX);
                      const endX = e.changedTouches[0].clientX;
                      const diff = startX - endX;

                      if (Math.abs(diff) > 50) {
                        const currentIdx = carouselIndexes[section.id] || 0;
                        if (diff > 0) {
                          const newIdx = currentIdx === section.carouselImages.length - 1 ? 0 : currentIdx + 1;
                          setCarouselIndexes(prev => ({ ...prev, [section.id]: newIdx }));
                        } else {
                          const newIdx = currentIdx === 0 ? section.carouselImages.length - 1 : currentIdx - 1;
                          setCarouselIndexes(prev => ({ ...prev, [section.id]: newIdx }));
                        }
                      }
                    }}
                  >
                    {/* Main image */}
                    <div className="relative overflow-hidden rounded-lg">
                      <img
                        src={section.carouselImages[carouselIndexes[section.id] || 0]?.url}
                        alt={section.carouselImages[carouselIndexes[section.id] || 0]?.caption || 'Carousel image'}
                        className="w-full h-64 md:h-96 object-cover"
                      />

                      {/* Navigation arrows */}
                      <button
                        onClick={() => {
                          const currentIdx = carouselIndexes[section.id] || 0;
                          const newIdx = currentIdx === 0 ? section.carouselImages.length - 1 : currentIdx - 1;
                          setCarouselIndexes(prev => ({ ...prev, [section.id]: newIdx }));
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-lg"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      <button
                        onClick={() => {
                          const currentIdx = carouselIndexes[section.id] || 0;
                          const newIdx = currentIdx === section.carouselImages.length - 1 ? 0 : currentIdx + 1;
                          setCarouselIndexes(prev => ({ ...prev, [section.id]: newIdx }));
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-lg"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    {/* Caption */}
                    {section.carouselImages[carouselIndexes[section.id] || 0]?.caption && (
                      <p className="text-center text-gray-600 mt-2" style={{ fontFamily: section.fontFamily || newsletter.contentFont }}>
                        {section.carouselImages[carouselIndexes[section.id] || 0].caption}
                      </p>
                    )}

                    {/* Dot indicators */}
                    <div className="flex justify-center gap-2 mt-3">
                      {section.carouselImages.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCarouselIndexes(prev => ({ ...prev, [section.id]: idx }))}
                          className={`w-3 h-3 rounded-full transition ${
                            (carouselIndexes[section.id] || 0) === idx
                              ? 'bg-church-navy'
                              : 'bg-gray-300 hover:bg-gray-400'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {displayNewsletter.sections.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>No content available in this newsletter.</p>
              </div>
            )}
            </div>

            {/* Footer */}
            <NewsletterFooter newsletter={displayNewsletter} />
        </div>

        {/* Action Buttons (No Print) */}
        <div className="no-print text-center mt-8">
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={copyShareableLink}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition inline-flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>{linkCopied ? 'Link Copied!' : 'Share Newsletter'}</span>
            </button>
            <button
              onClick={exportToPDF}
              className="px-6 py-3 bg-church-navy hover:bg-church-navy-deep text-white rounded-lg font-medium transition inline-flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download as PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsletterPublicView;
