# Quick-Add Expense Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a raised centre button to the mobile nav that opens a bottom sheet for quickly adding expenses from anywhere in the app.

**Architecture:** Five focused changes — extend ExpenseForm with an optional project selector, create a QuickAddSheet bottom sheet component, update MobileNav to add the raised ⊕ button (and render the sheet), pass `userId` from the server layout to both nav components, and add a matching "Add Expense" button to the desktop Sidebar. No new dependencies needed.

**Tech Stack:** Next.js App Router, Tailwind CSS, existing Dialog/Select/Button UI components, `useRouter` for post-save refresh, `lucide-react` for icons.

---

### Task 1: Extend ExpenseForm with optional project selector

**Files:**
- Modify: `src/components/expenses/expense-form.tsx`

**Context:**
- The form currently accepts an optional `projectId?: string` prop used when adding an expense from within a project page. That behaviour must be preserved.
- We add an optional `projects?: Array<{ id: string; name: string }>` prop. When provided, a project selector is shown at the top of the form. When not provided, the form behaves exactly as today.
- Default selected project is null — the POST body sends `project_id: null` → expense lands in Inbox.
- Hint text "No project selected — expense will go to Inbox" appears below the selector when nothing is selected.

**Note:** No unit tests for UI components in this project — verify manually by opening the form.

**Step 1: Update the Props interface and add `selectedProjectId` state**

Replace the top of `src/components/expenses/expense-form.tsx` Props and state:

```typescript
interface Props {
  userId: string
  projectId?: string
  projects?: Array<{ id: string; name: string }>
  onSuccess: () => void
}

export default function ExpenseForm({ userId, projectId, projects, onSuccess }: Props) {
  // ... existing state ...
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectId ?? null)
```

**Step 2: Update the POST body to use `selectedProjectId`**

In `handleSubmit`, change:
```typescript
project_id: projectId || null,
```
to:
```typescript
project_id: selectedProjectId,
```

**Step 3: Add project selector JSX above the ReceiptUpload**

Inside the `<form>` tag, before `<ReceiptUpload ...>`, add:

```tsx
{projects && (
  <div className="space-y-1">
    <Label>Project</Label>
    <Select
      value={selectedProjectId ?? ''}
      onValueChange={v => setSelectedProjectId(v || null)}
    >
      <SelectTrigger>
        <SelectValue placeholder="No project — goes to Inbox" />
      </SelectTrigger>
      <SelectContent>
        {projects.map(p => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
    {!selectedProjectId && (
      <p className="text-xs text-gray-400">No project selected — expense will go to Inbox</p>
    )}
  </div>
)}
```

**Step 4: Run tests**

```bash
cd /srv/projects/work/pai && npm test -- --run
```

Expected: 38 tests passing (no regressions — these tests cover lib/ only).

**Step 5: Commit**

```bash
git add src/components/expenses/expense-form.tsx
git commit -m "feat: add optional project selector to ExpenseForm"
```

---

### Task 2: Create QuickAddSheet bottom sheet component

**Files:**
- Create: `src/components/expenses/quick-add-sheet.tsx`

**Context:**
- This is a full-width bottom sheet that slides up from the bottom of the screen.
- It sits above the fixed mobile nav (z-index must exceed nav's `z-50` — use `z-[60]`).
- When `open` is false the sheet is off-screen (`translate-y-full`) but still in the DOM so the slide animation works.
- Projects are fetched from `/api/projects` the first time the sheet opens (lazy, cached in state).
- `onSuccess` closes the sheet and refreshes the current page.
- The backdrop click also closes the sheet.

**Step 1: Create the file**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import ExpenseForm from './expense-form'

interface Props {
  userId: string
  open: boolean
  onClose: () => void
}

export default function QuickAddSheet({ userId, open, onClose }: Props) {
  const router = useRouter()
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (open && projects.length === 0) {
      fetch('/api/projects')
        .then(r => r.json())
        .then((data: Array<{ id: string; name: string }>) =>
          setProjects((data ?? []).map(p => ({ id: p.id, name: p.name })))
        )
        .catch(() => {})
    }
  }, [open])

  function handleSuccess() {
    onClose()
    router.refresh()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-[60] transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-2xl transition-transform duration-300',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <h2 className="text-lg font-semibold">Add Expense</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-4 pb-8">
          <ExpenseForm
            userId={userId}
            projects={projects}
            onSuccess={handleSuccess}
          />
        </div>
      </div>
    </>
  )
}
```

**Step 2: Run tests**

```bash
npm test -- --run
```

Expected: 38 passing.

**Step 3: Commit**

```bash
git add src/components/expenses/quick-add-sheet.tsx
git commit -m "feat: add QuickAddSheet bottom sheet component"
```

---

### Task 3: Update MobileNav with raised centre button

**Files:**
- Modify: `src/components/nav/mobile-nav.tsx`

**Context:**
- Nav goes from 3 equal tabs to 4 items: Dashboard | Inbox | ⊕ | Settings.
- The ⊕ is a filled circle (52×52px, black bg, white icon) with `-mt-5` to lift it above the nav bar top border.
- The component now accepts `userId: string` and manages `sheetOpen` state.
- Returns a Fragment containing the `<nav>` and the `<QuickAddSheet>`.

**Step 1: Rewrite `src/components/nav/mobile-nav.tsx`**

```typescript
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Inbox, Settings, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import QuickAddSheet from '@/components/expenses/quick-add-sheet'

interface Props {
  className?: string
  userId: string
}

export default function MobileNav({ className, userId }: Props) {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <nav className={cn('flex items-end border-t bg-white fixed bottom-0 left-0 right-0 z-50', className)}>
        {/* Left tabs */}
        {[
          { href: '/', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/inbox', label: 'Inbox', icon: Inbox },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors',
              pathname === href ? 'text-gray-900 font-medium' : 'text-gray-500'
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}

        {/* Raised centre button */}
        <div className="flex flex-1 flex-col items-center pb-2">
          <button
            onClick={() => setSheetOpen(true)}
            className="-mt-5 h-14 w-14 rounded-full bg-black text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            aria-label="Add expense"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        {/* Right tab */}
        <Link
          href="/settings"
          className={cn(
            'flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors',
            pathname === '/settings' ? 'text-gray-900 font-medium' : 'text-gray-500'
          )}
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
      </nav>

      <QuickAddSheet
        userId={userId}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}
```

**Step 2: Run tests**

```bash
npm test -- --run
```

Expected: 38 passing.

**Step 3: Commit**

```bash
git add src/components/nav/mobile-nav.tsx
git commit -m "feat: add raised centre button to mobile nav, opens QuickAddSheet"
```

---

### Task 4: Pass userId from AppLayout to nav components

**Files:**
- Modify: `src/app/(app)/layout.tsx`

**Context:**
- Layout already fetches `user` for auth guard. Just pass `user.id` to both nav components.
- Sidebar currently takes only `className`. We'll update it to also accept `userId` in Task 5 — for now just pass it to MobileNav (Sidebar change comes next).

**Step 1: Update `src/app/(app)/layout.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/nav/sidebar'
import MobileNav from '@/components/nav/mobile-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar className="hidden md:flex" userId={user.id} />
      <main className="flex-1 overflow-auto flex flex-col">
        <MobileNav className="md:hidden" userId={user.id} />
        <div className="flex-1 p-4 md:p-8 pb-16 md:pb-8">{children}</div>
      </main>
    </div>
  )
}
```

**Step 2: Run tests**

```bash
npm test -- --run
```

Expected: 38 passing. (TypeScript will complain about `userId` on Sidebar until Task 5 — fix that in Task 5.)

**Step 3: Commit**

```bash
git add src/app/\(app\)/layout.tsx
git commit -m "feat: pass userId from layout to nav components"
```

---

### Task 5: Add global Add Expense button to desktop Sidebar

**Files:**
- Modify: `src/components/nav/sidebar.tsx`

**Context:**
- Sidebar is desktop-only (`hidden md:flex` in the layout). Add `userId: string` to its props.
- Add an "Add Expense" button below the nav links, above the Sign Out button.
- It opens the same `QuickAddSheet` (which is fixed-positioned, so it renders correctly even on desktop).
- The QuickAddSheet is already mobile-optimised visually, but it works fine on desktop as a centred bottom sheet.

**Step 1: Rewrite `src/components/nav/sidebar.tsx`**

```typescript
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Inbox, Settings, LogOut, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import QuickAddSheet from '@/components/expenses/quick-add-sheet'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface Props {
  className?: string
  userId: string
}

export default function Sidebar({ className, userId }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <aside className={cn('w-56 flex flex-col border-r bg-white px-3 py-6', className)}>
        <div className="mb-8 px-3 text-xl font-bold tracking-tight">PAI</div>
        <nav className="flex-1 space-y-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium bg-black text-white hover:bg-gray-800 transition-colors mb-2"
        >
          <Plus className="h-4 w-4" />
          Add Expense
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>

      <QuickAddSheet
        userId={userId}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}
```

**Step 2: Run tests**

```bash
npm test -- --run
```

Expected: 38 passing.

**Step 3: Commit**

```bash
git add src/components/nav/sidebar.tsx
git commit -m "feat: add global Add Expense button to desktop sidebar"
```

---

### Task 6: Manual smoke test and push

**Step 1: Start dev server locally OR deploy and test on device**

Check the following on mobile (or narrow browser window):
- [ ] Bottom nav shows 4 items: Dashboard, Inbox, ⊕ (raised black circle), Settings
- [ ] Tapping ⊕ opens the sheet from the bottom
- [ ] Sheet shows project selector defaulting to "No project — goes to Inbox"
- [ ] Selecting a project changes the selector label
- [ ] Receipt upload / OCR works within the sheet
- [ ] Saving with no project → expense appears in Inbox
- [ ] Saving with a project selected → expense appears in that project
- [ ] Swiping down (backdrop click) dismisses the sheet

Check on desktop:
- [ ] Black "Add Expense" button appears in sidebar
- [ ] Clicking it opens the same sheet
- [ ] Sheet renders correctly

**Step 2: Push to origin**

```bash
git push origin main
```
