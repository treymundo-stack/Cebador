/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        crema: {
          50: '#FBF8F2',
          100: '#F3EEE5',
          200: '#E8E0D2',
          300: '#D9CDB8',
        },
        mate: {
          50: '#F7F0EA',
          100: '#EDE0D3',
          200: '#D9C2A8',
          300: '#C4A47D',
          400: '#B07F4F',
          500: '#8A5A2E',
          600: '#744A24',
          700: '#5E3A1B',
          800: '#482B14',
          900: '#1C1714',
        },
        positivo: {
          50: '#EAF2EC',
          100: '#D4E5D8',
          500: '#2F5D3A',
          600: '#274D31',
          700: '#1F3D28',
        },
        alerta: {
          50: '#F5E6E6',
          100: '#E8C8C8',
          500: '#9B2C2C',
          600: '#842525',
          700: '#6E1E1E',
        },
        warning: {
          50: '#F9F0E1',
          100: '#EFD9B0',
          500: '#B07F2E',
          600: '#966A26',
        },
      },
      fontFamily: {
        titulo: ['"Cormorant Garamond"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.875rem',
        '2xl': '1.25rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
