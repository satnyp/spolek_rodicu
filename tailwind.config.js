/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1978e5',
        'background-light': '#f6f7f8',
        'background-dark': '#111821',
        'card-dark': '#1b2430'
      },
      fontFamily: {
        display: ['Inter', 'sans-serif']
      },
      boxShadow: {
        'design-xl': '0 20px 35px -18px rgba(15, 23, 42, 0.25)'
      }
    }
  },
  plugins: []
};
