# Design System: KZ Game Hub (Neo-brutalist Party Game Arcade)

Comprehensive `DESIGN.md` design system specification for the KZ Game Hub multiplayer platform, extracted from active Next.js and Tailwind codebase configurations.

## 1. Visual Theme & Atmosphere

A high-energy, playful Neo-brutalist party game arcade. High-contrast solid borders, stark black drop-shadows with zero blur, vivid candy-tone card accents, and a warm canary-yellow background create an unmistakable tactile, physical board game aesthetic. Micro-interactions simulate physical button presses via coordinate translation (`translate-x-[2px] translate-y-[2px]`) and corresponding shadow reduction.

## 2. Color Palette & Roles

### Primary Foundation
- **Canary Arcade Yellow (`#FEF08A`)**: Primary viewport canvas background and lively party game backdrop.
- **Warm Cream (`#FEFCE8`)**: Secondary subtle base background (amber-50) for loading states and dialog backings.
- **Card White (`#FFFFFF`)**: High-contrast foreground container surfaces, input backgrounds, and modal bases.
- **Obsidian Black (`#000000`)**: Structural framing, 4px and 2px architectural borders, heavy text, and crisp 0-blur drop shadows.

### Accent & Interactive
- **Electric Purple (`#A855F7`)**: Primary action button fill (`hover: #9333EA`), room join triggers, and highlight focus rings (`#8B5CF6`).
- **Indigo Spark (`#818CF8`)**: Secondary actions, phase badges, and active state indicators (`hover: #6366F1`).
- **Neutral Stone (`#F3F4F6` to `#E5E7EB`)**: Button hover states and secondary interactive pill surfaces.

### Game Identity Badges & Cards
- **Insider / Who Know (`#818CF8`)**: Mysterious indigo with white typography.
- **Sounds Fishy (`#C084FC`)**: Vibrant lilac with white typography.
- **Hand Duel / RPS (`#FBBF24`)**: Warm amber with black typography.
- **Detective Club (`#FDE047`)**: Bright detective yellow with black typography.
- **Who Am I (`#F472B6`)**: Playful candy pink with white typography.
- **Who First (`#34D399`)**: High-contrast emerald buzzer green with white typography.
- **The Mind (`#22D3EE`)**: Telepathic cyan with black typography.
- **Saboteur (`#F97316`)**: Explosive mining orange with white typography.
- **Coup (`#EF4444`)**: Deceptive royal red with white typography.
- **Card Game / Pok Deng (`#F59E0B`)**: Casino felt gold with black typography.
- **Banana Thief (`#EAB308`)**: Jungle monkey yellow with black typography.
- **Tic-Tac-Toe / Gobbler (`#A1A1AA`)**: Minimalist slate zinc with white typography.

### Typography & Text Hierarchy
- **Deep Black (`#000000`)**: Primary headings, labels, button labels, and high-emphasis uppercase titles.
- **Slate Ink (`#1E293B`)**: High-legibility body copy and description blocks.
- **Muted Slate (`#64748B`)**: Secondary metadata, room code hints, and timestamps.
- **Inverted White (`#FFFFFF`)**: High-contrast button text over dark/vibrant action fills.

### Functional States
- **Success (`#10B981`)**: Connected status indicators, correct guesses, winning states.
- **Warning / Pending (`#F59E0B`)**: Timer countdowns, secret word setting phase.
- **Destructive / Alert (`#EF4444`)**: Leave room, eliminate player, error banners.

## 3. Typography Rules

- **IBM Plex Sans Thai / Sans-Serif**:
  - **Display Titles (Home & Header)**: `4xl` to `5xl` (`36px` to `48px`), `font-black` (`900` weight), uppercase, `tracking-tighter` (`-0.05em`).
  - **Subheadings & Modal Titles**: `2xl` (`24px`), `font-black` (`900` weight), uppercase, `tracking-tight`.
  - **Button Text & Action Badges**: `sm` to `base` (`14px` to `16px`), `font-black` (`900` weight), uppercase, `tracking-wider` (`0.05em`).
  - **Input Labels & Captions**: `xs` to `sm` (`12px` to `14px`), `font-black` (`900` weight), uppercase, `tracking-widest` (`0.1em`).
  - **Body Copy**: `base` (`16px`), `font-medium` to `font-bold` (`500` - `700` weight), `leading-relaxed`.

## 4. Component Stylings

- **Buttons (Neo-brutalist)**:
  - Solid vibrant fill with `border-4 border-black`.
  - Hard shadow: `shadow-[4px_4px_0_0_#000]`.
  - Physical press effect: `hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px]`.
  - Active press: `active:shadow-none active:translate-x-[4px] active:translate-y-[4px]`.
  - Disabled state: `bg-gray-400 text-white border-black cursor-not-allowed hover:translate-x-0 hover:translate-y-0`.
- **Containers & Cards**:
  - Crisp `#FFFFFF` surface with `border-4 border-black` and `shadow-[8px_8px_0_0_#000]` for major cards, or `shadow-[4px_4px_0_0_#000]` for compact sub-cards.
  - Border radius is sharp to minimal (`rounded-none` or `rounded-lg`).
- **Form Inputs & Selects**:
  - `#FFFFFF` surface with `border-4 border-black`, `shadow-[4px_4px_0_0_#000]`.
  - Focus state: `focus:outline-none focus:ring-4 focus:ring-[#8B5CF6]`.
  - Uppercase centered text for room codes with `maxLength={6}`.
- **Role Cards & Secret Modals**:
  - 3D card flip animation (`perspective-1000`, `preserve-3d`, `rotate-y-180`) with dashed outline hidden state and revealed high-impact role view.
- **Pill Badges & Counters**:
  - `border-2 border-black rounded-md shadow-[2px_2px_0_0_#000]` with uppercase bold tracking.

## 5. Layout Principles

- **Layout Grid**:
  - Mobile: Single-column vertical stack with `max-w-md` width budget and `p-4` padding.
  - Desktop: Two-column grid (`lg:grid-cols-2 lg:gap-12`) with `max-w-5xl` container, or full arena view (`max-w-7xl`).
- **Vertical Rhythm**: Spacing steps on `8px` and `16px` rhythm (`gap-2`, `gap-4`, `gap-6`, `mb-6`, `space-y-6`).
- **Z-Index Hierarchy**: Sticky navigation and headers at `z-10`, overlays and modals at `z-50`.

## 6. Design System Notes for Stitch Generation

- **Atmosphere keywords**: Neo-brutalism, bold black borders, hard offset shadows, physical button press feedback, Canary Yellow canvas `#FEF08A`, high contrast, playful board game arcade.
- **Component prompts**:
  - Neo-brutalist action button: `bg-[#A855F7] text-white border-4 border-black shadow-[4px_4px_0_0_#000] uppercase font-black tracking-widest hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]`.
  - Game lobby card: White card with `border-4 border-black shadow-[8px_8px_0_0_#000]`, featuring bold 2-column layout, thick dividers, and vibrant 2-column game selection grid.
  - Input field: White input with `border-4 border-black shadow-[4px_4px_0_0_#000]` and `focus:ring-4 focus:ring-[#8B5CF6]`.
