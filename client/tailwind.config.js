/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,jsx}',
    '../src/FixNGo.Web/Views/**/*.cshtml',
    '../src/FixNGo.Web/TagHelpers/**/*.cs'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { brand: { red: '#E51C23', dark: '#B7151A' } },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] }
    }
  },
  plugins: []
};
