/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { brand: { red: '#E51C23', dark: '#B7151A' } },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] }
    }
  },
  plugins: []
};
