/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dcode: {
          bg: '#050505',
          surface: '#0B0B0C',
          surface2: '#111113',
          surface3: '#18181B',
          border: '#242428',
          borderLight: '#323238',
          text: '#F5F5F5',
          textSecondary: '#A1A1AA',
          textMuted: '#71717A',
          accent: '#3B82F6', // restrained blue
          accentHover: '#2563EB',
          accentMuted: 'rgba(59, 130, 246, 0.15)',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          dangerBg: 'rgba(239, 68, 68, 0.15)',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
