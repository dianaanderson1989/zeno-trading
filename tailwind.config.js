/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          green:  '#00ff88',
          cyan:   '#00d4ff',
          red:    '#ff3366',
          yellow: '#ffcc00',
          purple: '#9945ff',
        },
        dark: {
          950: '#050810',
          900: '#080c17',
          850: '#0a0f1e',
          800: '#0d1424',
          750: '#101828',
          700: '#141f33',
          600: '#1a2844',
          500: '#1e3054',
          400: '#243660',
          300: '#2d4270',
        },
        brand: {
          50:  '#e6fff3',
          100: '#b3ffe0',
          200: '#66ffbb',
          300: '#33ff99',
          400: '#00ff88',
          500: '#00cc6a',
          600: '#009950',
          700: '#006636',
          800: '#00331b',
          900: '#001a0e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'neon-green': '0 0 20px rgba(0, 255, 136, 0.3)',
        'neon-green-lg': '0 0 40px rgba(0, 255, 136, 0.4)',
        'neon-red': '0 0 20px rgba(255, 51, 102, 0.3)',
        'neon-cyan': '0 0 20px rgba(0, 212, 255, 0.3)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'gradient-neon': 'linear-gradient(135deg, #00ff88, #00d4ff)',
        'gradient-neon-red': 'linear-gradient(135deg, #ff3366, #ff6b35)',
        'gradient-dark': 'linear-gradient(180deg, #080c17 0%, #050810 100%)',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease',
        'fade-in': 'fade-in 0.2s ease',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0,255,136,0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(0,255,136,0.5)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
