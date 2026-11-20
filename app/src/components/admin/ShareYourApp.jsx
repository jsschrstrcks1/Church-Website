// Share Your App - dashboard card where admins manage the church's public share page (/share), shared by every admin:
// copy links, add custom buttons, reorder the cards, and customize how the page looks.
// Data + uploads now go through the Worker api/client (settings + file uploads) instead of Firebase.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SITE_URL, CHURCH_NAME } from '../../firebase/config';
import {
  apiNewsletters,
  apiShareSettings,
  apiSaveShareSettings,
  apiFileUpload,
  apiFileUrl,
  apiFileDelete,
} from '../../api/client';
import { buildShareResources, orderShareResources, publicNewsletterFilter, CALENDAR_URL } from '../../utils/shareResources';
import {
  MAX_CUSTOM_BUTTONS,
  MAX_BUTTON_LABEL_LENGTH,
  normalizeButtonLink,
  describeButtonLink
} from '../../utils/customShareButtons';
import ColorWheelPicker from '../shared/ColorWheelPicker';
import CustomLinkButton from '../shared/CustomLinkButton';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// One draggable row in the Card Order tab
const SortableResourceCard = ({ resource }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: resource.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
      <button
        type="button"
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1 -m-1"
        aria-label={`Drag to reorder ${resource.name}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>
      <span className="text-xl flex-shrink-0">{resource.icon}</span>
      <span className="flex-1 text-sm font-medium text-gray-900 truncate">{resource.name}</span>
    </div>
  );
};

// Form for creating or editing one custom button on the Share Links tab
const CustomButtonEditor = ({ draft, onChange, onSave, onCancel, saving, error, isNew }) => {
  const update = (fields) => onChange({ ...draft, ...fields });

  return (
    <div className="p-4 bg-white border-2 border-[#ded8cd] rounded-xl space-y-5">
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Preview</p>
        <div className="max-w-sm mx-auto">
          <CustomLinkButton button={draft} preview />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="customButtonLabel" className="block text-sm font-medium text-gray-700 mb-1">
            Button text
          </label>
          <input
            id="customButtonLabel"
            type="text"
            value={draft.label}
            onChange={(e) => update({ label: e.target.value })}
            placeholder="e.g. Watch on YouTube"
            maxLength={MAX_BUTTON_LABEL_LENGTH}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c41d25] focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="customButtonUrl" className="block text-sm font-medium text-gray-700 mb-1">
            Link
          </label>
          <input
            id="customButtonUrl"
            type="text"
            value={draft.url}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="Website, email, or phone number"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c41d25] focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            A web address, an email (opens their email app), or a phone number (calls you).
          </p>
        </div>
      </div>

      <ColorWheelPicker
        label={draft.gradientEnabled ? 'Gradient start color' : 'Button color'}
        value={draft.color}
        onChange={(color) => update({ color })}
      />

      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={draft.gradientEnabled}
          onChange={(e) => update({ gradientEnabled: e.target.checked })}
          className="w-4 h-4 text-[#c41d25] rounded focus:ring-[#c41d25]"
        />
        Use a gradient
      </label>

      {draft.gradientEnabled && (
        <ColorWheelPicker
          label="Gradient end color"
          value={draft.gradientColor}
          onChange={(gradientColor) => update({ gradientColor })}
        />
      )}

      <p className="text-xs text-gray-500">
        The text color is picked automatically so it&apos;s always easy to read on your button.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2 pt-2 border-t">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-[#10295e] hover:bg-[#0b1d44] disabled:bg-[#c41d25] text-white font-semibold rounded-lg transition text-sm"
        >
          {saving ? 'Saving...' : isNew ? 'Add Button' : 'Save Button'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const newButtonDraft = () => ({
  id: `btn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  label: '',
  url: '',
  color: '#10295e',
  gradientEnabled: false,
  gradientColor: '#e6252e'
});

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

// apiFileUrl(id) ends in the id, so a settings URL round-trips back to a deletable file id.
const fileIdFromUrl = (url) => {
  try {
    const parts = String(url || '').split('/');
    const last = parts[parts.length - 1];
    return last && last !== '' ? last : null;
  } catch {
    return null;
  }
};

const ShareYourApp = ({ memberProfile }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('links'); // 'links', 'order', 'settings'
  const [copiedLink, setCopiedLink] = useState(null);
  const [newsletters, setNewsletters] = useState([]);
  const [loading, setLoading] = useState(true);

  // Customization settings state
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [homeScreenIconUrl, setHomeScreenIconUrl] = useState('');
  const [homeScreenIconType, setHomeScreenIconType] = useState(''); // real MIME type, for Android's manifest
  const [homeScreenIconFile, setHomeScreenIconFile] = useState(null);
  const [homeScreenIconPreview, setHomeScreenIconPreview] = useState('');
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [backgroundImageFile, setBackgroundImageFile] = useState(null);
  const [backgroundImagePreview, setBackgroundImagePreview] = useState('');
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [classroomTitle, setClassroomTitle] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [shareInstructionText, setShareInstructionText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  // Master Share Page card order (an array of resource ids); empty means "default order"
  const [resourceOrder, setResourceOrder] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderSaved, setOrderSaved] = useState(false);

  // Custom link buttons shown under the cards on the Master Share Page
  const [customButtons, setCustomButtons] = useState([]);
  const [buttonDraft, setButtonDraft] = useState(null); // the button being created/edited, or null
  const [buttonError, setButtonError] = useState('');
  const [savingButtons, setSavingButtons] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const memberId = 'church';
  const baseUrl = SITE_URL;

  // Default values for customization (also what the public page shows when a field is left blank)
  const defaultTitle = CHURCH_NAME;
  const defaultWelcome = 'Welcome! Everything you need is below.';
  const defaultInstruction = 'Then paste it into Notes or text it to yourself';

  // The share settings payload is one JSON blob, so every write carries the full set of
  // fields (customization + card order + custom buttons) merged over whatever just changed.
  const buildSettingsSnapshot = (extra = {}) => ({
    avatarUrl: avatarUrl || '',
    homeScreenIconUrl: homeScreenIconUrl || '',
    homeScreenIconType: homeScreenIconUrl ? (homeScreenIconType || '') : '',
    backgroundImageUrl: backgroundImageUrl || '',
    classroomTitle: classroomTitle.trim() || defaultTitle,
    welcomeMessage: welcomeMessage.trim() || defaultWelcome,
    shareInstructionText: shareInstructionText.trim() || defaultInstruction,
    resourceOrder: Array.isArray(resourceOrder) ? resourceOrder : [],
    customButtons: Array.isArray(customButtons) ? customButtons : [],
    updatedAt: new Date().toISOString(),
    ...extra,
  });

  // Load newsletters and customization data
  useEffect(() => {
    const loadData = async () => {
      try {
        // All of this member's active newsletters
        const list = await apiNewsletters(false);
        const newslettersData = list
          .filter(n => (n.status || 'active') === 'active')
          .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
        setNewsletters(newslettersData);

        // Load customization settings (all in one worker payload)
        const data = await apiShareSettings();
        if (data) {
          setAvatarUrl(data.avatarUrl || '');
          setClassroomTitle(data.classroomTitle || '');
          setWelcomeMessage(data.welcomeMessage || '');
          setShareInstructionText(data.shareInstructionText || '');
          setImagePreview(data.avatarUrl || '');
          setHomeScreenIconUrl(data.homeScreenIconUrl || '');
          setHomeScreenIconType(data.homeScreenIconType || '');
          setHomeScreenIconPreview(data.homeScreenIconUrl || '');
          setBackgroundImageUrl(data.backgroundImageUrl || '');
          setBackgroundImagePreview(data.backgroundImageUrl || '');
          setResourceOrder(Array.isArray(data.resourceOrder) ? data.resourceOrder : []);
          setCustomButtons(Array.isArray(data.customButtons) ? data.customButtons : []);
        }
      } catch (error) {
        console.error('Error loading share data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const shareableLinks = [
    {
      id: 'master',
      name: 'Master Share Page',
      description: 'One link with the calendar and newsletters',
      url: `${baseUrl}/share`,
      icon: '🔗',
      alwaysAvailable: true
    },
    {
      id: 'calendar',
      name: 'Church Calendar',
      description: 'Events on the home page',
      url: `${baseUrl}${CALENDAR_URL}`,
      icon: '📅',
      alwaysAvailable: true
    },
    ...newsletters.map(newsletter => ({
      id: `newsletter-${newsletter.id}`,
      name: `Newsletter: ${newsletter.name || newsletter.title || 'Untitled'}`,
      description: !newsletter.published
        ? 'Not yet published'
        : publicNewsletterFilter(newsletter)
          ? 'Published · on the share page'
          : 'Published · hidden from the share page (turn on "Show on the church share page" in Newsletters)',
      url: newsletter.isPrimary
        ? `${baseUrl}/newsletter/${memberId}`
        : `${baseUrl}/newsletter/${memberId}/${newsletter.id}`,
      icon: '📰',
      available: newsletter.published
    }))
  ];

  // The exact same cards, and the same filters, a visitor sees on the Master Share Page -
  // built from the same shared util as SharePage.jsx so this list never lies to the member
  const sharePageResources = orderShareResources(
    buildShareResources({ memberId, newsletters: newsletters.filter(publicNewsletterFilter) }),
    resourceOrder
  );
  const pinnedResource = sharePageResources.find((r) => r.pinned);
  const draggableResources = sharePageResources.filter((r) => !r.pinned);

  const saveResourceOrder = async (newOrder) => {
    setSavingOrder(true);
    try {
      await apiSaveShareSettings(buildSettingsSnapshot({ resourceOrder: newOrder }));
      setOrderSaved(true);
      setTimeout(() => setOrderSaved(false), 2000);
    } catch (error) {
      console.error('Error saving card order:', error);
      alert('Failed to save the new order. Please try again.');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = draggableResources.findIndex((r) => r.id === active.id);
    const newIndex = draggableResources.findIndex((r) => r.id === over.id);
    const newOrder = arrayMove(draggableResources, oldIndex, newIndex).map((r) => r.id);

    setResourceOrder(newOrder);
    saveResourceOrder(newOrder);
  };

  const handleResetOrder = () => {
    setResourceOrder([]);
    saveResourceOrder([]);
  };

  const persistCustomButtons = async (nextButtons) => {
    setSavingButtons(true);
    try {
      await apiSaveShareSettings(buildSettingsSnapshot({ customButtons: nextButtons }));
      setCustomButtons(nextButtons);
      return true;
    } catch (error) {
      console.error('Error saving custom buttons:', error);
      return false;
    } finally {
      setSavingButtons(false);
    }
  };

  const handleSaveButtonDraft = async () => {
    const label = buttonDraft.label.trim();
    if (!label) {
      setButtonError('Please add some text for the button.');
      return;
    }
    const url = normalizeButtonLink(buttonDraft.url);
    if (!url) {
      setButtonError('That link doesn\'t look right. Use a web address (like example.com), an email address, or a phone number.');
      return;
    }

    const saved = { ...buttonDraft, label, url };
    const exists = customButtons.some((b) => b.id === saved.id);
    if (!exists && customButtons.length >= MAX_CUSTOM_BUTTONS) {
      setButtonError(`You can add up to ${MAX_CUSTOM_BUTTONS} buttons.`);
      return;
    }
    const nextButtons = exists
      ? customButtons.map((b) => (b.id === saved.id ? saved : b))
      : [...customButtons, saved];

    if (await persistCustomButtons(nextButtons)) {
      setButtonDraft(null);
      setButtonError('');
    } else {
      setButtonError('Failed to save the button. Please try again.');
    }
  };

  const handleDeleteButton = async (button) => {
    if (!window.confirm(`Remove the "${button.label}" button from the church share page? Every admin shares this page.`)) return;
    if (!(await persistCustomButtons(customButtons.filter((b) => b.id !== button.id)))) {
      alert('Failed to remove the button. Please try again.');
    }
  };

  const startEditingButton = (button) => {
    setButtonError('');
    // Show emails/phone numbers the way the member typed them, without the mailto:/tel: prefix
    setButtonDraft(button ? { ...button, url: button.url.replace(/^(mailto|tel):/i, '') } : newButtonDraft());
  };

  const copyToClipboard = async (url, linkId) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(linkId);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy link. Please copy manually: ' + url);
    }
  };

  const getColorClasses = () => {
    // All links share the brand navy/teal palette so the section matches the dashboard tiles
    const brand = { bg: 'bg-[#f6f0e4]', text: 'text-[#c41d25]', border: 'border-[#ded8cd]', button: 'bg-[#10295e] hover:bg-[#0b1d44]' };
    return brand;
  };

  // Customization handlers
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = async () => {
    if (avatarUrl) {
      const id = fileIdFromUrl(avatarUrl);
      if (id) {
        try {
          await apiFileDelete(id);
        } catch (error) {
          console.error('Error deleting image:', error);
        }
      }
    }
    setAvatarUrl('');
    setImageFile(null);
    setImagePreview('');
  };

  const uploadImage = async () => {
    if (!imageFile) return avatarUrl;

    setUploadingImage(true);
    try {
      const dataUrl = await readFileAsDataUrl(imageFile);
      const { id } = await apiFileUpload(imageFile.name, imageFile.type, dataUrl);
      return apiFileUrl(id);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
      return avatarUrl;
    } finally {
      setUploadingImage(false);
    }
  };

  // Home screen icon - the icon iOS shows if someone adds this member's share link to their
  // home screen. Only square images make sense there, so that's checked before accepting the file.
  const handleIconChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Icon must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      const img = new window.Image();
      img.onload = () => {
        if (img.naturalWidth !== img.naturalHeight) {
          alert('Please upload a square image (equal width and height) - ideally 512x512 or 192x192 pixels.');
          return;
        }
        if (img.naturalWidth < 192) {
          alert('For best results on phones, upload an image at least 192x192 pixels.');
          return;
        }
        setHomeScreenIconFile(file);
        setHomeScreenIconType(file.type);
        setHomeScreenIconPreview(dataUrl);
      };
      img.onerror = () => {
        alert('Could not read that image. Please try a different file.');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveHomeScreenIcon = async () => {
    if (homeScreenIconUrl) {
      const id = fileIdFromUrl(homeScreenIconUrl);
      if (id) {
        try {
          await apiFileDelete(id);
        } catch (error) {
          console.error('Error deleting home screen icon:', error);
        }
      }
    }
    setHomeScreenIconUrl('');
    setHomeScreenIconType('');
    setHomeScreenIconFile(null);
    setHomeScreenIconPreview('');
  };

  const uploadHomeScreenIcon = async () => {
    if (!homeScreenIconFile) return homeScreenIconUrl;

    setUploadingIcon(true);
    try {
      const dataUrl = await readFileAsDataUrl(homeScreenIconFile);
      const { id } = await apiFileUpload(homeScreenIconFile.name, homeScreenIconFile.type, dataUrl);
      return apiFileUrl(id);
    } catch (error) {
      console.error('Error uploading home screen icon:', error);
      alert('Failed to upload icon. Please try again.');
      return homeScreenIconUrl;
    } finally {
      setUploadingIcon(false);
    }
  };

  // Page background - the fixed image behind the Master Share Page, same idea as a newsletter
  // background. No square requirement here, unlike the home screen icon: this is meant to be a
  // full, usually landscape, photo.
  const handleBackgroundChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Background image must be less than 5MB');
      return;
    }

    setBackgroundImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setBackgroundImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBackgroundImage = async () => {
    if (backgroundImageUrl) {
      const id = fileIdFromUrl(backgroundImageUrl);
      if (id) {
        try {
          await apiFileDelete(id);
        } catch (error) {
          console.error('Error deleting background image:', error);
        }
      }
    }
    setBackgroundImageUrl('');
    setBackgroundImageFile(null);
    setBackgroundImagePreview('');
  };

  const uploadBackgroundImage = async () => {
    if (!backgroundImageFile) return backgroundImageUrl;

    setUploadingBackground(true);
    try {
      const dataUrl = await readFileAsDataUrl(backgroundImageFile);
      const { id } = await apiFileUpload(backgroundImageFile.name, backgroundImageFile.type, dataUrl);
      return apiFileUrl(id);
    } catch (error) {
      console.error('Error uploading background image:', error);
      alert('Failed to upload background image. Please try again.');
      return backgroundImageUrl;
    } finally {
      setUploadingBackground(false);
    }
  };

  const handleSaveCustomization = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      let finalAvatarUrl = avatarUrl;
      if (imageFile) {
        finalAvatarUrl = await uploadImage();
      }

      let finalHomeScreenIconUrl = homeScreenIconUrl;
      if (homeScreenIconFile) {
        finalHomeScreenIconUrl = await uploadHomeScreenIcon();
      }

      let finalBackgroundImageUrl = backgroundImageUrl;
      if (backgroundImageFile) {
        finalBackgroundImageUrl = await uploadBackgroundImage();
      }

      await apiSaveShareSettings(buildSettingsSnapshot({
        avatarUrl: finalAvatarUrl,
        homeScreenIconUrl: finalHomeScreenIconUrl,
        homeScreenIconType: finalHomeScreenIconUrl ? homeScreenIconType : '',
        backgroundImageUrl: finalBackgroundImageUrl,
        classroomTitle: classroomTitle.trim() || defaultTitle,
        welcomeMessage: welcomeMessage.trim() || defaultWelcome,
        shareInstructionText: shareInstructionText.trim() || defaultInstruction,
      }));

      setAvatarUrl(finalAvatarUrl);
      setImageFile(null);
      setHomeScreenIconUrl(finalHomeScreenIconUrl);
      setHomeScreenIconFile(null);
      setBackgroundImageUrl(finalBackgroundImageUrl);
      setBackgroundImageFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving customization:', error);
      alert('Failed to save customization. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetCustomization = () => {
    setClassroomTitle('');
    setWelcomeMessage('');
    setShareInstructionText('');
    handleRemoveImage();
    handleRemoveHomeScreenIcon();
    handleRemoveBackgroundImage();
  };

  const getInitial = () => {
    return 'N';
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Card Header - Clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[#c41d25] to-[#10295e] rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 text-lg">Share Your App</h3>
            <p className="text-sm text-gray-600">Share links with the church family</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {shareableLinks.filter(l => l.available || l.alwaysAvailable).length} links available
          </span>
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 bg-white">
            <div className="flex">
              <button
                onClick={() => setActiveTab('links')}
                className={`flex-1 px-6 py-3 font-medium transition ${
                  activeTab === 'links'
                    ? 'text-[#c41d25] border-b-2 border-[#10295e] bg-gray-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                📤 Share Links
              </button>
              <button
                onClick={() => setActiveTab('order')}
                className={`flex-1 px-6 py-3 font-medium transition ${
                  activeTab === 'order'
                    ? 'text-[#c41d25] border-b-2 border-[#10295e] bg-gray-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                🔀 Card Order
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 px-6 py-3 font-medium transition ${
                  activeTab === 'settings'
                    ? 'text-[#c41d25] border-b-2 border-[#10295e] bg-gray-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                ⚙️ Customize Page
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10295e]"></div>
              </div>
            ) : activeTab === 'order' ? (
              // Card Order Panel - controls the order cards appear in for EVERY visitor to the Master Share Page
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Master Share Page Card Order</h4>
                  <p className="text-sm text-gray-600">
                    Drag to change the order these cards appear in. This is what everyone sees when they open your Master Share Page link, and the order updates for everyone right away.
                  </p>
                </div>

                {pinnedResource && (
                  <div className="flex items-center gap-3 p-3 bg-[#fbf7ef] border-2 border-[#ded8cd] rounded-lg">
                    <span className="text-gray-400 flex-shrink-0" title="Always shown first">📌</span>
                    <span className="text-xl flex-shrink-0">{pinnedResource.icon}</span>
                    <span className="flex-1 text-sm font-medium text-gray-900 truncate">{pinnedResource.name}</span>
                    <span className="text-xs text-[#c41d25] font-medium whitespace-nowrap">Always first</span>
                  </div>
                )}

                {draggableResources.length > 0 ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={draggableResources.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {draggableResources.map((resource) => (
                          <SortableResourceCard key={resource.id} resource={resource} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <p className="text-sm text-gray-500 py-6 text-center">
                    Publish a newsletter to add more cards to reorder.
                  </p>
                )}

                <div className="flex items-center justify-between pt-3 border-t">
                  <p className="text-xs text-gray-500">
                    {savingOrder ? 'Saving...' : orderSaved ? '✓ Saved' : 'Drag a card - changes save automatically'}
                  </p>
                  {resourceOrder.length > 0 && (
                    <button
                      type="button"
                      onClick={handleResetOrder}
                      className="text-xs text-gray-500 hover:text-red-600 underline"
                    >
                      Reset to default order
                    </button>
                  )}
                </div>
              </div>
            ) : activeTab === 'settings' ? (
              // Settings/Customization Panel
              <form onSubmit={handleSaveCustomization} className="space-y-6">
                {/* Avatar Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Profile Image
                  </label>
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Avatar preview"
                          className="w-20 h-20 rounded-full object-cover border-4 border-[#f6f0e4] shadow-md"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gradient-to-br from-[#c41d25] to-[#10295e] rounded-full flex items-center justify-center shadow-md">
                          <span className="text-3xl text-white font-bold">{getInitial()}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2">
                        <label className="px-4 py-2 bg-[#10295e] hover:bg-[#0b1d44] text-white rounded-lg cursor-pointer transition text-sm font-medium">
                          Upload Image
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </label>
                        {(imagePreview || avatarUrl) && (
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition text-sm font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Max 5MB. Shows an N if no image is uploaded.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Home Screen Icon Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Home Screen Icon
                  </label>
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0">
                      <img
                        src={homeScreenIconPreview || '/images/logo.png'}
                        alt={homeScreenIconPreview ? 'Home screen icon preview' : 'Default app icon'}
                        className={`w-20 h-20 rounded-2xl object-cover shadow-md border-4 ${
                          homeScreenIconPreview ? 'border-[#f6f0e4]' : 'border-gray-100'
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2">
                        <label className="px-4 py-2 bg-[#10295e] hover:bg-[#0b1d44] text-white rounded-lg cursor-pointer transition text-sm font-medium">
                          {uploadingIcon ? 'Uploading...' : 'Upload Icon'}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleIconChange}
                            disabled={uploadingIcon}
                            className="hidden"
                          />
                        </label>
                        {(homeScreenIconPreview || homeScreenIconUrl) && (
                          <button
                            type="button"
                            onClick={handleRemoveHomeScreenIcon}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition text-sm font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Shown when someone adds the share link to their phone&apos;s home screen. Use a square image - ideally 512x512, at least 192x192. Max 2MB. If nothing is uploaded, the church logo is used.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Page Background Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Page Background
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    A background for the Master Share Page - it stays fixed in place while the cards scroll over it, the same way newsletters work. If nothing is uploaded, a plain cream background is used.
                  </p>

                  {backgroundImagePreview && (
                    <div
                      className="w-full h-40 rounded-lg bg-cover bg-center bg-no-repeat border border-gray-200 mb-3"
                      style={{ backgroundImage: `url(${backgroundImagePreview})` }}
                    >
                      <div className="w-full h-full bg-black/20 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded">
                          Background Preview
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <label className="px-4 py-2 bg-[#10295e] hover:bg-[#0b1d44] text-white rounded-lg cursor-pointer transition text-sm font-medium">
                      {uploadingBackground ? 'Uploading...' : backgroundImagePreview ? 'Change Background' : 'Upload Background Image'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleBackgroundChange}
                        disabled={uploadingBackground}
                        className="hidden"
                      />
                    </label>
                    {(backgroundImagePreview || backgroundImageUrl) && (
                      <button
                        type="button"
                        onClick={handleRemoveBackgroundImage}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition text-sm font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Accepts JPG, PNG, or WebP. Max 5MB. For best results, use a photo at least 1920x1080 pixels.
                  </p>
                </div>

                {/* Page Title (stored as classroomTitle, an older field name kept for saved pages) */}
                <div>
                  <label htmlFor="classroomTitle" className="block text-sm font-medium text-gray-700 mb-2">
                    Page Title
                  </label>
                  <input
                    type="text"
                    id="classroomTitle"
                    value={classroomTitle}
                    onChange={(e) => setClassroomTitle(e.target.value)}
                    placeholder={defaultTitle}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c41d25] focus:border-transparent"
                    maxLength={100}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default: <span className="italic">{defaultTitle}</span>
                  </p>
                </div>

                {/* Welcome Message */}
                <div>
                  <label htmlFor="welcomeMessage" className="block text-sm font-medium text-gray-700 mb-2">
                    Welcome Message
                  </label>
                  <textarea
                    id="welcomeMessage"
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder={defaultWelcome}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c41d25] focus:border-transparent resize-none"
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default: <span className="italic">{defaultWelcome}</span>
                  </p>
                </div>

                {/* Share Instruction */}
                <div>
                  <label htmlFor="shareInstructionText" className="block text-sm font-medium text-gray-700 mb-2">
                    Share Link Instruction
                  </label>
                  <input
                    type="text"
                    id="shareInstructionText"
                    value={shareInstructionText}
                    onChange={(e) => setShareInstructionText(e.target.value)}
                    placeholder={defaultInstruction}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c41d25] focus:border-transparent"
                    maxLength={100}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default: <span className="italic">{defaultInstruction}</span>
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="submit"
                    disabled={saving || uploadingImage}
                    className="flex-1 px-6 py-3 bg-[#10295e] hover:bg-[#0b1d44] disabled:bg-[#c41d25] text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {saving || uploadingImage ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        {uploadingImage ? 'Uploading...' : 'Saving...'}
                      </>
                    ) : saved ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Saved!
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCustomization}
                    className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition"
                  >
                    Reset
                  </button>
                </div>
              </form>
            ) : (
              // Share Links Panel
              <div className="space-y-4">
              {/* Master Link - Highlighted */}
              <div className="p-4 bg-gradient-to-r from-[#fbf7ef] to-[#f6f0e4] border-2 border-[#ded8cd] rounded-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🔗</span>
                    <div>
                      <h4 className="font-semibold text-gray-900">Master Share Page</h4>
                      <p className="text-sm text-gray-600 mb-2">One link for the church family with the calendar and newsletters. Every admin manages this same page.</p>
                      <code className="text-xs bg-white px-2 py-1 rounded border text-gray-700 break-all block">
                        {baseUrl}/share
                      </code>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => copyToClipboard(`${baseUrl}/share`, 'master')}
                      className={`px-4 py-2 text-white font-medium rounded-lg transition text-sm whitespace-nowrap ${
                        copiedLink === 'master' ? 'bg-green-600' : 'bg-[#10295e] hover:bg-[#0b1d44]'
                      }`}
                    >
                      {copiedLink === 'master' ? '✓ Copied!' : 'Copy Link'}
                    </button>
                    <Link
                      to="/share"
                      target="_blank"
                      className="px-4 py-2 bg-white border border-[#ded8cd] text-[#c41d25] font-medium rounded-lg hover:bg-[#fbf7ef] transition text-sm text-center whitespace-nowrap"
                    >
                      Preview
                    </Link>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-gray-50 text-sm text-gray-500">Individual Links</span>
                </div>
              </div>

              {/* Individual Links Grid */}
              <div className="grid md:grid-cols-2 gap-3">
                {shareableLinks.filter(link => link.id !== 'master').map(link => {
                  const colors = getColorClasses(link.color);
                  const isAvailable = link.available || link.alwaysAvailable;
                  
                  return (
                    <div 
                      key={link.id} 
                      className={`p-4 bg-white border rounded-lg ${
                        isAvailable ? colors.border : 'border-gray-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <span className="text-xl">{link.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 text-sm truncate">{link.name}</h4>
                          <p className={`text-xs ${isAvailable ? 'text-gray-500' : 'text-amber-600'}`}>
                            {link.description}
                          </p>
                        </div>
                      </div>
                      {isAvailable && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => copyToClipboard(link.url, link.id)}
                            className={`flex-1 px-3 py-1.5 text-white text-xs font-medium rounded transition ${
                              copiedLink === link.id ? 'bg-green-600' : colors.button
                            }`}
                          >
                            {copiedLink === link.id ? '✓ Copied!' : 'Copy'}
                          </button>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition"
                          >
                            View
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Custom Buttons */}
              <div className="relative pt-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-gray-50 text-sm text-gray-500">Custom Buttons</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 text-center -mt-1">
                Add your own buttons to the bottom of the Master Share Page - link to anything, like online giving, the YouTube channel, or the church email.
              </p>

              <div className="space-y-3">
                {customButtons.map((button) => (
                  buttonDraft?.id === button.id ? (
                    <CustomButtonEditor
                      key={button.id}
                      draft={buttonDraft}
                      onChange={setButtonDraft}
                      onSave={handleSaveButtonDraft}
                      onCancel={() => setButtonDraft(null)}
                      saving={savingButtons}
                      error={buttonError}
                      isNew={false}
                    />
                  ) : (
                    <div key={button.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl">
                      <div className="w-40 sm:w-56 flex-shrink-0">
                        <CustomLinkButton button={button} preview />
                      </div>
                      <p className="flex-1 min-w-0 text-xs text-gray-500 truncate" title={button.url}>
                        {describeButtonLink(button.url)}
                      </p>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditingButton(button)}
                          disabled={!!buttonDraft || savingButtons}
                          className="p-2 text-gray-500 hover:text-[#c41d25] hover:bg-[#fbf7ef] rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Edit button"
                          aria-label={`Edit ${button.label}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteButton(button)}
                          disabled={!!buttonDraft || savingButtons}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Remove button"
                          aria-label={`Remove ${button.label}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                ))}

                {/* New button being created */}
                {buttonDraft && !customButtons.some((b) => b.id === buttonDraft.id) && (
                  <CustomButtonEditor
                    draft={buttonDraft}
                    onChange={setButtonDraft}
                    onSave={handleSaveButtonDraft}
                    onCancel={() => setButtonDraft(null)}
                    saving={savingButtons}
                    error={buttonError}
                    isNew
                  />
                )}

                {!buttonDraft && (
                  customButtons.length < MAX_CUSTOM_BUTTONS ? (
                    <button
                      type="button"
                      onClick={() => startEditingButton(null)}
                      className="w-full py-6 border-2 border-dashed border-gray-300 hover:border-[#c41d25] hover:bg-[#fbf7ef]/50 rounded-xl text-gray-500 hover:text-[#c41d25] transition flex flex-col items-center gap-1"
                    >
                      <span className="w-10 h-10 rounded-full bg-white border-2 border-current flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </span>
                      <span className="text-sm font-medium">Add a custom button</span>
                      <span className="text-xs text-gray-400">{customButtons.length} of {MAX_CUSTOM_BUTTONS} used</span>
                    </button>
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-2">
                      You&apos;ve reached the limit of {MAX_CUSTOM_BUTTONS} buttons. Remove one to add another.
                    </p>
                  )
                )}
              </div>

              {/* Tip */}
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  💡 <strong>Tip:</strong> Use the Master Share Page link to give the church family everything in one place!
                </p>
              </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareYourApp;
