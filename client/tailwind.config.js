/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101b2b',
        muted: '#64748b',
        canvas: '#f4f6f8',
        brand: '#d8ff54',
        line: '#e5e9ed'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'sans-serif']
      },
      boxShadow: {
        soft: '0 18px 60px rgba(16, 27, 43, .08)'
      }
    }
  },
  plugins: []
};
