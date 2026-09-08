/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#213747',
    tint: '#e65d42',

    // Core surfaces
    background: '#f5f1e8',
    foreground: '#213747',

    // Cards / elevated surfaces
    card: '#fbf9f3',
    cardForeground: '#213747',

    // Primary action color (buttons, links, active states)
    primary: '#e65d42',
    primaryForeground: '#fbf9f3',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#286765',
    secondaryForeground: '#fbf9f3',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#e8e3d8',
    mutedForeground: '#68757c',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#f8c931',
    accentForeground: '#213747',

    // Destructive actions (delete, error states)
    destructive: '#b83e35',
    destructiveForeground: '#fbf9f3',

    // Borders and input outlines
    border: '#d9d3c7',
    input: '#d9d3c7',
  },

  dark: {
    text: '#fbf9f3',
    tint: '#ee765d',
    background: '#1d2d38',
    foreground: '#fbf9f3',
    card: '#243945',
    cardForeground: '#fbf9f3',
    primary: '#ee765d',
    primaryForeground: '#fbf9f3',
    secondary: '#3c8580',
    secondaryForeground: '#fbf9f3',
    muted: '#30434f',
    mutedForeground: '#c1c3b8',
    accent: '#f8c931',
    accentForeground: '#213747',
    destructive: '#d8665d',
    destructiveForeground: '#fbf9f3',
    border: '#40535d',
    input: '#40535d',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 14,
};

export default colors;
