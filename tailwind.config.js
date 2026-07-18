/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        primary: {
          50: '#e6ffe6',
          100: '#ccffcc',
          200: '#99ff99',
          300: '#66ff66',
          400: '#33ff33',
          500: '#00ff41',
          600: '#00cc33',
          700: '#009928',
          800: '#00661c',
          900: '#003311',
          950: '#001a09',
        },
        amber: {
          400: '#ffb000',
          500: '#ff9500',
        }
      },
      boxShadow: {
        'glow': '0 0 8px rgba(0, 255, 65, 0.3), 0 0 16px rgba(0, 255, 65, 0.1)',
        'glow-sm': '0 0 4px rgba(0, 255, 65, 0.2)',
        'glow-amber': '0 0 8px rgba(255, 176, 0, 0.3)',
      },
    }
  },
  plugins: [],
}
