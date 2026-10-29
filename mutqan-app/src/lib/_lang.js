// The app is Arabic-first (RTL).
export const resolveFaceLang = () => 'ar'
export const resolveFaceLangFrom = () => 'ar'
export const isRtlLang = (l) => /^(ar|he|fa|ur)/i.test(String(l || 'ar'))
export const onFaceLangChange = () => () => {}
