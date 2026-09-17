export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#061f16',
          900: '#061f16',
          800: '#08281c',
          700: '#0a3022',
          600: '#0c3526',
          500: '#10402e',
        },
        ink: {
          DEFAULT: '#f3f1e9',
          muted: '#c6c9bf',
          dim: '#92998e',
        },
        line: {
          DEFAULT: 'rgba(226,191,118,0.28)',
          strong: 'rgba(226,191,118,0.52)',
        },
        buy: {
          DEFAULT: '#56b887',
          dim: 'rgba(86,184,135,0.14)',
        },
        sell: {
          DEFAULT: '#e07171',
          dim: 'rgba(224,113,113,0.14)',
        },
        brand: {
          DEFAULT: '#e2bf76',
          dim: 'rgba(226,191,118,0.12)',
        },
        warn: '#d6a85c',
        blue: { trade: '#7ca6a0' },
        purple: { trade: '#9b91aa' },
        gold: {
          DEFAULT: '#e2bf76',
          deep: '#b89755',
          dim: 'rgba(226,191,118,0.12)',
        },
        platinum: '#e7e5df',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
      },
      fontSize: {
        '2xs': '0.625rem',
        '3xs': '0.5rem',
      },
    },
  },
  plugins: [],
}