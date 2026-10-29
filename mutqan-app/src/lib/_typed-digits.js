// Arabic-Indic / Persian digits -> ASCII, so a phone or PIN typed on an Arabic keyboard still matches.
export const foldTypedDigits = (s) => String(s ?? '')
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
  .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
