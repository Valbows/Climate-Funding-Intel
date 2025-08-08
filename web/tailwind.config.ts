import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#111111',
        muted: '#191919',
        border: '#272727',
        accent: '#0177FB',
        success: '#05C702',
        warning: '#FE6B2C',
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '4px',
      },
    },
  },
  plugins: [],
}
export default config
