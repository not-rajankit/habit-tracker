/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#b9dfff',
          300: '#7cc4ff',
          400: '#36a5ff',
          500: '#0c87f0',
          600: '#006bcd',
          700: '#0054a6',
          800: '#054889',
          900: '#0a3d71',
        },
        surface: {
          50: '#fafbfc',
          100: '#f4f6f8',
          200: '#e9ecf0',
          300: '#d3d8e0',
        },
        accent: {
          green: '#34d399',
          orange: '#fb923c',
          red: '#f87171',
          purple: '#a78bfa',
          pink: '#f472b6',
        }
      },
    },
  },
  plugins: [],
}
