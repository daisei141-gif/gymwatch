/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gym: {
          bg: '#0a0a0a',
          surface: '#141414',
          card: '#1c1c1c',
          border: '#2a2a2a',
          orange: '#ff6b1a',
          'orange-dim': 'rgba(255,107,26,0.12)',
          'orange-mid': 'rgba(255,107,26,0.35)',
          muted: '#888888',
        }
      },
      fontFamily: {
        gym: ['Barlow Condensed', 'Impact', 'sans-serif']
      }
    }
  },
  plugins: []
}
