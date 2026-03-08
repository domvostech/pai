# PAI Budget Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app for freelancers to track production budgets, scan receipts, and generate combined PDF expense reports.

**Architecture:** Next.js 14 App Router with serverless API routes, Supabase for auth/database/storage, Claude Haiku for OCR, Postmark Inbound for email receipts, and pdf-lib for export generation.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Supabase JS v2, @anthropic-ai/sdk, pdf-lib, browser-image-compression, Vitest

---

## Phase 1: Foundation

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.env.local.example`

**Step 1: Initialize Next.js with TypeScript and Tailwind**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes
```

**Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk pdf-lib browser-image-compression
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

**Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button card dialog form input label select separator sheet skeleton table tabs toast
```

**Step 4: Create `.env.local.example`**

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
POSTMARK_WEBHOOK_SECRET=
```

**Step 5: Configure Vitest — create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

**Step 6: Create `src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

**Step 7: Add test script to `package.json`**

Add to scripts: `"test": "vitest"`, `"test:run": "vitest run"`

**Step 8: Verify project builds**

```bash
npm run build
```
Expected: Build succeeds with no errors.

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 project with TypeScript, Tailwind, shadcn/ui"
```

---

### Task 2: Supabase Schema & Row Level Security

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/migrations/002_rls_policies.sql`
- Create: `supabase/migrations/003_storage.sql`

**Step 1: Install Supabase CLI and initialize**

```bash
npm install -D supabase
npx supabase init
npx supabase start
```

**Step 2: Create `supabase/migrations/001_initial_schema.sql`**

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Clients
create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  created_at timestamptz not null default now()
);

-- Projects
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  total_budget numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Expense category enum
create type expense_category as enum ('general', 'transport');

-- Expenses
create table public.expenses (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vendor text,
  amount numeric(12,2) not null default 0,
  date date not null default current_date,
  category expense_category not null default 'general',
  notes text,
  receipt_path text,
  is_return boolean not null default false,
  ocr_confidence jsonb,
  created_at timestamptz not null default now()
);

-- Inbound email tokens
create table public.inbound_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now()
);
```

**Step 3: Create `supabase/migrations/002_rls_policies.sql`**

```sql
-- Enable RLS on all tables
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.expenses enable row level security;
alter table public.inbound_tokens enable row level security;

-- Clients: users can only see/modify their own
create policy "clients_select" on public.clients for select using (auth.uid() = user_id);
create policy "clients_insert" on public.clients for insert with check (auth.uid() = user_id);
create policy "clients_update" on public.clients for update using (auth.uid() = user_id);
create policy "clients_delete" on public.clients for delete using (auth.uid() = user_id);

-- Projects
create policy "projects_select" on public.projects for select using (auth.uid() = user_id);
create policy "projects_insert" on public.projects for insert with check (auth.uid() = user_id);
create policy "projects_update" on public.projects for update using (auth.uid() = user_id);
create policy "projects_delete" on public.projects for delete using (auth.uid() = user_id);

-- Expenses
create policy "expenses_select" on public.expenses for select using (auth.uid() = user_id);
create policy "expenses_insert" on public.expenses for insert with check (auth.uid() = user_id);
create policy "expenses_update" on public.expenses for update using (auth.uid() = user_id);
create policy "expenses_delete" on public.expenses for delete using (auth.uid() = user_id);

-- Inbound tokens
create policy "tokens_select" on public.inbound_tokens for select using (auth.uid() = user_id);
create policy "tokens_insert" on public.inbound_tokens for insert with check (auth.uid() = user_id);
create policy "tokens_delete" on public.inbound_tokens for delete using (auth.uid() = user_id);
```

**Step 4: Create `supabase/migrations/003_storage.sql`**

```sql
-- Storage bucket for receipts
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);

-- Only authenticated users can upload to their own folder
create policy "receipts_upload" on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts_select" on storage.objects for select
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts_delete" on storage.objects for delete
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
```

**Step 5: Apply migrations**

```bash
npx supabase db reset
```
Expected: Migrations applied, local Supabase running.

**Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema, RLS policies, and storage bucket"
```

---

### Task 3: Supabase Client Setup & Auth Middleware

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/middleware.ts`
- Create: `src/lib/supabase/types.ts`

**Step 1: Generate TypeScript types from schema**

```bash
npx supabase gen types typescript --local > src/lib/supabase/types.ts
```

**Step 2: Create `src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 3: Create `src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

**Step 4: Create `src/middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/inbound-email).*)'],
}
```

Note: `/api/inbound-email` is excluded from auth middleware — it uses a token-based webhook secret instead.

**Step 5: Commit**

```bash
git add src/
git commit -m "feat: add Supabase client utilities and auth middleware"
```

---

## Phase 2: Authentication

### Task 4: Login & Signup Pages

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/signup/page.tsx`
- Create: `src/app/(auth)/layout.tsx`

**Step 1: Create auth layout `src/app/(auth)/layout.tsx`**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
```

**Step 2: Create `src/app/(auth)/login/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Sign in to your PAI account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-600">
          No account? <Link href="/signup" className="underline">Sign up</Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

**Step 3: Create `src/app/(auth)/signup/page.tsx`**

Mirror of login page but calls `supabase.auth.signUp()`. On success show "Check your email to confirm your account." message instead of redirecting.

```typescript
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else setDone(true)
  }

  if (done) return (
    <Card><CardContent className="pt-6">
      <p className="text-center">Check your email to confirm your account.</p>
    </CardContent></Card>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Get started with PAI</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password (min 8 characters)</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-600">
          Already have an account? <Link href="/login" className="underline">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

**Step 4: Verify auth flow works**

```bash
npm run dev
```
Navigate to `http://localhost:3000` — should redirect to `/login`. Create account, confirm email, sign in, should reach `/`.

**Step 5: Commit**

```bash
git add src/app/\(auth\)/
git commit -m "feat: add login and signup pages"
```

---

## Phase 3: App Shell & Navigation

### Task 5: App Layout & Navigation

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/nav/sidebar.tsx`
- Create: `src/components/nav/mobile-nav.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create `src/app/(app)/layout.tsx`**

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
      <Sidebar className="hidden md:flex" />
      <main className="flex-1 overflow-auto">
        <MobileNav className="md:hidden" />
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
```

**Step 2: Create `src/components/nav/sidebar.tsx`**

Navigation links: Dashboard (`/`), Inbox (`/inbox`), Settings (`/settings`). Include sign-out button calling `supabase.auth.signOut()`.

```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Inbox, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className={cn('w-56 flex flex-col border-r bg-white px-3 py-6', className)}>
      <div className="mb-8 px-3 text-xl font-bold">PAI</div>
      <nav className="flex-1 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === href ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}>
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <button onClick={signOut} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
        <LogOut className="h-4 w-4" />Sign out
      </button>
    </aside>
  )
}
```

**Step 3: Create `src/components/nav/mobile-nav.tsx`**

Bottom tab bar for mobile with the same links, icon + label layout.

```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Inbox, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname()
  return (
    <nav className={cn('flex border-b bg-white', className)}>
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href}
          className={cn('flex flex-1 flex-col items-center gap-1 py-3 text-xs',
            pathname === href ? 'text-gray-900 font-medium' : 'text-gray-500'
          )}>
          <Icon className="h-5 w-5" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
```

**Step 4: Create placeholder pages to avoid 404s**

- `src/app/(app)/page.tsx` → "Dashboard" heading
- `src/app/(app)/inbox/page.tsx` → "Inbox" heading
- `src/app/(app)/settings/page.tsx` → "Settings" heading

**Step 5: Verify layout renders correctly on mobile and desktop**

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: add app shell with sidebar and mobile navigation"
```

---

## Phase 4: Clients & Projects

### Task 6: Budget Calculation Utilities (TDD)

**Files:**
- Create: `src/lib/budget.ts`
- Create: `src/lib/budget.test.ts`

**Step 1: Write failing tests `src/lib/budget.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { calculateBudgetSummary } from './budget'

describe('calculateBudgetSummary', () => {
  it('calculates spent by category', () => {
    const expenses = [
      { amount: 100, category: 'general', is_return: false },
      { amount: 50, category: 'transport', is_return: false },
    ]
    const result = calculateBudgetSummary(1000, expenses as any)
    expect(result.spentGeneral).toBe(100)
    expect(result.spentTransport).toBe(50)
  })

  it('subtracts returns from totals', () => {
    const expenses = [
      { amount: 100, category: 'general', is_return: false },
      { amount: 30, category: 'general', is_return: true },
    ]
    const result = calculateBudgetSummary(1000, expenses as any)
    expect(result.spentGeneral).toBe(70)
    expect(result.totalSpent).toBe(70)
  })

  it('calculates remaining budget', () => {
    const expenses = [
      { amount: 200, category: 'general', is_return: false },
      { amount: 100, category: 'transport', is_return: false },
    ]
    const result = calculateBudgetSummary(1000, expenses as any)
    expect(result.remaining).toBe(700)
    expect(result.isOverBudget).toBe(false)
  })

  it('flags overbudget correctly', () => {
    const expenses = [
      { amount: 1200, category: 'general', is_return: false },
    ]
    const result = calculateBudgetSummary(1000, expenses as any)
    expect(result.isOverBudget).toBe(true)
    expect(result.remaining).toBe(-200)
  })

  it('handles empty expenses', () => {
    const result = calculateBudgetSummary(500, [])
    expect(result.totalSpent).toBe(0)
    expect(result.remaining).toBe(500)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:run src/lib/budget.test.ts
```
Expected: FAIL — "cannot find module './budget'"

**Step 3: Implement `src/lib/budget.ts`**

```typescript
import type { Database } from './supabase/types'

type Expense = Database['public']['Tables']['expenses']['Row']

export interface BudgetSummary {
  totalBudget: number
  spentGeneral: number
  spentTransport: number
  totalSpent: number
  remaining: number
  isOverBudget: boolean
}

export function calculateBudgetSummary(totalBudget: number, expenses: Expense[]): BudgetSummary {
  let spentGeneral = 0
  let spentTransport = 0

  for (const expense of expenses) {
    const amount = expense.is_return ? -Math.abs(expense.amount) : Math.abs(expense.amount)
    if (expense.category === 'general') spentGeneral += amount
    else if (expense.category === 'transport') spentTransport += amount
  }

  const totalSpent = spentGeneral + spentTransport
  const remaining = totalBudget - totalSpent

  return {
    totalBudget,
    spentGeneral,
    spentTransport,
    totalSpent,
    remaining,
    isOverBudget: remaining < 0,
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm run test:run src/lib/budget.test.ts
```
Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/budget.ts src/lib/budget.test.ts
git commit -m "feat: add budget calculation utilities with tests"
```

---

### Task 7: Client Management

**Files:**
- Create: `src/app/(app)/clients/page.tsx`
- Create: `src/components/clients/client-form.tsx`
- Create: `src/app/api/clients/route.ts`

**Step 1: Create API route `src/app/api/clients/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, email } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('clients')
    .insert({ user_id: user.id, name: name.trim(), email: email?.trim() || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

**Step 2: Create `src/components/clients/client-form.tsx`**

Dialog form with Name and Email fields. On submit, POSTs to `/api/clients` and calls `onSuccess` callback.

**Step 3: Create clients page `src/app/(app)/clients/page.tsx`**

List of clients with name, email, project count. "New Client" button opens dialog form.

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: add client management (list, create)"
```

---

### Task 8: Project Management

**Files:**
- Create: `src/app/(app)/page.tsx` (Dashboard — replace placeholder)
- Create: `src/components/projects/project-form.tsx`
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[id]/route.ts`

**Step 1: Create `src/app/api/projects/route.ts`**

GET: list user's projects with `client:clients(name)` join and expense totals.
POST: create project (requires `name`, `total_budget`, optional `client_id`).

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .select('*, client:clients(id, name), expenses(amount, is_return, category)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, total_budget, client_id } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name: name.trim(), total_budget: total_budget || 0, client_id: client_id || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

**Step 2: Create `src/components/projects/project-form.tsx`**

Dialog with: Project Name, Client (select existing or "New client…" option that opens client form inline), Budget amount.

**Step 3: Build Dashboard `src/app/(app)/page.tsx`**

Grid of project cards. Each card shows: project name, client name, budget remaining (color-coded red if over budget), quick stats (general spent / transport spent). "New Project" button.

```typescript
import { createClient } from '@/lib/supabase/server'
import { calculateBudgetSummary } from '@/lib/budget'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('*, client:clients(name), expenses(amount, is_return, category)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        {/* NewProjectButton client component */}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects?.map(project => {
          const summary = calculateBudgetSummary(project.total_budget, project.expenses ?? [])
          return (
            <Link key={project.id} href={`/projects/${project.id}`}>
              {/* Project card with summary */}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 4: Create `src/app/(app)/projects/[id]/page.tsx`** (placeholder for next task)

**Step 5: Commit**

```bash
git add src/
git commit -m "feat: add project management and dashboard with budget summary cards"
```

---

## Phase 5: Expenses & Receipt Processing

### Task 9: Receipt Compression Utility (TDD)

**Files:**
- Create: `src/lib/receipt-compression.ts`
- Create: `src/lib/receipt-compression.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { shouldCompressAsImage, getReceiptStoragePath } from './receipt-compression'

describe('getReceiptStoragePath', () => {
  it('generates path with user id prefix', () => {
    const path = getReceiptStoragePath('user-123', 'expense-456', 'jpg')
    expect(path).toBe('user-123/expense-456.jpg')
  })

  it('lowercases extension', () => {
    const path = getReceiptStoragePath('u1', 'e1', 'JPEG')
    expect(path).toContain('.jpeg')
  })
})

describe('shouldCompressAsImage', () => {
  it('returns true for image types', () => {
    expect(shouldCompressAsImage('image/jpeg')).toBe(true)
    expect(shouldCompressAsImage('image/png')).toBe(true)
  })

  it('returns false for PDF', () => {
    expect(shouldCompressAsImage('application/pdf')).toBe(false)
  })
})
```

**Step 2: Run to verify failure**

```bash
npm run test:run src/lib/receipt-compression.test.ts
```

**Step 3: Implement `src/lib/receipt-compression.ts`**

```typescript
export function getReceiptStoragePath(userId: string, expenseId: string, extension: string): string {
  return `${userId}/${expenseId}.${extension.toLowerCase()}`
}

export function shouldCompressAsImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1500,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  initialQuality: 0.8,
}
```

**Step 4: Run to verify pass**

```bash
npm run test:run src/lib/receipt-compression.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/receipt-compression.ts src/lib/receipt-compression.test.ts
git commit -m "feat: add receipt compression utilities with tests"
```

---

### Task 10: Claude OCR Integration (TDD)

**Files:**
- Create: `src/lib/ocr.ts`
- Create: `src/lib/ocr.test.ts`

**Step 1: Write failing tests for OCR response parsing**

```typescript
import { describe, it, expect } from 'vitest'
import { parseOcrResponse, type OcrResult } from './ocr'

describe('parseOcrResponse', () => {
  it('parses a valid OCR response', () => {
    const raw = JSON.stringify({
      vendor: 'IKEA',
      amount: 42.50,
      date: '2026-03-08',
      category: 'general',
      confidence: { vendor: 0.95, amount: 0.99, date: 0.90, category: 0.80 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('IKEA')
    expect(result.amount).toBe(42.50)
    expect(result.date).toBe('2026-03-08')
    expect(result.confidence.vendor).toBe(0.95)
  })

  it('returns null fields for invalid JSON', () => {
    const result = parseOcrResponse('not json')
    expect(result.vendor).toBeNull()
    expect(result.amount).toBeNull()
  })

  it('identifies low confidence fields', () => {
    const raw = JSON.stringify({
      vendor: 'Shop', amount: 10, date: '2026-01-01', category: 'general',
      confidence: { vendor: 0.4, amount: 0.95, date: 0.9, category: 0.85 }
    })
    const result = parseOcrResponse(raw)
    expect(result.lowConfidenceFields).toContain('vendor')
    expect(result.lowConfidenceFields).not.toContain('amount')
  })
})
```

**Step 2: Run to verify failure**

```bash
npm run test:run src/lib/ocr.test.ts
```

**Step 3: Implement `src/lib/ocr.ts`**

```typescript
export interface OcrResult {
  vendor: string | null
  amount: number | null
  date: string | null
  category: 'general' | 'transport' | null
  notes: string | null
  confidence: Record<string, number>
  lowConfidenceFields: string[]
}

const CONFIDENCE_THRESHOLD = 0.7

export function parseOcrResponse(raw: string): OcrResult {
  try {
    const parsed = JSON.parse(raw)
    const confidence: Record<string, number> = parsed.confidence ?? {}
    const lowConfidenceFields = Object.entries(confidence)
      .filter(([, score]) => score < CONFIDENCE_THRESHOLD)
      .map(([field]) => field)

    return {
      vendor: parsed.vendor ?? null,
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      date: parsed.date ?? null,
      category: ['general', 'transport'].includes(parsed.category) ? parsed.category : null,
      notes: parsed.notes ?? null,
      confidence,
      lowConfidenceFields,
    }
  } catch {
    return { vendor: null, amount: null, date: null, category: null, notes: null, confidence: {}, lowConfidenceFields: [] }
  }
}
```

**Step 4: Add the actual Claude API call function below `parseOcrResponse`**

```typescript
import Anthropic from '@anthropic-ai/sdk'

const OCR_PROMPT = `You are a receipt parser. Extract the following fields from this receipt image or text.
Return ONLY valid JSON with this exact structure:
{
  "vendor": "store or vendor name",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "category": "general or transport",
  "notes": "any relevant notes or null",
  "confidence": {
    "vendor": 0.0-1.0,
    "amount": 0.0-1.0,
    "date": 0.0-1.0,
    "category": 0.0-1.0
  }
}
Category is "transport" only if the receipt is clearly for transportation (taxi, fuel, train, bus, parking). Otherwise "general".
If a field cannot be determined, use null for the value and 0.0 for its confidence.`

export async function extractReceiptData(input: { imageBase64: string; mimeType: string } | { text: string }): Promise<OcrResult> {
  const client = new Anthropic()

  const content = 'imageBase64' in input
    ? [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: input.mimeType as any, data: input.imageBase64 } },
        { type: 'text' as const, text: OCR_PROMPT },
      ]
    : [{ type: 'text' as const, text: `${OCR_PROMPT}\n\nReceipt text:\n${input.text}` }]

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return parseOcrResponse(text)
}
```

**Step 5: Run tests to verify pass**

```bash
npm run test:run src/lib/ocr.test.ts
```

**Step 6: Commit**

```bash
git add src/lib/ocr.ts src/lib/ocr.test.ts
git commit -m "feat: add Claude Haiku OCR integration with response parsing and confidence scoring"
```

---

### Task 11: Expense API Routes

**Files:**
- Create: `src/app/api/expenses/route.ts`
- Create: `src/app/api/expenses/[id]/route.ts`
- Create: `src/app/api/ocr/route.ts`

**Step 1: Create `src/app/api/ocr/route.ts`**

Accepts a file upload (form-data), reads it, calls `extractReceiptData`, returns the OCR result. This is called from the expense form after the user selects a file.

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractReceiptData } from '@/lib/ocr'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const text = formData.get('text') as string | null

  if (file) {
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const result = await extractReceiptData({ imageBase64: base64, mimeType: file.type })
    return NextResponse.json(result)
  } else if (text) {
    const result = await extractReceiptData({ text })
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'No file or text provided' }, { status: 400 })
}
```

**Step 2: Create `src/app/api/expenses/route.ts`**

GET: list expenses for a project (or inbox if no project_id param).
POST: create expense with optional receipt_path.

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  const inbox = searchParams.get('inbox') === 'true'

  let query = supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false })

  if (inbox) query = query.is('project_id', null)
  else if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { project_id, vendor, amount, date, category, notes, receipt_path, is_return, ocr_confidence } = body

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      project_id: project_id || null,
      vendor, amount, date, category,
      notes: notes || null,
      receipt_path: receipt_path || null,
      is_return: is_return ?? false,
      ocr_confidence: ocr_confidence || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

**Step 3: Create `src/app/api/expenses/[id]/route.ts`**

PATCH: update expense (for inbox assignment — set project_id — or edit fields).
DELETE: delete expense and its receipt from storage.

**Step 4: Commit**

```bash
git add src/app/api/
git commit -m "feat: add expense and OCR API routes"
```

---

### Task 12: Expense Form with Receipt Upload

**Files:**
- Create: `src/components/expenses/expense-form.tsx`
- Create: `src/components/expenses/receipt-upload.tsx`
- Create: `src/components/expenses/receipt-viewer.tsx`

**Step 1: Create `src/components/expenses/receipt-upload.tsx`**

File input that accepts `image/*,application/pdf`. On file select:
1. Compresses images client-side using `browser-image-compression` with `IMAGE_COMPRESSION_OPTIONS`
2. Uploads compressed file to Supabase Storage at `{userId}/{expenseId}.{ext}`
3. Calls `/api/ocr` with the file
4. Returns `{ storagePath, ocrResult }`

```typescript
'use client'
import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import { IMAGE_COMPRESSION_OPTIONS, shouldCompressAsImage, getReceiptStoragePath } from '@/lib/receipt-compression'
import type { OcrResult } from '@/lib/ocr'

interface Props {
  userId: string
  onResult: (result: { storagePath: string; ocrResult: OcrResult }) => void
  onError: (msg: string) => void
}

export default function ReceiptUpload({ userId, onResult, onError }: Props) {
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    try {
      const expenseId = crypto.randomUUID()
      const ext = shouldCompressAsImage(file.type) ? 'jpeg' : 'pdf'
      const storagePath = getReceiptStoragePath(userId, expenseId, ext)

      let uploadFile: File = file
      if (shouldCompressAsImage(file.type)) {
        uploadFile = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS)
      }

      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(storagePath, uploadFile)
      if (uploadError) throw new Error(uploadError.message)

      const formData = new FormData()
      formData.append('file', uploadFile)
      const ocrRes = await fetch('/api/ocr', { method: 'POST', body: formData })
      const ocrResult: OcrResult = await ocrRes.json()

      onResult({ storagePath, ocrResult })
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <button type="button" onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 rounded border border-dashed px-4 py-3 text-sm text-gray-500 hover:border-gray-400 w-full justify-center">
        {loading ? 'Processing…' : 'Upload receipt (photo or PDF)'}
      </button>
    </div>
  )
}
```

**Step 2: Create `src/components/expenses/expense-form.tsx`**

Full form with:
- ReceiptUpload at top (optional)
- Vendor, Amount, Date, Category (general/transport), Notes fields
- `is_return` toggle checkbox
- Low-confidence fields highlighted in yellow (based on `ocrResult.lowConfidenceFields`)
- Submit calls POST `/api/expenses`

```typescript
'use client'
import { useState } from 'react'
import ReceiptUpload from './receipt-upload'
import type { OcrResult } from '@/lib/ocr'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Props {
  userId: string
  projectId?: string
  onSuccess: () => void
}

export default function ExpenseForm({ userId, projectId, onSuccess }: Props) {
  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState<'general' | 'transport'>('general')
  const [notes, setNotes] = useState('')
  const [isReturn, setIsReturn] = useState(false)
  const [receiptPath, setReceiptPath] = useState<string | null>(null)
  const [lowConfidence, setLowConfidence] = useState<string[]>([])
  const [ocrConfidence, setOcrConfidence] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOcrResult({ storagePath, ocrResult }: { storagePath: string; ocrResult: OcrResult }) {
    setReceiptPath(storagePath)
    setLowConfidence(ocrResult.lowConfidenceFields)
    setOcrConfidence(ocrResult.confidence)
    if (ocrResult.vendor) setVendor(ocrResult.vendor)
    if (ocrResult.amount) setAmount(String(ocrResult.amount))
    if (ocrResult.date) setDate(ocrResult.date)
    if (ocrResult.category) setCategory(ocrResult.category)
    if (ocrResult.notes) setNotes(ocrResult.notes)
  }

  const fieldClass = (field: string) =>
    cn(lowConfidence.includes(field) && 'ring-2 ring-yellow-400')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId || null,
        vendor, amount: parseFloat(amount), date, category, notes,
        receipt_path: receiptPath, is_return: isReturn, ocr_confidence: ocrConfidence,
      }),
    })
    if (res.ok) onSuccess()
    else { const d = await res.json(); setError(d.error) }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ReceiptUpload userId={userId} onResult={handleOcrResult} onError={setError} />
      {lowConfidence.length > 0 && (
        <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
          Highlighted fields have low OCR confidence — please verify.
        </p>
      )}
      <div className="space-y-2">
        <Label>Vendor</Label>
        <Input className={fieldClass('vendor')} value={vendor} onChange={e => setVendor(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Amount</Label>
          <Input type="number" step="0.01" className={fieldClass('amount')} value={amount} onChange={e => setAmount(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" className={fieldClass('date')} value={date} onChange={e => setDate(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={category} onValueChange={(v: any) => setCategory(v)}>
          <SelectTrigger className={fieldClass('category')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="transport">Transport</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isReturn} onChange={e => setIsReturn(e.target.checked)} />
        This is a return / refund
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Saving…' : 'Save expense'}
      </Button>
    </form>
  )
}
```

**Step 3: Create `src/components/expenses/receipt-viewer.tsx`**

Given a `receiptPath`, fetches a signed URL from Supabase Storage and renders either an `<img>` or an `<iframe>` (for PDFs). Used in expense detail view.

```typescript
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ReceiptViewer({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const isPdf = path.endsWith('.pdf')

  useEffect(() => {
    const supabase = createClient()
    supabase.storage.from('receipts').createSignedUrl(path, 3600)
      .then(({ data }) => { if (data) setUrl(data.signedUrl) })
  }, [path])

  if (!url) return <div className="h-48 bg-gray-100 animate-pulse rounded" />

  return isPdf
    ? <iframe src={url} className="w-full h-96 rounded border" />
    : <img src={url} alt="Receipt" className="max-w-full rounded border" />
}
```

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: add expense form with receipt upload, OCR pre-fill, and confidence highlighting"
```

---

### Task 13: Project Detail Page

**Files:**
- Create: `src/app/(app)/projects/[id]/page.tsx`
- Create: `src/components/expenses/expense-list.tsx`
- Create: `src/components/expenses/expense-detail-dialog.tsx`

**Step 1: Build `src/app/(app)/projects/[id]/page.tsx`**

Server component. Fetches project + expenses. Shows:
- Budget summary bar (total / general / transport / remaining — red if over budget)
- Tab bar: "All" / "General" / "Transport"
- Expense list (client component with inline filtering)
- "Add Expense" button (opens dialog)
- "Export" button (links to export page)

**Step 2: Create `src/components/expenses/expense-list.tsx`**

Client component. Renders expense rows with: date, vendor, amount (negative/red for returns), category badge. Each row clickable to open detail dialog.

**Step 3: Create `src/components/expenses/expense-detail-dialog.tsx`**

Shows expense fields + ReceiptViewer if receipt exists. Edit and Delete actions.

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: add project detail page with expense list and budget summary"
```

---

## Phase 6: Inbox & Email Inbound

### Task 14: Email Parsing Utilities (TDD)

**Files:**
- Create: `src/lib/email-parser.ts`
- Create: `src/lib/email-parser.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import { extractTokenFromEmail, hasUsableContent } from './email-parser'

describe('extractTokenFromEmail', () => {
  it('extracts token from To address', () => {
    const token = extractTokenFromEmail({ to: 'abc123@mail.yourapp.com' })
    expect(token).toBe('abc123')
  })

  it('returns null for unrecognized address', () => {
    const token = extractTokenFromEmail({ to: 'someone@gmail.com' })
    expect(token).toBeNull()
  })
})

describe('hasUsableContent', () => {
  it('returns true when attachments present', () => {
    expect(hasUsableContent({ attachments: [{}], textBody: '' } as any)).toBe(true)
  })

  it('returns true when text body has content', () => {
    expect(hasUsableContent({ attachments: [], textBody: 'Receipt from IKEA total $42.50' } as any)).toBe(true)
  })

  it('returns false when nothing useful', () => {
    expect(hasUsableContent({ attachments: [], textBody: '' } as any)).toBe(false)
  })
})
```

**Step 2: Run to verify failure**

```bash
npm run test:run src/lib/email-parser.test.ts
```

**Step 3: Implement `src/lib/email-parser.ts`**

```typescript
const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN ?? 'mail.yourapp.com'

export function extractTokenFromEmail({ to }: { to: string }): string | null {
  const match = to.match(new RegExp(`^([a-f0-9]+)@${INBOUND_EMAIL_DOMAIN.replace('.', '\\.')}`, 'i'))
  return match?.[1] ?? null
}

export function hasUsableContent({ attachments, textBody, htmlBody }: {
  attachments: any[]
  textBody?: string
  htmlBody?: string
}): boolean {
  if (attachments?.length > 0) return true
  if (textBody && textBody.trim().length > 20) return true
  if (htmlBody && htmlBody.trim().length > 20) return true
  return false
}
```

**Step 4: Run to verify pass**

```bash
npm run test:run src/lib/email-parser.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/email-parser.ts src/lib/email-parser.test.ts
git commit -m "feat: add email parsing utilities with tests"
```

---

### Task 15: Postmark Inbound Webhook

**Files:**
- Create: `src/app/api/inbound-email/route.ts`
- Create: `src/lib/supabase/service.ts`

**Step 1: Create service-role Supabase client `src/lib/supabase/service.ts`**

The inbound email webhook runs outside of user auth context — it needs the service role key to look up users by token and insert expenses.

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

**Step 2: Create `src/app/api/inbound-email/route.ts`**

Postmark sends a JSON POST. Process flow:
1. Verify webhook secret header
2. Extract token from `To` address → look up user in `inbound_tokens`
3. Process attachments or body text through OCR
4. Upload any attachments to Storage
5. Create inbox expense (project_id = null) with OCR result
6. If no usable content, still create an inbox entry with vendor = "No relevant information found"

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractTokenFromEmail, hasUsableContent } from '@/lib/email-parser'
import { extractReceiptData } from '@/lib/ocr'
import { getReceiptStoragePath, shouldCompressAsImage } from '@/lib/receipt-compression'

export async function POST(request: Request) {
  // Verify webhook secret
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.POSTMARK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const supabase = createServiceClient()

  // Find user by inbound token
  const toAddress = Array.isArray(body.ToFull) ? body.ToFull[0]?.Email : body.To
  const token = extractTokenFromEmail({ to: toAddress ?? '' })
  if (!token) return NextResponse.json({ ok: true }) // Not for us

  const { data: tokenRow } = await supabase
    .from('inbound_tokens')
    .select('user_id')
    .eq('token', token)
    .single()
  if (!tokenRow) return NextResponse.json({ ok: true })

  const userId = tokenRow.user_id
  const fromAddress = body.From ?? 'unknown'

  // Check for usable content
  const attachments = body.Attachments ?? []
  const textBody = body.TextBody ?? ''
  const htmlBody = body.HtmlBody ?? ''

  if (!hasUsableContent({ attachments, textBody, htmlBody })) {
    // Create "no relevant information" inbox entry
    await supabase.from('expenses').insert({
      user_id: userId,
      project_id: null,
      vendor: `No relevant information found (from: ${fromAddress})`,
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      category: 'general',
      notes: 'Email received but no receipt data could be extracted.',
    })
    return NextResponse.json({ ok: true })
  }

  // Process first usable attachment
  const imageAttachment = attachments.find((a: any) =>
    a.ContentType?.startsWith('image/') || a.ContentType === 'application/pdf'
  )

  let receiptPath: string | null = null
  let ocrResult = null

  if (imageAttachment) {
    const buffer = Buffer.from(imageAttachment.Content, 'base64')
    const expenseId = crypto.randomUUID()
    const ext = imageAttachment.ContentType === 'application/pdf' ? 'pdf' : 'jpeg'
    receiptPath = getReceiptStoragePath(userId, expenseId, ext)

    await supabase.storage.from('receipts').upload(receiptPath, buffer, {
      contentType: imageAttachment.ContentType,
    })

    ocrResult = await extractReceiptData({
      imageBase64: imageAttachment.Content,
      mimeType: imageAttachment.ContentType,
    })
  } else if (textBody || htmlBody) {
    // Strip HTML tags for text extraction
    const cleanText = (htmlBody || textBody).replace(/<[^>]+>/g, ' ').trim()
    ocrResult = await extractReceiptData({ text: cleanText })
  }

  await supabase.from('expenses').insert({
    user_id: userId,
    project_id: null,
    vendor: ocrResult?.vendor ?? `Email from ${fromAddress}`,
    amount: ocrResult?.amount ?? 0,
    date: ocrResult?.date ?? new Date().toISOString().split('T')[0],
    category: ocrResult?.category ?? 'general',
    notes: ocrResult?.notes ?? null,
    receipt_path: receiptPath,
    ocr_confidence: ocrResult?.confidence ?? null,
  })

  return NextResponse.json({ ok: true })
}
```

**Step 3: Commit**

```bash
git add src/
git commit -m "feat: add Postmark inbound email webhook with OCR processing"
```

---

### Task 16: Inbox Page

**Files:**
- Create: `src/app/(app)/inbox/page.tsx`
- Create: `src/components/inbox/inbox-item.tsx`

**Step 1: Build `src/app/(app)/inbox/page.tsx`**

Lists all expenses where `project_id IS NULL`. Server component. Each item shows: vendor, amount, date, category, receipt thumbnail if available. "No relevant information found" items shown with a distinct style.

**Step 2: Create `src/components/inbox/inbox-item.tsx`**

Client component. Shows inbox expense with:
- Expense fields (read-only, with low-confidence highlighting)
- "Assign to project" dropdown — selecting a project calls PATCH `/api/expenses/{id}` with `{ project_id }`
- "Discard" button (DELETE)
- Edit fields inline before assigning

**Step 3: Commit**

```bash
git add src/
git commit -m "feat: add inbox page for unassigned email receipts"
```

---

## Phase 7: Export

### Task 17: PDF Export Generation (TDD)

**Files:**
- Create: `src/lib/pdf-export.ts`
- Create: `src/lib/pdf-export.test.ts`

**Step 1: Write failing tests for PDF generation helpers**

```typescript
import { describe, it, expect } from 'vitest'
import { formatCurrency, buildExpenseRows } from './pdf-export'

describe('formatCurrency', () => {
  it('formats positive amounts', () => {
    expect(formatCurrency(42.5)).toBe('€42.50')
  })

  it('formats returns as negative', () => {
    expect(formatCurrency(-15)).toBe('-€15.00')
  })
})

describe('buildExpenseRows', () => {
  it('separates general and transport expenses', () => {
    const expenses = [
      { category: 'general', amount: 100, is_return: false, vendor: 'IKEA', date: '2026-03-01', notes: null },
      { category: 'transport', amount: 20, is_return: false, vendor: 'Uber', date: '2026-03-02', notes: null },
    ]
    const { general, transport } = buildExpenseRows(expenses as any)
    expect(general).toHaveLength(1)
    expect(transport).toHaveLength(1)
    expect(general[0].vendor).toBe('IKEA')
  })

  it('sorts rows by date ascending', () => {
    const expenses = [
      { category: 'general', amount: 10, is_return: false, vendor: 'B', date: '2026-03-05', notes: null },
      { category: 'general', amount: 20, is_return: false, vendor: 'A', date: '2026-03-01', notes: null },
    ]
    const { general } = buildExpenseRows(expenses as any)
    expect(general[0].vendor).toBe('A')
    expect(general[1].vendor).toBe('B')
  })
})
```

**Step 2: Run to verify failure**

```bash
npm run test:run src/lib/pdf-export.test.ts
```

**Step 3: Implement helpers in `src/lib/pdf-export.ts`**

```typescript
import type { Database } from './supabase/types'
type Expense = Database['public']['Tables']['expenses']['Row']

export function formatCurrency(amount: number): string {
  const formatted = Math.abs(amount).toFixed(2)
  return amount < 0 ? `-€${formatted}` : `€${formatted}`
}

export function buildExpenseRows(expenses: Expense[]) {
  const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date))
  return {
    general: sorted.filter(e => e.category === 'general'),
    transport: sorted.filter(e => e.category === 'transport'),
  }
}
```

**Step 4: Run tests to verify pass**

```bash
npm run test:run src/lib/pdf-export.test.ts
```

**Step 5: Add the main PDF generation function**

Uses `pdf-lib` to build the report PDF and stitch in receipt scans.

```typescript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { calculateBudgetSummary } from './budget'

export async function generateExpenseReportPdf({
  project,
  client,
  expenses,
  receiptBuffers, // { path: string, buffer: Uint8Array, mimeType: string }[]
}: {
  project: { name: string; total_budget: number }
  client: { name: string } | null
  expenses: Expense[]
  receiptBuffers: { path: string; buffer: Uint8Array; mimeType: string }[]
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const { general, transport } = buildExpenseRows(expenses)
  const summary = calculateBudgetSummary(project.total_budget, expenses)

  // Helper to add a page and return drawing context
  const addPage = () => {
    const page = pdfDoc.addPage([595, 842]) // A4
    return page
  }

  // Page 1: Report header + summary
  const page1 = addPage()
  let y = 800

  const draw = (text: string, x: number, yPos: number, size = 11, bold = false) => {
    page1.drawText(text, { x, y: yPos, size, font: bold ? boldFont : font, color: rgb(0, 0, 0) })
  }

  draw('EXPENSE REPORT', 50, y, 18, true); y -= 30
  draw(project.name, 50, y, 13, true); y -= 20
  if (client) { draw(`Client: ${client.name}`, 50, y, 11); y -= 15 }
  y -= 10

  // Summary box
  draw('Budget Summary', 50, y, 12, true); y -= 18
  draw(`Total Budget: ${formatCurrency(summary.totalBudget)}`, 50, y); y -= 15
  draw(`General Expenses: ${formatCurrency(summary.spentGeneral)}`, 50, y); y -= 15
  draw(`Transport Expenses: ${formatCurrency(summary.spentTransport)}`, 50, y); y -= 15
  draw(`Total Spent: ${formatCurrency(summary.totalSpent)}`, 50, y); y -= 15
  const remainingColor = summary.isOverBudget ? rgb(0.8, 0, 0) : rgb(0, 0.5, 0)
  page1.drawText(`Remaining: ${formatCurrency(summary.remaining)}`, {
    x: 50, y, size: 11, font: boldFont, color: remainingColor
  })
  y -= 30

  // Expense table helper
  const drawTable = (title: string, rows: Expense[]) => {
    if (rows.length === 0) return
    if (y < 150) { /* would need multi-page — simplified for v1 */ }
    draw(title, 50, y, 12, true); y -= 18
    draw('Date', 50, y, 9, true)
    draw('Vendor', 110, y, 9, true)
    draw('Notes', 280, y, 9, true)
    draw('Amount', 480, y, 9, true)
    y -= 12
    page1.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) })
    y -= 10

    for (const row of rows) {
      const amountStr = row.is_return ? `-€${Math.abs(row.amount).toFixed(2)}` : `€${row.amount.toFixed(2)}`
      draw(row.date, 50, y, 9)
      draw((row.vendor ?? '').substring(0, 22), 110, y, 9)
      draw((row.notes ?? '').substring(0, 24), 280, y, 9)
      draw(amountStr, 480, y, 9)
      y -= 14
    }
    y -= 10
  }

  drawTable('General Expenses', general)
  drawTable('Transport Expenses', transport)

  // Append receipt pages
  for (const { buffer, mimeType } of receiptBuffers) {
    if (mimeType === 'application/pdf') {
      const receiptPdf = await PDFDocument.load(buffer)
      const copiedPages = await pdfDoc.copyPages(receiptPdf, receiptPdf.getPageIndices())
      copiedPages.forEach(p => pdfDoc.addPage(p))
    } else {
      // Image
      const receiptPage = pdfDoc.addPage([595, 842])
      const img = mimeType === 'image/png'
        ? await pdfDoc.embedPng(buffer)
        : await pdfDoc.embedJpg(buffer)
      const { width, height } = img.scaleToFit(495, 742)
      receiptPage.drawImage(img, { x: 50, y: (842 - height) / 2, width, height })
    }
  }

  return pdfDoc.save()
}
```

**Step 6: Commit**

```bash
git add src/lib/pdf-export.ts src/lib/pdf-export.test.ts
git commit -m "feat: add PDF export generation with receipt stitching"
```

---

### Task 18: Export API Route & UI

**Files:**
- Create: `src/app/api/projects/[id]/export/route.ts`
- Create: `src/components/projects/export-button.tsx`

**Step 1: Create `src/app/api/projects/[id]/export/route.ts`**

GET with `?format=pdf` or `?format=csv`.

For PDF:
1. Fetch project, client, all expenses
2. Fetch each receipt from Supabase Storage
3. Call `generateExpenseReportPdf`
4. Return as `application/pdf` response

For CSV:
1. Build CSV string (date, vendor, amount, category, is_return, notes)
2. Return as `text/csv`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateExpenseReportPdf } from '@/lib/pdf-export'
import { calculateBudgetSummary } from '@/lib/budget'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'pdf'

  const { data: project } = await supabase
    .from('projects')
    .select('*, client:clients(name)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('project_id', params.id)
    .order('date')

  if (format === 'csv') {
    const header = 'Date,Vendor,Amount,Category,Return,Notes\n'
    const rows = (expenses ?? []).map(e =>
      `${e.date},"${(e.vendor ?? '').replace(/"/g, '""')}",${e.amount},${e.category},${e.is_return},"${(e.notes ?? '').replace(/"/g, '""')}"`
    ).join('\n')
    return new NextResponse(header + rows, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${project.name}-expenses.csv"`,
      },
    })
  }

  // PDF export — fetch receipt buffers
  const receiptBuffers = []
  for (const expense of (expenses ?? [])) {
    if (expense.receipt_path) {
      const { data } = await supabase.storage.from('receipts').download(expense.receipt_path)
      if (data) {
        const buffer = new Uint8Array(await data.arrayBuffer())
        const mimeType = expense.receipt_path.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
        receiptBuffers.push({ path: expense.receipt_path, buffer, mimeType })
      }
    }
  }

  const summary = calculateBudgetSummary(project.total_budget, expenses ?? [])
  if (summary.isOverBudget) {
    // Overbudget warning is embedded in the PDF report header
  }

  const pdfBytes = await generateExpenseReportPdf({
    project,
    client: (project as any).client ?? null,
    expenses: expenses ?? [],
    receiptBuffers,
  })

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${project.name}-expense-report.pdf"`,
    },
  })
}
```

**Step 2: Create `src/components/projects/export-button.tsx`**

Client component with two buttons: "Export PDF" and "Export CSV". Each triggers a download by navigating to `/api/projects/{id}/export?format=pdf` or `csv`.

**Step 3: Add ExportButton to project detail page**

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: add PDF and CSV export with receipt stitching"
```

---

## Phase 8: Settings

### Task 19: Settings Page & Inbound Email Token

**Files:**
- Create: `src/app/(app)/settings/page.tsx`
- Create: `src/app/api/inbound-token/route.ts`

**Step 1: Create `src/app/api/inbound-token/route.ts`**

GET: return user's token (create one if none exists).

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let { data: token } = await supabase
    .from('inbound_tokens')
    .select('token')
    .eq('user_id', user.id)
    .single()

  if (!token) {
    const { data: newToken } = await supabase
      .from('inbound_tokens')
      .insert({ user_id: user.id })
      .select('token')
      .single()
    token = newToken
  }

  const domain = process.env.INBOUND_EMAIL_DOMAIN ?? 'mail.yourapp.com'
  return NextResponse.json({ address: `${token?.token}@${domain}` })
}
```

**Step 2: Build `src/app/(app)/settings/page.tsx`**

Shows:
- Inbound email address with copy-to-clipboard button
- Instructions: "Forward receipts to this address to have them appear in your Inbox automatically."
- User email (read-only)

**Step 3: Commit**

```bash
git add src/
git commit -m "feat: add settings page with inbound email address"
```

---

## Phase 9: Polish & Deployment

### Task 20: Loading States & Error Boundaries

**Files:**
- Create: `src/app/(app)/loading.tsx`
- Create: `src/app/(app)/error.tsx`
- Create: `src/components/ui/page-error.tsx`

Add skeleton loading states to project list and expense list. Add error boundary for graceful failure messages.

**Commit:**

```bash
git commit -m "feat: add loading skeletons and error boundaries"
```

---

### Task 21: Vercel & Supabase Production Setup

**Step 1: Push schema to Supabase cloud**

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**Step 2: Configure Vercel environment variables**

In Vercel dashboard, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `POSTMARK_WEBHOOK_SECRET`
- `INBOUND_EMAIL_DOMAIN`

**Step 3: Deploy**

```bash
vercel --prod
```

**Step 4: Configure Postmark Inbound**

- Set up inbound domain in Postmark dashboard
- Point webhook to `https://yourapp.vercel.app/api/inbound-email`
- Set `x-webhook-secret` header to match `POSTMARK_WEBHOOK_SECRET`

**Step 5: Smoke test**

- Sign up, create a client, create a project
- Add an expense manually with a receipt photo
- Forward a test email receipt to your inbound address
- Check inbox, assign to project
- Export PDF and verify combined report + scans

**Step 6: Final commit and push**

```bash
git add -A
git commit -m "feat: production deployment configuration"
git push
```

---

## Test Coverage Summary

| Module | Tests |
|---|---|
| `src/lib/budget.ts` | calculateBudgetSummary — 5 cases |
| `src/lib/receipt-compression.ts` | getReceiptStoragePath, shouldCompressAsImage |
| `src/lib/ocr.ts` | parseOcrResponse — 3 cases |
| `src/lib/email-parser.ts` | extractTokenFromEmail, hasUsableContent |
| `src/lib/pdf-export.ts` | formatCurrency, buildExpenseRows |

Run all tests: `npm run test:run`

---

## Out of Scope for This Plan

- Custom report templates
- Multi-currency
- Team/agency accounts
- Native mobile app
- Automated duplicate detection
