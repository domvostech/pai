# Quick-Add Expense Design

**Date:** 2026-03-09
**Status:** Approved

## Goal

Add a prominent, frictionless "Add Expense" entry point to the mobile nav so users can snap a receipt photo and save an expense in seconds, without navigating into a project first.

## Problem

The current flow requires: Dashboard → tap project card → scroll to Expenses → tap "Add Expense". On mobile this is too many steps for a quick receipt capture on the go.

## Design

### Mobile Nav — Raised Centre Button

The mobile nav expands from 3 tabs to 4:

```
[ Dashboard ]  [ Inbox ]  [ ⊕ ]  [ Settings ]
```

- The ⊕ is a filled circle (~52×52px, `bg-black text-white`), with a `Plus` or `Camera` icon
- It sits ~10px above the tab bar baseline using negative `margin-top`, breaking the top border for the classic "raised" look
- No label needed — the shape and position make it self-evident
- Dashboard, Inbox, Settings labels and icons remain unchanged

### Bottom Sheet

Tapping ⊕ opens a bottom sheet sliding up to ~85% screen height, internally scrollable, swipe-down to dismiss.

Layout (top to bottom):
1. Drag handle (centred bar at top)
2. Title "Add Expense" + close ✕ button
3. Receipt upload / camera (first — enables the quick-snap use case)
4. Project selector — default state shows "No project — goes to Inbox" in grey hint text; once selected shows project name
5. Vendor field
6. Amount + Date (side by side)
7. Category selector
8. Notes field
9. Return/refund checkbox
10. "Save Expense" full-width button

**Project selector behaviour:**
- Fetches the user's projects client-side on sheet open
- Default: null (no project selected) — expense saves with `project_id: null` → lands in Inbox
- The hint text "No project — goes to Inbox" makes the fallback self-explanatory

**On save:**
- Sheet closes
- Toast confirms: "Saved to Inbox" or "Saved to [Project name]"
- Current page refreshes

### Desktop

- Mobile nav and bottom sheet are mobile-only (`md:hidden`)
- Sidebar gets a global "Add Expense" button (above or below the nav links)
- Opens the existing Dialog with the same ExpenseForm, extended with the project selector
- Same Inbox fallback when no project is selected

## Components

| Component | Action |
|---|---|
| `src/components/nav/mobile-nav.tsx` | Add 4th tab with raised ⊕ button; wire open state |
| `src/components/expenses/quick-add-sheet.tsx` | New bottom sheet component (client) |
| `src/components/nav/sidebar.tsx` | Add "Add Expense" button wired to dialog |
| `src/components/expenses/expense-form.tsx` | Add optional `projects` prop + project selector at top |
| `src/app/(app)/layout.tsx` | Pass userId + projects to nav components as needed |

## Out of Scope

- Camera capture directly (uses OS file picker / camera via `<input type="file" accept="image/*" capture>`)
- Customising which project is pre-selected based on current page (v2)
- Animations beyond standard slide-up transition
