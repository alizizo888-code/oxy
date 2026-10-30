/** @type {import('tailwindcss').Config} */
import skin from './theme.js'
import tw from 'tailwindcss/colors'

// sky/blue are CSS-variable driven so colour themes can swap them at runtime; the fallback is the brand's own scale.
const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}` }
const scale = (name) => Object.fromEntries(Object.keys(tw[name]).map((s) => [s, `rgb(var(--${name}-${s}, ${hex2rgb((skin.colors?.[name] || tw[name])[s])}) / <alpha-value>)`]))

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: skin.borderRadius,
      colors: {
        sky: scale('sky'),
        blue: scale('blue'),
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
