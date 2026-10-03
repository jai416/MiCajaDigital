/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Verde esmeralda de la app (AppColors.primary). El panel usa la misma
        // paleta que el telefono para que se vean como la misma marca.
        mc: {
          bg: 'var(--mc-bg)',
          surface: 'var(--mc-surface)',
          field: 'var(--mc-field)',
          text: 'var(--mc-text)',
          muted: 'var(--mc-text-2)',
          primary: 'var(--mc-primary)',
          soft: 'var(--mc-primary-light)',
          'on-soft': 'var(--mc-on-primary-light)',
          border: 'var(--mc-border)',
          danger: 'var(--mc-danger)',
          warning: 'var(--mc-warning)',
          info: 'var(--mc-info)',
        },
      },
    },
  },
  plugins: [],
};