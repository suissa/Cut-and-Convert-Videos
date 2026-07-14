/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/render/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b1020',
        panel: '#12182a',
        panelSoft: '#1a2238',
        accent: '#8b5cf6'
      }
    }
  },
  plugins: []
};
