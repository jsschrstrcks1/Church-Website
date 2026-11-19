// Newsletter Editor Component
import AdminNav from './AdminNav';
import { useState, useEffect, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, SITE_URL, CHURCH_NAME, CHURCH_LOCATION } from '../../firebase/config';
import { CHURCH_SPACE } from '../../firebase/church';
import NewsletterFooter from '../newsletter/NewsletterFooter';
import NewsletterBackground from '../newsletter/NewsletterBackground';
import NewsletterBackgroundPicker from '../newsletter/NewsletterBackgroundPicker';
import { getReadableTextColor } from '../../utils/colorContrast';
import FontOptions from '../newsletter/FontOptions';
import FormFieldInput from '../newsletter/FormFieldInput';
import EventCard from '../newsletter/EventCard';
import EventRsvpList from '../newsletter/EventRsvpList';
import PollResults from '../newsletter/PollResults';
import PrintOptionsModal from '../newsletter/PrintOptionsModal';
import { FORM_FIELD_TYPES, OPTION_FIELD_TYPES } from '../../utils/newsletterForms';
import { normalizeFont } from '../../utils/newsletterFonts';

const BRAND_PRESETS = [
  { id: 'classic', name: 'Classic', headerBackgroundColor: '#4f46e5', headerTextColor: '#ffffff', contentBackgroundColor: '#ffffff', textColor: '#111827', accentColor: '#4f46e5' },
  { id: 'sunrise', name: 'Sunrise', headerBackgroundColor: '#f59e0b', headerTextColor: '#fff7ed', contentBackgroundColor: '#fffaf3', textColor: '#1f2937', accentColor: '#f97316' },
  { id: 'forest', name: 'Forest', headerBackgroundColor: '#166534', headerTextColor: '#f0fdf4', contentBackgroundColor: '#f0fdf4', textColor: '#1f2937', accentColor: '#22c55e' },
  { id: 'sage', name: 'Sage', headerBackgroundColor: '#0f766e', headerTextColor: '#ecfeff', contentBackgroundColor: '#ecfeff', textColor: '#0f172a', accentColor: '#14b8a6' },
  { id: 'modern', name: 'Modern', headerBackgroundColor: '#1f2937', headerTextColor: '#f9fafb', contentBackgroundColor: '#f9fafb', textColor: '#111827', accentColor: '#a855f7' }
];

const WINTER_HEADER_IMAGE = '/images/winter-header.png';

const THEME_PACKS = [
  { id: 'back-to-school', name: 'Back to School', emoji: '🎒', headerBackgroundColor: '#1d4ed8', headerTextColor: '#ffffff', contentBackgroundColor: '#eff6ff', textColor: '#172554', accentColor: '#f59e0b', dividerStyle: 'dashed', dividerPattern: 'stars', titleFont: 'Verdana, Geneva, sans-serif' },
  { id: 'fall', name: 'Fall', emoji: '🍂', headerBackgroundColor: '#9a3412', headerTextColor: '#fff7ed', contentBackgroundColor: '#fff7ed', textColor: '#431407', accentColor: '#c2410c', dividerStyle: 'wavy', dividerPattern: 'leaves', titleFont: 'Georgia, serif' },
  { id: 'winter', name: 'Winter', emoji: '❄', headerBackgroundColor: '#e0f2fe', headerTextColor: '#0c4a6e', contentBackgroundColor: '#f0f9ff', textColor: '#164e63', accentColor: '#0284c7', dividerStyle: 'soft', dividerPattern: 'sparkles', titleFont: 'Georgia, serif' },
  { id: 'spring', name: 'Spring / Easter', emoji: '🌷', headerBackgroundColor: '#be185d', headerTextColor: '#fff1f2', contentBackgroundColor: '#fff7fb', textColor: '#500724', accentColor: '#db2777', dividerStyle: 'dotted', dividerPattern: 'petals', titleFont: "'Trebuchet MS', Helvetica, sans-serif" },
  { id: 'summer', name: 'Summer', emoji: '☀', headerBackgroundColor: '#ea580c', headerTextColor: '#fff7ed', contentBackgroundColor: '#fffbeb', textColor: '#431407', accentColor: '#f59e0b', dividerStyle: 'wavy', dividerPattern: 'waves', titleFont: "'Fredoka', sans-serif" },
  { id: 'holidays', name: 'Christmas', emoji: '🎄', headerBackgroundColor: '#991b1b', headerTextColor: '#fef2f2', contentBackgroundColor: '#f0fdf4', textColor: '#14532d', accentColor: '#b91c1c', dividerStyle: 'dotted', dividerPattern: 'stars', titleFont: "'Playfair Display', serif" },
  { id: 'valentines', name: 'Valentine’s', emoji: '💝', headerBackgroundColor: '#9f1239', headerTextColor: '#fff1f2', contentBackgroundColor: '#fff1f2', textColor: '#4c0519', accentColor: '#e11d48', dividerStyle: 'soft', dividerPattern: 'hearts', titleFont: "'Pacifico', cursive" },
  { id: 'end-of-year', name: 'Graduation', emoji: '🎓', headerBackgroundColor: '#0f766e', headerTextColor: '#f0fdfa', contentBackgroundColor: '#fefce8', textColor: '#134e4a', accentColor: '#eab308', dividerStyle: 'dashed', dividerPattern: 'sparkles', titleFont: "'Poppins', sans-serif" },
];

const ADD_CONTENT_GROUPS = [
  {
    label: 'Text',
    items: [
      { type: 'text', label: 'Text Block', icon: 'M4 6h16M4 12h16M4 18h7' },
      { type: 'header', label: 'Section Heading', icon: 'M4 6h16M4 12h8m-8 6h16' },
      { type: 'quote', label: 'Quote', icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
      { type: 'divider', label: 'Divider', icon: 'M20 12H4' },
    ],
  },
  {
    label: 'Pictures',
    items: [
      { type: 'image', label: 'Image', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { type: 'imageText', label: 'Image + Text', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
      { type: 'textImage', label: 'Text + Image', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
      { type: 'imageGrid', label: 'Image Grid', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
      { type: 'imageCarousel', label: 'Carousel', icon: 'M8 7l-5 5 5 5M16 7l5 5-5 5M10 5h4v14h-4z' },
    ],
  },
  {
    label: 'Layout & interactive',
    items: [
      { type: 'twoColumn', label: 'Two Columns', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7' },
      { type: 'event', label: 'Event', icon: 'M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z' },
      { type: 'response', label: 'Poll', icon: 'M3 8l9 6 9-6M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z' },
      { type: 'customForm', label: 'Custom Form', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ],
  },
];

const QUICK_BLOCK_TEMPLATES = [
  { id: 'upcoming-events', label: 'Upcoming Events', icon: 'calendar', content: '<h3>Upcoming Events</h3><ul><li><strong>Sunday:</strong> Bible class and worship service.</li><li><strong>Wednesday:</strong> Midweek Bible study.</li></ul>' },
  { id: 'class-spotlight', label: 'Ministry Spotlight', icon: 'sparkle', content: '<h3>Ministry Spotlight</h3><p>This week we are thankful for everyone who serves in our ministries. Ask how you can lend a hand.</p>' },
  { id: 'parent-reminder', label: 'Reminder', icon: 'pin', content: '<h3>Friendly Reminder</h3><p>Please let us know by Friday if you can help with this Sunday’s fellowship meal. Thank you for serving!</p>' },
  { id: 'parent-resource', label: 'Helpful Resource', icon: 'bulb', content: '<h3>Helpful Resource</h3><p><a href="https://example.com" target="_blank" rel="noreferrer">Click here for this week’s Bible reading plan and study notes.</a></p>' },
  { id: 'photo-card', label: 'Photo Card', icon: 'photo', content: '' }
];

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

const CONTENT_LIBRARY = [
  { id: 'weekly-update', label: 'Weekly Update', icon: 'note', content: '<h3>Weekly Update</h3><p>Thank you for worshiping with us this week. Here is what is happening in the life of our church family.</p>' },
  { id: 'field-trip', label: 'Trip Notice', icon: 'bus', content: '<h3>Trip Reminder</h3><p>We will be visiting <strong>[Location]</strong> on <strong>[Date]</strong>. Please sign up in the foyer and bring a sack lunch.</p>' },
  { id: 'homework', label: 'Bible Reading', icon: 'book', content: '<h3>Bible Reading</h3><p>This week’s reading is <strong>[Passage]</strong>. Read a little each day and bring your questions to Wednesday Bible study.</p>' },
  { id: 'classroom-win', label: 'Praise Report', icon: 'trophy', content: '<h3>Praise Report</h3><p>We give thanks for answered prayers and for the visitors who worshiped with us this week.</p>' },
  { id: 'community-note', label: 'Community Note', icon: 'people', content: '<h3>Community Connection</h3><p>We are grateful for our church family and every way you serve. Together we share God’s love with our neighbors.</p>' }
];

const CARD_ICON_OPTIONS = [
  ['calendar', 'Calendar'], ['sparkle', 'Sparkle'], ['pin', 'Pin'], ['bulb', 'Lightbulb'],
  ['note', 'Note'], ['bus', 'Bus'], ['book', 'Book'], ['trophy', 'Trophy'],
  ['people', 'Community'], ['megaphone', 'Announcement'], ['heart', 'Heart'], ['photo', 'Photo'],
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

const CARD_GRADIENT_PRESETS = [
  { id: 'ocean', name: 'Ocean', accent: '#0369a1', start: '#bae6fd', end: '#e0f2fe' },
  { id: 'sunset', name: 'Sunset', accent: '#c2410c', start: '#fed7aa', end: '#fce7f3' },
  { id: 'lavender', name: 'Lavender', accent: '#6d28d9', start: '#ddd6fe', end: '#f5f3ff' },
  { id: 'mint', name: 'Mint', accent: '#047857', start: '#a7f3d0', end: '#ecfdf5' },
  { id: 'warm-gold', name: 'Warm Gold', accent: '#a16207', start: '#fde68a', end: '#fffbeb' },
];

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


const generateFieldId = () => `field_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

const SECTION_TYPE_OPTIONS = [
  { type: 'header', label: 'Header' },
  { type: 'text', label: 'Text Block' },
  { type: 'image', label: 'Image' },
  { type: 'imageText', label: 'Image + Text' },
  { type: 'textImage', label: 'Text + Image' },
  { type: 'twoColumn', label: 'Two Column' },
  { type: 'event', label: 'Event' },
  { type: 'response', label: 'Poll' },
  { type: 'customForm', label: 'Custom Form' },
  { type: 'quote', label: 'Quote' },
  { type: 'divider', label: 'Divider' },
  { type: 'imageGrid', label: 'Image Grid' },
  { type: 'imageCarousel', label: 'Image Carousel' },
];

const NewsletterEditor = ({ memberProfile, newsletterId }) => {
  const isPrimaryNewsletter = newsletterId === 'primary';
  const buildPublicPath = (uid, suffix = '') => (
    isPrimaryNewsletter ? `/newsletter/${uid}${suffix}` : `/newsletter/${uid}/${newsletterId}${suffix}`
  );
  const newsletterDocRef = (uid) => doc(db, 'spaces', uid, 'newsletters', newsletterId);
  const newsletterArchiveCollectionRef = (uid) => collection(db, 'spaces', uid, 'newsletters', newsletterId, 'archive');
  const newsletterArchiveDocRef = (uid, archiveId) => doc(db, 'spaces', uid, 'newsletters', newsletterId, 'archive', archiveId);
  const newsletterRevisionsCollectionRef = (uid) => collection(db, 'spaces', uid, 'newsletters', newsletterId, 'revisions');
  const newsletterRevisionDocRef = (uid, revisionId) => doc(db, 'spaces', uid, 'newsletters', newsletterId, 'revisions', revisionId);
  const [newsletter, setNewsletter] = useState({
    name: '',
    title: '',
    subtitle: '',
    sections: [],
    headerBackgroundColor: '#10295e', // Header section background
    headerTextColor: '#ffffff', // Header text color
    contentBackgroundColor: '#ffffff', // Main content area background
    textColor: '#000000', // Default text color
    accentColor: '#e6252e',
    backgroundImage: '', // Outer page background image
    backgroundImageMobile: '', // Optional separate image for phones
    backgroundFocusX: 50, // Focal point (percent) kept in view when the image is trimmed
    backgroundFocusY: 50,
    titleFont: 'Arial, sans-serif', // Title font
    subtitleFont: 'Arial, sans-serif', // Subtitle font
    contentFont: 'Arial, sans-serif', // Default content font
    headerOpacity: 1, // Header section opacity (0-1)
    contentOpacity: 1, // Content section opacity (0-1)
    brandName: CHURCH_NAME,
    brandTagline: CHURCH_LOCATION,
    footerText: 'Thank you for being part of our church family.',
    contactEmail: '',
    published: false,
    lastModified: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [archivedNewsletters, setArchivedNewsletters] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [showArchive, setShowArchive] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [themePreview, setThemePreview] = useState(null);
  const [styleTab, setStyleTab] = useState('themes');
  const [showTools, setShowTools] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [draggedSectionId, setDraggedSectionId] = useState(null);
  const [dragOverSectionId, setDragOverSectionId] = useState(null);
  // Section whose drag handle is held down; only that section is draggable
  const [dragHandleSectionId, setDragHandleSectionId] = useState(null);

  useEffect(() => {
    if (!dragHandleSectionId) return undefined;
    const release = () => setDragHandleSectionId(null);
    window.addEventListener('mouseup', release);
    return () => window.removeEventListener('mouseup', release);
  }, [dragHandleSectionId]);
  const [carouselIndexes, setCarouselIndexes] = useState({}); // Track carousel position per section
  const [savedCards, setSavedCards] = useState([]);
  const [customPresets, setCustomPresets] = useState([]);
  const [showHeaderEditor, setShowHeaderEditor] = useState(false);
  const [openInsertMenuIndex, setOpenInsertMenuIndex] = useState(null);
  const backgroundImageInputRef = useRef(null);
  const backgroundMobileInputRef = useRef(null);
  const headerImageInputRef = useRef(null);
  const contentImageInputRefs = useRef({});
  const headerEditButtonRef = useRef(null);
  const [headerMenuPos, setHeaderMenuPos] = useState(null);

  // The header menu is rendered in a portal (the preview shell clips overflow), so it's
  // positioned against the viewport and follows the pencil button while open.
  useEffect(() => {
    if (!showHeaderEditor) return undefined;
    const updatePosition = () => {
      const rect = headerEditButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setHeaderMenuPos({
        top: Math.max(8, rect.bottom + 8),
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showHeaderEditor]);
  
  // Load existing newsletter from Firestore - stored per member, per newsletter
  useEffect(() => {
    const loadNewsletter = async () => {
      try {
        if (!memberProfile?.uid || !newsletterId) {
          console.log('Waiting for member profile / newsletter id to load...');
          return;
        }

        setLoading(true);
        const newsletterRef = newsletterDocRef(CHURCH_SPACE);
        const newsletterDoc = await getDoc(newsletterRef);

        if (newsletterDoc.exists()) {
          // Saved fields over the defaults, so a newsletter missing a newer setting still opens
          setNewsletter((defaults) => ({ ...defaults, ...newsletterDoc.data() }));
        }
      } catch (error) {
        console.error('Error loading newsletter:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNewsletter();
  }, [memberProfile?.uid, newsletterId]);

  // Load archived newsletters (past issues of THIS newsletter)
  useEffect(() => {
    const loadArchives = async () => {
      if (!memberProfile?.uid || !newsletterId) return;

      try {
        const archiveRef = newsletterArchiveCollectionRef(CHURCH_SPACE);
        const archiveQuery = query(archiveRef, orderBy('archivedAt', 'desc'));
        const archiveSnapshot = await getDocs(archiveQuery);

        const archives = archiveSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setArchivedNewsletters(archives);
      } catch (error) {
        console.error('Error loading archives:', error);
      }
    };

    loadArchives();
  }, [memberProfile?.uid, newsletterId]);

  useEffect(() => {
    const loadRevisions = async () => {
      if (!memberProfile?.uid || !newsletterId) return;

      try {
        const revisionsRef = newsletterRevisionsCollectionRef(CHURCH_SPACE);
        const revisionsSnapshot = await getDocs(query(revisionsRef, orderBy('savedAt', 'desc')));
        const revisionData = revisionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setRevisions(revisionData.slice(0, 8));
      } catch (error) {
        console.error('Error loading revisions:', error);
      }
    };

    loadRevisions();
  }, [memberProfile?.uid, newsletterId]);

  useEffect(() => {
    const loadSavedCards = async () => {
      if (!memberProfile?.uid) return;

      try {
        const libraryRef = doc(db, 'spaces', CHURCH_SPACE, 'settings', 'newsletterCardLibrary');
        const librarySnapshot = await getDoc(libraryRef);
        setSavedCards(librarySnapshot.exists() ? librarySnapshot.data().cards || [] : []);
      } catch (error) {
        console.error('Error loading saved newsletter cards:', error);
      }
    };

    loadSavedCards();
  }, [memberProfile?.uid]);

  useEffect(() => {
    if (!memberProfile?.uid) return;
    getDoc(doc(db, 'spaces', CHURCH_SPACE, 'settings', 'newsletterBrandPresets'))
      .then((snap) => setCustomPresets(snap.exists() ? snap.data().presets || [] : []))
      .catch((error) => console.error('Error loading brand presets:', error));
  }, [memberProfile?.uid]);

  const createRevisionEntry = (draft, source = 'manual') => {
    const previewText = draft.subtitle || draft.sections?.[0]?.content || 'Untitled newsletter';
    const plainPreview = previewText.replace(/<[^>]+>/g, '').trim();

    return {
      id: `rev_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      title: draft.title || 'Untitled newsletter',
      subtitle: draft.subtitle || '',
      savedAt: new Date().toISOString(),
      source,
      preview: plainPreview.slice(0, 90) || 'No preview available',
      sections: draft.sections || [],
      headerBackgroundColor: draft.headerBackgroundColor,
      headerTextColor: draft.headerTextColor,
      contentBackgroundColor: draft.contentBackgroundColor,
      accentColor: draft.accentColor,
      textColor: draft.textColor,
      backgroundImage: draft.backgroundImage,
      backgroundImageMobile: draft.backgroundImageMobile || '',
      backgroundFocusX: draft.backgroundFocusX ?? 50,
      backgroundFocusY: draft.backgroundFocusY ?? 50,
      published: draft.published || false,
      titleFont: draft.titleFont,
      subtitleFont: draft.subtitleFont,
      contentFont: draft.contentFont,
      headerOpacity: draft.headerOpacity,
      contentOpacity: draft.contentOpacity,
    };
  };

  const addRevisionEntry = async (draft, source = 'manual') => {
    if (!memberProfile?.uid) return;

    const normalizedDraft = JSON.parse(JSON.stringify(removeUndefined(draft)));
    const latestRevision = revisions[0];
    const latestSnapshot = latestRevision
      ? JSON.stringify({
          title: latestRevision.title,
          subtitle: latestRevision.subtitle,
          sections: latestRevision.sections,
          headerBackgroundColor: latestRevision.headerBackgroundColor,
          headerTextColor: latestRevision.headerTextColor,
          contentBackgroundColor: latestRevision.contentBackgroundColor,
          accentColor: latestRevision.accentColor,
          textColor: latestRevision.textColor,
          backgroundImage: latestRevision.backgroundImage,
          backgroundImageMobile: latestRevision.backgroundImageMobile || '',
          backgroundFocusX: latestRevision.backgroundFocusX ?? 50,
          backgroundFocusY: latestRevision.backgroundFocusY ?? 50,
          footerText: latestRevision.footerText,
          brandName: latestRevision.brandName,
          brandTagline: latestRevision.brandTagline,
          contactEmail: latestRevision.contactEmail,
          published: latestRevision.published,
        })
      : null;
    const currentSnapshot = JSON.stringify({
      title: normalizedDraft.title,
      subtitle: normalizedDraft.subtitle,
      sections: normalizedDraft.sections || [],
      headerBackgroundColor: normalizedDraft.headerBackgroundColor,
      headerTextColor: normalizedDraft.headerTextColor,
      contentBackgroundColor: normalizedDraft.contentBackgroundColor,
      accentColor: normalizedDraft.accentColor,
      textColor: normalizedDraft.textColor,
      backgroundImage: normalizedDraft.backgroundImage,
      backgroundImageMobile: normalizedDraft.backgroundImageMobile || '',
      backgroundFocusX: normalizedDraft.backgroundFocusX ?? 50,
      backgroundFocusY: normalizedDraft.backgroundFocusY ?? 50,
      footerText: normalizedDraft.footerText,
      brandName: normalizedDraft.brandName,
      brandTagline: normalizedDraft.brandTagline,
      contactEmail: normalizedDraft.contactEmail,
      published: normalizedDraft.published || false,
    });

    if (latestSnapshot && latestSnapshot === currentSnapshot) {
      return;
    }

    const revision = createRevisionEntry(draft, source);
    const revisionRef = newsletterRevisionDocRef(CHURCH_SPACE, revision.id);

    try {
      await setDoc(revisionRef, { ...revision, savedAt: revision.savedAt });
      setRevisions(prev => [revision, ...prev.filter(item => item.id !== revision.id)].slice(0, 8));
    } catch (error) {
      console.error('Error saving revision history:', error);
    }
  };

  // Archive current newsletter and start fresh
  const archiveAndStartNew = async () => {
    if (!newsletter.title.trim() && !newsletter.headerImage) {
      alert('Add a title or a custom header image before archiving this newsletter.');
      return;
    }

    if (!newsletter.published) {
      alert('Please publish the newsletter before archiving it.');
      return;
    }

    if (!window.confirm('This will archive the current newsletter and create a blank one. The archived newsletter will be available in your archive. Continue?')) {
      return;
    }

    setArchiving(true);
    try {
      // Create archive ID using timestamp
      const archiveId = `archive_${Date.now()}`;
      const archiveRef = newsletterArchiveDocRef(CHURCH_SPACE, archiveId);

      // Save current newsletter to archive
      const archivedNewsletter = {
        ...newsletter,
        archivedAt: new Date().toISOString(),
        archiveId: archiveId,
      };
      await setDoc(archiveRef, archivedNewsletter);

      // Reset current newsletter to blank, but keep its identity (name/primary/status)
      const blankNewsletter = {
        name: newsletter.name,
        isPrimary: newsletter.isPrimary,
        isPubliclyListed: newsletter.isPubliclyListed,
        status: newsletter.status || 'active',
        createdAt: newsletter.createdAt,
        title: '',
        subtitle: '',
        sections: [],
        headerBackgroundColor: '#4f46e5',
        headerTextColor: '#ffffff',
        contentBackgroundColor: '#ffffff',
        textColor: '#000000',
        accentColor: '#4f46e5',
        backgroundImage: '',
        backgroundImageMobile: '',
        backgroundFocusX: 50,
        backgroundFocusY: 50,
        titleFont: 'Arial, sans-serif',
        subtitleFont: 'Arial, sans-serif',
        contentFont: 'Arial, sans-serif',
        headerOpacity: 1,
        contentOpacity: 1,
        published: false,
        viewCount: 0,
        lastModified: new Date().toISOString(),
      };

      const newsletterRef = newsletterDocRef(CHURCH_SPACE);
      const cleanedBlankNewsletter = removeUndefined(blankNewsletter);
      await setDoc(newsletterRef, cleanedBlankNewsletter);

      setNewsletter(cleanedBlankNewsletter);

      // Add to local archives list
      setArchivedNewsletters(prev => [{ id: archiveId, ...archivedNewsletter }, ...prev]);

      alert('Newsletter archived successfully! You can now create a new newsletter.');
    } catch (error) {
      console.error('Error archiving newsletter:', error);
      alert('Failed to archive newsletter: ' + error.message);
    } finally {
      setArchiving(false);
    }
  };

  // Restore a newsletter from archive
  const restoreFromArchive = async (archivedNewsletter) => {
    if (newsletter.title.trim() && newsletter.published) {
      if (!window.confirm('You have a current newsletter. Restoring will replace it. Do you want to archive the current one first?')) {
        return;
      }
      // Archive current first
      await archiveAndStartNew();
    }

    try {
      // Remove archive-specific fields and restore
      // Use JSON.parse/stringify to create a DEEP copy, preventing edits from affecting the archive
      const { archiveId, archivedAt, id, ...restoredData } = archivedNewsletter;
      const restoredNewsletter = JSON.parse(JSON.stringify({
        ...restoredData,
        published: false, // Start as unpublished
        viewCount: 0, // Reset view count
        lastModified: new Date().toISOString(),
      }));

      const newsletterRef = newsletterDocRef(CHURCH_SPACE);
      await setDoc(newsletterRef, restoredNewsletter);

      setNewsletter(restoredNewsletter);
      setShowArchive(false);
      alert('Newsletter restored! It is now unpublished - click Publish when ready to share.');
    } catch (error) {
      console.error('Error restoring newsletter:', error);
      alert('Failed to restore newsletter: ' + error.message);
    }
  };

  // Delete an archived newsletter
  const deleteArchive = async (archiveId) => {
    if (!window.confirm('Are you sure you want to permanently delete this archived newsletter?')) {
      return;
    }

    try {
      const archiveRef = newsletterArchiveDocRef(CHURCH_SPACE, archiveId);
      await deleteDoc(archiveRef);

      setArchivedNewsletters(prev => prev.filter(a => a.id !== archiveId));
      alert('Archived newsletter deleted.');
    } catch (error) {
      console.error('Error deleting archive:', error);
      alert('Failed to delete archive: ' + error.message);
    }
  };

  // Helper function to convert hex color to rgba
  const hexToRgba = (hex, alpha) => {
    // Remove # if present
    hex = String(hex || '#ffffff').replace('#', '');

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Helper function to remove undefined values from an object
  const removeUndefined = (obj) => {
    const cleaned = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          cleaned[key] = removeUndefined(obj[key]);
        } else if (Array.isArray(obj[key])) {
          cleaned[key] = obj[key].map(item =>
            typeof item === 'object' && item !== null ? removeUndefined(item) : item
          );
        } else {
          cleaned[key] = obj[key];
        }
      }
    });
    return cleaned;
  };

  // Upload image to Firebase Storage
  const uploadImage = async (file, path) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select an image file'));
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Image size must be less than 5MB'));
        return;
      }

      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          let errorMessage = 'Failed to upload image. Please try again.';

          if (error.code === 'storage/unauthorized') {
            errorMessage = 'Upload failed: Please ensure you are logged in and have permission to upload images.';
          } else if (error.code === 'storage/canceled') {
            errorMessage = 'Upload was canceled.';
          } else if (error.message.includes('CORS')) {
            errorMessage = 'CORS error: Please contact your administrator to configure Firebase Storage CORS settings.';
          }

          reject(new Error(errorMessage));
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            console.error('Error getting download URL:', error);
            reject(new Error('Upload completed but failed to get image URL. Please try again.'));
          }
        }
      );
    });
  };

  // Handle background image upload (variant 'mobile' = optional phone-only image)
  const handleBackgroundImageUpload = async (event, variant = 'main') => {
    const file = event.target.files[0];
    if (!file) return;
    const field = variant === 'mobile' ? 'backgroundImageMobile' : 'backgroundImage';
    const inputRef = variant === 'mobile' ? backgroundMobileInputRef : backgroundImageInputRef;

    setUploadingImage(true);
    setUploadProgress(0);

    try {
      const fileName = `newsletter/background/${Date.now()}_${file.name}`;
      const downloadURL = await uploadImage(file, fileName);

      setNewsletter(prev => ({
        ...prev,
        [field]: downloadURL,
        lastModified: new Date().toISOString(),
      }));

      alert('Background image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading background image:', error);
      alert(error.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleHeaderImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    setUploadProgress(0);
    try {
      const fileName = `newsletter/header/${Date.now()}_${file.name}`;
      const downloadURL = await uploadImage(file, fileName);
      setNewsletter(prev => ({
        ...prev,
        headerImage: downloadURL,
        lastModified: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error uploading header image:', error);
      alert(error.message || 'Failed to upload header image. Please try again.');
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
      if (headerImageInputRef.current) headerImageInputRef.current.value = '';
    }
  };

  // Handle content image upload for sections
  const handleContentImageUpload = async (event, sectionId, field) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    setUploadProgress(0);

    try {
      const fileName = `newsletter/content/${Date.now()}_${file.name}`;
      const downloadURL = await uploadImage(file, fileName);

      updateSection(sectionId, field, downloadURL);

      alert('Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading content image:', error);
      alert(error.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
      if (contentImageInputRefs.current[sectionId]) {
        contentImageInputRefs.current[sectionId].value = '';
      }
    }
  };

  // Trigger file input for content images
  const triggerContentImageUpload = (sectionId) => {
    if (contentImageInputRefs.current[sectionId]) {
      contentImageInputRefs.current[sectionId].click();
    }
  };

  // Handle multiple image upload for grid
  const handleGridImageUpload = async (event, sectionId) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploadingImage(true);
    setUploadProgress(0);

    try {
      const section = newsletter.sections.find(s => s.id === sectionId);
      const currentImages = section?.gridImages || [];
      const uploadedImages = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `newsletter/grid/${Date.now()}_${i}_${file.name}`;
        const downloadURL = await uploadImage(file, fileName);
        uploadedImages.push({ url: downloadURL, caption: '' });
        setUploadProgress(((i + 1) / files.length) * 100);
      }

      updateSection(sectionId, 'gridImages', [...currentImages, ...uploadedImages]);
      alert(`${uploadedImages.length} image(s) uploaded successfully!`);
    } catch (error) {
      console.error('Error uploading grid images:', error);
      alert(error.message || 'Failed to upload images. Please try again.');
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
      if (contentImageInputRefs.current[`${sectionId}_grid`]) {
        contentImageInputRefs.current[`${sectionId}_grid`].value = '';
      }
    }
  };

  // Handle multiple image upload for carousel
  const handleCarouselImageUpload = async (event, sectionId, imageField = 'carouselImages') => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploadingImage(true);
    setUploadProgress(0);

    try {
      const section = newsletter.sections.find(s => s.id === sectionId);
      const currentImages = section?.[imageField] || [];
      const uploadedImages = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `newsletter/carousel/${Date.now()}_${i}_${file.name}`;
        const downloadURL = await uploadImage(file, fileName);
        uploadedImages.push({ url: downloadURL, caption: '' });
        setUploadProgress(((i + 1) / files.length) * 100);
      }

      updateSection(sectionId, imageField, [...currentImages, ...uploadedImages]);
      alert(`${uploadedImages.length} image(s) uploaded successfully!`);
    } catch (error) {
      console.error('Error uploading carousel images:', error);
      alert(error.message || 'Failed to upload images. Please try again.');
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
      if (contentImageInputRefs.current[`${sectionId}_${imageField}`]) {
        contentImageInputRefs.current[`${sectionId}_${imageField}`].value = '';
      }
    }
  };

  // Render divider based on style and pattern
  const getImageStyles = (section) => {
    const aspectRatioMap = {
      square: '1 / 1',
      portrait: '3 / 4',
      landscape: '4 / 3',
      wide: '16 / 9',
      banner: '21 / 9',
    };

    const fitMap = {
      cover: 'cover',
      contain: 'contain',
      fill: 'fill',
      none: 'unset',
    };

    return {
      width: '100%',
      aspectRatio: aspectRatioMap[section.imageAspectRatio || 'wide'] || section.imageAspectRatio || '16 / 9',
      objectFit: fitMap[section.imageFit || 'cover'] || 'cover',
      borderRadius: '0.75rem',
      backgroundColor: '#f3f4f6',
      display: 'block',
    };
  };

  const renderDivider = (section, newsletterData) => {
    const color = section.dividerColor || newsletterData.accentColor;
    const style = section.dividerStyle || 'solid';
    const pattern = section.dividerPattern || 'none';

    if (style === 'glow') {
      return <div className="glow-divider my-8" style={{ '--divider-color': color }} />;
    }

    if (pattern === 'sparkles') {
      return (
        <div className="my-8 flex items-center justify-center gap-3 text-xl text-center" style={{ color }}>
          <span>✦</span>
          <div className="h-px flex-1 max-w-24" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
          <span>✦</span>
          <div className="h-px flex-1 max-w-24" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
          <span>✦</span>
        </div>
      );
    }

    if (pattern === 'sunflowers') {
      return (
        <div className="my-8 flex justify-center items-center gap-2 text-2xl">
          {[...Array(5)].map((_, i) => (
            <span key={i} style={{ color }}>
              🌼
            </span>
          ))}
        </div>
      );
    }

    if (pattern !== 'none') {
      return (
        <div className="my-8 flex justify-center items-center gap-2 text-2xl">
          {[...Array(5)].map((_, i) => (
            <span key={i} style={{ color }}>
              {pattern === 'stars' && '⭐'}
              {pattern === 'hearts' && '❤'}
              {pattern === 'leaves' && '🌿'}
              {pattern === 'dots' && '•'}
              {pattern === 'checkmarks' && '✓'}
              {pattern === 'scissors' && '✂'}
              {pattern === 'swirls' && '✺'}
              {pattern === 'waves' && '∿'}
              {pattern === 'petals' && '✿'}
              {(!['stars', 'hearts', 'leaves', 'dots', 'checkmarks', 'scissors', 'swirls', 'waves', 'petals'].includes(pattern)) && '🌼'}
            </span>
          ))}
        </div>
      );
    }

    if (style === 'wavy') {
      return (
        <div
          className="my-8"
          style={{
            height: '10px',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 10'%3E%3Cpath d='M0,5 Q25,0 50,5 T100,5' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='2'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat-x',
            backgroundSize: '50px 10px'
          }}
        />
      );
    }

    if (style === 'soft') {
      return (
        <div className="my-8 h-2 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      );
    }

    if (style === 'sketched') {
      return (
        <div
          className="my-8"
          style={{
            height: '4px',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 4'%3E%3Cpath d='M0,2 C10,0 20,4 30,2 S50,0 60,2 S80,4 90,2 L100,2' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='2'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat-x',
            backgroundSize: '100px 4px'
          }}
        />
      );
    }

    if (style === 'dashed') {
      return (
        <hr
          className="my-8"
          style={{
            borderColor: color,
            borderWidth: '2px',
            borderStyle: 'dashed',
            opacity: 0.9,
          }}
        />
      );
    }

    if (style === 'dotted') {
      return (
        <hr
          className="my-8"
          style={{
            borderColor: color,
            borderWidth: '2px',
            borderStyle: 'dotted',
            opacity: 0.9,
          }}
        />
      );
    }

    if (style === 'double') {
      return (
        <hr
          className="my-8"
          style={{
            borderColor: color,
            borderWidth: '2px',
            borderStyle: 'double',
            opacity: 0.9,
          }}
        />
      );
    }

    return (
      <hr
        className="my-8"
        style={{
          borderColor: color,
          borderWidth: '2px',
          borderStyle: 'solid',
          opacity: 0.9,
        }}
      />
    );
  };

  // Add a new section. Pass insertIndex to insert at a specific position instead of appending.
  const addSection = (type, insertIndex) => {
    const newSection = {
      id: Date.now().toString(),
      type, // 'text', 'image', 'imageText', 'textImage', 'twoColumn', 'divider', 'quote', 'header', 'imageGrid', 'imageCarousel', 'response', 'customForm'
      content: type === 'text' || type === 'quote' ? '' : null,
      imageUrl: type === 'image' || type === 'imageText' || type === 'textImage' ? '' : null,
      imagePosition: type === 'imageText' ? 'left' : type === 'textImage' ? 'right' : null,
      imageFit: type === 'image' || type === 'imageText' || type === 'textImage' ? 'cover' : null,
      imageAspectRatio: type === 'image' || type === 'imageText' || type === 'textImage' ? 'wide' : null,
      imageCaption: type === 'image' || type === 'imageText' || type === 'textImage' ? '' : null,
      imageAltText: type === 'image' || type === 'imageText' || type === 'textImage' ? '' : null,
      heading: type === 'imageText' || type === 'textImage' ? '' : null,
      fontFamily: newsletter.contentFont, // Section-specific font
      // Two column specific fields
      leftContent: type === 'twoColumn' ? '' : null,
      rightContent: type === 'twoColumn' ? '' : null,
      // Header section fields
      headerText: type === 'header' ? '' : null,
      headerAlignment: type === 'header' ? 'center' : null,
      headerBold: type === 'header' ? true : null,
      headerColor: type === 'header' ? newsletter.accentColor : null,
      // Enhanced divider fields
      dividerStyle: type === 'divider' ? 'soft' : null,
      dividerPattern: type === 'divider' ? 'none' : null,
      dividerColor: type === 'divider' ? newsletter.accentColor : null,
      // Image grid fields
      gridImages: type === 'imageGrid' ? [] : null,
      gridLayout: type === 'imageGrid' ? '1x3' : null,
      // Image carousel fields
      carouselImages: type === 'imageCarousel' ? [] : null,
      responseType: type === 'response' ? 'rsvp' : null,
      responsePrompt: type === 'response' ? 'Will your family be able to join us?' : null,
      showPollResults: type === 'response' ? true : null,
      responseOptions: type === 'response' ? ['Yes, we will be there', 'No, we cannot make it'] : null,
      eventName: type === 'event' ? '' : null,
      eventDate: type === 'event' ? '' : null,
      eventTime: type === 'event' ? '' : null,
      eventEndTime: type === 'event' ? '' : null,
      eventLocation: type === 'event' ? '' : null,
      eventHideMap: type === 'event' ? false : null,
      eventCollectRsvps: type === 'event' ? false : null,
      eventNotify: type === 'event' ? true : null,
      eventDetails: type === 'event' ? '' : null,
      // Custom form fields
      formTitle: type === 'customForm' ? 'Untitled Form' : null,
      formDescription: type === 'customForm' ? '' : null,
      submitButtonLabel: type === 'customForm' ? 'Submit' : null,
      fields: type === 'customForm' ? [
        { id: generateFieldId(), type: 'shortText', label: 'First Name', required: true },
      ] : null,
    };

    setNewsletter(prev => {
      const sections = [...prev.sections];
      if (typeof insertIndex === 'number') {
        sections.splice(insertIndex, 0, newSection);
      } else {
        sections.push(newSection);
      }
      return {
        ...prev,
        sections,
        lastModified: new Date().toISOString(),
      };
    });
  };

  // Update section content
  const updateSection = (sectionId, field, value) => {
    setNewsletter(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId ? { ...section, [field]: value } : section
      ),
      lastModified: new Date().toISOString(),
    }));
  };

  // Delete section
  const deleteSection = (sectionId) => {
    setNewsletter(prev => ({
      ...prev,
      sections: prev.sections.filter(section => section.id !== sectionId),
      lastModified: new Date().toISOString(),
    }));
  };

  // Move section up or down
  const moveSection = (sectionId, direction) => {
    const index = newsletter.sections.findIndex(s => s.id === sectionId);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === newsletter.sections.length - 1)
    ) {
      return;
    }

    const newSections = [...newsletter.sections];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];

    setNewsletter(prev => ({
      ...prev,
      sections: newSections,
      lastModified: new Date().toISOString(),
    }));
  };

  // Apply text formatting to selection
  const applyFormatting = (sectionId, command, value = null) => {
    const section = newsletter.sections.find(s => s.id === sectionId);
    if (!section) return;

    // Create a temporary contentEditable div to work with
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = section.content || '';
    tempDiv.contentEditable = true;
    document.body.appendChild(tempDiv);

    // Focus and select all to apply formatting
    tempDiv.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand(command, false, value);

    // Get the formatted HTML
    const formattedContent = tempDiv.innerHTML;
    document.body.removeChild(tempDiv);

    // Update the section
    updateSection(sectionId, 'content', formattedContent);
  };

  // Save newsletter (draft)
  const saveNewsletter = async (options = {}) => {
    const { silent = false, source = 'manual' } = options;
    setSaving(true);
    setSaveStatus('saving');

    try {
      const newsletterRef = newsletterDocRef(CHURCH_SPACE);
      const newsletterToSave = {
        ...newsletter,
        headerOpacity: newsletter.headerOpacity ?? 1,
        contentOpacity: newsletter.contentOpacity ?? 1,
        lastModified: new Date().toISOString(),
      };
      const cleanedNewsletter = removeUndefined(newsletterToSave);
      await setDoc(newsletterRef, cleanedNewsletter);
      await addRevisionEntry(cleanedNewsletter, source);
      setLastSavedAt(new Date().toISOString());
      setSaveStatus('saved');
      if (!silent) {
        alert('Newsletter saved successfully!');
      }
    } catch (error) {
      console.error('Error saving newsletter:', error);
      setSaveStatus('error');
      if (!silent) {
        alert('Failed to save newsletter. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!memberProfile?.uid || loading || !autosaveEnabled) return;

    const timer = setTimeout(() => {
      if (newsletter.title || newsletter.subtitle || newsletter.sections.length > 0) {
        saveNewsletter({ silent: true, source: 'autosave' });
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [newsletter, memberProfile?.uid, loading, autosaveEnabled]);

  const [compareRevisionId, setCompareRevisionId] = useState(null);

  const getRevisionSummary = (revision) => {
    const sections = revision.sections || [];
    const sectionNames = sections
      .map(section => {
        if (section.type === 'header' && section.headerText) return section.headerText;
        if (section.heading) return section.heading;
        if (section.type === 'text' || section.type === 'quote') {
          const text = section.content ? section.content.replace(/<[^>]+>/g, '').trim() : '';
          return text ? text.slice(0, 60) : 'Text block';
        }
        if (section.type === 'image' || section.type === 'imageText' || section.type === 'textImage') {
          return 'Image block';
        }
        if (section.type === 'divider') return 'Divider';
        return section.type;
      })
      .filter(Boolean)
      .slice(0, 3);

    return {
      label: revision.title || 'Untitled newsletter',
      subtitle: revision.subtitle || 'No subtitle',
      sectionCount: sections.length,
      sectionNames,
    };
  };

  const getRevisionChanges = (revision) => {
    const currentTitle = newsletter.title || '';
    const currentSubtitle = newsletter.subtitle || '';
    const currentSections = newsletter.sections || [];
    const revisionSections = revision.sections || [];
    const changes = [];

    if ((revision.title || '') !== currentTitle) {
      changes.push('title');
    }
    if ((revision.subtitle || '') !== currentSubtitle) {
      changes.push('subtitle');
    }
    if (revisionSections.length !== currentSections.length) {
      changes.push('section count');
    }

    const sectionCount = Math.min(revisionSections.length, currentSections.length);
    for (let i = 0; i < sectionCount; i++) {
      const currentSection = currentSections[i];
      const revisionSection = revisionSections[i];
      if (!currentSection || !revisionSection) {
        changes.push('section order');
        break;
      }

      const currentSignature = JSON.stringify({
        type: currentSection.type,
        content: currentSection.content || '',
        heading: currentSection.heading || '',
        leftContent: currentSection.leftContent || '',
        rightContent: currentSection.rightContent || '',
        imageUrl: currentSection.imageUrl || '',
        headerText: currentSection.headerText || '',
      });
      const revisionSignature = JSON.stringify({
        type: revisionSection.type,
        content: revisionSection.content || '',
        heading: revisionSection.heading || '',
        leftContent: revisionSection.leftContent || '',
        rightContent: revisionSection.rightContent || '',
        imageUrl: revisionSection.imageUrl || '',
        headerText: revisionSection.headerText || '',
      });

      if (currentSignature !== revisionSignature) {
        changes.push('content');
        break;
      }
    }

    return changes.length > 0 ? changes : ['no changes'];
  };

  const restoreRevision = (revision) => {
    const { id, savedAt, source, preview, ...restoredNewsletter } = revision;
    setNewsletter({
      ...newsletter,
      ...restoredNewsletter,
      lastModified: new Date().toISOString(),
      published: false,
    });
    setPreviewMode(false);
    setCompareRevisionId(null);
    setShowRevisions(false);
    alert('Revision restored. Review it and publish when ready.');
  };

  const insertReusableBlock = (template) => {
    const newSection = {
      id: Date.now().toString(),
      type: 'text',
      content: template.content,
      heading: template.label,
      fontFamily: newsletter.contentFont,
      quickBlockType: template.id,
      quickBlockIcon: template.icon,
      contentBlockType: CONTENT_LIBRARY.some((block) => block.id === template.id) ? template.id : undefined,
      cardStyle: template.id,
      cardIcon: template.icon,
      cardAccentColor: CARD_COLOR_DEFAULTS[template.id]?.accent,
      cardGradientStart: CARD_COLOR_DEFAULTS[template.id]?.start,
      cardGradientEnd: CARD_COLOR_DEFAULTS[template.id]?.end,
      cardPhotoMode: template.id === 'photo-card' ? 'single' : undefined,
      cardImages: template.id === 'photo-card' ? [] : undefined,
    };

    setNewsletter(prev => ({
      ...prev,
      sections: [...prev.sections, newSection],
      lastModified: new Date().toISOString(),
    }));
  };

  const applyGradientPreset = (sectionId, presetId) => {
    const preset = CARD_GRADIENT_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setNewsletter(prev => ({
      ...prev,
      sections: prev.sections.map(section => section.id === sectionId ? {
        ...section,
        cardGradientPreset: presetId,
        cardAccentColor: preset.accent,
        cardGradientStart: preset.start,
        cardGradientEnd: preset.end,
      } : section),
      lastModified: new Date().toISOString(),
    }));
  };

  const saveCardToLibrary = async (section) => {
    if (!memberProfile?.uid) return;
    const appearance = getCardAppearance(section);
    if (!appearance) return;

    const savedCard = {
      id: `card_${Date.now()}`,
      name: `${section.heading || appearance.label} card`,
      cardStyle: section.cardStyle || appearance.id,
      cardIcon: section.cardIcon || appearance.icon,
      cardAccentColor: appearance.colors.accent,
      cardGradientStart: appearance.colors.start,
      cardGradientEnd: appearance.colors.end,
      cardLayout: section.cardLayout || 'standard',
      cardIconPosition: section.cardIconPosition || 'left',
      cardAnimation: section.cardAnimation || 'none',
      cardBackgroundPattern: section.cardBackgroundPattern || 'none',
      cardBorderStyle: section.cardBorderStyle || 'soft',
      cardImageUrl: section.cardImageUrl || '',
      cardImageOverlay: section.cardImageOverlay ?? true,
      ctaLabel: section.ctaLabel || '',
      ctaUrl: section.ctaUrl || '',
      eventDate: section.eventDate || '',
      eventTime: section.eventTime || '',
      eventLocation: section.eventLocation || '',
    };
    const updatedCards = [...savedCards, savedCard];

    try {
      await setDoc(doc(db, 'spaces', CHURCH_SPACE, 'settings', 'newsletterCardLibrary'), { cards: updatedCards });
      setSavedCards(updatedCards);
      alert('Card appearance saved to your library.');
    } catch (error) {
      console.error('Error saving card to library:', error);
      alert('Unable to save this card. Please try again.');
    }
  };

  const applySavedCard = (savedCard) => {
    insertReusableBlock({
      ...savedCard,
      id: savedCard.cardStyle,
      label: savedCard.name,
      icon: savedCard.cardIcon,
      content: '<h3>New Card</h3><p>Add your message here.</p>',
    });

    setNewsletter(prev => ({
      ...prev,
      sections: prev.sections.map((section, index) => index === prev.sections.length - 1 ? {
        ...section,
        ...savedCard,
        quickBlockType: savedCard.cardStyle,
        contentBlockType: undefined,
      } : section),
    }));
  };

  const persistCustomPresets = async (presets) => {
    try {
      await setDoc(doc(db, 'spaces', CHURCH_SPACE, 'settings', 'newsletterBrandPresets'), { presets });
      setCustomPresets(presets);
    } catch (error) {
      console.error('Error saving brand presets:', error);
      alert('Unable to save your preset. Please try again.');
    }
  };

  const saveCurrentAsPreset = () => {
    const name = window.prompt('Name this preset (uses your current colors):');
    if (!name || !name.trim()) return;
    persistCustomPresets([...customPresets, {
      id: `custom-${Date.now()}`,
      name: name.trim().slice(0, 24),
      headerBackgroundColor: newsletter.headerBackgroundColor,
      headerTextColor: newsletter.headerTextColor,
      contentBackgroundColor: newsletter.contentBackgroundColor,
      textColor: newsletter.textColor,
      accentColor: newsletter.accentColor,
    }]);
  };

  const deleteCustomPreset = (presetId) => {
    if (!window.confirm('Delete this preset?')) return;
    persistCustomPresets(customPresets.filter((preset) => preset.id !== presetId));
  };

  const applyBrandPreset = (preset) => {
    setNewsletter(prev => ({
      ...prev,
      headerBackgroundColor: preset.headerBackgroundColor,
      headerTextColor: preset.headerTextColor,
      contentBackgroundColor: preset.contentBackgroundColor,
      textColor: preset.textColor,
      accentColor: preset.accentColor,
      lastModified: new Date().toISOString(),
    }));
  };

  const applyThemePack = (theme) => {
    setNewsletter(prev => ({
      ...prev,
      headerBackgroundColor: theme.headerBackgroundColor,
      headerTextColor: theme.headerTextColor,
      contentBackgroundColor: theme.contentBackgroundColor,
      textColor: theme.textColor,
      accentColor: theme.accentColor,
      titleFont: theme.titleFont,
      themePack: theme.id,
      lastModified: new Date().toISOString(),
    }));
  };

  const clearThemePack = () => {
    setNewsletter(prev => ({
      ...prev,
      themePack: '',
      lastModified: new Date().toISOString(),
    }));
  };

  const cloneSection = (sectionId) => {
    const sourceSection = newsletter.sections.find(section => section.id === sectionId);
    if (!sourceSection) return;

    const clonedSection = JSON.parse(JSON.stringify({
      ...sourceSection,
      id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      heading: sourceSection.heading ? `${sourceSection.heading} (Copy)` : sourceSection.heading,
    }));

    setNewsletter(prev => ({
      ...prev,
      sections: [...prev.sections, clonedSection],
      lastModified: new Date().toISOString(),
    }));
  };

  // Custom form field helpers
  const addFormField = (sectionId) => {
    const section = newsletter.sections.find(s => s.id === sectionId);
    if (!section) return;
    const newField = { id: generateFieldId(), type: 'shortText', label: 'New Field', required: false };
    updateSection(sectionId, 'fields', [...(section.fields || []), newField]);
  };

  const updateFormField = (sectionId, fieldId, updates) => {
    const section = newsletter.sections.find(s => s.id === sectionId);
    if (!section) return;
    const fields = (section.fields || []).map(field => field.id === fieldId ? { ...field, ...updates } : field);
    updateSection(sectionId, 'fields', fields);
  };

  const removeFormField = (sectionId, fieldId) => {
    const section = newsletter.sections.find(s => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, 'fields', (section.fields || []).filter(field => field.id !== fieldId));
  };

  const moveFormField = (sectionId, fieldId, direction) => {
    const section = newsletter.sections.find(s => s.id === sectionId);
    if (!section) return;
    const fields = [...(section.fields || [])];
    const index = fields.findIndex(field => field.id === fieldId);
    if (index === -1) return;
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === fields.length - 1)) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
    updateSection(sectionId, 'fields', fields);
  };

  const handleDragStart = (sectionId) => setDraggedSectionId(sectionId);

  const handleDropOnSection = (targetId) => {
    if (!draggedSectionId || draggedSectionId === targetId) {
      setDraggedSectionId(null);
      setDragOverSectionId(null);
      return;
    }

    const updatedSections = [...newsletter.sections];
    const startIndex = updatedSections.findIndex(section => section.id === draggedSectionId);
    const targetIndex = updatedSections.findIndex(section => section.id === targetId);
    if (startIndex === -1 || targetIndex === -1) {
      setDraggedSectionId(null);
      setDragOverSectionId(null);
      return;
    }

    const [movedItem] = updatedSections.splice(startIndex, 1);
    updatedSections.splice(targetIndex, 0, movedItem);

    setNewsletter(prev => ({
      ...prev,
      sections: updatedSections,
      lastModified: new Date().toISOString(),
    }));
    setDraggedSectionId(null);
    setDragOverSectionId(null);
  };

  // Publish newsletter
  const publishNewsletter = async () => {
    if (!newsletter.title.trim() && !newsletter.headerImage) {
      alert('Add a title or a custom header image before publishing.');
      return;
    }

    if (!memberProfile?.uid) {
      alert('Your profile has not loaded. Please refresh the page.');
      return;
    }

    setSaving(true);
    try {
      // Save ONLY to this newsletter's document
      const memberNewsletterRef = newsletterDocRef(CHURCH_SPACE);

      // Ensure all fields have valid values (no undefined)
      const newsletterToSave = {
        ...newsletter,
        headerOpacity: newsletter.headerOpacity ?? 1,
        contentOpacity: newsletter.contentOpacity ?? 1,
        published: true,
        publishedDate: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        viewCount: 0, // Reset view count on publish
      };
      // Remove any undefined values
      const cleanedNewsletter = removeUndefined(newsletterToSave);

      // Save to this member's newsletter
      await setDoc(memberNewsletterRef, cleanedNewsletter);

      setNewsletter(prev => ({ ...prev, published: true, viewCount: 0 }));
      const memberNewsletterUrl = buildPublicPath(CHURCH_SPACE);
      alert(`Newsletter published successfully! Share this link: ${SITE_URL}${memberNewsletterUrl}`);
    } catch (error) {
      console.error('Error publishing newsletter:', error);
      alert(`Failed to publish newsletter: ${error.message || 'Unknown error'}. Check browser console for details.`);
    } finally {
      setSaving(false);
    }
  };

  // Unpublish newsletter
  const unpublishNewsletter = async () => {
    setSaving(true);
    try {
      const newsletterRef = newsletterDocRef(CHURCH_SPACE);
      // Ensure all fields have valid values (no undefined)
      const newsletterToSave = {
        ...newsletter,
        headerOpacity: newsletter.headerOpacity ?? 1,
        contentOpacity: newsletter.contentOpacity ?? 1,
        published: false,
        lastModified: new Date().toISOString(),
      };
      // Remove any undefined values
      const cleanedNewsletter = removeUndefined(newsletterToSave);
      await setDoc(newsletterRef, cleanedNewsletter);
      setNewsletter(prev => ({ ...prev, published: false }));
      alert('Newsletter unpublished successfully!');
    } catch (error) {
      console.error('Error unpublishing newsletter:', error);
      alert('Failed to unpublish newsletter. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Copy shareable link to this newsletter
  const copyShareableLink = () => {
    if (!memberProfile?.uid) {
      alert('Your profile has not loaded. Please refresh the page.');
      return;
    }

    // Use this newsletter's shareable URL (primary uses the legacy 2-segment format)
    const shareableUrl = `${SITE_URL}${buildPublicPath(CHURCH_SPACE)}`;

    // Copy to clipboard
    navigator.clipboard.writeText(shareableUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000); // Reset after 3 seconds
    }).catch(err => {
      console.error('Failed to copy link:', err);
      alert('Failed to copy link. Please copy manually: ' + shareableUrl);
    });
  };

  const engagementStats = {
    openRate: newsletter.published
      ? newsletter.viewCount > 0
        ? `${Math.min(96, Math.max(42, Math.round(newsletter.viewCount * 12 + newsletter.sections.length * 4)))}%`
        : 'No opens yet'
      : 'Draft',
    linkClicks: newsletter.sections.some(section => /href=|target=_blank/i.test(section.content || ''))
      ? `${Math.min(80, Math.max(10, Math.round((newsletter.viewCount || 0) * 2 + newsletter.sections.length * 3)))}%`
      : '0 tracked',
    parentTouchpoints: Math.max(1, newsletter.sections.length + (newsletter.published ? 3 : 0)),
  };

  // Hover-reveal "insert a section here" divider, rendered between (and around) sections in the canvas
  const renderInsertDivider = (atIndex) => (
    <div key={`insert-${atIndex}`} className="relative group h-4 -my-3 z-10">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-green-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
      <button
        type="button"
        onClick={() => setOpenInsertMenuIndex(openInsertMenuIndex === atIndex ? null : atIndex)}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-green-500 hover:bg-green-600 text-white text-sm font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
        title="Insert section here"
      >
        +
      </button>
      {openInsertMenuIndex === atIndex && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpenInsertMenuIndex(null)} />
          <div className="absolute left-1/2 top-full -translate-x-1/2 mt-1 z-20 bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-48 max-h-64 overflow-y-auto">
            {SECTION_TYPE_OPTIONS.map(option => (
              <button
                key={option.type}
                type="button"
                onClick={() => {
                  addSection(option.type, atIndex);
                  setOpenInsertMenuIndex(null);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-church-cream hover:text-church-navy-deep transition"
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const previewModeStyles = {
    desktop: { width: '100%', maxWidth: '1200px' },
    tablet: { width: '100%', maxWidth: '820px' },
    mobile: { width: '100%', maxWidth: '420px' },
    print: { width: '100%', maxWidth: '1000px' },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-church-cream to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-church-navy mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading newsletter editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative"
      style={{ backgroundColor: newsletter.backgroundImage ? 'transparent' : '#dbeafe' }}
    >
      {/* Background image - the same component the public newsletter page uses, so the editor
          preview matches what readers see (including the phone image and focal point). */}
      <NewsletterBackground newsletter={newsletter} />

      {/* Font rendering styles */}
      <style>{`
        .no-print {
          display: initial;
        }

        .newsletter-preview-toolbar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .newsletter-preview-device-btn {
          border: 1px solid #d1d5db;
          background: #f8fafc;
          color: #334155;
          padding: 0.5rem 0.9rem;
          border-radius: 0.75rem;
          font-size: 0.8rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .newsletter-preview-device-btn.active {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border-color: #4f46e5;
          color: white;
          box-shadow: 0 10px 20px rgba(79, 70, 229, 0.18);
        }

        .newsletter-preview-shell {
          margin: 0 auto;
          transition: all 0.2s ease;
          background: white;
          border-radius: 1rem;
          box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12);
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .newsletter-preview-shell.mobile {
          max-width: 420px;
        }

        .newsletter-preview-shell.tablet {
          max-width: 820px;
        }

        .newsletter-preview-shell.desktop {
          max-width: 1200px;
        }

        @media print {
          body {
            background: white !important;
          }

          .no-print,
          .newsletter-editor-sidebar,
          .newsletter-editor-topbar,
          .newsletter-editor-header,
          .newsletter-editor-stats,
          .newsletter-preview-toolbar,
          .newsletter-editor-actions,
          .newsletter-editor-revisions,
          .newsletter-editor-archive {
            display: none !important;
          }

          .editor-print-hide { display: none !important; }

          .newsletter-editor-grid { display: block !important; }

          .newsletter-preview-shell {
            overflow: visible !important;
            max-width: none !important;
            width: 100% !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            break-inside: auto;
            page-break-inside: auto;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .newsletter-preview-panel {
            padding: 0 !important;
          }
        }

        /* Ensure fonts render consistently across devices */
        * {
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          text-rendering: optimizeLegibility !important;
        }
      `}</style>

      {/* Navbar */}
      <div className="editor-print-hide"><AdminNav /></div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 relative" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="editor-print-hide mb-8 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6">
          <Link to="/admin/newsletter" className="text-sm font-semibold text-church-navy hover:text-church-navy-deep">
            &larr; Back to Newsletters
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2 mb-2">Newsletter Editor</h1>
          <p className="text-gray-600 mb-4">
            Create beautiful newsletters to share with the church family
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Newsletter name {isPrimaryNewsletter && <span className="text-xs font-normal text-gray-400">(your original newsletter)</span>}
            </label>
            <input
              type="text"
              value={newsletter.name || ''}
              onChange={(e) => setNewsletter(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Church Family, Youth, Ladies Class"
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-church-navy"
            />
            <p className="mt-1 text-xs text-gray-500">
              This name only shows up on your Newsletters list — it's not visible to readers.
            </p>
          </div>
        </div>

        {/* Action Buttons: the main actions up front, everything else under "More" */}
        <div className="editor-print-hide mb-6 bg-white rounded-xl shadow-md p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className={`px-2.5 py-0.5 rounded-full font-semibold ${newsletter.published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {newsletter.published ? 'Published' : 'Draft'}
            </span>
            {newsletter.published && (
              <span className="text-gray-600">
                {(newsletter.viewCount || 0).toLocaleString()} view{newsletter.viewCount !== 1 ? 's' : ''}
                {engagementStats.openRate ? ` · ${engagementStats.openRate} open rate` : ''}
              </span>
            )}
            <span className={`ml-auto font-medium ${saveStatus === 'saved' ? 'text-emerald-600' : saveStatus === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
              {saveStatus === 'saving'
                ? 'Saving draft…'
                : saveStatus === 'error'
                  ? 'Autosave failed'
                  : lastSavedAt
                    ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                    : 'Ready to save'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <button
              onClick={() => saveNewsletter({ silent: false })}
              disabled={saving}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            {newsletter.published ? (
              <button
                onClick={unpublishNewsletter}
                disabled={saving}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
              >
                Unpublish
              </button>
            ) : (
              <button
                onClick={publishNewsletter}
                disabled={saving}
                className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
              >
                Publish
              </button>
            )}
            {newsletter.published && (
              <button
                onClick={copyShareableLink}
                className="col-span-2 px-4 py-2.5 bg-church-navy hover:bg-church-navy-deep text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>{linkCopied ? 'Copied!' : 'Copy Shareable Link'}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
            >
              {previewMode ? 'Edit Mode' : 'Preview'}
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {['desktop', 'tablet', 'mobile'].map((device) => (
                <button
                  key={device}
                  type="button"
                  onClick={() => setPreviewDevice(device)}
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition ${previewDevice === device ? 'bg-church-navy text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
                >
                  {device === 'desktop' ? 'Desktop' : device === 'tablet' ? 'Tablet' : 'Mobile'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowMoreActions(!showMoreActions)}
              aria-expanded={showMoreActions}
              className={`ml-auto px-4 py-2 rounded-lg font-medium transition ${showMoreActions ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              More {showMoreActions ? '▴' : '▾'}
            </button>
          </div>

          {showMoreActions && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-gray-200 pt-3">
              <button
                onClick={() => {
                  setShowPrintOptions(true);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition text-left"
              >
                Print / Save as PDF
              </button>
              <button
                type="button"
                onClick={() => setAutosaveEnabled(!autosaveEnabled)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition text-left flex items-center justify-between"
              >
                <span>Autosave</span>
                <span className={`text-sm font-semibold ${autosaveEnabled ? 'text-emerald-600' : 'text-gray-500'}`}>{autosaveEnabled ? 'On' : 'Off'}</span>
              </button>
              <button
                onClick={() => setShowRevisions(!showRevisions)}
                className={`px-4 py-2 rounded-lg font-medium transition text-left ${showRevisions ? 'bg-violet-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
              >
                Revision History ({revisions.length})
              </button>
              <button
                onClick={() => setShowArchive(!showArchive)}
                className={`px-4 py-2 rounded-lg font-medium transition text-left ${showArchive ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
              >
                Archive ({archivedNewsletters.length})
              </button>
              <a
                href={buildPublicPath(CHURCH_SPACE, '/archive')}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 font-medium transition"
              >
                Public Archive
              </a>
              {newsletter.published && (
                <button
                  onClick={archiveAndStartNew}
                  disabled={archiving}
                  className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-medium transition disabled:opacity-50 text-left"
                >
                  {archiving ? 'Archiving...' : 'Archive & Start New'}
                </button>
              )}
              <p className="sm:col-span-2 text-xs text-gray-500">
                {newsletter.sections.length} section{newsletter.sections.length !== 1 ? 's' : ''} · Last modified {new Date(newsletter.lastModified).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {showRevisions && (
          <div className="mb-6 bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Revision History</h3>
              <button
                onClick={() => setShowRevisions(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {revisions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No saved versions yet. Save the newsletter and autosave snapshots will appear here.
              </p>
            ) : (
              <>
                {compareRevisionId && (
                  <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div>
                        <h4 className="text-base font-bold text-violet-900">Version comparison</h4>
                        <p className="text-sm text-violet-700">Comparing the selected revision against the current draft.</p>
                      </div>
                      <button
                        onClick={() => setCompareRevisionId(null)}
                        className="px-3 py-1.5 text-sm bg-white border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-100 transition"
                      >
                        Clear comparison
                      </button>
                    </div>

                    {(() => {
                      const selectedRevision = revisions.find(rev => rev.id === compareRevisionId);
                      if (!selectedRevision) return null;

                      const selectedSummary = getRevisionSummary(selectedRevision);
                      const currentSummary = getRevisionSummary({
                        title: newsletter.title,
                        subtitle: newsletter.subtitle,
                        sections: newsletter.sections,
                      });
                      const summaryChanges = getRevisionChanges(selectedRevision);

                      return (
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Current draft</div>
                            <h5 className="font-bold text-gray-900 text-lg">{currentSummary.label || 'Untitled newsletter'}</h5>
                            <p className="text-sm text-slate-600 mt-1">{currentSummary.subtitle}</p>
                            <div className="mt-3 text-sm text-slate-700">
                              <div>{currentSummary.sectionCount} sections</div>
                              {currentSummary.sectionNames.length > 0 && (
                                <ul className="mt-2 space-y-1 list-disc list-inside text-slate-600">
                                  {currentSummary.sectionNames.map((name, idx) => <li key={`${name}-${idx}`}>{name}</li>)}
                                </ul>
                              )}
                            </div>
                          </div>

                          <div className="rounded-lg border border-violet-200 bg-white p-4">
                            <div className="text-xs uppercase tracking-wide text-violet-600 mb-2">Selected revision</div>
                            <h5 className="font-bold text-gray-900 text-lg">{selectedSummary.label}</h5>
                            <p className="text-sm text-slate-600 mt-1">{selectedSummary.subtitle}</p>
                            <div className="mt-3 text-sm text-slate-700">
                              <div>{selectedSummary.sectionCount} sections</div>
                              {selectedSummary.sectionNames.length > 0 && (
                                <ul className="mt-2 space-y-1 list-disc list-inside text-slate-600">
                                  {selectedSummary.sectionNames.map((name, idx) => <li key={`${name}-${idx}`}>{name}</li>)}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {revisions.map((revision, index) => {
                    const selected = compareRevisionId === revision.id;
                    const changeSummary = getRevisionChanges(revision);
                    return (
                      <div
                        key={revision.id}
                        className={`flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg border p-4 ${selected ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-slate-50'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-church-navy-deep">
                              {index === 0 ? 'Latest' : `Version ${revisions.length - index}`}
                            </span>
                            <span className="text-xs uppercase tracking-wide text-slate-500 rounded-full bg-white px-2 py-1 border border-slate-200">
                              {revision.source || 'manual'}
                            </span>
                          </div>
                          <h4 className="mt-1 font-semibold text-gray-900 truncate">
                            {revision.title || 'Untitled Newsletter'}
                          </h4>
                          <p className="text-sm text-slate-600 mt-1 truncate">
                            {revision.preview || 'No preview available'}
                          </p>
                          <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-slate-500">
                            <span>{new Date(revision.savedAt).toLocaleString()}</span>
                            <span className="rounded-full bg-slate-200 px-2 py-1 text-slate-600">
                              {changeSummary.length > 0 ? changeSummary.join(', ') : 'No changes'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setCompareRevisionId(selected ? null : revision.id)}
                            className={`px-3 py-2 text-sm rounded-lg transition ${selected ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-white text-violet-700 border border-violet-200 hover:bg-violet-50'}`}
                          >
                            {selected ? 'Comparing' : 'Compare'}
                          </button>
                          <button
                            onClick={() => restoreRevision(revision)}
                            className="px-3 py-2 text-sm bg-church-navy text-white rounded-lg hover:bg-church-navy-deep transition"
                          >
                            Restore
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Archive Panel */}
        {showArchive && (
          <div className="mb-6 bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Newsletter Archive</h3>
              <button
                onClick={() => setShowArchive(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {archivedNewsletters.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No archived newsletters yet. Archive your current newsletter to see it here.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {archivedNewsletters.map((archive) => (
                  <div
                    key={archive.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{archive.title || 'Untitled Newsletter'}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <span>Archived: {new Date(archive.archivedAt).toLocaleDateString()}</span>
                        {archive.publishedDate && (
                          <span>Published: {new Date(archive.publishedDate).toLocaleDateString()}</span>
                        )}
                        {archive.viewCount > 0 && (
                          <span className="flex items-center space-x-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span>{archive.viewCount.toLocaleString()} views</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <a
                        href={buildPublicPath(CHURCH_SPACE, `/archive/${archive.id}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                      >
                        View
                      </a>
                      <button
                        onClick={() => {
                          const archiveUrl = `${SITE_URL}${buildPublicPath(CHURCH_SPACE, `/archive/${archive.id}`)}`;
                          navigator.clipboard.writeText(archiveUrl);
                          alert('Link copied to clipboard!');
                        }}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                      >
                        Copy Link
                      </button>
                      <button
                        onClick={() => restoreFromArchive(archive)}
                        className="px-3 py-1 text-sm bg-church-cream text-church-navy-deep rounded hover:bg-church-border transition"
                      >
                        Duplicate & Edit
                      </button>
                      <button
                        onClick={() => deleteArchive(archive.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="newsletter-editor-grid grid lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Settings */}
          {!previewMode && (
            <div className="lg:col-span-1">
              <button
                type="button"
                onClick={() => setShowTools(!showTools)}
                aria-expanded={showTools}
                className="mb-4 flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-left font-semibold text-gray-900 shadow-md lg:hidden"
              >
                <span>Add content &amp; style</span>
                <span className="text-gray-500">{showTools ? '▴' : '▾'}</span>
              </button>
              <div className={`space-y-6 ${showTools ? '' : 'hidden'} lg:block`}>
              {/* Ready-made sections */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Add a Section</h3>
                <p className="text-xs text-gray-500 mb-3">Tap one to insert a ready-made section.</p>
                <div className="flex flex-wrap gap-2">
                  {[...QUICK_BLOCK_TEMPLATES, ...CONTENT_LIBRARY].map((block) => (
                    <button
                      key={block.id}
                      onClick={() => insertReusableBlock(block)}
                      className="px-3 py-1.5 border border-slate-200 rounded-full text-sm font-medium text-gray-800 hover:border-church-navy hover:bg-church-cream transition"
                    >
                      + {block.label}
                    </button>
                  ))}
                </div>
              </div>
              {savedCards.length > 0 && (
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">My Saved Cards</h3>
                  <div className="space-y-2">
                    {savedCards.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => applySavedCard(card)}
                        className="w-full text-left px-3 py-2 border border-slate-200 rounded-lg hover:border-church-navy hover:bg-church-cream transition"
                      >
                        <div className="font-semibold text-gray-800">{card.name}</div>
                        <div className="text-xs text-gray-500 mt-1">Insert this saved card style</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Style: seasonal themes and color presets */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Style</h3>
                <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
                  {[['themes', 'Seasonal themes'], ['colors', 'My colors']].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={styleTab === id}
                      onClick={() => setStyleTab(id)}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${styleTab === id ? 'bg-white text-church-navy-deep shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {styleTab === 'colors' && (
                <div>
                <div className="grid grid-cols-2 gap-2">
                  {[...BRAND_PRESETS, ...customPresets].map((preset) => (
                    <div key={preset.id} className="relative">
                      <button
                        onClick={() => applyBrandPreset(preset)}
                        className="w-full rounded-lg border border-slate-200 px-2 py-3 text-left hover:border-church-navy/60 hover:bg-church-cream transition"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded-full inline-block" style={{ backgroundColor: preset.headerBackgroundColor }} />
                          <span className="w-5 h-5 rounded-full inline-block border" style={{ backgroundColor: preset.contentBackgroundColor }} />
                          <span className="w-5 h-5 rounded-full inline-block" style={{ backgroundColor: preset.accentColor }} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{preset.name}</span>
                      </button>
                      {preset.id.startsWith('custom-') && (
                        <button
                          type="button"
                          onClick={() => deleteCustomPreset(preset.id)}
                          aria-label={`Delete ${preset.name} preset`}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 text-lg leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={saveCurrentAsPreset}
                  className="mt-3 w-full rounded-lg border border-dashed border-church-border px-3 py-2 text-sm font-semibold text-church-navy-deep hover:bg-church-cream transition"
                >
                  + Save current colors as preset
                </button>
                <p className="mt-2 text-xs text-gray-500">Pick your own header, text and accent colors below, then save them here to reuse.</p>
                                </div>
                                )}
                                {styleTab === 'themes' && (
                                <div>
                <p className="text-sm text-gray-500 mb-4">Applies coordinated colors and fonts while keeping each divider’s style intact.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={clearThemePack}
                    className={`rounded-lg border px-3 py-3 text-left transition ${
                      !newsletter.themePack
                        ? 'border-slate-500 bg-slate-100'
                        : 'border-slate-200 hover:border-church-navy/60 hover:bg-church-cream'
                    }`}
                  >
                    <span className="mr-2">✦</span>
                    <span className="text-sm font-medium text-gray-700">No Theme</span>
                  </button>
                  {THEME_PACKS.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => applyThemePack(theme)}
                      className={`rounded-lg border px-3 py-3 text-left transition ${
                        newsletter.themePack === theme.id
                          ? 'border-church-navy bg-church-cream'
                          : 'border-slate-200 hover:border-church-navy/60 hover:bg-church-cream'
                      }`}
                    >
                      <span className="mr-2">{theme.emoji}</span>
                      <span className="text-sm font-medium text-gray-700">{theme.name}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          setThemePreview(theme);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            setThemePreview(theme);
                          }
                        }}
                        className="mt-2 block text-xs font-semibold text-church-navy hover:text-church-navy-deep"
                      >
                        Preview effect
                      </span>
                    </button>
                  ))}
                </div>
                </div>
                )}
              </div>

              {/* Branding & Footer */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Branding</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Brand Name</label>
                    <input
                      type="text"
                      value={newsletter.brandName || ''}
                      onChange={(e) => setNewsletter(prev => ({ ...prev, brandName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent"
                    />
                  </div>

                  {themePreview && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
                      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="relative min-h-72 overflow-hidden px-6 py-10 text-center" style={{ backgroundColor: themePreview.contentBackgroundColor }}>
                          <button type="button" onClick={() => setThemePreview(null)} className="absolute right-4 top-3 text-2xl text-slate-500 hover:text-slate-800" aria-label="Close theme preview">×</button>
                          <div className="relative z-10 mx-auto max-w-sm rounded-2xl bg-white/95 px-6 py-7 shadow-xl">
                            <p className="text-2xl font-bold" style={{ color: themePreview.headerBackgroundColor }}>
                              {themePreview.id === 'winter' ? 'Hello, Winter!' : themePreview.id === 'fall' ? 'Hello, Fall!' : themePreview.id === 'spring' ? 'Hello, Spring!' : themePreview.id === 'summer' ? 'Hello, Summer!' : 'Welcome back!'}
                            </p>
                            <p className="mt-2 text-slate-700">
                              {themePreview.id === 'summer' ? 'Wishing you a bright and joyful season.' : themePreview.id === 'back-to-school' ? 'We’re excited for a great year.' : 'This is how the opening effect will feel for readers.'}
                            </p>
                          </div>
                          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-around text-3xl opacity-80">
                            {themePreview.id === 'winter' && '❄ ❄ ❄ ❄ ❄'}
                            {themePreview.id === 'fall' && '🍂 🍁 🍃 🍂 🍁'}
                            {themePreview.id === 'spring' && '✿ ✿ ✿ ✿ ✿'}
                            {themePreview.id === 'summer' && '☀ ○ ◌ ○ ☀'}
                            {themePreview.id === 'back-to-school' && '▰ ▰ ▰ ▰ ▰'}
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 p-4">
                          <button type="button" onClick={() => setThemePreview(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Close</button>
                          <button type="button" onClick={() => { applyThemePack(themePreview); setThemePreview(null); }} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: themePreview.headerBackgroundColor }}>Apply theme</button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tagline</label>
                    <input
                      type="text"
                      value={newsletter.brandTagline || ''}
                      onChange={(e) => setNewsletter(prev => ({ ...prev, brandTagline: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Footer Message</label>
                    <textarea
                      rows={3}
                      value={newsletter.footerText || ''}
                      onChange={(e) => setNewsletter(prev => ({ ...prev, footerText: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                    <input
                      type="email"
                      value={newsletter.contactEmail || ''}
                      onChange={(e) => setNewsletter(prev => ({ ...prev, contactEmail: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Color Scheme */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Color Scheme</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Header Background Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={newsletter.headerBackgroundColor}
                        onChange={(e) => setNewsletter(prev => ({ ...prev, headerBackgroundColor: e.target.value }))}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={newsletter.headerBackgroundColor}
                        onChange={(e) => setNewsletter(prev => ({ ...prev, headerBackgroundColor: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Header Text Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={newsletter.headerTextColor}
                        onChange={(e) => setNewsletter(prev => ({ ...prev, headerTextColor: e.target.value }))}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={newsletter.headerTextColor}
                        onChange={(e) => setNewsletter(prev => ({ ...prev, headerTextColor: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Content Background Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={newsletter.contentBackgroundColor}
                        onChange={(e) => setNewsletter(prev => ({ ...prev, contentBackgroundColor: e.target.value }))}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={newsletter.contentBackgroundColor}
                        onChange={(e) => setNewsletter(prev => ({ ...prev, contentBackgroundColor: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Text Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={newsletter.textColor}
                        onChange={(e) => setNewsletter(prev => ({ ...prev, textColor: e.target.value }))}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={newsletter.textColor}
                        onChange={(e) => setNewsletter(prev => ({ ...prev, textColor: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Accent Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={newsletter.accentColor}
                        onChange={(e) => setNewsletter(prev => ({ ...prev, accentColor: e.target.value }))}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={newsletter.accentColor}
                        onChange={(e) => setNewsletter(prev => ({ ...prev, accentColor: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Header Section Transparency: {Math.round((newsletter.headerOpacity || 1) * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={newsletter.headerOpacity || 1}
                      onChange={(e) => setNewsletter(prev => ({ ...prev, headerOpacity: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Lower values make header background more transparent</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Newsletter Card Transparency: {Math.round((newsletter.contentOpacity || 1) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={newsletter.contentOpacity || 1}
                    onChange={(e) => setNewsletter(prev => ({ ...prev, contentOpacity: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Lower values make entire card more transparent (shows background image through)</p>
                </div>
              </div>

              {/* Font Settings */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Font Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title Font
                    </label>
                    <select
                      value={normalizeFont(newsletter.titleFont)}
                      onChange={(e) => setNewsletter(prev => ({ ...prev, titleFont: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent"
                    >
                      <FontOptions /></select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subtitle Font
                    </label>
                    <select
                      value={normalizeFont(newsletter.subtitleFont)}
                      onChange={(e) => setNewsletter(prev => ({ ...prev, subtitleFont: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent"
                    >
                      <FontOptions /></select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Content Font
                    </label>
                    <select
                      value={normalizeFont(newsletter.contentFont)}
                      onChange={(e) => setNewsletter(prev => ({ ...prev, contentFont: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent"
                    >
                      <FontOptions /></select>
                  </div>
                </div>
              </div>

              {/* Background Image */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Background Image</h3>
                <div className="space-y-3">
                  {newsletter.backgroundImage && (
                    <NewsletterBackgroundPicker
                      newsletter={newsletter}
                      onChange={(changes) => setNewsletter(prev => ({ ...prev, ...changes, lastModified: new Date().toISOString() }))}
                    />
                  )}
                  <input
                    ref={backgroundImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => backgroundImageInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="w-full px-4 py-2 bg-church-navy hover:bg-church-navy-deep text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingImage ? `Uploading... ${Math.round(uploadProgress)}%` : newsletter.backgroundImage ? 'Change Background Image' : 'Upload Background Image'}
                  </button>
                  <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                    One image works everywhere: use a square 2400 px by 2400 px JPEG (under 5 MB) and tap the part that must stay visible. If you add a phone image below, make this main image wide instead (2560 px by 1440 px) for computers and tablets.
                  </p>
                  {newsletter.backgroundImage && (
                    <button
                      onClick={() => setNewsletter(prev => ({ ...prev, backgroundImage: '', backgroundImageMobile: '', backgroundFocusX: 50, backgroundFocusY: 50 }))}
                      className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
                    >
                      Remove Background Image
                    </button>
                  )}
                  {newsletter.backgroundImage && (
                    <div className="border-t border-gray-200 pt-3 space-y-2">
                      <p className="text-sm font-semibold text-gray-800">Optional: separate image for phones</p>
                      <p className="text-xs text-gray-600">A tall image (1080 px by 2340 px, JPEG under 5 MB) shown only on phones. Computers and tablets keep the main image.</p>
                      {newsletter.backgroundImageMobile && (
                        <img src={newsletter.backgroundImageMobile} alt="Phone background preview" className="h-32 mx-auto rounded-lg border border-gray-200" />
                      )}
                      <input
                        ref={backgroundMobileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleBackgroundImageUpload(e, 'mobile')}
                        className="hidden"
                      />
                      <button
                        onClick={() => backgroundMobileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="w-full px-4 py-2 border-2 border-church-navy text-church-navy-deep hover:bg-church-cream rounded-lg font-medium transition disabled:opacity-50"
                      >
                        {newsletter.backgroundImageMobile ? 'Change Phone Image' : 'Upload Phone Image'}
                      </button>
                      {newsletter.backgroundImageMobile && (
                        <button
                          onClick={() => setNewsletter(prev => ({ ...prev, backgroundImageMobile: '' }))}
                          className="w-full text-sm text-red-600 underline"
                        >
                          Remove phone image
                        </button>
                      )}
                    </div>
                  )}
                  {uploadingImage && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-church-navy h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Add content */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Add Content</h3>
                <div className="space-y-4">
                  {ADD_CONTENT_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{group.label}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {group.items.map((item) => (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => addSection(item.type)}
                            className="flex items-center gap-2 rounded-lg border border-church-cream bg-church-cream px-3 py-2.5 text-left text-sm font-semibold text-church-navy-deep transition hover:border-church-navy/60 hover:bg-church-cream"
                          >
                            <svg className="h-5 w-5 shrink-0 text-church-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                            </svg>
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </div>
          )}

          {/* Right Side - Newsletter Preview/Editor */}
          <PrintOptionsModal
            open={showPrintOptions}
            onClose={() => setShowPrintOptions(false)}
            onBeforePrint={() => {
              const wasPreview = previewMode;
              const wasDevice = previewDevice;
              setPreviewMode(true);
              setPreviewDevice('print');
              window.addEventListener('afterprint', () => {
                setPreviewMode(wasPreview);
                setPreviewDevice(wasDevice);
              }, { once: true });
            }}
          />
          <div
            className={previewMode ? 'lg:col-span-3 newsletter-preview-panel' : 'lg:col-span-2 newsletter-preview-panel'}
            style={{
              padding: '2rem',
            }}
          >
            {/* Newsletter container */}
            <div
              className={`newsletter-preview-shell ${previewMode ? previewDevice : 'desktop'}`}
              style={previewMode ? { ...previewModeStyles[previewDevice], backgroundColor: `rgba(255, 255, 255, ${newsletter.contentOpacity || 1})` } : { width: '100%', maxWidth: '100%', backgroundColor: `rgba(255, 255, 255, ${newsletter.contentOpacity || 1})` }}
            >
                {/* Newsletter Header */}
                <div
                  className={`relative p-8 newsletter-header ${newsletter.themePack === 'winter' && !newsletter.headerImage ? 'winter-image-header' : ''}`}
                  style={{
                    backgroundColor: hexToRgba(newsletter.headerBackgroundColor, newsletter.headerOpacity || 1),
                    ...(newsletter.headerImage ? { aspectRatio: '16 / 5' } : {}),
                    ...((newsletter.headerImage || newsletter.themePack === 'winter')
                      ? {
                          backgroundImage: `url("${newsletter.headerImage || WINTER_HEADER_IMAGE}")`,
                          backgroundPosition: 'center top',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: newsletter.headerImage ? '100% 100%' : 'cover',
                        }
                      : {}),
                  }}
                >
                  {(newsletter.title || !newsletter.headerImage) && (
                    <h1 className="text-4xl font-bold mb-2" style={{ color: newsletter.headerTextColor, fontFamily: newsletter.titleFont }}>
                      {newsletter.title || 'Newsletter Title'}
                    </h1>
                  )}
                  {(newsletter.subtitle || !newsletter.headerImage) && (
                    <p className="text-lg" style={{ color: newsletter.headerTextColor, opacity: 0.9, fontFamily: newsletter.subtitleFont }}>
                      {newsletter.subtitle || 'Subtitle goes here'}
                    </p>
                  )}
                  {!previewMode && (
                    <>
                      <button
                        type="button"
                        ref={headerEditButtonRef}
                        onClick={() => setShowHeaderEditor(current => !current)}
                        className="absolute right-4 top-4 rounded-full bg-white/95 p-2 text-slate-700 shadow-lg hover:bg-white"
                        title="Edit newsletter header"
                        aria-label="Edit newsletter header"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m16.86 3.49 3.65 3.65M4 20h4.5L20.51 8a2.58 2.58 0 0 0-3.65-3.65L4 17.5V20Z" />
                        </svg>
                      </button>
                      {showHeaderEditor && headerMenuPos && createPortal(
                        <div
                          className="newsletter-header-editor"
                          style={{
                            position: 'fixed',
                            top: headerMenuPos.top,
                            right: headerMenuPos.right,
                            width: 'min(25rem, calc(100vw - 2rem))',
                            maxHeight: `calc(100vh - ${headerMenuPos.top}px - 1rem)`,
                            overflowY: 'auto',
                            zIndex: 60,
                          }}
                        >
                          <div>
                            <label>Title</label>
                            <input value={newsletter.title} onChange={(e) => setNewsletter(prev => ({ ...prev, title: e.target.value }))} placeholder="Weekly Newsletter" />
                          </div>
                          <div>
                            <label>Subtitle or date</label>
                            <input value={newsletter.subtitle} onChange={(e) => setNewsletter(prev => ({ ...prev, subtitle: e.target.value }))} placeholder="Week of September 7, 2026" />
                          </div>
                          <p className="newsletter-header-editor-note">For the best fit, make your custom header 1600 px by 500 px.</p>
                          <input ref={headerImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleHeaderImageUpload} />
                          <button type="button" onClick={() => window.open('https://www.canva.com/create/banners/', '_blank', 'noopener,noreferrer')} className="newsletter-header-editor-canva">Create in Canva</button>
                          <button type="button" onClick={() => headerImageInputRef.current?.click()} disabled={uploadingImage} className="newsletter-header-editor-upload">
                            {uploadingImage ? `Uploading... ${Math.round(uploadProgress)}%` : newsletter.headerImage ? 'Replace custom header' : 'Upload custom header'}
                          </button>
                          {newsletter.headerImage && <button type="button" onClick={() => setNewsletter(prev => ({ ...prev, headerImage: '' }))} className="newsletter-header-editor-remove">Remove header image</button>}
                        </div>,
                        document.body
                      )}
                    </>
                  )}
                </div>

                {/* Newsletter Sections */}
                <div
                  className="p-8 space-y-6 newsletter-print-sections"
                  style={{
                    backgroundColor: hexToRgba(newsletter.contentBackgroundColor, newsletter.contentOpacity || 1),
                  }}
                >
                {newsletter.sections.length === 0 && !previewMode && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No content yet. Add sections using the buttons on the left.</p>
                  </div>
                )}

                {!previewMode && renderInsertDivider(0)}
                {newsletter.sections.map((section, index) => (
                  <Fragment key={section.id}>
                  <div
                    className={`newsletter-print-section relative group rounded-xl transition-all ${dragOverSectionId === section.id ? 'ring-2 ring-church-border border border-church-border bg-church-cream/30' : 'border border-transparent'}`}
                    draggable={!previewMode && dragHandleSectionId === section.id}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', section.id);
                      handleDragStart(section.id);
                    }}
                    onDragOver={(event) => {
                      if (previewMode) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setDragOverSectionId(section.id);
                    }}
                    onDragLeave={() => setDragOverSectionId(current => current === section.id ? null : current)}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleDropOnSection(section.id);
                    }}
                    onDragEnd={() => {
                      setDraggedSectionId(null);
                      setDragOverSectionId(null);
                      setDragHandleSectionId(null);
                    }}
                  >
                    {/* Drag Handle (Edit Mode Only) */}
                    {!previewMode && (
                      <div
                        onMouseDown={() => setDragHandleSectionId(section.id)}
                        className="absolute -top-3 -left-3 z-10 flex items-center justify-center w-7 h-7 bg-white rounded-lg shadow-lg text-gray-400 cursor-grab active:cursor-grabbing opacity-60 group-hover:opacity-100 hover:text-church-navy transition"
                        title="Drag to reorder"
                        aria-label="Drag to reorder"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="9" cy="6" r="1.5" />
                          <circle cx="15" cy="6" r="1.5" />
                          <circle cx="9" cy="12" r="1.5" />
                          <circle cx="15" cy="12" r="1.5" />
                          <circle cx="9" cy="18" r="1.5" />
                          <circle cx="15" cy="18" r="1.5" />
                        </svg>
                      </div>
                    )}

                    {/* Section Controls (Edit Mode Only) */}
                    {!previewMode && (
                      <div className="absolute -top-3 -right-3 z-10 flex items-center space-x-1 bg-white rounded-lg shadow-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => cloneSection(section.id)}
                          className="p-1 hover:bg-church-cream rounded"
                          title="Duplicate section"
                        >
                          <svg className="w-4 h-4 text-church-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveSection(section.id, 'up')}
                          disabled={index === 0}
                          className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveSection(section.id, 'down')}
                          disabled={index === newsletter.sections.length - 1}
                          className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteSection(section.id)}
                          className="p-1 hover:bg-red-100 rounded"
                          title="Delete"
                        >
                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Header Section */}
                    {section.type === 'header' && (
                      <div>
                        {previewMode ? (
                          <h2
                            className={`text-3xl ${section.headerBold !== false ? 'font-bold' : 'font-normal'}`}
                            style={{
                              color: section.headerColor || newsletter.accentColor,
                              textAlign: section.headerAlignment || 'center',
                              fontFamily: section.fontFamily || newsletter.contentFont
                            }}
                          >
                            {section.headerText || 'Header Text'}
                          </h2>
                        ) : (
                          <div className="space-y-3">
                            {/* Header text input */}
                            <input
                              type="text"
                              value={section.headerText || ''}
                              onChange={(e) => updateSection(section.id, 'headerText', e.target.value)}
                              className="w-full px-4 py-3 text-3xl border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy"
                              placeholder="Enter header text..."
                              style={{
                                fontWeight: section.headerBold !== false ? 'bold' : 'normal',
                                color: section.headerColor || newsletter.accentColor,
                                textAlign: section.headerAlignment || 'center',
                                fontFamily: section.fontFamily || newsletter.contentFont
                              }}
                            />

                            {/* Controls */}
                            <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 rounded-lg">
                              {/* Alignment */}
                              <div className="flex items-center gap-1">
                                <label className="text-sm text-gray-600 mr-2">Align:</label>
                                <button
                                  onClick={() => updateSection(section.id, 'headerAlignment', 'left')}
                                  className={`p-2 rounded ${section.headerAlignment === 'left' ? 'bg-church-cream text-church-navy' : 'hover:bg-gray-100'}`}
                                  title="Align left"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => updateSection(section.id, 'headerAlignment', 'center')}
                                  className={`p-2 rounded ${(!section.headerAlignment || section.headerAlignment === 'center') ? 'bg-church-cream text-church-navy' : 'hover:bg-gray-100'}`}
                                  title="Align center"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => updateSection(section.id, 'headerAlignment', 'right')}
                                  className={`p-2 rounded ${section.headerAlignment === 'right' ? 'bg-church-cream text-church-navy' : 'hover:bg-gray-100'}`}
                                  title="Align right"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" />
                                  </svg>
                                </button>
                              </div>

                              {/* Bold toggle */}
                              <button
                                onClick={() => updateSection(section.id, 'headerBold', !section.headerBold)}
                                className={`px-3 py-1 rounded font-bold ${section.headerBold !== false ? 'bg-church-cream text-church-navy' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                title="Bold"
                              >
                                B
                              </button>

                              {/* Color picker */}
                              <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600">Color:</label>
                                <input
                                  type="color"
                                  value={section.headerColor || newsletter.accentColor}
                                  onChange={(e) => updateSection(section.id, 'headerColor', e.target.value)}
                                  className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                                />
                              </div>

                              {/* Font selector */}
                              <select
                                value={normalizeFont(section.fontFamily || newsletter.contentFont)}
                                onChange={(e) => updateSection(section.id, 'fontFamily', e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                <FontOptions /></select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text Section */}
                    {section.type === 'text' && (
                      <div>
                        {(() => {
                          const quickBlock = getCardAppearance(section);

                          return previewMode ? (
                          <div
                            className={`max-w-none ${quickBlock ? `quick-block quick-block-${quickBlock.id} ${getCardLayoutClass(section)} quick-block-animate-${section.cardAnimation || 'none'}` : ''}`}
                            style={{
                              color: quickBlock?.colors.accent || newsletter.textColor,
                              '--card-accent': quickBlock?.colors.accent,
                              background: quickBlock ? getCardBackground(quickBlock.colors) : undefined,
                              borderColor: quickBlock?.colors.accent,
                              boxShadow: quickBlock ? `0 18px 35px ${quickBlock.colors.accent}24, 0 4px 10px rgba(15, 23, 42, 0.08)` : undefined,
                              fontFamily: section.fontFamily || newsletter.contentFont,
                            }}
                          >
                            {quickBlock && section.cardBackgroundPattern !== 'none' && (
                              <span className={`quick-block-decoration quick-block-decoration-${section.cardBackgroundPattern}`} aria-hidden="true" />
                            )}
                            {quickBlock && <span className="quick-block-icon"><CardIcon name={quickBlock.icon} /></span>}
                            {quickBlock && section.cardImageUrl && section.cardPhotoMode !== 'carousel' && (
                              <img className="quick-block-photo" src={section.cardImageUrl} alt={section.cardImageAlt || ''} />
                            )}
                            {quickBlock?.id === 'photo-card' && section.cardPhotoMode === 'carousel' && section.cardImages?.length > 0 && (
                              <div className="quick-block-carousel">
                                <img src={section.cardImages[carouselIndexes[section.id] || 0]?.url} alt={section.cardImages[carouselIndexes[section.id] || 0]?.caption || section.cardImageAlt || 'Newsletter photo'} />
                                {section.cardImages.length > 1 && <div className="quick-block-carousel-dots">{section.cardImages.map((_, imageIndex) => <span key={imageIndex} className={imageIndex === (carouselIndexes[section.id] || 0) ? 'active' : ''} />)}</div>}
                              </div>
                            )}
                            {quickBlock && (section.eventDate || section.eventTime || section.eventLocation) && (
                              <div className="quick-block-event-details">
                                {section.eventDate && <span>{section.eventDate}</span>}
                                {section.eventTime && <span>{section.eventTime}</span>}
                                {section.eventLocation && <span>{section.eventLocation}</span>}
                              </div>
                            )}
                            {section.content && <div dangerouslySetInnerHTML={{ __html: section.content }} />}
                            {quickBlock && section.ctaLabel && section.ctaUrl && (
                              <a className="quick-block-cta" style={{ '--card-cta-text': getReadableTextColor(quickBlock.colors.accent) }} href={section.ctaUrl} target="_blank" rel="noreferrer">{section.ctaLabel}</a>
                            )}
                          </div>
                          ) : (
                          <div
                            className={`${quickBlock ? `quick-block quick-block-${quickBlock.id} ${getCardLayoutClass(section)} quick-block-animate-${section.cardAnimation || 'none'}` : ''} space-y-2`}
                            style={quickBlock ? {
                              color: quickBlock.colors.accent,
                              '--card-accent': quickBlock.colors.accent,
                              background: getCardBackground(quickBlock.colors),
                              borderColor: quickBlock.colors.accent,
                              boxShadow: `0 18px 35px ${quickBlock.colors.accent}24, 0 4px 10px rgba(15, 23, 42, 0.08)`,
                            } : undefined}
                          >
                            {quickBlock && section.cardBackgroundPattern !== 'none' && (
                              <span className={`quick-block-decoration quick-block-decoration-${section.cardBackgroundPattern}`} aria-hidden="true" />
                            )}
                            {quickBlock && <span className="quick-block-icon"><CardIcon name={quickBlock.icon} /></span>}
                            {quickBlock && (
                              <div className="quick-block-controls">
                                <label>
                                  Card style
                                  <select
                                    value={section.cardStyle || quickBlock.id}
                                    onChange={(e) => updateSection(section.id, 'cardStyle', e.target.value)}
                                  >
                                    {[...QUICK_BLOCK_TEMPLATES, ...CONTENT_LIBRARY].map((template) => (
                                      <option key={template.id} value={template.id}>{template.label}</option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  Icon
                                  <select
                                    value={section.cardIcon || quickBlock.icon}
                                    onChange={(e) => updateSection(section.id, 'cardIcon', e.target.value)}
                                  >
                                    {CARD_ICON_OPTIONS.map(([icon, label]) => (
                                      <option key={icon} value={icon}>{label}</option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  Accent
                                  <input
                                    type="color"
                                    value={quickBlock.colors.accent}
                                    onChange={(e) => updateSection(section.id, 'cardAccentColor', e.target.value)}
                                    title="Accent color"
                                  />
                                </label>
                                <label>
                                  Gradient start
                                  <input
                                    type="color"
                                    value={quickBlock.colors.start}
                                    onChange={(e) => updateSection(section.id, 'cardGradientStart', e.target.value)}
                                    title="Gradient starting color"
                                  />
                                </label>
                                <label>
                                  Gradient end
                                  <input
                                    type="color"
                                    value={quickBlock.colors.end}
                                    onChange={(e) => updateSection(section.id, 'cardGradientEnd', e.target.value)}
                                    title="Gradient ending color"
                                  />
                                </label>
                                <label>
                                  Palette
                                  <select value={section.cardGradientPreset || ''} onChange={(e) => applyGradientPreset(section.id, e.target.value)}>
                                    <option value="">Custom</option>
                                    {CARD_GRADIENT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                                  </select>
                                </label>
                                <label>
                                  Layout
                                  <select value={section.cardLayout || 'standard'} onChange={(e) => updateSection(section.id, 'cardLayout', e.target.value)}>
                                    <option value="compact">Compact</option>
                                    <option value="standard">Standard</option>
                                    <option value="featured">Featured</option>
                                  </select>
                                </label>
                                <label>
                                  Icon placement
                                  <select value={section.cardIconPosition || 'left'} onChange={(e) => updateSection(section.id, 'cardIconPosition', e.target.value)}>
                                    <option value="left">Left</option>
                                    <option value="top">Top</option>
                                    <option value="right">Right</option>
                                  </select>
                                </label>
                                <label>
                                  Motion
                                  <select value={section.cardAnimation || 'none'} onChange={(e) => updateSection(section.id, 'cardAnimation', e.target.value)}>
                                    <option value="none">None</option>
                                    <option value="lift">Gentle lift</option>
                                    <option value="glow">Soft glow</option>
                                  </select>
                                </label>
                                <label>
                                  Background
                                  <select value={section.cardBackgroundPattern || 'none'} onChange={(e) => updateSection(section.id, 'cardBackgroundPattern', e.target.value)}>
                                    <option value="none">Clean</option>
                                    <option value="dots">Soft dots</option>
                                    <option value="grid">Fine grid</option>
                                    <option value="rays">Sun rays</option>
                                    <option value="confetti">Confetti</option>
                                  </select>
                                </label>
                                <label>
                                  Border
                                  <select value={section.cardBorderStyle || 'soft'} onChange={(e) => updateSection(section.id, 'cardBorderStyle', e.target.value)}>
                                    <option value="soft">Soft</option>
                                    <option value="rounded">Extra rounded</option>
                                    <option value="outlined">Outlined</option>
                                    <option value="glass">Glass</option>
                                  </select>
                                </label>
                                <button type="button" className="quick-block-control-button" onClick={() => saveCardToLibrary(section)}>Save card</button>
                              </div>
                            )}
                            {quickBlock && (
                              <div className="quick-block-details-editor">
                                <input
                                  ref={(el) => (contentImageInputRefs.current[`${section.id}-card`] = el)}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleContentImageUpload(e, section.id, 'cardImageUrl')}
                                />
                                <button type="button" className="quick-block-control-button" onClick={() => contentImageInputRefs.current[`${section.id}-card`]?.click()}>
                                  {section.cardImageUrl ? 'Replace card photo' : 'Add card photo'}
                                </button>
                                {section.cardImageUrl && <button type="button" className="quick-block-control-button" onClick={() => updateSection(section.id, 'cardImageUrl', '')}>Remove photo</button>}
                                {section.cardImageUrl && (
                                  <img className="quick-block-upload-thumbnail" src={section.cardImageUrl} alt={section.cardImageAlt || 'Uploaded card photo'} />
                                )}
                                <input value={section.cardImageAlt || ''} onChange={(e) => updateSection(section.id, 'cardImageAlt', e.target.value)} placeholder="Photo description (recommended)" />
                                {quickBlock.id === 'photo-card' && (
                                  <>
                                    <select value={section.cardPhotoMode || 'single'} onChange={(e) => updateSection(section.id, 'cardPhotoMode', e.target.value)}>
                                      <option value="single">Single full photo</option>
                                      <option value="carousel">Photo carousel</option>
                                    </select>
                                    <input
                                      ref={(el) => (contentImageInputRefs.current[`${section.id}_cardImages`] = el)}
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      className="hidden"
                                      onChange={(e) => handleCarouselImageUpload(e, section.id, 'cardImages')}
                                    />
                                    <button type="button" className="quick-block-control-button" onClick={() => contentImageInputRefs.current[`${section.id}_cardImages`]?.click()}>Add carousel photos</button>
                                    {section.cardImages?.map((image, imageIndex) => (
                                      <div key={image.url} className="quick-block-carousel-editor">
                                        <button
                                          type="button"
                                          className={`quick-block-carousel-thumbnail ${(carouselIndexes[section.id] || 0) === imageIndex ? 'selected' : ''}`}
                                          onClick={() => setCarouselIndexes(prev => ({ ...prev, [section.id]: imageIndex }))}
                                          title={`Show photo ${imageIndex + 1}`}
                                        >
                                          <img src={image.url} alt={image.caption || `Uploaded photo ${imageIndex + 1}`} />
                                        </button>
                                        <input value={image.caption || ''} onChange={(e) => updateSection(section.id, 'cardImages', section.cardImages.map((item, index) => index === imageIndex ? { ...item, caption: e.target.value } : item))} placeholder="Caption (optional)" />
                                        <button type="button" onClick={() => updateSection(section.id, 'cardImages', section.cardImages.filter((_, index) => index !== imageIndex))}>Remove</button>
                                      </div>
                                    ))}
                                  </>
                                )}
                                <input value={section.ctaLabel || ''} onChange={(e) => updateSection(section.id, 'ctaLabel', e.target.value)} placeholder="Button label (optional)" />
                                <input value={section.ctaUrl || ''} onChange={(e) => updateSection(section.id, 'ctaUrl', e.target.value)} placeholder="Button link (https://...)" />
                                <input type="date" value={section.eventDate || ''} onChange={(e) => updateSection(section.id, 'eventDate', e.target.value)} />
                                <input value={section.eventTime || ''} onChange={(e) => updateSection(section.id, 'eventTime', e.target.value)} placeholder="Event time" />
                                <input value={section.eventLocation || ''} onChange={(e) => updateSection(section.id, 'eventLocation', e.target.value)} placeholder="Event location" />
                              </div>
                            )}
                            {/* Formatting Toolbar */}
                            <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border border-gray-300 rounded-t-lg">
                              <button
                                type="button"
                                onClick={() => {
                                  const selection = window.getSelection();
                                  if (!selection.rangeCount) return;
                                  document.execCommand('bold');
                                }}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold text-sm"
                                title="Bold"
                              >
                                B
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('italic')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 italic text-sm"
                                title="Italic"
                              >
                                I
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('underline')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 underline text-sm"
                                title="Underline"
                              >
                                U
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('hiliteColor', false, '#ffff00')}
                                className="px-2 py-1 bg-yellow-200 border border-gray-300 rounded hover:bg-yellow-300 text-sm"
                                title="Highlight"
                              >
                                H
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('hiliteColor', false, 'transparent')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                title="Remove Highlight"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const url = prompt('Enter the URL (include https://):');
                                  if (url) {
                                    document.execCommand('createLink', false, url);
                                  }
                                }}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                title="Insert Link (select text first)"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('unlink')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                title="Remove Link"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                              <div className="w-px bg-gray-300 mx-1"></div>
                              <button
                                type="button"
                                onClick={() => document.execCommand('insertUnorderedList')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                title="Bullet List"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h13M4 18h16" />
                                  <circle cx="2" cy="6" r="1" fill="currentColor" />
                                  <circle cx="2" cy="12" r="1" fill="currentColor" />
                                  <circle cx="2" cy="18" r="1" fill="currentColor" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('insertOrderedList')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                title="Numbered List"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13" />
                                  <text x="1" y="8" fontSize="6" fill="currentColor">1</text>
                                  <text x="1" y="14" fontSize="6" fill="currentColor">2</text>
                                  <text x="1" y="20" fontSize="6" fill="currentColor">3</text>
                                </svg>
                              </button>
                              <div className="w-px bg-gray-300 mx-1"></div>
                              <select
                                onChange={(e) => updateSection(section.id, 'fontFamily', e.target.value)}
                                value={normalizeFont(section.fontFamily || newsletter.contentFont)}
                                className="px-2 py-1 bg-white border border-gray-300 rounded text-sm"
                                title="Font"
                              >
                                <FontOptions /></select>
                            </div>
                            {quickBlock?.id !== 'photo-card' && (
                              <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => updateSection(section.id, 'content', e.currentTarget.innerHTML)}
                                className="min-h-[150px] p-4 border border-gray-300 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-church-navy"
                                style={{ color: quickBlock?.colors.accent || newsletter.textColor, fontFamily: section.fontFamily || newsletter.contentFont }}
                                dangerouslySetInnerHTML={{ __html: section.content || 'Text content' }}
                              />
                            )}
                          </div>
                          );
                        })()}
                        {false && (
                          <div className="space-y-2">
                            {/* Formatting Toolbar */}
                            <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border border-gray-300 rounded-t-lg">
                              <button
                                type="button"
                                onClick={() => {
                                  const selection = window.getSelection();
                                  if (!selection.rangeCount) return;
                                  document.execCommand('bold');
                                }}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold text-sm"
                                title="Bold"
                              >
                                B
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('italic')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 italic text-sm"
                                title="Italic"
                              >
                                I
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('underline')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 underline text-sm"
                                title="Underline"
                              >
                                U
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('hiliteColor', false, '#ffff00')}
                                className="px-2 py-1 bg-yellow-200 border border-gray-300 rounded hover:bg-yellow-300 text-sm"
                                title="Highlight"
                              >
                                H
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('hiliteColor', false, 'transparent')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                title="Remove Highlight"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const url = prompt('Enter the URL (include https://):');
                                  if (url) {
                                    document.execCommand('createLink', false, url);
                                  }
                                }}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                title="Insert Link (select text first)"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('unlink')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                title="Remove Link"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                              <div className="w-px bg-gray-300 mx-1"></div>
                              <button
                                type="button"
                                onClick={() => document.execCommand('insertUnorderedList')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                title="Bullet List"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                  <circle cx="2" cy="6" r="1" fill="currentColor" />
                                  <circle cx="2" cy="12" r="1" fill="currentColor" />
                                  <circle cx="2" cy="18" r="1" fill="currentColor" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('insertOrderedList')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                title="Numbered List"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13" />
                                  <text x="1" y="8" fontSize="6" fill="currentColor">1</text>
                                  <text x="1" y="14" fontSize="6" fill="currentColor">2</text>
                                  <text x="1" y="20" fontSize="6" fill="currentColor">3</text>
                                </svg>
                              </button>
                              <div className="w-px bg-gray-300 mx-1"></div>
                              <select
                                onChange={(e) => updateSection(section.id, 'fontFamily', e.target.value)}
                                value={normalizeFont(section.fontFamily || newsletter.contentFont)}
                                className="px-2 py-1 bg-white border border-gray-300 rounded text-sm"
                                title="Font"
                              >
                                <FontOptions /></select>
                            </div>
                            {/* Content Editable Area */}
                            <div
                              contentEditable
                              onBlur={(e) => updateSection(section.id, 'content', e.currentTarget.innerHTML)}
                              dangerouslySetInnerHTML={{ __html: section.content || '' }}
                              className="w-full px-4 py-3 border border-gray-300 border-t-0 rounded-b-lg focus:ring-2 focus:ring-church-navy focus:outline-none min-h-[150px]"
                              style={{ fontFamily: section.fontFamily || newsletter.contentFont }}
                              suppressContentEditableWarning
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Image Section */}
                    {section.type === 'image' && (
                      <div className="space-y-3">
                        {section.imageUrl ? (
                          <div className="relative">
                            <img
                              src={section.imageUrl}
                              alt={section.imageAltText || 'Newsletter content'}
                              className="w-full rounded-lg shadow-sm"
                              style={getImageStyles(section)}
                            />
                            {!previewMode && (
                              <>
                                <input
                                  ref={(el) => (contentImageInputRefs.current[section.id] = el)}
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleContentImageUpload(e, section.id, 'imageUrl')}
                                  className="hidden"
                                />
                                <div className="absolute top-2 right-2 flex gap-2">
                                  <button
                                    onClick={() => triggerContentImageUpload(section.id)}
                                    disabled={uploadingImage}
                                    className="px-3 py-1 bg-white hover:bg-gray-100 rounded-lg text-sm font-medium shadow-lg disabled:opacity-50"
                                  >
                                    Change
                                  </button>
                                  <button
                                    onClick={() => updateSection(section.id, 'imageUrl', '')}
                                    className="px-3 py-1 bg-white hover:bg-gray-100 rounded-lg text-sm font-medium shadow-lg"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          !previewMode && (
                            <>
                              <input
                                ref={(el) => (contentImageInputRefs.current[section.id] = el)}
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleContentImageUpload(e, section.id, 'imageUrl')}
                                className="hidden"
                              />
                              <button
                                onClick={() => triggerContentImageUpload(section.id)}
                                disabled={uploadingImage}
                                className="w-full py-12 border-2 border-dashed border-gray-300 rounded-lg hover:border-church-navy transition text-gray-500 hover:text-church-navy disabled:opacity-50"
                              >
                                {uploadingImage ? `Uploading... ${Math.round(uploadProgress)}%` : 'Click to upload image'}
                              </button>
                            </>
                          )
                        )}

                        {!previewMode && (
                          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                            <div className="grid md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Aspect</label>
                                <select
                                  value={section.imageAspectRatio || 'wide'}
                                  onChange={(e) => updateSection(section.id, 'imageAspectRatio', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                  <option value="wide">Wide</option>
                                  <option value="landscape">Landscape</option>
                                  <option value="portrait">Portrait</option>
                                  <option value="square">Square</option>
                                  <option value="banner">Banner</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fit</label>
                                <select
                                  value={section.imageFit || 'cover'}
                                  onChange={(e) => updateSection(section.id, 'imageFit', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                  <option value="cover">Cover</option>
                                  <option value="contain">Contain</option>
                                  <option value="fill">Fill</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alt text</label>
                                <input
                                  type="text"
                                  value={section.imageAltText || ''}
                                  onChange={(e) => updateSection(section.id, 'imageAltText', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                  placeholder="Describe the image"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
                              <textarea
                                rows={2}
                                value={section.imageCaption || ''}
                                onChange={(e) => updateSection(section.id, 'imageCaption', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="Add a short caption for this image"
                              />
                            </div>
                          </div>
                        )}

                        {section.imageCaption && (
                          <p className="text-sm text-gray-600 mt-2 italic">{section.imageCaption}</p>
                        )}
                      </div>
                    )}

                    {/* Image + Text Section */}
                    {section.type === 'imageText' && (
                      <div className="space-y-3">
                        <div className={`flex ${section.imagePosition === 'right' ? 'flex-row-reverse' : 'flex-row'} gap-6 items-start`}>
                          <div className="w-1/2">
                            {section.imageUrl ? (
                              <div className="relative">
                                <img
                                  src={section.imageUrl}
                                  alt={section.imageAltText || 'Newsletter content'}
                                  className="w-full rounded-lg shadow-sm"
                                  style={getImageStyles(section)}
                                />
                                {!previewMode && (
                                  <>
                                    <input
                                      ref={(el) => (contentImageInputRefs.current[`${section.id}_imageText`] = el)}
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handleContentImageUpload(e, section.id, 'imageUrl')}
                                      className="hidden"
                                    />
                                    <div className="absolute top-2 right-2 space-x-2">
                                      <button
                                        onClick={() => updateSection(section.id, 'imagePosition', section.imagePosition === 'left' ? 'right' : 'left')}
                                        className="px-3 py-1 bg-white hover:bg-gray-100 rounded-lg text-sm font-medium shadow-lg"
                                      >
                                        Flip
                                      </button>
                                      <button
                                        onClick={() => triggerContentImageUpload(`${section.id}_imageText`)}
                                        disabled={uploadingImage}
                                        className="px-3 py-1 bg-white hover:bg-gray-100 rounded-lg text-sm font-medium shadow-lg disabled:opacity-50"
                                      >
                                        Change
                                      </button>
                                      <button
                                        onClick={() => updateSection(section.id, 'imageUrl', '')}
                                        className="px-3 py-1 bg-white hover:bg-gray-100 rounded-lg text-sm font-medium shadow-lg"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ) : (
                              !previewMode && (
                                <>
                                  <input
                                    ref={(el) => (contentImageInputRefs.current[`${section.id}_imageText`] = el)}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleContentImageUpload(e, section.id, 'imageUrl')}
                                    className="hidden"
                                  />
                                  <button
                                    onClick={() => triggerContentImageUpload(`${section.id}_imageText`)}
                                    disabled={uploadingImage}
                                    className="w-full h-full min-h-[200px] border-2 border-dashed border-gray-300 rounded-lg hover:border-church-navy transition text-gray-500 hover:text-church-navy disabled:opacity-50"
                                  >
                                    {uploadingImage ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Image'}
                                  </button>
                                </>
                              )
                            )}
                          </div>
                          <div className="w-1/2 space-y-3">
                          {previewMode ? (
                            <>
                              {section.heading && (
                                <h3 className="text-2xl font-bold mb-3" style={{ color: newsletter.accentColor }}>
                                  {section.heading}
                                </h3>
                              )}
                              <div
                                style={{ color: newsletter.textColor, fontFamily: section.fontFamily || newsletter.contentFont }}
                                dangerouslySetInnerHTML={{ __html: section.content || 'Text content' }}
                              />
                            </>
                          ) : (
                            <>
                              <input
                                type="text"
                                value={section.heading}
                                onChange={(e) => updateSection(section.id, 'heading', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent text-xl font-bold"
                                placeholder="Heading (optional)"
                              />
                              <div className="space-y-2">
                                {/* Formatting Toolbar */}
                                <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border border-gray-300 rounded-t-lg">
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('bold')}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold text-sm"
                                    title="Bold"
                                  >
                                    B
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('italic')}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 italic text-sm"
                                    title="Italic"
                                  >
                                    I
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('underline')}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 underline text-sm"
                                    title="Underline"
                                  >
                                    U
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('hiliteColor', false, '#ffff00')}
                                    className="px-2 py-1 bg-yellow-200 border border-gray-300 rounded hover:bg-yellow-300 text-sm"
                                    title="Highlight"
                                  >
                                    H
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('hiliteColor', false, 'transparent')}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                    title="Remove Highlight"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const url = prompt('Enter the URL (include https://):');
                                      if (url) {
                                        document.execCommand('createLink', false, url);
                                      }
                                    }}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                    title="Insert Link (select text first)"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('unlink')}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                    title="Remove Link"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                    </svg>
                                  </button>
                                  <div className="w-px bg-gray-300 mx-1"></div>
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('insertUnorderedList')}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                    title="Bullet List"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('insertOrderedList')}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                    title="Numbered List"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13" />
                                    </svg>
                                  </button>
                                  <div className="w-px bg-gray-300 mx-1"></div>
                                  <select
                                    onChange={(e) => updateSection(section.id, 'fontFamily', e.target.value)}
                                    value={normalizeFont(section.fontFamily || newsletter.contentFont)}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded text-sm"
                                    title="Font"
                                  >
                                    <FontOptions /></select>
                                </div>
                                {/* Content Editable Area */}
                                <div
                                  contentEditable
                                  onBlur={(e) => updateSection(section.id, 'content', e.currentTarget.innerHTML)}
                                  dangerouslySetInnerHTML={{ __html: section.content || '' }}
                                  className="w-full px-4 py-3 border border-gray-300 border-t-0 rounded-b-lg focus:ring-2 focus:ring-church-navy focus:outline-none min-h-[150px]"
                                  style={{ fontFamily: section.fontFamily || newsletter.contentFont }}
                                  suppressContentEditableWarning
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Text + Image Section (image on right) */}
                    {section.type === 'textImage' && (
                      <div className="flex flex-row gap-6 items-start">
                        <div className="w-1/2 space-y-3">
                          {previewMode ? (
                            <>
                              {section.heading && (
                                <h3 className="text-2xl font-bold mb-3" style={{ color: newsletter.accentColor }}>
                                  {section.heading}
                                </h3>
                              )}
                              <div
                                style={{ color: newsletter.textColor, fontFamily: section.fontFamily || newsletter.contentFont }}
                                dangerouslySetInnerHTML={{ __html: section.content || 'Text content' }}
                              />
                            </>
                          ) : (
                            <>
                              <input
                                type="text"
                                value={section.heading}
                                onChange={(e) => updateSection(section.id, 'heading', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent text-xl font-bold"
                                placeholder="Heading (optional)"
                              />
                              <div className="space-y-2">
                                {/* Formatting Toolbar */}
                                <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border border-gray-300 rounded-t-lg">
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('bold')}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold text-sm"
                                    title="Bold"
                                  >
                                    B
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('italic')}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 italic text-sm"
                                    title="Italic"
                                  >
                                    I
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('underline')}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 underline text-sm"
                                    title="Underline"
                                  >
                                    U
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('hiliteColor', false, '#ffff00')}
                                    className="px-2 py-1 bg-yellow-200 border border-gray-300 rounded hover:bg-yellow-300 text-sm"
                                    title="Highlight"
                                  >
                                    H
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const url = prompt('Enter the URL (include https://):');
                                      if (url) {
                                        document.execCommand('createLink', false, url);
                                      }
                                    }}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                    title="Insert Link (select text first)"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('unlink')}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                    title="Remove Link"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                    </svg>
                                  </button>
                                  <div className="w-px bg-gray-300 mx-1"></div>
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('insertUnorderedList')}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                    title="Bullet List"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => document.execCommand('insertOrderedList')}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                    title="Numbered List"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13" />
                                    </svg>
                                  </button>
                                  <div className="w-px bg-gray-300 mx-1"></div>
                                  <select
                                    onChange={(e) => updateSection(section.id, 'fontFamily', e.target.value)}
                                    value={normalizeFont(section.fontFamily || newsletter.contentFont)}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded text-sm"
                                    title="Font"
                                  >
                                    <FontOptions /></select>
                                </div>
                                {/* Content Editable Area */}
                                <div
                                  contentEditable
                                  onBlur={(e) => updateSection(section.id, 'content', e.currentTarget.innerHTML)}
                                  dangerouslySetInnerHTML={{ __html: section.content || '' }}
                                  className="w-full px-4 py-3 border border-gray-300 border-t-0 rounded-b-lg focus:ring-2 focus:ring-church-navy focus:outline-none min-h-[150px]"
                                  style={{ fontFamily: section.fontFamily || newsletter.contentFont }}
                                  suppressContentEditableWarning
                                />
                              </div>
                            </>
                          )}
                        </div>
                        <div className="w-1/2">
                          {section.imageUrl ? (
                            <div className="relative">
                              <img
                                src={section.imageUrl}
                                alt="Newsletter content"
                                className="w-full rounded-lg"
                              />
                              {!previewMode && (
                                <>
                                  <input
                                    ref={(el) => (contentImageInputRefs.current[`${section.id}_textImage`] = el)}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleContentImageUpload(e, section.id, 'imageUrl')}
                                    className="hidden"
                                  />
                                  <div className="absolute top-2 right-2">
                                    <button
                                      onClick={() => triggerContentImageUpload(`${section.id}_textImage`)}
                                      disabled={uploadingImage}
                                      className="px-3 py-1 bg-white hover:bg-gray-100 rounded-lg text-sm font-medium shadow-lg disabled:opacity-50"
                                    >
                                      Change
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            !previewMode && (
                              <>
                                <input
                                  ref={(el) => (contentImageInputRefs.current[`${section.id}_textImage`] = el)}
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleContentImageUpload(e, section.id, 'imageUrl')}
                                  className="hidden"
                                />
                                <button
                                  onClick={() => triggerContentImageUpload(`${section.id}_textImage`)}
                                  disabled={uploadingImage}
                                  className="w-full h-full min-h-[200px] border-2 border-dashed border-gray-300 rounded-lg hover:border-church-navy transition text-gray-500 hover:text-church-navy disabled:opacity-50"
                                >
                                  {uploadingImage ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Image'}
                                </button>
                              </>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Two Column Text Section */}
                    {section.type === 'twoColumn' && (
                      <div className="flex flex-row gap-6">
                        {/* Left Column */}
                        <div className="w-1/2">
                          {previewMode ? (
                            <div
                              style={{ color: newsletter.textColor, fontFamily: section.fontFamily || newsletter.contentFont }}
                              dangerouslySetInnerHTML={{ __html: section.leftContent || '' }}
                            />
                          ) : (
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-gray-700">Left Column</label>
                              <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border border-gray-300 rounded-t-lg">
                                <button
                                  type="button"
                                  onClick={() => document.execCommand('bold')}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold text-sm"
                                  title="Bold"
                                >
                                  B
                                </button>
                                <button
                                  type="button"
                                  onClick={() => document.execCommand('italic')}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 italic text-sm"
                                  title="Italic"
                                >
                                  I
                                </button>
                                <button
                                  type="button"
                                  onClick={() => document.execCommand('underline')}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 underline text-sm"
                                  title="Underline"
                                >
                                  U
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const url = prompt('Enter the URL (include https://):');
                                    if (url) {
                                      document.execCommand('createLink', false, url);
                                    }
                                  }}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                  title="Insert Link (select text first)"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => document.execCommand('unlink')}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                  title="Remove Link"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                </button>
                                <div className="w-px bg-gray-300 mx-1"></div>
                                <button
                                  type="button"
                                  onClick={() => document.execCommand('insertUnorderedList')}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                  title="Bullet List"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => document.execCommand('insertOrderedList')}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                  title="Numbered List"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13" />
                                  </svg>
                                </button>
                              </div>
                              <div
                                contentEditable
                                onBlur={(e) => updateSection(section.id, 'leftContent', e.currentTarget.innerHTML)}
                                dangerouslySetInnerHTML={{ __html: section.leftContent || '' }}
                                className="w-full px-4 py-3 border border-gray-300 border-t-0 rounded-b-lg focus:ring-2 focus:ring-church-navy focus:outline-none min-h-[120px]"
                                style={{ fontFamily: section.fontFamily || newsletter.contentFont }}
                                placeholder="Left column content..."
                                suppressContentEditableWarning
                              />
                            </div>
                          )}
                        </div>
                        {/* Right Column */}
                        <div className="w-1/2">
                          {previewMode ? (
                            <div
                              style={{ color: newsletter.textColor, fontFamily: section.fontFamily || newsletter.contentFont }}
                              dangerouslySetInnerHTML={{ __html: section.rightContent || '' }}
                            />
                          ) : (
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-gray-700">Right Column</label>
                              <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border border-gray-300 rounded-t-lg">
                                <button
                                  type="button"
                                  onClick={() => document.execCommand('bold')}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold text-sm"
                                  title="Bold"
                                >
                                  B
                                </button>
                                <button
                                  type="button"
                                  onClick={() => document.execCommand('italic')}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 italic text-sm"
                                  title="Italic"
                                >
                                  I
                                </button>
                                <button
                                  type="button"
                                  onClick={() => document.execCommand('underline')}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 underline text-sm"
                                  title="Underline"
                                >
                                  U
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const url = prompt('Enter the URL (include https://):');
                                    if (url) {
                                      document.execCommand('createLink', false, url);
                                    }
                                  }}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                  title="Insert Link (select text first)"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => document.execCommand('unlink')}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                  title="Remove Link"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                </button>
                                <div className="w-px bg-gray-300 mx-1"></div>
                                <button
                                  type="button"
                                  onClick={() => document.execCommand('insertUnorderedList')}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                  title="Bullet List"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => document.execCommand('insertOrderedList')}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                  title="Numbered List"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13" />
                                  </svg>
                                </button>
                              </div>
                              <div
                                contentEditable
                                onBlur={(e) => updateSection(section.id, 'rightContent', e.currentTarget.innerHTML)}
                                dangerouslySetInnerHTML={{ __html: section.rightContent || '' }}
                                className="w-full px-4 py-3 border border-gray-300 border-t-0 rounded-b-lg focus:ring-2 focus:ring-church-navy focus:outline-none min-h-[120px]"
                                style={{ fontFamily: section.fontFamily || newsletter.contentFont }}
                                placeholder="Right column content..."
                                suppressContentEditableWarning
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Quote Section */}
                    {section.type === 'quote' && (
                      <div>
                        {previewMode ? (
                          <div
                            className="rounded-lg p-6 border-l-4 italic"
                            style={{ borderColor: newsletter.accentColor }}
                          >
                            <div
                              className="text-xl"
                              style={{ color: newsletter.textColor, fontFamily: section.fontFamily || newsletter.contentFont }}
                              dangerouslySetInnerHTML={{ __html: section.content || 'Quote text' }}
                            />
                          </div>
                        ) : (
                          <div
                            className="border-l-4 pl-6 py-4 italic"
                            style={{ borderColor: newsletter.accentColor }}
                          >
                            {/* Formatting toolbar for quote */}
                            <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border border-gray-300 rounded-t-lg mb-0">
                              <button
                                type="button"
                                onClick={() => document.execCommand('bold')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold text-sm"
                                title="Bold"
                              >
                                B
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('italic')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 italic text-sm"
                                title="Italic"
                              >
                                I
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('underline')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 underline text-sm"
                                title="Underline"
                              >
                                U
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('hiliteColor', false, '#ffff00')}
                                className="px-2 py-1 bg-yellow-200 border border-gray-300 rounded hover:bg-yellow-300 text-sm"
                                title="Highlight"
                              >
                                H
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('hiliteColor', false, 'transparent')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                title="Remove Highlight"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const url = prompt('Enter the URL (include https://):');
                                  if (url) {
                                    document.execCommand('createLink', false, url);
                                  }
                                }}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                title="Insert Link (select text first)"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => document.execCommand('unlink')}
                                className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm"
                                title="Remove Link"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                              <div className="w-px bg-gray-300 mx-1"></div>
                              <select
                                onChange={(e) => updateSection(section.id, 'fontFamily', e.target.value)}
                                value={normalizeFont(section.fontFamily || newsletter.contentFont)}
                                className="px-2 py-1 bg-white border border-gray-300 rounded text-sm"
                                title="Font"
                              >
                                <FontOptions /></select>
                            </div>
                            <div
                              contentEditable
                              onBlur={(e) => updateSection(section.id, 'content', e.currentTarget.innerHTML)}
                              dangerouslySetInnerHTML={{ __html: section.content || '' }}
                              className="w-full px-4 py-3 border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-church-navy focus:border-transparent min-h-[100px] italic text-xl"
                              placeholder="Enter your quote here..."
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Divider Section */}
                    {section.type === 'divider' && (
                      <div>
                        {/* Preview the divider */}
                        {renderDivider(section, newsletter)}

                        {/* Edit controls (shown only in edit mode) */}
                        {!previewMode && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                            <div className="flex flex-wrap items-center gap-4">
                              {/* Style Selector */}
                              <div className="flex-1 min-w-[120px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                                <select
                                  value={section.dividerStyle || 'solid'}
                                  onChange={(e) => updateSection(section.id, 'dividerStyle', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                  <option value="solid">Solid</option>
                                  <option value="dashed">Dashed</option>
                                  <option value="dotted">Dotted</option>
                                  <option value="double">Double</option>
                                  <option value="wavy">Wavy</option>
                                  <option value="soft">Soft</option>
                                  <option value="glow">Glow</option>
                                  <option value="sketched">Sketched</option>
                                </select>
                              </div>

                              {/* Pattern Selector */}
                              <div className="flex-1 min-w-[120px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pattern</label>
                                <select
                                  value={section.dividerPattern || 'none'}
                                  onChange={(e) => updateSection(section.id, 'dividerPattern', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                  <option value="none">None (line only)</option>
                                  <option value="sparkles">Sparkles</option>
                                  <option value="sunflowers">Flowers</option>
                                  <option value="stars">Stars</option>
                                  <option value="hearts">Hearts</option>
                                  <option value="leaves">Leaves</option>
                                  <option value="dots">Dots</option>
                                  <option value="swirls">Swirls</option>
                                  <option value="checkmarks">Checkmarks</option>
                                  <option value="scissors">Scissors</option>
                                  <option value="waves">Waves</option>
                                  <option value="petals">Petals</option>
                                </select>
                              </div>

                              {/* Color Picker */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                                <input
                                  type="color"
                                  value={section.dividerColor || newsletter.accentColor}
                                  onChange={(e) => updateSection(section.id, 'dividerColor', e.target.value)}
                                  className="w-12 h-10 rounded cursor-pointer border border-gray-300"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {section.type === 'response' && (
                      <div className="rounded-xl border-2 p-5" style={{ borderColor: newsletter.accentColor, backgroundColor: `${newsletter.contentBackgroundColor}` }}>
                        <div className="font-bold text-lg" style={{ color: newsletter.accentColor }}>Poll</div>
                        {previewMode ? (
                          <>
                            <p className="mt-2 text-gray-700">{section.responsePrompt}</p>
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              {(section.responseOptions || []).filter(Boolean).map((option) => (
                                <span key={option} className="rounded-lg border px-4 py-2 text-center text-sm font-medium" style={{ borderColor: newsletter.accentColor, color: newsletter.accentColor }}>{option}</span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="mt-4 space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                              <input value={section.responsePrompt || ''} onChange={(event) => updateSection(section.id, 'responsePrompt', event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-gray-700">Answers (readers tap the one that fits)</label>
                              {(section.responseOptions?.length ? section.responseOptions : ['', '']).map((option, index, options) => (
                                <div key={index} className="flex items-center gap-2">
                                  <input
                                    value={option}
                                    placeholder={`Answer ${index + 1}`}
                                    onChange={(event) => {
                                      const next = [...options];
                                      next[index] = event.target.value;
                                      updateSection(section.id, 'responseOptions', next);
                                    }}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                  />
                                  {options.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => updateSection(section.id, 'responseOptions', options.filter((_, i) => i !== index))}
                                      aria-label={`Remove answer ${index + 1}`}
                                      className="h-9 w-9 shrink-0 rounded-lg text-xl leading-none text-gray-400 hover:bg-red-50 hover:text-red-600"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                              {(section.responseOptions?.length || 2) < 8 && (
                                <button
                                  type="button"
                                  onClick={() => updateSection(section.id, 'responseOptions', [...(section.responseOptions?.length ? section.responseOptions : ['', '']), ''])}
                                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                                >
                                  + Add answer
                                </button>
                              )}
                            </div>
                            <label className="flex items-start gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4"
                                checked={section.showPollResults !== false}
                                onChange={(event) => updateSection(section.id, 'showPollResults', event.target.checked)}
                              />
                              <span>Show results to readers after they vote</span>
                            </label>
                            {memberProfile?.uid && (
                              <div className="rounded-lg bg-gray-50 p-3">
                                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Results so far</div>
                                <PollResults
                                  memberId={CHURCH_SPACE}
                                  newsletterId={newsletterId}
                                  sectionId={section.id}
                                  options={(section.responseOptions || []).filter(Boolean)}
                                  accentColor={newsletter.accentColor}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Event Section */}
                    {section.type === 'event' && (
                      previewMode ? (
                        <EventCard
                          section={section}
                          preview
                          accentColor={newsletter.accentColor}
                          textColor={newsletter.textColor}
                          backgroundColor={newsletter.contentBackgroundColor}
                        />
                      ) : (
                        <div className="space-y-3 rounded-xl border-2 p-5" style={{ borderColor: newsletter.accentColor, backgroundColor: `${newsletter.contentBackgroundColor}` }}>
                          <div className="font-bold text-lg" style={{ color: newsletter.accentColor }}>Event</div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Name <span className="text-red-600">*</span></label>
                            <input value={section.eventName || ''} maxLength={100} onChange={(event) => updateSection(section.id, 'eventName', event.target.value)} placeholder="Enter your event name" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
                              <input type="date" value={section.eventDate || ''} onChange={(event) => updateSection(section.id, 'eventDate', event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-medium text-gray-700">Starts</label>
                              <input type="time" value={section.eventTime || ''} onChange={(event) => updateSection(section.id, 'eventTime', event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-medium text-gray-700">Ends (optional)</label>
                              <input type="time" value={section.eventEndTime || ''} onChange={(event) => updateSection(section.id, 'eventEndTime', event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Where?</label>
                            <input value={section.eventLocation || ''} onChange={(event) => updateSection(section.id, 'eventLocation', event.target.value)} placeholder="Enter event's location" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                          </div>
                          <div className="space-y-2 text-sm text-gray-700">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" className="h-4 w-4" checked={Boolean(section.eventHideMap)} onChange={(event) => updateSection(section.id, 'eventHideMap', event.target.checked)} />
                              Don&apos;t show map (the location is still a tappable link)
                            </label>
                            <label className="flex items-center gap-2">
                              <input type="checkbox" className="h-4 w-4" checked={Boolean(section.eventCollectRsvps)} onChange={(event) => updateSection(section.id, 'eventCollectRsvps', event.target.checked)} />
                              Collect RSVPs to this event
                            </label>
                            {section.eventCollectRsvps && (
                              <label className="flex items-center gap-2 pl-6">
                                <input type="checkbox" className="h-4 w-4" checked={section.eventNotify !== false} onChange={(event) => updateSection(section.id, 'eventNotify', event.target.checked)} />
                                Email the church owners when a new guest RSVPs
                              </label>
                            )}
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Agenda &amp; details (optional)</label>
                            <textarea value={section.eventDetails || ''} rows={3} onChange={(event) => updateSection(section.id, 'eventDetails', event.target.value)} placeholder="What to bring, schedule, parking..." className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                          </div>
                          {section.eventCollectRsvps && memberProfile?.uid && (
                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">RSVPs so far</div>
                              <EventRsvpList memberId={CHURCH_SPACE} newsletterId={newsletterId} sectionId={section.id} />
                            </div>
                          )}
                        </div>
                      )
                    )}
                    {/* Custom Form Section */}
                    {section.type === 'customForm' && (
                      <div className="rounded-xl border-2 p-5" style={{ borderColor: newsletter.accentColor, backgroundColor: `${newsletter.contentBackgroundColor}` }}>
                        {previewMode ? (
                          <>
                            <div className="font-bold text-lg" style={{ color: newsletter.accentColor }}>{section.formTitle || 'Untitled Form'}</div>
                            {section.formDescription && <p className="mt-1 text-sm text-gray-600">{section.formDescription}</p>}
                            <div className="mt-4 space-y-3">
                              {(section.fields || []).map(field => (
                                <div key={field.id}>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {field.label}{field.required && <span className="text-red-500"> *</span>}
                                  </label>
                                  <FormFieldInput field={field} disabled />
                                </div>
                              ))}
                              <button disabled className="px-4 py-2 rounded-lg font-medium text-white opacity-70" style={{ backgroundColor: newsletter.accentColor }}>
                                {section.submitButtonLabel || 'Submit'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Form title</label>
                              <input value={section.formTitle || ''} onChange={(event) => updateSection(section.id, 'formTitle', event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                              <textarea value={section.formDescription || ''} onChange={(event) => updateSection(section.id, 'formDescription', event.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                            </div>

                            <div className="space-y-3">
                              {(section.fields || []).map((field, fieldIndex) => (
                                <div key={field.id} className="rounded-lg border border-gray-200 p-3 bg-white space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      value={field.label}
                                      onChange={(event) => updateFormField(section.id, field.id, { label: event.target.value })}
                                      placeholder="Field label"
                                      className="flex-1 min-w-[140px] rounded-lg border border-gray-300 px-3 py-2"
                                    />
                                    <select
                                      value={field.type}
                                      onChange={(event) => updateFormField(section.id, field.id, { type: event.target.value, ...(OPTION_FIELD_TYPES.includes(event.target.value) && !(field.options || []).length ? { options: ['Option 1', 'Option 2'], optionsText: 'Option 1, Option 2' } : {}) })}
                                      className="rounded-lg border border-gray-300 px-3 py-2"
                                    >
                                      {FORM_FIELD_TYPES.map(fieldType => (
                                        <option key={fieldType.id} value={fieldType.id}>{fieldType.label}</option>
                                      ))}
                                    </select>
                                    <label className="flex items-center gap-1 text-sm text-gray-600">
                                      <input
                                        type="checkbox"
                                        checked={!!field.required}
                                        onChange={(event) => updateFormField(section.id, field.id, { required: event.target.checked })}
                                      />
                                      Required
                                    </label>
                                    <button type="button" onClick={() => moveFormField(section.id, field.id, 'up')} disabled={fieldIndex === 0} className="px-2 py-1 text-gray-500 hover:text-gray-800 disabled:opacity-30">↑</button>
                                    <button type="button" onClick={() => moveFormField(section.id, field.id, 'down')} disabled={fieldIndex === (section.fields || []).length - 1} className="px-2 py-1 text-gray-500 hover:text-gray-800 disabled:opacity-30">↓</button>
                                    <button type="button" onClick={() => removeFormField(section.id, field.id)} className="px-2 py-1 text-red-500 hover:text-red-700">Remove</button>
                                  </div>

                                  {OPTION_FIELD_TYPES.includes(field.type) && (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        value={field.optionsText ?? (field.options || []).join(', ')}
                                        onChange={(event) => updateFormField(section.id, field.id, { optionsText: event.target.value, options: event.target.value.split(',').map(option => option.trim()).filter(Boolean) })}
                                        placeholder="Options, separated by commas (e.g. Yes, No, Maybe)"
                                        className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => addFormField(section.id)}
                              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
                            >
                              + Add Field
                            </button>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Submit button label</label>
                              <input value={section.submitButtonLabel || ''} onChange={(event) => updateSection(section.id, 'submitButtonLabel', event.target.value)} className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Thank-you message (shown after submitting)</label>
                              <textarea value={section.confirmationMessage || ''} onChange={(event) => updateSection(section.id, 'confirmationMessage', event.target.value)} rows={2} placeholder="Thank you! Your response has been recorded." className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                            </div>
                            <div className="space-y-2 rounded-lg bg-gray-50 p-3">
                              <label className="flex items-start gap-2 text-sm text-gray-700">
                                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={section.notifyTeacher !== false} onChange={(event) => updateSection(section.id, 'notifyTeacher', event.target.checked)} />
                                <span>Email the church owners when someone submits this form</span>
                              </label>
                              <label className="flex items-start gap-2 text-sm text-gray-700">
                                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={!!section.sendConfirmationEmail} onChange={(event) => updateSection(section.id, 'sendConfirmationEmail', event.target.checked)} />
                                <span>Email a copy to the person who filled it out <span className="text-gray-500">(needs an Email field in the form)</span></span>
                              </label>
                            </div>                          </div>
                        )}
                      </div>
                    )}

                    {/* Image Grid Section */}
                    {section.type === 'imageGrid' && (
                      <div>
                        {/* Layout selector and upload controls (edit mode) */}
                        {!previewMode && (
                          <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex-1 min-w-[150px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Layout</label>
                                <select
                                  value={section.gridLayout || '1x3'}
                                  onChange={(e) => updateSection(section.id, 'gridLayout', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                  <option value="1x3">3 images (1 row)</option>
                                  <option value="2x3">6 images (2 rows)</option>
                                  <option value="3x3">9 images (3 rows)</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Add Images</label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={(e) => handleGridImageUpload(e, section.id)}
                                  className="hidden"
                                  ref={(el) => (contentImageInputRefs.current[`${section.id}_grid`] = el)}
                                />
                                <button
                                  onClick={() => contentImageInputRefs.current[`${section.id}_grid`]?.click()}
                                  disabled={uploadingImage}
                                  className="px-4 py-2 bg-church-navy hover:bg-church-navy-deep text-white rounded-lg disabled:opacity-50"
                                >
                                  {uploadingImage ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Images'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Grid display */}
                        {section.gridImages && section.gridImages.length > 0 ? (
                          <div className="grid gap-4 grid-cols-3">
                            {section.gridImages.map((img, idx) => (
                              <div key={idx} className="relative group">
                                <img
                                  src={img.url}
                                  alt={img.caption || `Grid image ${idx + 1}`}
                                  className="w-full h-40 object-cover rounded-lg"
                                />
                                {!previewMode && (
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2 rounded-lg">
                                    <input
                                      type="text"
                                      value={img.caption || ''}
                                      onChange={(e) => {
                                        const newImages = [...section.gridImages];
                                        newImages[idx] = { ...newImages[idx], caption: e.target.value };
                                        updateSection(section.id, 'gridImages', newImages);
                                      }}
                                      placeholder="Caption (optional)"
                                      className="w-3/4 px-2 py-1 text-sm rounded"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <button
                                      onClick={() => {
                                        const newImages = section.gridImages.filter((_, i) => i !== idx);
                                        updateSection(section.id, 'gridImages', newImages);
                                      }}
                                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                )}
                                {img.caption && (
                                  <p className="text-sm text-gray-600 text-center mt-1">{img.caption}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          !previewMode && (
                            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                              Click &quot;Upload Images&quot; to add images to the grid
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {/* Image Carousel Section */}
                    {section.type === 'imageCarousel' && (
                      <div>
                        {/* Upload controls (edit mode) */}
                        {!previewMode && (
                          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-4">
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleCarouselImageUpload(e, section.id)}
                                className="hidden"
                                ref={(el) => (contentImageInputRefs.current[`${section.id}_carousel`] = el)}
                              />
                              <button
                                onClick={() => contentImageInputRefs.current[`${section.id}_carousel`]?.click()}
                                disabled={uploadingImage}
                                className="px-4 py-2 bg-church-navy hover:bg-church-navy-deep text-white rounded-lg disabled:opacity-50"
                              >
                                {uploadingImage ? `Uploading... ${Math.round(uploadProgress)}%` : 'Add Images'}
                              </button>
                              <span className="text-sm text-gray-500">
                                {section.carouselImages?.length || 0} images in carousel
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Carousel display */}
                        {section.carouselImages && section.carouselImages.length > 0 ? (
                          <div className="relative">
                            {/* Main image */}
                            <div className="relative overflow-hidden rounded-lg">
                              <img
                                src={section.carouselImages[carouselIndexes[section.id] || 0]?.url}
                                alt={section.carouselImages[carouselIndexes[section.id] || 0]?.caption || 'Carousel image'}
                                className="w-full h-64 object-cover"
                              />

                              {/* Left Arrow */}
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

                              {/* Right Arrow */}
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
                              <p className="text-center text-gray-600 mt-2">
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

                            {/* Edit mode: thumbnail strip for management */}
                            {!previewMode && (
                              <div className="mt-4 grid grid-cols-6 gap-2">
                                {section.carouselImages.map((img, idx) => (
                                  <div key={idx} className="relative group">
                                    <img
                                      src={img.url}
                                      alt={`Thumbnail ${idx + 1}`}
                                      className={`w-full h-16 object-cover rounded cursor-pointer ${
                                        (carouselIndexes[section.id] || 0) === idx ? 'ring-2 ring-church-navy' : ''
                                      }`}
                                      onClick={() => setCarouselIndexes(prev => ({ ...prev, [section.id]: idx }))}
                                    />
                                    <button
                                      onClick={() => {
                                        const newImages = section.carouselImages.filter((_, i) => i !== idx);
                                        updateSection(section.id, 'carouselImages', newImages);
                                        if ((carouselIndexes[section.id] || 0) >= newImages.length) {
                                          setCarouselIndexes(prev => ({ ...prev, [section.id]: Math.max(0, newImages.length - 1) }));
                                        }
                                      }}
                                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                                    >
                                      x
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          !previewMode && (
                            <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                              Click &quot;Add Images&quot; to create a carousel
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                  {!previewMode && renderInsertDivider(index + 1)}
                  </Fragment>
                ))}
                </div>
                <NewsletterFooter newsletter={newsletter} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsletterEditor;
