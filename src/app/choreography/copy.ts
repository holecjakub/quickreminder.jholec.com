// Page copy (landing spec §7): headlines are fixed by the spec, the rest is a draft Jakub edits.
// Facts follow the app's README "Use" table and SPEC §1.
import {
  ArrowsLeftRight,
  Browser,
  CalendarBlank,
  CalendarCheck,
  CheckCircle,
  Clock,
  ClockCounterClockwise,
  CursorClick,
  Flag,
  GearSix,
  Keyboard,
  Lightning,
  Link,
  ListBullets,
  MagnifyingGlass,
  MapPin,
  Palette,
  Scales,
  SealCheck,
  ShieldCheck,
  SquaresFour,
  Translate,
  X,
  type Icon,
} from '@phosphor-icons/react';
import { DEMO_REMINDER } from './demo';
import type { SectionId } from './snapshot';

export interface FeatureBullet {
  readonly icon: Icon;
  readonly text: string;
}

export interface FeatureCopy {
  readonly id: Exclude<SectionId, 'hero'>;
  readonly label: string;
  readonly headline: string;
  readonly paragraph: string;
  readonly secondary?: string;
  readonly bullets: readonly FeatureBullet[];
}

/** "(02) Dates /" — jholec.com numbered section title (landing §7.3, contracts §6.1). */
export function sectionTitle(id: Exclude<SectionId, 'hero'>, label: string): string {
  return `(${id}) ${label} /`;
}

export const HERO_COPY: { readonly title: 'A reminder, straight out of the notch.'; readonly subtitle: string } = {
  title: 'A reminder, straight out of the notch.',
  subtitle: 'A free Mac app that adds reminders from the notch. The screen above is live: click the notch and type.',
};

export const FEATURE_COPY: readonly FeatureCopy[] = [
  {
    id: '01',
    label: 'Shortcut',
    headline: 'One shortcut.',
    paragraph:
      'Press ⇧⌘R in any app and the notch opens into a panel, with the cursor already in the title. The app you were using stays in front, so you are back in it the moment you save.',
    bullets: [
      { icon: Keyboard, text: '⇧⌘R from anywhere, or a shortcut of your own' },
      { icon: CursorClick, text: 'Or click the notch, like on the screen here' },
      { icon: X, text: 'Esc, ⓧ or a click outside closes it without saving' },
    ],
  },
  {
    id: '02',
    label: 'Dates',
    headline: 'Say when.',
    paragraph:
      'Write the date the way you would say it. The panel spots the phrase and shows when you will be reminded. Tab applies it and takes the phrase out of the title.',
    secondary: `Czech works too: “${DEMO_REMINDER.czechExample}”.`,
    bullets: [
      { icon: CalendarCheck, text: '“tomorrow at 2pm”, “in 2 hours”, “v pátek”' },
      { icon: Lightning, text: 'Skip the Tab and the date is applied when you save' },
      { icon: Translate, text: 'English and Czech. With two dates, the last one counts' },
    ],
  },
  {
    id: '03',
    label: 'Set Date',
    headline: 'Set the date in the notch.',
    paragraph:
      'Press ⌘D or the calendar button and the panel grows downward into Set Date. Type a date, pick a preset, or set the day and time. Nothing above it moves.',
    bullets: [
      { icon: SquaresFour, text: 'Six presets on ⌘1 to ⌘6, from “In 1 Hour” to “Next Month”' },
      { icon: CalendarBlank, text: '⌘K opens a month calendar, and the arrow keys move the day' },
      { icon: Clock, text: 'Type “fri 2pm”, “+90m” or “1430” and check the preview before you set it' },
    ],
  },
  {
    id: '04',
    label: 'Lists',
    headline: 'Your lists, your colour.',
    paragraph:
      'Click “Reminders ▾” to pick a list. The panel takes on the list’s colour: the header, the save button, the date chip and the text cursor all follow.',
    bullets: [
      { icon: ListBullets, text: 'All your lists from Apple Reminders, each in its own colour' },
      { icon: Palette, text: 'On light colours the labels turn dark, so they stay readable' },
      { icon: ClockCounterClockwise, text: 'The list you pick is the one you get next time' },
    ],
  },
  {
    id: '05',
    label: 'Flag & location',
    headline: 'Flag it, pin it.',
    paragraph:
      'The flag marks what matters. The pin grows the panel into a Location field, right below the bar, like Set Date. Type a place and press Return: it is saved in the notes as “📍 Office”, so you see it wherever the reminder shows up.',
    bullets: [
      { icon: Flag, text: 'A flagged reminder is saved with high priority' },
      { icon: MapPin, text: 'The place is a line of text in the notes. Nothing tracks your location' },
      { icon: ArrowsLeftRight, text: 'Switch between Location and Set Date and what you typed stays' },
    ],
  },
  {
    id: '06',
    label: 'Save',
    headline: 'Save, and it flies home.',
    paragraph:
      'Press ⌘↩, Return or the check button. The panel folds back into the notch, a check mark lands next to it, and the reminder is already in your list.',
    bullets: [
      { icon: CheckCircle, text: 'Saved to Apple Reminders through EventKit, so it syncs like any other reminder' },
      { icon: Browser, text: 'Here it lands in the window on the desktop and never leaves your browser' },
    ],
  },
];

export const INTEGRATIONS_COPY: FeatureCopy & {
  readonly cards: readonly { icon: Icon; title: string; body: string }[];
  readonly terminalCommand: 'open quickreminder://show';
} = {
  id: '07',
  label: 'Integrations',
  headline: 'Everywhere you already are.',
  paragraph:
    'Open the panel from Raycast, from Shortcuts or from a script. Launching the app from Spotlight or the Dock opens it too.',
  bullets: [],
  cards: [
    { icon: MagnifyingGlass, title: 'Raycast', body: 'Type “Quick Reminder” in Raycast. The repo ships a Script Command for it.' },
    { icon: Lightning, title: 'Shortcuts', body: 'Add an Open URL action with quickreminder://show to any shortcut.' },
    { icon: Link, title: 'URL scheme', body: 'quickreminder://show, hide and toggle work from scripts and other apps.' },
    {
      icon: GearSix,
      title: 'Settings',
      body: 'Launch at login, your own hotkey, the default list, and whether Set Date opens in the notch or as a popover.',
    },
  ],
  terminalCommand: 'open quickreminder://show',
};

export const DOWNLOAD_COPY: {
  headline: 'Free. Open source. macOS 26.';
  primary: 'Download for macOS';
  secondary: 'View on GitHub';
  facts: readonly { icon: Icon; title: string; detail: string }[];
  requirements: string;
  note: string;
} = {
  headline: 'Free. Open source. macOS 26.',
  primary: 'Download for macOS',
  secondary: 'View on GitHub',
  facts: [
    { icon: SealCheck, title: 'Notarized Developer ID build', detail: 'Signed and notarized, so macOS opens it without a warning.' },
    { icon: ShieldCheck, title: 'Only EventKit, no private APIs', detail: 'It reads and writes your reminders through Apple’s public framework.' },
    { icon: Scales, title: 'MIT licence', detail: 'Read the code, build it yourself, or change it.' },
  ],
  requirements: 'Requires macOS 26 on Apple silicon. Works on Macs without a notch too, with a virtual notch at the top of the screen.',
  note: 'On first launch, macOS asks for access to Reminders.',
};

export const FOOTER_COPY: { madeBy: 'Made by Jakub Holec'; disclaimer: string; siteNote: string } = {
  madeBy: 'Made by Jakub Holec',
  disclaimer:
    'Not affiliated with, endorsed by or sponsored by Apple Inc. Apple, macOS, iOS, Xcode, SF Symbols and Reminders are trademarks of Apple Inc. ' +
    'QuickReminder is an independent, from-scratch implementation using only public Apple frameworks; it contains no Apple source code or assets and uses no private APIs. ' +
    'It reads and writes your reminders through the public EventKit framework.',
  siteNote:
    'The desktop, wallpaper, window and cursor on this page are original drawings, and the icons are Phosphor. Nothing on this page is an Apple asset.',
};
