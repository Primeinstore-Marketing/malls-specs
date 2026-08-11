const tokens = require('../design-system/tokens/tailwind.tokens.js');

/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: tokens.theme,
  plugins: [],
};

module.exports = config;
