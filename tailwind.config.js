/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eefbf3',
          100: '#d6f5e3',
          200: '#b0eacb',
          300: '#7dd8ab',
          400: '#48be84',
          500: '#25a366',
          600: '#188452',
          700: '#146843',
          800: '#135337',
          900: '#10452e',
        },
        dark: {
          900: '#0a0e1a',
          800: '#0f1626',
          700: '#161d30',
          600: '#1e2640',
          500: '#252f4a',
          400: '#2e3a58',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
