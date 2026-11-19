/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Same brand colors as the public site (public/css/styles.css :root)
      colors: {
        church: {
          navy: '#10295e',
          'navy-deep': '#0b1d44',
          red: '#e6252e',
          'red-dark': '#c41d25',
          gold: '#e7bd49',
          blue: '#0861ef',
          cream: '#f6f0e4',
          paper: '#fffdf8',
          ink: '#18202d',
          muted: '#69727b',
          border: '#ded8cd'
        }
      },
      fontFamily: {
        serif: ['"Libre Caslon Text"', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
};
