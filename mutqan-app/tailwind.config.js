/** @type {import('tailwindcss').Config} */
import skin from './theme.js'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: skin.borderRadius,
      colors: {
        ...skin.colors,
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
