/**
 * TeamAdmin — prebuilt member-roster & invite manager for Whacka Teams apps.
 *
 * Render this on an admin-only screen of a team app. It lets the owner/admin add
 * staff (by invite link OR by handing them a username + password directly), assign
 * roles, grant role-based manager access, reset passwords, and disable members —
 * plus permanently remove a disabled member (confirmed, frees their seat + username) —
 * all server-enforced. It gates itself with team.canManage(), so it's safe to route
 * to directly; non-admins see an access notice.
 *
 *   <Route path="/admin" element={<TeamAdmin />} />
 *
 * Props:
 *   onClose {function} optional — renders a back/close button
 *   roles   {array}    optional — app-declared role manifest (see team.openAdmin)
 *   labels  {object}   override any UI string (localize without touching this file);
 *                      defaults follow TeamLogin's language rule (Arabic when <html>
 *                      or <body> has dir="rtl" or lang="ar", otherwise the phone's
 *                      language); explicit labels always win. Keys: { title,
 *                      subtitle, close, deniedTitle, deniedBody, goBack, tabMembers,
 *                      tabAdd, tabRequests, tabSignIn, membersLoadError, membersEmpty,
 *                      loadMore, memberFallback, disabledBadge, ownerBadge, save, resetPin,
 *                      resetPassword, reEnable, disable, remove, removeConfirm, actionFailed,
 *                      whoManages, powerRead, powerWrite, powerManage,
 *                      tempPin, tempPassword, methodLink, methodPassword,
 *                      methodImport, introLinkPin, introLink, introCredsPin, introCreds,
 *                      name, namePlaceholder, username, usernamePlaceholder,
 *                      usernameLatinOnly, usernameTooShort, usernameTaken, role,
 *                      expiry, expiry30, expiry7,
 *                      expiryNever, pinLabel, passwordLabel, optionalHint,
 *                      autoGenerate, adding, createInvite, createLogin,
 *                      createdHandThese, appLine, usernameLine, copyLoginDetails,
 *                      addFailed, invitesLoadError, invitesEmpty, inviteAccepted,
 *                      invitePending, inviteExpired, copyInviteLink, revoke,
 *                      selfSignupTitle, selfSignupBody, requestsLoadError,
 *                      updateFailed, rejectAllConfirm, rejectAll, noPending,
 *                      turnOnHint, pendingOne, pendingMany, roleToGive, approve,
 *                      reject, pinModeTitle, pinModeBody, pickerTitle, pickerBody,
 *                      importIntroPin, importIntro, fileNoRows, fileReadError,
 *                      reading, chooseFile, rowsFound, usernameCol, displayNameCol,
 *                      roleCol, roleForAll, noneOption, selectColumn, creating,
 *                      createLogins, noUsableRows, importCap, createdCount,
 *                      skippedCount, copyAllLogins, importAnother, importFailed,
 *                      copied, copy }. Strings with {handle}/{role}/{count} are
 *                      templates — keep the placeholder in overrides.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Users, Ticket, Copy, Check, Trash2, Key, UserX, UserCheck, Loader2, KeyRound, Link2, Upload, Inbox, LockKeyhole,
} from 'lucide-react'
import { team } from '../lib/team'
import { auth } from '../lib/auth'
import { readSpreadsheet } from '../lib/spreadsheet'
import { onPrimaryColor } from '../lib/_on-primary'
import { resolveFaceLang, onFaceLangChange } from '../lib/_lang.js'
import { foldTypedDigits } from '../lib/_typed-digits.js'
import { POWERS, declaredPowers, manifestPowers } from '../lib/_role-access.js'

const EXPIRY_OPTIONS = [
  { key: 'expiry30', ms: 30 * 86400_000 },
  { key: 'expiry7', ms: 7 * 86400_000 },
  { key: 'expiryNever', ms: 0 },
]

// Language per render via the one cascade every platform face shares
// (_lang.js, 2026-09-28) — apps set documentElement.dir/lang during their own
// boot. This module's single call site.
function detectArabic() {
  return resolveFaceLang() === 'ar'
}

// Fill {placeholders} in a label template: fmt(L.rowsFound, { count: 12 }).
const fmt = (s, vars) => String(s ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars?.[k] ?? ''))

// UI strings — Arabic apps get Arabic defaults; every key still overridable via
// the `labels` prop (explicit localization always wins). Mirrors TeamLogin.
function defaultLabels(isArabic) {
  return isArabic
    ? {
        title: 'الفريق',
        subtitle: 'إدارة من يمكنه تسجيل الدخول وما يمكنه فعله.',
        close: 'إغلاق',
        deniedTitle: 'ليست لديك صلاحية إدارة الفريق.',
        deniedBody: 'اطلب من المشرف منحك الصلاحية.',
        goBack: 'رجوع',
        tabMembers: 'الأعضاء',
        tabAdd: 'إضافة أشخاص',
        tabRequests: 'الطلبات',
        tabSignIn: 'تسجيل الدخول',
        membersLoadError: 'تعذر تحميل الأعضاء',
        membersEmpty: 'لا يوجد أعضاء بعد. أضف شخصًا من تبويب «إضافة أشخاص».',
        loadMore: 'تحميل المزيد',
        memberFallback: 'عضو',
        disabledBadge: 'موقوف',
        ownerBadge: 'المالك',
        save: 'حفظ',
        resetPin: 'إعادة تعيين الرقم السري',
        resetPassword: 'إعادة تعيين كلمة المرور',
        reEnable: 'إعادة تفعيل',
        disable: 'إيقاف',
        remove: 'حذف نهائي',
        removeConfirm: 'حذف @{handle} نهائيًا؟ سيتحرر مقعده واسم المستخدم الخاص به، وتبقى بياناته السابقة في التطبيق. لا يمكن التراجع عن هذا.',
        actionFailed: 'فشل الإجراء',
        whoManages: 'صلاحيات كل دور',
        powerRead: 'رؤية كل السجلات',
        powerWrite: 'تعديل كل السجلات',
        powerManage: 'إدارة الأشخاص',
        name: 'الاسم',
        namePlaceholder: 'مثال: سارة علي',
        usernameLatinOnly: 'حروف إنجليزية وأرقام و _ فقط',
        usernameTooShort: '٣ أحرف على الأقل',
        usernameTaken: 'اسم المستخدم هذا مستخدم.',
        tempPin: 'الرقم السري المؤقت:',
        tempPassword: 'كلمة المرور المؤقتة:',
        methodLink: 'دعوة برابط',
        methodPassword: 'إنشاء حساب دخول',
        methodImport: 'رفع ملف',
        introLinkPin: 'اختر اسم المستخدم والدور ثم أرسل الرابط — وسيختار هو رقمه السري المكوّن من 6 أرقام.',
        introLink: 'اختر اسم المستخدم والدور ثم أرسل الرابط — وسيعيّن هو كلمة مروره.',
        introCredsPin: 'اختر اسم المستخدم ثم سلّمه الرقم السري المُولَّد — دون حاجة لرابط.',
        introCreds: 'اختر اسم المستخدم وكلمة المرور ثم سلّمهما له — دون حاجة لرابط.',
        username: 'اسم المستخدم',
        usernamePlaceholder: 'مثال: sara',
        role: 'الدور',
        expiry: 'الصلاحية',
        expiry30: 'تنتهي خلال 30 يومًا',
        expiry7: 'تنتهي خلال 7 أيام',
        expiryNever: 'لا تنتهي',
        pinLabel: 'الرقم السري (PIN)',
        passwordLabel: 'كلمة المرور',
        optionalHint: '(اختياري)',
        autoGenerate: 'يُولَّد تلقائيًا',
        adding: 'جارٍ الإضافة…',
        createInvite: 'إنشاء دعوة',
        createLogin: 'إنشاء حساب',
        createdHandThese: 'تم إنشاء الحساب — سلّم هذه البيانات إلى @{handle}:',
        appLine: 'التطبيق:',
        usernameLine: 'اسم المستخدم:',
        copyLoginDetails: 'نسخ بيانات الدخول',
        addFailed: 'تعذرت إضافة العضو',
        invitesLoadError: 'تعذر تحميل الدعوات',
        invitesEmpty: 'لا توجد دعوات بعد.',
        inviteAccepted: 'مقبولة',
        invitePending: 'قيد الانتظار',
        inviteExpired: 'منتهية',
        copyInviteLink: 'نسخ رابط الدعوة',
        revoke: 'إلغاء',
        selfSignupTitle: 'السماح بطلبات الانضمام',
        selfSignupBody: 'عند التفعيل، يمكن لأي شخص لديه رابط التطبيق طلب حساب — وتوافق أنت على كل طلب أدناه.',
        requestsLoadError: 'تعذر تحميل الطلبات',
        updateFailed: 'تعذر التحديث',
        rejectAllConfirm: 'رفض جميع الطلبات المعلقة ({count})؟ سيتم حذفها نهائيًا.',
        rejectAll: 'رفض الكل',
        noPending: 'لا توجد طلبات معلقة حاليًا.',
        turnOnHint: 'فعّل «طلبات الانضمام» أعلاه للسماح للناس بطلب حساب.',
        pendingOne: 'طلب معلق',
        pendingMany: 'طلبات معلقة',
        roleToGive: 'الدور الذي سيُمنح',
        approve: 'موافقة',
        reject: 'رفض',
        pinModeTitle: 'تسجيل الدخول برقم سري (PIN)',
        pinModeBody: 'تحصل الحسابات الجديدة على رقم سري من 6 أرقام بدلًا من كلمة المرور — الأسهل للموظفين والطلاب. كلمات المرور الحالية تظل صالحة؛ أعد تعيين أي عضو لتحويله إلى رقم سري.',
        pickerTitle: 'تسجيل الدخول باختيار الاسم',
        pickerBody: 'تعرض شاشة الدخول قائمة الأعضاء ليضغط كل شخص على اسمه بدلًا من كتابة اسم المستخدم. يمكن لأي شخص يفتح التطبيق رؤية هذه القائمة — مناسب لفصل دراسي أو فريق صغير؛ اتركه مغلقًا إذا كانت قائمة الأعضاء خاصة.',
        importIntroPin: 'ارفع جدول بيانات (‎.csv أو ‎.xlsx) بموظفيك، وحدد العمود الذي يحوي اسم المستخدم، وأنشئ جميع الحسابات دفعة واحدة. تُولَّد الأرقام السرية لتسليمها.',
        importIntro: 'ارفع جدول بيانات (‎.csv أو ‎.xlsx) بموظفيك، وحدد العمود الذي يحوي اسم المستخدم، وأنشئ جميع الحسابات دفعة واحدة. تُولَّد كلمات المرور لتسليمها.',
        fileNoRows: 'الملف لا يحتوي على صفوف.',
        fileReadError: 'تعذرت قراءة الملف.',
        reading: 'جارٍ القراءة…',
        chooseFile: 'اختر ملف ‎.csv أو ‎.xlsx',
        rowsFound: 'تم العثور على {count} صفًا — حدد الأعمدة:',
        usernameCol: 'اسم المستخدم *',
        displayNameCol: 'الاسم الظاهر',
        roleCol: 'عمود الدور',
        roleForAll: 'الدور للجميع',
        noneOption: '— بدون —',
        selectColumn: 'اختر العمود',
        creating: 'جارٍ الإنشاء…',
        createLogins: 'إنشاء {count} حسابًا',
        noUsableRows: 'لا توجد صفوف صالحة — اختر العمود الذي يحوي اسم المستخدم.',
        importCap: 'الملف يحتوي {count} صفًا؛ الحد 100 في المرة الواحدة. قسّم الملف.',
        createdCount: 'تم إنشاء {count} حسابًا',
        skippedCount: ' · تم تخطي {count}',
        copyAllLogins: 'نسخ جميع الحسابات',
        importAnother: 'استيراد ملف آخر',
        importFailed: 'فشل الاستيراد.',
        copied: 'تم النسخ',
        copy: 'نسخ',
      }
    : {
        title: 'Team',
        subtitle: 'Manage who can sign in and what they can do.',
        close: 'Close',
        deniedTitle: 'You don’t have access to team management.',
        deniedBody: 'Ask an admin to grant you access.',
        goBack: 'Go back',
        tabMembers: 'Members',
        tabAdd: 'Add people',
        tabRequests: 'Requests',
        tabSignIn: 'Sign-in',
        membersLoadError: 'Failed to load members',
        membersEmpty: 'No members yet. Add someone from the “Add people” tab.',
        loadMore: 'Load more',
        memberFallback: 'Member',
        disabledBadge: 'disabled',
        ownerBadge: 'owner',
        save: 'Save',
        resetPin: 'Reset PIN',
        resetPassword: 'Reset password',
        reEnable: 'Re-enable',
        disable: 'Disable',
        remove: 'Remove permanently',
        removeConfirm: 'Permanently remove @{handle}? Their seat and username are freed; the data they entered stays in the app. This cannot be undone.',
        actionFailed: 'Action failed',
        whoManages: 'What each role can do',
        powerRead: 'See all records',
        powerWrite: 'Change all records',
        powerManage: 'Manage people',
        name: 'Name',
        namePlaceholder: 'e.g. Sara Ali',
        usernameLatinOnly: 'English letters, numbers and _ only',
        usernameTooShort: 'At least 3 characters',
        usernameTaken: 'That username is taken.',
        tempPin: 'Temporary PIN:',
        tempPassword: 'Temporary password:',
        methodLink: 'Invite by link',
        methodPassword: 'Create a login',
        methodImport: 'Upload a list',
        introLinkPin: 'Pick their username and role, then send them the link — they choose their own 6-digit PIN.',
        introLink: 'Pick their username and role, then send them the link — they set their own password.',
        introCredsPin: 'Pick their username, then hand them the generated PIN — no link needed.',
        introCreds: 'Pick their username and password, then hand both to them — no link needed.',
        username: 'Username',
        usernamePlaceholder: 'e.g. sara',
        role: 'Role',
        expiry: 'Expiry',
        expiry30: 'Expires in 30 days',
        expiry7: 'Expires in 7 days',
        expiryNever: 'Never expires',
        pinLabel: 'PIN',
        passwordLabel: 'Password',
        optionalHint: '(optional)',
        autoGenerate: 'Auto-generate',
        adding: 'Adding…',
        createInvite: 'Create invite',
        createLogin: 'Create login',
        createdHandThese: 'Account created — hand these to @{handle}:',
        appLine: 'App:',
        usernameLine: 'Username:',
        copyLoginDetails: 'Copy login details',
        addFailed: 'Failed to add the member',
        invitesLoadError: 'Failed to load invites',
        invitesEmpty: 'No invites yet.',
        inviteAccepted: 'accepted',
        invitePending: 'pending',
        inviteExpired: 'expired',
        copyInviteLink: 'Copy invite link',
        revoke: 'Revoke',
        selfSignupTitle: 'Let people request to join',
        selfSignupBody: 'When on, anyone with the app link can ask for an account — you approve each one below.',
        requestsLoadError: 'Failed to load requests',
        updateFailed: 'Failed to update',
        rejectAllConfirm: 'Reject all {count} pending requests? This permanently deletes them.',
        rejectAll: 'Reject all',
        noPending: 'No pending requests right now.',
        turnOnHint: 'Turn on “request to join” above to let people ask for an account.',
        pendingOne: 'pending request',
        pendingMany: 'pending requests',
        roleToGive: 'Role to give them',
        approve: 'Approve',
        reject: 'Reject',
        pinModeTitle: 'Sign in with a PIN',
        pinModeBody: 'New logins get a 6-digit PIN instead of a password — easiest for staff and students. Existing passwords keep working; reset anyone to switch them to a PIN.',
        pickerTitle: 'Tap-your-name sign-in',
        pickerBody: "The sign-in screen lists your members so people tap their name instead of typing a username. Anyone who opens the app can see that list — great for a class or a small team; leave it off if who's on the roster is private.",
        importIntroPin: 'Upload a spreadsheet (.csv or .xlsx) of your staff, pick which column holds the username, and create every login at once. PINs are generated for you to hand out.',
        importIntro: 'Upload a spreadsheet (.csv or .xlsx) of your staff, pick which column holds the username, and create every login at once. Passwords are generated for you to hand out.',
        fileNoRows: 'That file has no rows.',
        fileReadError: 'Could not read the file.',
        reading: 'Reading…',
        chooseFile: 'Choose a .csv or .xlsx file',
        rowsFound: '{count} rows found — map the columns:',
        usernameCol: 'Username *',
        displayNameCol: 'Display name',
        roleCol: 'Role column',
        roleForAll: 'Role for all',
        noneOption: '— none —',
        selectColumn: 'Select column',
        creating: 'Creating…',
        createLogins: 'Create {count} logins',
        noUsableRows: 'No usable rows — pick the column that holds the username.',
        importCap: "That's {count} rows; import is capped at 100 at a time. Split the file.",
        createdCount: 'Created {count} logins',
        skippedCount: ' · {count} skipped',
        copyAllLogins: 'Copy all logins',
        importAnother: 'Import another file',
        importFailed: 'Import failed.',
        copied: 'Copied',
        copy: 'Copy',
      }
}

// Shared visual tokens (match TeamLogin: stone palette, rounded, primary theme color).
const FIELD =
  'rounded-xl border border-stone-200 bg-stone-50 text-stone-900 outline-none transition ' +
  'placeholder:text-stone-400 hover:border-stone-300 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15'
const CARD = 'rounded-2xl border border-stone-200/80 bg-white shadow-sm shadow-stone-900/[0.03]'
const PRIMARY_BTN =
  'rounded-full bg-primary font-semibold shadow-sm transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60'

// Overlay padding that clears notches / home indicator in standalone PWAs (matches TeamLogin).
const SAFE_PAD = {
  padding:
    'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) ' +
    'max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))',
}

// Client-side mirror of the server's role/handle normalization so typos ("Cashier",
// trailing space) don't surface as a regex error string. A username's ٠-٩ / ۰-۹
// are 0-9 (P49).
const normRole = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '')
const normHandle = (s) => foldTypedDigits(s).toLowerCase().trim().replace(/[^a-z0-9_]/g, '')

// Pretty default label from a role key ("front_desk" → "Front Desk").
const titleCaseRole = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// Normalize the optional `roles` manifest the app passes in. Each entry may be a
// bare string ('cashier') or { name, label?, admin?, powers? }. The names are normalized to
// the SAME server role keys the app's code enforces on (visibleTo:'role:cashier'),
// so the roster's role picker and the app's permission rules can never drift apart.
// Returns [] when nothing usable is passed → callers fall back to a free-text input
// (identical to the pre-manifest behavior, so existing apps are unaffected).
function normalizeRoleOptions(roles) {
  if (!Array.isArray(roles)) return []
  const seen = new Set()
  const out = []
  for (const entry of roles) {
    const raw = typeof entry === 'string' ? { name: entry } : (entry && typeof entry === 'object' ? entry : null)
    if (!raw) continue
    const name = normRole(raw.name)
    if (!name || name === 'owner' || seen.has(name)) continue  // 'owner' is reserved
    seen.add(name)
    const label = (raw.label != null && String(raw.label).trim()) || titleCaseRole(name)
    out.push({ name, label, admin: !!raw.admin, powers: Array.isArray(raw.powers) ? raw.powers : [] })
  }
  return out
}

// Role picker: a <select> of the app-declared roles when a manifest is present,
// else the original free-text <input>. When a manifest is present it also injects
// the member's CURRENT role as an option even if it's off-manifest (legacy/owner),
// so an existing assignment is never silently mangled.
function RoleField({ value, onChange, roleOptions, className, title, disabled }) {
  if (!roleOptions || roleOptions.length === 0) {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        title={title}
        disabled={disabled}
        className={className}
      />
    )
  }
  const cur = normRole(value)
  const opts = cur && !roleOptions.some((o) => o.name === cur)
    ? [{ name: cur, label: cur }, ...roleOptions]
    : roleOptions
  return (
    <select value={cur} onChange={(e) => onChange(e.target.value)} title={title} disabled={disabled} className={className}>
      {opts.map((o) => <option key={o.name} value={o.name}>{o.label}</option>)}
    </select>
  )
}

async function copyText(value) {
  try { await navigator.clipboard.writeText(value); return true } catch { return false }
}

export default function TeamAdmin({ onClose, roles, labels = {} }) {
  const isArabic = detectArabic()
  const L = { ...defaultLabels(isArabic), ...labels }
  const dir = isArabic ? 'rtl' : 'ltr'
  // Rendered as a first screen (an /admin route) it can mount before the app's
  // boot effect sets <html> dir/lang — re-render when they change, as TeamLogin
  // does (delivery ledger P47).
  const [, setFaceLang] = useState(resolveFaceLang)
  useEffect(() => {
    setFaceLang(resolveFaceLang())
    return onFaceLangChange(setFaceLang)
  }, [])
  const [state, setState] = useState('checking') // checking | denied | ready
  const [tab, setTab] = useState('members')
  const [pendingCount, setPendingCount] = useState(0)
  // Per-app sign-in options (PIN mode / member picker) — read once, edited on the
  // Sign-in tab, and threaded into the credential labels ("Password" vs "PIN").
  const [loginCfg, setLoginCfg] = useState({ pin: false, memberPicker: false })
  // Bumped when the sync below actually changes a role's powers, so MembersTab
  // re-reads them and the role card isn't stale.
  const [roleAccessVersion, setRoleAccessVersion] = useState(0)
  const roleOptions = useMemo(() => normalizeRoleOptions(roles), [roles])
  const refreshPending = () => team.listPending().then((p) => setPendingCount(p.length)).catch(() => {})

  useEffect(() => {
    let alive = true
    team.canManage()
      .then((ok) => { if (alive) setState(ok ? 'ready' : 'denied') })
      .catch(() => { if (alive) setState('denied') })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (state !== 'ready') return
    refreshPending()
    team.config()
      .then((c) => setLoginCfg({ pin: c?.loginConfig?.pin === true, memberPicker: c?.loginConfig?.memberPicker === true }))
      .catch(() => {})
  }, [state])

  // The app's declared roles decide what each role can do on the team (W2-B): the
  // server grants what the list gives (admin: true = all three, else `powers`),
  // takes back only what the list itself once gave and no longer gives, and never
  // touches what the owner switched on by hand (team.syncRoles; a role it cannot
  // set is skipped and the rest still sync, P63). Owner-only, one request,
  // best-effort; failures are non-fatal.
  useEffect(() => {
    if (state !== 'ready' || roleOptions.length === 0) return
    if (typeof auth?.isAppOwner === 'function' && !auth.isAppOwner()) return
    let alive = true
    team.syncRoles(manifestPowers(roleOptions))
      // Only nudge MembersTab to re-read if something changed — the no-op case stays free of reloads.
      .then((res) => { if (alive && res?.changed) setRoleAccessVersion((v) => v + 1) })
      .catch(() => { /* non-fatal: the dropdown still works without it */ })
    return () => { alive = false }
  }, [state, roleOptions])

  if (state === 'checking') {
    return (
      <div className="flex items-center justify-center p-12 text-stone-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }
  if (state === 'denied') {
    return (
      <div dir={dir} className="mx-auto max-w-md p-12 text-center text-stone-600">
        <p className="font-semibold text-stone-900">{L.deniedTitle}</p>
        <p className="mt-1 text-sm text-stone-400">{L.deniedBody}</p>
        {onClose && (
          <button onClick={onClose} className="mt-4 text-sm font-medium text-primary hover:underline">{L.goBack}</button>
        )}
      </div>
    )
  }

  return (
    <div dir={dir} className="mx-auto max-w-2xl p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary shadow-sm" style={{ color: onPrimaryColor() }}>
          <Users className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">{L.title}</h1>
          <p className="text-sm text-stone-500">{L.subtitle}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-full border border-stone-200 bg-stone-50 px-3.5 py-1.5 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900"
          >
            {L.close}
          </button>
        )}
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full bg-stone-100 p-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabButton active={tab === 'members'} onClick={() => setTab('members')} icon={Users}>{L.tabMembers}</TabButton>
        <TabButton active={tab === 'add'} onClick={() => setTab('add')} icon={Ticket}>{L.tabAdd}</TabButton>
        <TabButton active={tab === 'requests'} onClick={() => setTab('requests')} icon={Inbox}>
          {L.tabRequests}{pendingCount > 0 ? ` (${pendingCount})` : ''}
        </TabButton>
        <TabButton active={tab === 'signin'} onClick={() => setTab('signin')} icon={LockKeyhole}>{L.tabSignIn}</TabButton>
      </div>

      {tab === 'members'
        ? <MembersTab roleOptions={roleOptions} roleAccessVersion={roleAccessVersion} pin={loginCfg.pin} L={L} />
        : tab === 'add'
          ? <AddTab roleOptions={roleOptions} pin={loginCfg.pin} L={L} />
          : tab === 'requests'
            ? <RequestsTab roleOptions={roleOptions} onChanged={refreshPending} L={L} />
            : <SignInTab loginCfg={loginCfg} onChanged={setLoginCfg} L={L} />}
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 font-semibold transition ${
        active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" /> {children}
    </button>
  )
}

// ─────────────────────────────────────────────
// Members
// ─────────────────────────────────────────────

// Follows the cursor until rows arrive or the roster ends — pages can be
// EMPTY with hasMore=true while the server scans a large roster (documented
// listMembersPage contract). Used by both the initial load and Load more, so
// neither ever surfaces a rows-less-but-unfinished page as a dead end.
async function fetchMembersFrom(cursor) {
  for (let i = 0; i < 20; i++) {
    const page = await team.listMembersPage(cursor ? { cursor } : {})
    const next = page.hasMore ? page.nextCursor : null
    if (page.members.length || !next) return { rows: page.members, nextCursor: next }
    cursor = next
  }
  return { rows: [], nextCursor: cursor }
}

function MembersTab({ roleOptions, roleAccessVersion = 0, pin, L }) {
  const [members, setMembers] = useState(null)
  const [rolePowers, setRolePowers] = useState({ adminRoles: [], powers: {}, codePowers: {} })
  const [err, setErr] = useState(null)
  // Rosters can exceed one page (1000). nextCursor doubles as the "more exists"
  // flag; null = fully loaded.
  const [nextCursor, setNextCursor] = useState(null)
  const [moreBusy, setMoreBusy] = useState(false)
  // A reload invalidates any in-flight loadMore, so a page fetched under a
  // pre-reset cursor can never be appended onto the fresh list or clobber the
  // fresh cursor with a stale one.
  const genRef = useRef(0)

  const load = () => {
    const gen = ++genRef.current
    fetchMembersFrom(null)
      .then(({ rows, nextCursor: c }) => {
        if (gen !== genRef.current) return
        setMembers(rows); setNextCursor(c); setErr(null)
      })
      .catch((e) => { if (gen === genRef.current) setErr(e?.message || L.membersLoadError) })
    team.getRolePowers().then(setRolePowers).catch(() => {})
  }
  // Re-load when the parent's sync changes a role's powers (roleAccessVersion bumps),
  // so the role card reflects the server immediately. With no roles manifest the
  // version never changes → still a single load, as before.
  useEffect(load, [roleAccessVersion])

  const loadMore = async () => {
    const gen = genRef.current
    setMoreBusy(true)
    try {
      const { rows, nextCursor: c } = await fetchMembersFrom(nextCursor)
      if (gen !== genRef.current) return
      // De-dup by userId: a member disabled mid-walk loses their roster row and
      // re-appears later as an orphan credential — keep the newer row (it
      // carries the current status), drop the stale one.
      setMembers((prev) => {
        const fresh = new Set(rows.map((r) => r.userId))
        return [...(prev || []).filter((m) => !fresh.has(m.userId)), ...rows]
      })
      setNextCursor(c)
      setErr(null)
    } catch (e) {
      if (gen === genRef.current) setErr(e?.message || L.membersLoadError)
    } finally {
      setMoreBusy(false)
    }
  }

  // Row actions patch the list in place — a full reload would reset to page 1,
  // losing paging position AND unmounting rows past it, which destroys a
  // just-issued one-time temp password before the admin can copy it.
  const patchMember = (userId, patch) =>
    setMembers((prev) => (prev || []).map((m) => (m.userId === userId ? { ...m, ...patch } : m)))
  const removeMemberRow = (userId) =>
    setMembers((prev) => (prev || []).filter((m) => m.userId !== userId))
  const refreshRolePowers = () => team.getRolePowers().then(setRolePowers).catch(() => {})

  if (err && !members) return <ErrorBox>{err}</ErrorBox>
  if (!members) return <Spinner />
  if (members.length === 0 && !nextCursor) return <Empty>{L.membersEmpty}</Empty>

  return (
    <>
      <RoleAccessCard members={members} rolePowers={rolePowers} roleOptions={roleOptions} onChanged={refreshRolePowers} L={L} />
      <div className={`divide-y divide-stone-100 ${CARD}`}>
        {members.map((m) => (
          <MemberRow
            key={m.userId} member={m} roleOptions={roleOptions}
            onPatch={patchMember} onRemove={removeMemberRow}
            pin={pin} L={L}
          />
        ))}
      </div>
      {/* A Load-more failure keeps the loaded list; the error renders inline. */}
      {err && <ErrorBox>{err}</ErrorBox>}
      {nextCursor && (
        <button
          disabled={moreBusy}
          onClick={loadMore}
          className="mt-2 w-full rounded-lg border border-stone-200 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
        >
          {moreBusy ? '…' : L.loadMore}
        </button>
      )}
    </>
  )
}

function MemberRow({ member, roleOptions, onPatch, onRemove, pin, L }) {
  // A disabled member holds no roster role; the field shows the one they come back with.
  const [role, setRole] = useState(member.role || member.disabledRole || 'member')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [tempPw, setTempPw] = useState(null)
  const isOwner = member.role === 'owner'
  const disabled = member.status === 'disabled'
  const savedRole = member.role || member.disabledRole || 'member'
  const dirty = !disabled && normRole(role) !== savedRole

  // `after` applies the action's outcome (fn's result) to the parent list in place
  // (no full reload — see MembersTab.patchMember for why).
  const run = async (fn, after) => {
    setBusy(true); setMsg(null)
    try { const res = await fn(); after?.(res) }
    catch (e) { setMsg(e?.message || L.actionFailed) }
    finally { setBusy(false) }
  }
  // The role a re-activated member came back with: the server's answer (servers
  // before 2026-10-18 say nothing and re-add as 'member').
  const backAs = (res) => res?.role || member.role || 'member'

  return (
    <div className="p-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-stone-100 bg-cover bg-center ring-1 ring-stone-200/70" style={member.avatarUrl ? { backgroundImage: `url(${member.avatarUrl})` } : undefined} />
        <div className="min-w-[9rem] flex-1">
          <div className="truncate font-semibold text-stone-900">
            {member.displayName || member.handle || L.memberFallback}
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-stone-400">
            {member.handle && <span className="truncate">@{member.handle}</span>}
            {disabled && <span className="shrink-0 rounded-full bg-stone-200 px-1.5 py-px text-[11px] font-medium text-stone-600">{L.disabledBadge}</span>}
          </div>
        </div>

        {isOwner ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">{L.ownerBadge}</span>
        ) : (
          <>
            <RoleField
              value={role}
              onChange={setRole}
              roleOptions={roleOptions}
              disabled={disabled}
              className={`w-32 px-2.5 py-1.5 text-sm focus:ring-2 disabled:opacity-60 ${FIELD}`}
            />
            {dirty && (
              <button
                disabled={busy || !normRole(role)}
                onClick={() => run(
                  () => team.setRole(member.userId, normRole(role)),
                  () => onPatch(member.userId, { role: normRole(role) }),
                )}
                style={{ color: onPrimaryColor() }}
                className={`px-3 py-1.5 text-xs ${PRIMARY_BTN}`}
              >
                {L.save}
              </button>
            )}
            <RowIcon title={pin ? L.resetPin : L.resetPassword} disabled={busy} onClick={() => run(async () => {
              const res = await team.resetPassword(member.userId)
              if (res?.tempPassword) setTempPw(res.tempPassword)
              return res
            }, (res) => {
              // Reset also re-activates a disabled seat (server behavior), with the role it held.
              if (member.role) return
              const back = backAs(res)
              onPatch(member.userId, { status: 'active', role: back, disabledRole: null })
              setRole(back)
            })}>
              <Key className="h-4 w-4" />
            </RowIcon>
            {disabled ? (
              <>
                <RowIcon title={L.reEnable} disabled={busy} onClick={() => run(
                  () => team.enableMember(member.userId),
                  (res) => {
                    const back = backAs(res)
                    onPatch(member.userId, { status: 'active', role: back, disabledRole: null })
                    setRole(back)
                  },
                )}>
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                </RowIcon>
                {/* Permanent removal lives ONLY on disabled members: Disable → Remove is a
                    deliberate two-step ladder, so a seat + username can never be freed by
                    one accidental tap on an active person. */}
                <RowIcon title={L.remove} disabled={busy} onClick={() => {
                  if (!window.confirm(fmt(L.removeConfirm, { handle: member.handle || member.displayName || L.memberFallback }))) return
                  run(() => team.deleteMember(member.userId), () => onRemove(member.userId))
                }}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </RowIcon>
              </>
            ) : (
              <RowIcon title={L.disable} disabled={busy} onClick={() => run(
                () => team.disableMember(member.userId),
                (res) => {
                  onPatch(member.userId, { status: 'disabled', role: null, disabledRole: res?.disabledRole ?? null })
                  setRole(res?.disabledRole || 'member')
                },
              )}>
                <UserX className="h-4 w-4 text-red-500" />
              </RowIcon>
            )}
          </>
        )}
      </div>


      {tempPw && (
        <div className="ms-[52px] mt-2 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2 ps-3">
          <span className="text-xs text-stone-500">{pin ? L.tempPin : L.tempPassword}</span>
          <code className="text-sm font-semibold text-stone-900">{tempPw}</code>
          <CopyButton value={tempPw} copiedLabel={L.copied} label={L.copy} />
        </div>
      )}
      {msg && <div className="ms-[52px] mt-1.5 text-xs text-red-600">{msg}</div>}
    </div>
  )
}

// What each role can do on the team — see every record / change every record /
// manage people (W2-B). A ROLE-level setting, so it lives once per role (with how
// many people hold it), never under one person's row. Owner only: setRolePowers
// is owner-gated server-side. A power the app's own roles list gives shows on and
// locked — the sync grants it back on every open; "see" shows on while "change" is.
function RoleAccessCard({ members, rolePowers, roleOptions, onChanged, L }) {
  const [busy, setBusy] = useState(null)
  if (typeof auth?.isAppOwner === 'function' && !auth.isAppOwner()) return null
  const counts = new Map()
  for (const m of members) {
    if (!m.role || m.role === 'owner' || m.role === 'member' || m.role === 'admin') continue
    counts.set(m.role, (counts.get(m.role) || 0) + 1)
  }
  if (counts.size === 0) return null
  const labelOf = (name) => roleOptions.find((o) => o.name === name)?.label || titleCaseRole(name)
  const powerLabel = { read: L.powerRead, write: L.powerWrite, manage: L.powerManage }
  const heldBy = (name) => new Set((rolePowers?.powers || {})[name] || [])
  const flip = async (name, power, on) => {
    const next = heldBy(name)
    if (on) { next.add(power); if (power === 'write') next.add('read') } else { next.delete(power); if (power === 'read') next.delete('write') }
    setBusy(name)
    try { await team.setRolePowers(name, POWERS.filter((p) => next.has(p))); await onChanged() } catch { /* the switch stays as the server has it */ }
    finally { setBusy(null) }
  }
  return (
    <div className={`mb-3 p-4 ${CARD}`}>
      <p className="mb-2 text-sm font-semibold text-stone-900">{L.whoManages}</p>
      <div className="divide-y divide-stone-100">
        {[...counts.entries()].map(([name, n]) => {
          const held = heldBy(name)
          const declared = new Set(declaredPowers(roleOptions, name))
          return (
            <div key={name} className="py-2.5">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">{labelOf(name)}</span>
                <span className="flex items-center gap-1 text-xs text-stone-400"><Users className="h-3.5 w-3.5" />{n}</span>
              </div>
              {POWERS.map((power) => {
                const locked = declared.has(power) || (power === 'read' && (held.has('write') || declared.has('write')))
                const on = locked || held.has(power)
                return (
                  <div key={power} className="mt-1.5 flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-[13px] text-stone-500">{powerLabel[power]}</span>
                    <button
                      type="button" role="switch" aria-checked={on} aria-label={`${labelOf(name)} · ${powerLabel[power]}`}
                      disabled={locked || busy === name} onClick={() => flip(name, power, !on)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${on ? 'bg-primary' : 'bg-stone-300'}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'start-[22px]' : 'start-0.5'}`} />
                    </button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RowIcon({ title, onClick, disabled, children }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-stone-500 transition hover:border-stone-300 hover:text-stone-900 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────
// Add people — invite link OR direct username+password
// ─────────────────────────────────────────────

function AddTab({ roleOptions, pin, L }) {
  const [method, setMethod] = useState('link') // link | password
  const [invites, setInvites] = useState(null)
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState(roleOptions[0]?.name || 'member')
  const [expiryMs, setExpiryMs] = useState(EXPIRY_OPTIONS[0].ms)
  const [password, setPassword] = useState('')
  const [created, setCreated] = useState(null) // {kind:'link',url}|{kind:'creds',handle,password,url}
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  // Paged: >1000 invites used to silently truncate (PostgREST max-rows).
  // Reload resets to the first page — a fresh invite sorts newest-first, so
  // it is always visible right after create.
  const [invitesCursor, setInvitesCursor] = useState(null)
  const [invitesBusy, setInvitesBusy] = useState(false)
  const load = () => {
    team.listInvitesPage()
      .then((page) => { setInvites(page.invites); setInvitesCursor(page.hasMore ? page.nextCursor : null) })
      .catch((e) => setErr(e?.message || L.invitesLoadError))
  }
  useEffect(load, [])

  const loadMoreInvites = async () => {
    setInvitesBusy(true)
    try {
      const page = await team.listInvitesPage({ cursor: invitesCursor })
      setInvites((prev) => {
        const fresh = new Set(page.invites.map((i) => i.code))
        return [...(prev || []).filter((i) => !fresh.has(i.code)), ...page.invites]
      })
      setInvitesCursor(page.hasMore ? page.nextCursor : null)
    } catch (e) {
      setErr(e?.message || L.invitesLoadError)
    } finally {
      setInvitesBusy(false)
    }
  }

  const create = async () => {
    setBusy(true); setErr(null); setCreated(null)
    try {
      const h = normHandle(handle)
      const r = normRole(role) || 'member'
      if (method === 'link') {
        const inv = await team.createInvite({ handle: h, role: r, expiresIn: expiryMs || undefined })
        setCreated({ kind: 'link', url: inv.url })
      } else {
        const res = await team.createMember({ handle: h, role: r, password: password || undefined, displayName: name.trim() || undefined })
        setCreated({ kind: 'creds', handle: res.handle, password: password || res.tempPassword, url: res.url })
        setPassword(''); setName('')
      }
      setHandle('')
      load()
    } catch (e) {
      setErr(e?.status === 409 ? L.usernameTaken : (e?.message || L.addFailed))
    } finally {
      setBusy(false)
    }
  }
  // What the box will keep vs what was typed: say the rule the moment a letter would be dropped.
  const typed = foldTypedDigits(handle).toLowerCase().trim()
  const kept = normHandle(handle)
  const handleHint = typed && kept !== typed ? L.usernameLatinOnly : (kept && kept.length < 3 ? L.usernameTooShort : null)

  return (
    <div className="space-y-4">
      <div className={`p-4 ${CARD}`}>
        <div className="mb-3 flex gap-1 overflow-x-auto rounded-full bg-stone-100 p-1 text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <MethodButton active={method === 'link'} onClick={() => { setMethod('link'); setCreated(null) }} icon={Link2}>
            {L.methodLink}
          </MethodButton>
          <MethodButton active={method === 'password'} onClick={() => { setMethod('password'); setCreated(null) }} icon={KeyRound}>
            {L.methodPassword}
          </MethodButton>
          <MethodButton active={method === 'import'} onClick={() => { setMethod('import'); setCreated(null) }} icon={Upload}>
            {L.methodImport}
          </MethodButton>
        </div>
        {method === 'import' && <ImportPanel roleOptions={roleOptions} onDone={load} pin={pin} L={L} />}
        {method !== 'import' && (
        <>
        <p className="mb-3 text-[13px] text-stone-500">
          {method === 'link'
            ? (pin ? L.introLinkPin : L.introLink)
            : (pin ? L.introCredsPin : L.introCreds)}
        </p>
        <div className="flex flex-wrap items-start gap-3">
          {method === 'password' && (
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-stone-700">{L.name}</label>
              <input
                data-f="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={L.namePlaceholder}
                className={`w-40 px-3 py-2 text-sm ${FIELD}`}
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-stone-700">{L.username}</label>
            <input
              data-f="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={L.usernamePlaceholder}
              className={`w-32 px-3 py-2 text-sm ${FIELD}`}
            />
            {handleHint && <p className="mt-1 max-w-[14rem] text-xs text-red-600">{handleHint}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-stone-700">{L.role}</label>
            <RoleField
              value={role}
              onChange={setRole}
              roleOptions={roleOptions}
              className={`w-28 px-3 py-2 text-sm ${FIELD}`}
            />
          </div>
          {method === 'link' ? (
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-stone-700">{L.expiry}</label>
              <select
                value={expiryMs}
                onChange={(e) => setExpiryMs(Number(e.target.value))}
                className={`px-3 py-2 text-sm ${FIELD}`}
              >
                {EXPIRY_OPTIONS.map((o) => <option key={o.ms} value={o.ms}>{L[o.key]}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-stone-700">
                {pin ? L.pinLabel : L.passwordLabel} <span className="font-normal text-stone-400">{L.optionalHint}</span>
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                placeholder={L.autoGenerate}
                className={`w-36 px-3 py-2 text-sm ${FIELD}`}
                {...(pin ? { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 } : {})}
              />
            </div>
          )}
          <button
            onClick={create}
            disabled={busy || kept.length < 3}
            style={{ color: onPrimaryColor() }}
            className={`ms-auto mt-[26px] px-4 py-2 text-sm ${PRIMARY_BTN}`}
          >
            {busy ? L.adding : method === 'link' ? L.createInvite : L.createLogin}
          </button>
        </div>

        {created?.kind === 'link' && created.url && <CopyField value={created.url} copiedLabel={L.copied} copyLabel={L.copy} />}
        {created?.kind === 'creds' && (
          <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3.5">
            <p className="mb-2 text-[13px] font-semibold text-stone-700">
              {fmt(L.createdHandThese, { handle: created.handle })}
            </p>
            <div className="space-y-1 text-sm text-stone-700">
              {created.url && <div>{L.appLine} <span className="font-medium">{created.url}</span></div>}
              <div>{L.usernameLine} <span className="font-medium">{created.handle}</span></div>
              <div>{pin ? L.pinLabel : L.passwordLabel}: <code className="font-semibold text-stone-900">{created.password}</code></div>
            </div>
            <div className="mt-2.5">
              <CopyButton
                label={L.copyLoginDetails}
                copiedLabel={L.copied}
                value={`${created.url ? created.url + '\n' : ''}Username: ${created.handle}\n${pin ? 'PIN' : 'Password'}: ${created.password}`}
              />
            </div>
          </div>
        )}
        {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}
        </>
        )}
      </div>

      {!invites ? <Spinner /> : invites.length === 0 ? (
        <Empty>{L.invitesEmpty}</Empty>
      ) : (
        <div className={`divide-y divide-stone-100 ${CARD}`}>
          {invites.map((inv) => (
            <div key={inv.code} className="flex items-center gap-3 p-3.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-stone-900">
                  {inv.handle ? `@${inv.handle}` : inv.code}
                  <span className="ms-2 font-normal text-stone-400">{inv.role}</span>
                </div>
                <div className="text-xs text-stone-400">
                  {inv.used_count > 0 ? L.inviteAccepted : inv.active ? L.invitePending : L.inviteExpired}
                </div>
              </div>
              {inv.active && inv.used_count === 0 && inv.url && (
                <RowIcon title={L.copyInviteLink} onClick={() => copyText(inv.url)}>
                  <Copy className="h-4 w-4" />
                </RowIcon>
              )}
              <RowIcon title={L.revoke} onClick={() => team.revokeInvite(inv.code).then(load)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </RowIcon>
            </div>
          ))}
        </div>
      )}
      {invitesCursor && (
        <button
          disabled={invitesBusy}
          onClick={loadMoreInvites}
          className="w-full rounded-lg border border-stone-200 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
        >
          {invitesBusy ? '…' : L.loadMore}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Requests — self-signup toggle + pending approvals
// ─────────────────────────────────────────────

function RequestsTab({ roleOptions, onChanged, L }) {
  const [selfSignup, setSelfSignup] = useState(null)
  const [pending, setPending] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    team.config().then((c) => setSelfSignup(!!c?.selfSignup)).catch(() => setSelfSignup(false))
    team.listPending().then(setPending).catch((e) => setErr(e?.message || L.requestsLoadError))
  }
  useEffect(load, [])

  const toggle = async () => {
    const next = !selfSignup
    setBusy(true); setErr(null)
    try { await team.setSelfSignup(next); setSelfSignup(next) }
    catch (e) { setErr(e?.message || L.updateFailed) }
    finally { setBusy(false) }
  }
  const refresh = () => { load(); onChanged?.() }
  const rejectAll = async () => {
    if (!pending?.length) return
    if (!window.confirm(fmt(L.rejectAllConfirm, { count: pending.length }))) return
    setBusy(true); setErr(null)
    try { await team.rejectAllPending(); refresh() }
    catch (e) { setErr(e?.message || L.updateFailed) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between gap-3 p-4 ${CARD}`}>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900">{L.selfSignupTitle}</p>
          <p className="mt-0.5 text-[13px] text-stone-500">{L.selfSignupBody}</p>
        </div>
        <button
          type="button" role="switch" aria-checked={selfSignup === true}
          disabled={busy || selfSignup === null} onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${selfSignup ? 'bg-primary' : 'bg-stone-300'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${selfSignup ? 'start-[22px]' : 'start-0.5'}`} />
        </button>
      </div>

      {err && <ErrorBox>{err}</ErrorBox>}

      {!pending ? <Spinner /> : pending.length === 0 ? (
        <Empty>{selfSignup ? L.noPending : L.turnOnHint}</Empty>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-stone-400">{pending.length} {pending.length === 1 ? L.pendingOne : L.pendingMany}</p>
            <button type="button" disabled={busy} onClick={rejectAll} className="text-xs font-medium text-red-500 transition hover:text-red-600 disabled:opacity-50">{L.rejectAll}</button>
          </div>
          <div className={`divide-y divide-stone-100 ${CARD}`}>
            {pending.map((p) => <PendingRow key={p.userId} req={p} roleOptions={roleOptions} onChanged={refresh} onError={setErr} L={L} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function PendingRow({ req, roleOptions, onChanged, onError, L }) {
  const [role, setRole] = useState(roleOptions[0]?.name || 'member')
  const [busy, setBusy] = useState(false)
  const run = async (fn) => {
    setBusy(true); onError?.(null)
    try { await fn(); onChanged?.() }
    catch (e) { onError?.(e?.message || L.actionFailed) }
    finally { setBusy(false) }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 p-3.5">
      <div className="h-10 w-10 shrink-0 rounded-full bg-stone-100 bg-cover bg-center ring-1 ring-stone-200/70" style={req.avatarUrl ? { backgroundImage: `url(${req.avatarUrl})` } : undefined} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-stone-900">{req.displayName || req.handle}</div>
        <div className="text-xs text-stone-400">@{req.handle}</div>
      </div>
      <RoleField value={role} onChange={setRole} roleOptions={roleOptions} title={L.roleToGive} className={`w-24 px-2.5 py-1.5 text-sm ${FIELD}`} />
      <button disabled={busy || !normRole(role)} onClick={() => run(() => team.approveMember(req.userId, normRole(role)))} style={{ color: onPrimaryColor() }} className={`px-3 py-1.5 text-xs ${PRIMARY_BTN}`}>
        {L.approve}
      </button>
      <RowIcon title={L.reject} disabled={busy} onClick={() => run(() => team.rejectMember(req.userId))}>
        <Trash2 className="h-4 w-4 text-red-500" />
      </RowIcon>
    </div>
  )
}

// ─────────────────────────────────────────────
// Sign-in — per-app login-surface options (PIN mode, member picker)
// ─────────────────────────────────────────────

function SignInTab({ loginCfg, onChanged, L }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const flip = async (key) => {
    const next = { ...loginCfg, [key]: !loginCfg[key] }
    setBusy(true); setErr(null)
    try {
      const res = await team.setLoginConfig({ [key]: next[key] })
      onChanged?.(res?.loginConfig || next)
    } catch (e) {
      setErr(e?.message || L.updateFailed)
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <ToggleRow
        title={L.pinModeTitle}
        body={L.pinModeBody}
        checked={loginCfg.pin}
        disabled={busy}
        onToggle={() => flip('pin')}
      />
      <ToggleRow
        title={L.pickerTitle}
        body={L.pickerBody}
        checked={loginCfg.memberPicker}
        disabled={busy}
        onToggle={() => flip('memberPicker')}
      />
      {err && <ErrorBox>{err}</ErrorBox>}
    </div>
  )
}

function ToggleRow({ title, body, checked, disabled, onToggle }) {
  return (
    <div className={`flex items-center justify-between gap-3 p-4 ${CARD}`}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-stone-900">{title}</p>
        <p className="mt-0.5 text-[13px] text-stone-500">{body}</p>
      </div>
      <button
        type="button" role="switch" aria-checked={checked === true}
        disabled={disabled} onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-stone-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'start-[22px]' : 'start-0.5'}`} />
      </button>
    </div>
  )
}

// Bulk import — parse a staff spreadsheet, map columns, create every login at once.
function ImportPanel({ roleOptions, onDone, pin, L }) {
  const [columns, setColumns] = useState(null)
  const [rows, setRows] = useState([])
  const [map, setMap] = useState({ handle: '', name: '', role: '' })
  const [defaultRole, setDefaultRole] = useState(roleOptions[0]?.name || 'member')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const pick = async (file) => {
    if (!file) return
    setErr(null); setResults(null); setColumns(null); setBusy(true)
    try {
      const { columns: cols, rows: parsed } = await readSpreadsheet(file)
      if (!parsed?.length) throw new Error(L.fileNoRows)
      const colList = cols || Object.keys(parsed[0] || {})
      setColumns(colList); setRows(parsed)
      const find = (re) => colList.find((c) => re.test(c)) || ''  // best-effort auto-map
      setMap({ handle: find(/user|handle|login/i) || find(/name/i), name: find(/name|full/i), role: find(/role|position|title|job/i) })
    } catch (e) {
      setErr(e?.message || L.fileReadError)
    } finally { setBusy(false) }
  }

  const runImport = async () => {
    setErr(null); setBusy(true)
    try {
      const payload = rows.map((r) => ({
        handle: String(r[map.handle] ?? '').trim(),
        displayName: map.name ? String(r[map.name] ?? '').trim() : undefined,
        role: (map.role && r[map.role] ? normRole(String(r[map.role])) : normRole(defaultRole)) || 'member',
      })).filter((r) => r.handle)
      if (!payload.length) throw new Error(L.noUsableRows)
      if (payload.length > 100) throw new Error(fmt(L.importCap, { count: payload.length }))
      const res = await team.bulkCreateMembers(payload)
      setResults(res); onDone?.()
    } catch (e) {
      setErr(e?.message || L.importFailed)
    } finally { setBusy(false) }
  }

  if (results) {
    const made = results.results.filter((r) => r.ok)
    const failed = results.results.filter((r) => !r.ok)
    const csv = `username,${pin ? 'pin' : 'password'}\n` + made.map((r) => `${r.handle},${r.tempPassword}`).join('\n')
    return (
      <div className="space-y-3">
        <p className="text-[13px] font-semibold text-stone-700">
          {fmt(L.createdCount, { count: made.length })}{failed.length ? fmt(L.skippedCount, { count: failed.length }) : ''}
        </p>
        {made.length > 0 && (
          <>
            <div className={`max-h-64 divide-y divide-stone-100 overflow-auto ${CARD}`}>
              {made.map((r) => (
                <div key={r.handle} className="flex items-center justify-between gap-3 p-2.5 text-sm">
                  <span className="font-medium text-stone-800">@{r.handle}</span>
                  <code className="text-stone-900">{r.tempPassword}</code>
                </div>
              ))}
            </div>
            <CopyButton label={L.copyAllLogins} copiedLabel={L.copied} value={csv} />
          </>
        )}
        {failed.length > 0 && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-xs text-stone-500">
            {failed.map((r, i) => <div key={`${r.handle}-${i}`}>@{r.handle || '?'} — {r.reason}</div>)}
          </div>
        )}
        <button onClick={() => { setResults(null); setColumns(null); setRows([]) }} className="text-sm font-medium text-primary hover:underline">
          {L.importAnother}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="mb-1 text-[13px] text-stone-500">
        {pin ? L.importIntroPin : L.importIntro}
      </p>
      {!columns ? (
        <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm font-medium text-stone-600 hover:border-stone-400 ${busy ? 'opacity-60' : ''}`}>
          <Upload className="h-4 w-4" />
          {busy ? L.reading : L.chooseFile}
          <input type="file" accept=".csv,.xlsx" className="hidden" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-stone-500">{fmt(L.rowsFound, { count: rows.length })}</p>
          <div className="flex flex-wrap items-end gap-3">
            <ColSelect label={L.usernameCol} cols={columns} value={map.handle} onChange={(v) => setMap((m) => ({ ...m, handle: v }))} L={L} />
            <ColSelect label={L.displayNameCol} cols={columns} value={map.name} onChange={(v) => setMap((m) => ({ ...m, name: v }))} optional L={L} />
            <ColSelect label={L.roleCol} cols={columns} value={map.role} onChange={(v) => setMap((m) => ({ ...m, role: v }))} optional L={L} />
            {!map.role && (
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-stone-700">{L.roleForAll}</label>
                <RoleField value={defaultRole} onChange={setDefaultRole} roleOptions={roleOptions} className={`w-28 px-3 py-2 text-sm ${FIELD}`} />
              </div>
            )}
          </div>
          <button onClick={runImport} disabled={busy || !map.handle} style={{ color: onPrimaryColor() }} className={`px-4 py-2 text-sm ${PRIMARY_BTN}`}>
            {busy ? L.creating : fmt(L.createLogins, { count: rows.length })}
          </button>
        </div>
      )}
      {err && <ErrorBox>{err}</ErrorBox>}
    </div>
  )
}

function ColSelect({ label, cols, value, onChange, optional, L }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold text-stone-700">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`px-3 py-2 text-sm ${FIELD}`}>
        <option value="">{optional ? L.noneOption : L.selectColumn}</option>
        {cols.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  )
}

function MethodButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 font-semibold transition ${
        active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" /> {children}
    </button>
  )
}

function CopyButton({ value, label, copiedLabel }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (await copyText(value)) { setCopied(true); setTimeout(() => setCopied(false), 1500) }
  }
  return (
    <button onClick={copy} style={{ color: onPrimaryColor() }} className={`flex items-center gap-1 px-3 py-1.5 text-xs ${PRIMARY_BTN}`}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? (copiedLabel || 'Copied') : (label || 'Copy')}
    </button>
  )
}

function CopyField({ value, copiedLabel, copyLabel }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2 ps-3.5">
      <input readOnly value={value} dir="ltr" className="min-w-0 flex-1 bg-transparent text-sm text-stone-700 outline-none" />
      <CopyButton value={value} label={copyLabel} copiedLabel={copiedLabel} />
    </div>
  )
}

function ErrorBox({ children }) {
  return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{children}</p>
}
function Spinner() {
  return <div className="flex justify-center p-8 text-stone-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
}
function Empty({ children }) {
  return <p className={`p-8 text-center text-sm text-stone-400 ${CARD}`}>{children}</p>
}

/**
 * Imperative entry used by team.openAdmin(): mounts <TeamAdmin> in a modal overlay so the
 * owner can manage the roster from a one-line "Manage team" button instead of a hand-built
 * admin route. Self-gates with team.canManage() (non-admins see an access notice). Resolves
 * when the modal is dismissed.
 * @param {object} [options] - { roles, labels } forwarded to <TeamAdmin>
 * @returns {Promise<void>}
 */
export async function openTeamAdmin(options = {}) {
  const { createRoot } = await import('react-dom/client')
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      resolve()
      setTimeout(() => {
        try { root.unmount() } catch {}
        host.remove()
      }, 0)
    }

    // Same robust overlay recipe as TeamLogin's modal: fixed + overflow-y-auto + margin-auto
    // card — centers when short, scrolls when tall, never clips behind a device frame.
    root.render(
      <div
        className="fixed inset-0 z-[2147483600] flex overflow-y-auto bg-stone-950/50 backdrop-blur-sm"
        style={SAFE_PAD}
        onClick={(e) => { if (e.target === e.currentTarget) finish() }}
      >
        <div className="m-auto w-full max-w-md rounded-3xl bg-white shadow-2xl shadow-stone-900/10">
          <TeamAdmin onClose={finish} roles={options?.roles} labels={options?.labels} />
        </div>
      </div>,
    )
  })
}
