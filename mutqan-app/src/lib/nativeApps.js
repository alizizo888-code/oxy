// Native Android apps (built by GitHub Actions → release "apps-latest"). Links never change between versions.
const BASE = 'https://github.com/alizizo888-code/alizeidan123/releases/download/apps-latest/'
export const APK_APP = BASE + 'oxygen-app.apk'   // customers / whole site
export const APK_OPS = BASE + 'oxygen-ops.apk'   // operations supervisor (owner / ops / technician)
export const isNativeShell = () => typeof window !== 'undefined' && !!(window.Capacitor && window.Capacitor.isNativePlatform?.())
