import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        glass: {
          50: 'rgba(255, 255, 255, 0.05)',
          100: 'rgba(255, 255, 255, 0.1)',
          200: 'rgba(255, 255, 255, 0.2)',
          300: 'rgba(255, 255, 255, 0.3)',
        },
        surface: {
          DEFAULT: 'rgba(15, 15, 20, 1)',
          raised: 'rgba(25, 25, 35, 1)',
          overlay: 'rgba(30, 30, 45, 0.8)',
        },
        accent: {
          DEFAULT: 'rgba(99, 102, 241, 1)',
          glow: 'rgba(99, 102, 241, 0.3)',
        },
      },
      backdropBlur: {
        glass: '20px',
      },
      borderRadius: {
        glass: '16px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'glass-hover': '0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        glow: '0 0 20px rgba(99, 102, 241, 0.3)',
      },
    },
  },
  plugins: [],
}

export default config
