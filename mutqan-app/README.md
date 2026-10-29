# Metqan

Exported from Whacka — this is **your app's code**: the components, pages and hooks
you built, exactly as they run on Whacka. It's yours to keep.

## What's in here

- `src/App.jsx`, `src/components/*`, `src/pages/*`, `src/hooks/*` — **your code**.
  This is the real export, untouched.
- `src/lib/*` — **stubs** for the Whacka client SDK (data, auth, storage, push,
  social, …). The real implementation runs on the Whacka platform and is provided to
  your app at runtime, so it isn't included here. The stubs keep your imports
  resolving and show which Whacka APIs your code uses.
- `src/main.jsx` — a stubbed entry point. The platform bootstrap (session, auth,
  realtime, install, theming) runs on Whacka and is omitted.
- `index.html`, `vite.config.js`, `package.json`, Tailwind/PostCSS config — the build setup.

## Does this run on its own?

**No — and it isn't meant to.** Your app's data, auth, storage, AI, payments and push
features are powered by Whacka's hosted backend, and the client SDK that talks to it is
not part of this export. What you have here is a faithful, readable copy of the code you
authored — for your records, for review, or to hand to a developer.

## Ownership

Your application code is yours. The Whacka platform SDK and backend that make it run are
Whacka's, and are not included in this export.
