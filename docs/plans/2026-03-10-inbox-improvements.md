# Inbox Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show the inbound email address on the empty inbox page, and display a live item count badge on the Inbox nav item in both mobile and desktop navs.

**Architecture:** Two independent changes. (1) The inbox page server component fetches the inbound token (already done on the settings page — same pattern) and passes the address to InboxClient to render when empty. (2) The app layout server component adds a single count query and passes `inboxCount` down to both nav components, which render a badge inline.

**Tech Stack:** Next.js 14 App Router, Supabase server client, Tailwind CSS, existing nav components.

---

### Task 1: Show inbound email address on empty inbox

**Files:**
- Modify: `src/app/(app)/inbox/page.tsx`
- Modify: `src/components/inbox/inbox-client.tsx`

**Context:**
- The inbox page is a server component. It already fetches `user` and `expenses`. We add one more read-only query for the inbound token — the same `inbound_tokens` table read that `src/app/(app)/settings/page.tsx` uses.
- `INBOUND_EMAIL_DOMAIN` env var drives the domain; falls back to `'mail.yourapp.com'`.
- `InboxClient` currently shows a plain text message when empty. We extend it to also show the address as a monospace block.
- No token row → `inboundAddress` is `null` → the address block is simply not rendered (graceful degradation).

**Step 1: Update `src/app/(app)/inbox/page.tsx`**

Replace the full file with:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InboxClient from '@/components/inbox/inbox-client'
import type { Database } from '@/lib/supabase/types'

type Expense = Database['public']['Tables']['expenses']['Row']

export default async function InboxPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .is('project_id', null)
    .order('created_at', { ascending: false })

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name')

  const { data: tokenRow } = await supabase
    .from('inbound_tokens')
    .select('token')
    .eq('user_id', user.id)
    .single()

  const domain = process.env.INBOUND_EMAIL_DOMAIN ?? 'mail.yourapp.com'
  const inboundAddress = tokenRow ? `${tokenRow.token}@${domain}` : null

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Inbox</h1>
      <p className="text-sm text-gray-500 mb-6">
        Receipts forwarded by email appear here. Assign them to a project or discard them.
      </p>
      <InboxClient
        initialExpenses={(expenses ?? []) as Expense[]}
        projects={projects ?? []}
        inboundAddress={inboundAddress}
      />
    </div>
  )
}
```

**Step 2: Update `src/components/inbox/inbox-client.tsx`**

Add `inboundAddress: string | null` to Props and update the empty state. Change the `Props` interface and component signature, then replace the empty-state return:

```typescript
interface Props {
  initialExpenses: Expense[]
  projects: Project[]
  inboundAddress: string | null
}

export default function InboxClient({ initialExpenses, projects, inboundAddress }: Props) {
```

Replace the empty-state block (currently lines 48–54):

```tsx
  if (expenses.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Your inbox is empty. Forward receipts to your inbound email address to get started.
        </p>
        {inboundAddress && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Forward receipts to:</p>
            <p className="text-sm font-mono bg-gray-100 rounded px-3 py-2 break-all">
              {inboundAddress}
            </p>
          </div>
        )}
      </div>
    )
  }
```

**Step 3: Run tests**

```bash
cd /srv/projects/work/pai && npm test -- --run
```

Expected: 38 passing.

**Step 4: Commit**

```bash
git add src/app/\(app\)/inbox/page.tsx src/components/inbox/inbox-client.tsx
git commit -m "feat: show inbound email address on empty inbox page"
```

---

### Task 2: Inbox count badge in nav

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/nav/mobile-nav.tsx`
- Modify: `src/components/nav/sidebar.tsx`

**Context:**
- The layout server component already has a Supabase client and the authenticated user. We add a single `count` query — no extra round trips thanks to Supabase's `{ count: 'exact', head: true }` option which returns only the count, not rows.
- Both nav components are client components. They receive `inboxCount: number` as a prop and render a badge when it is > 0.
- **Mobile nav badge:** the icon + label are stacked vertically in a flex column link. Wrap the icon in a `relative` div and overlay the count as an absolute badge top-right of the icon.
- **Desktop sidebar badge:** the link is horizontal (icon + label). Push the badge to the far right with `ml-auto`.
- Badge disappears when `inboxCount` is 0 (conditional render).

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

  const { count: inboxCount } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('project_id', null)

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar className="hidden md:flex" userId={user.id} inboxCount={inboxCount ?? 0} />
      <main className="flex-1 overflow-auto flex flex-col">
        <MobileNav className="md:hidden" userId={user.id} inboxCount={inboxCount ?? 0} />
        <div className="flex-1 p-4 md:p-8 pb-16 md:pb-8">{children}</div>
      </main>
    </div>
  )
}
```

**Step 2: Update `src/components/nav/mobile-nav.tsx`**

Add `inboxCount: number` to Props. Wrap the Inbox icon in a relative container and overlay the badge. The left tabs array gets a `badge` field:

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
  inboxCount: number
}

export default function MobileNav({ className, userId, inboxCount }: Props) {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  const leftTabs = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, badge: 0 },
    { href: '/inbox', label: 'Inbox', icon: Inbox, badge: inboxCount },
  ]

  return (
    <>
      <nav className={cn('flex items-end border-t bg-white fixed bottom-0 left-0 right-0 z-50', className)}>
        {leftTabs.map(({ href, label, icon: Icon, badge }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors',
              pathname === href ? 'text-gray-900 font-medium' : 'text-gray-500'
            )}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {badge > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[1rem] h-4 rounded-full bg-gray-800 text-white text-[10px] flex items-center justify-center px-0.5 leading-none">
                  {badge}
                </span>
              )}
            </div>
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

**Step 3: Update `src/components/nav/sidebar.tsx`**

Add `inboxCount: number` to Props. Render a badge to the right of the Inbox label:

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
  inboxCount: number
}

export default function Sidebar({ className, userId, inboxCount }: Props) {
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
              {href === '/inbox' && inboxCount > 0 && (
                <span className="ml-auto text-xs bg-gray-200 text-gray-700 rounded-full px-1.5 py-0.5 leading-none">
                  {inboxCount}
                </span>
              )}
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

**Step 4: Run tests**

```bash
npm test -- --run
```

Expected: 38 passing.

**Step 5: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/components/nav/mobile-nav.tsx src/components/nav/sidebar.tsx
git commit -m "feat: show inbox count badge in nav"
```

---

### Task 3: Push

```bash
git push origin main
```
