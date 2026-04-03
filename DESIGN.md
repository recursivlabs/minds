# Minds 2.0 Design System

## Brand
- **Name**: Minds
- **Tagline**: The open social network
- **Subtitle**: Powered by AI. Owned by you.

## Colors
- **Background**: `#09090b` (near-black)
- **Surface**: `#18181b` (card backgrounds)
- **Accent**: `#1b85d6` (Minds blue)
- **Boost**: `#f5a623` (gold)
- **Token**: `#ffd700` (gold)

## Typography
Dark theme, high contrast white text on black backgrounds.
System font stack, no custom fonts required.

## Design Principles
1. **Dark first** - the entire app is dark mode
2. **Minimal chrome** - content is the focus, UI gets out of the way
3. **Blue accents** - Minds blue for interactive elements
4. **Gold for value** - boost and token features use gold
5. **Instant feedback** - optimistic updates everywhere

## Key Components
- **PostCard**: The core content unit with votes, replies, boost, tip
- **VoteButtons**: Upvote/downvote arrows (blue up, red down)
- **BoostBadge**: Gold rocket badge on boosted posts
- **NSFWOverlay**: Blur overlay with tap-to-reveal
- **WalletCard**: Token balance display with diamond icon
- **Avatar**: Circular with fallback initials, deterministic colors

## Architecture
- Expo Router for navigation
- Recursiv SDK for all backend operations
- AuthProvider for session management
- Custom hooks for data fetching (usePosts, useProfile, etc.)
- Optimistic updates for votes, follows, messages
