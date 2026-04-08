import { Platform } from 'react-native';

/**
 * Inject global CSS for web-only hover and transition effects.
 * Called once on app startup.
 */
export function injectWebStyles() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
    /* Smooth transitions on all interactive elements */
    [role="button"], [data-focusable="true"], a {
      transition: opacity 0.1s ease, background-color 0.15s ease, transform 0.1s ease !important;
    }
    [role="button"]:hover, [data-focusable="true"]:hover {
      opacity: 0.85;
    }

    /* Smooth page transitions */
    [data-testid="screen-container"], main, [role="main"] {
      animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0.7; }
      to { opacity: 1; }
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.08);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.15);
    }

    /* Remove focus outlines on interactive elements (we handle focus visually) */
    *:focus {
      outline: none;
    }

    /* Smooth font rendering */
    body {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Selection color */
    ::selection {
      background: rgba(212, 168, 68, 0.3);
    }
  `;
  document.head.appendChild(style);
}
