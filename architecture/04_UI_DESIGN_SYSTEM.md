# 04 — UI DESIGN SYSTEM

## 1. Design Rationale

This terminal runs in front of a cashier for long shifts, often in a dim-lit warung at night. Two ergonomic requirements drive every visual decision: (1) no pure-white text — high-contrast white-on-black causes eye fatigue over hours of staring at a screen — and (2) every primary action must be reachable without a mouse, because a cashier's hands are often already on the scanner or counting cash, not hovering a trackpad.

## 2. `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Warm dark base — never pure black, never pure white.
        base: {
          950: '#0c0a09', // stone-950, deepest background
          900: '#1c1917', // stone-900, primary surface
          800: '#292524', // stone-800, card surface
          700: '#44403c', // stone-700, borders
        },
        text: {
          primary: '#fafaf9',   // stone-50 — used instead of #fff
          secondary: '#d6d3d1', // stone-300
          muted: '#a8a29e',     // stone-400
        },
        accent: {
          amber: '#f59e0b',   // primary call-to-action (Checkout, Confirm)
          orange: '#ea580c',  // warnings, low stock
          red: '#dc2626',     // destructive actions (Void, Cancel)
          green: '#16a34a',   // success confirmation only (payment settled)
        },
        warung: {
          // distinct accent family for Warung Mode chrome
          DEFAULT: '#f59e0b',
        },
        agentmode: {
          // distinct accent family for Agent Mode chrome — visually
          // reinforces that this is a *different* ledger, on sight
          DEFAULT: '#0ea5e9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'], // prices, totals, transaction codes
      },
    },
  },
  plugins: [],
};

export default config;
```

## 3. `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

body {
  @apply bg-base-900 text-text-primary antialiased;
}

/* Large tabular numbers for prices/totals — never let digits jiggle in width */
.price-display {
  @apply font-mono tabular-nums;
}

/* Visible focus ring everywhere — this UI is keyboard-first, focus state
   must always be obvious without a mouse cursor as a reference point */
:focus-visible {
  outline: 2px solid theme('colors.accent.amber');
  outline-offset: 2px;
}
```

## 4. Component Hierarchy

```
<AppShell>                              // app/pos/layout.tsx
  ├── <Header>
  │     ├── <ModeIndicator />           // shows "WARUNG [F1]" or "AGENT [F2]" with accent color
  │     └── <CashierBadge />            // logged-in user, shift clock
  │
  ├── <ModeSwitcher />                  // invisible — owns the F1/F2 keydown listener
  │
  ├── (Warung Mode) ─────────────────────────────────────────
  │   <WarungWorkspace>
  │     ├── <BarcodeInput />            // always-focused hidden input, scanner target
  │     ├── <ProductGrid>               // fallback for manual/touch selection
  │     │     └── <ProductCard />
  │     ├── <Cart>
  │     │     └── <CartLine />          // qty +/-, remove, line subtotal
  │     └── <CheckoutPanel>
  │           ├── <PaymentMethodTabs /> // Cash / QRIS / Transfer
  │           ├── <NumPad />            // cash tendered entry
  │           └── <ChangeDueDisplay />
  │
  └── (Agent Mode) ──────────────────────────────────────────
      <AgentWorkspace>
        ├── <FloatBalanceWidget />      // current agent.float_ledger balance, always visible
        ├── <ServiceSelector>
        │     └── <ServiceTile />       // e-wallet topup / bill payment / QRIS deposit / withdrawal / transfer
        ├── <TransactionForm>
        │     ├── <PhoneInput />
        │     ├── <AmountInput />
        │     └── <FeeBreakdown />      // admin fee + commission, shown before confirm
        └── <RecentTransactions />      // last N agent.transactions, status badges
</AppShell>
```

## 5. Keyboard Navigation Map

| Key | Context | Action |
|---|---|---|
| `F1` | Anywhere in `/pos/*` | Switch to Warung Mode |
| `F2` | Anywhere in `/pos/*` | Switch to Agent Mode |
| `F3` | Anywhere in `/pos/*` | Open Reports (owner role only) |
| `F4` | Warung Mode | Clear current cart (with confirm) |
| `Enter` | Warung Mode, cart has items | Open Checkout Panel |
| `Enter` | Checkout Panel | Confirm payment / complete sale |
| `Esc` | Any modal/panel | Close / cancel without side effects |
| `/` | Warung Mode | Focus manual product search (fallback when scanner unavailable) |
| `+` / `-` | Cart, line item focused | Increment / decrement quantity |
| `Delete` | Cart, line item focused | Remove line item |
| `Enter` | Agent Mode, form valid | Submit transaction |
| Numeric keys | Checkout NumPad / Agent AmountInput | Direct digit entry, no mouse needed |

## 6. Implementation Pattern for Global Hotkeys

```tsx
// lib/keyboard/useGlobalHotkeys.ts
'use client';
import { useEffect } from 'react';

type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

export function useGlobalHotkeys(map: HotkeyMap) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTypingContext =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Function keys (F1-F4) always fire, even while typing in the
      // barcode field — they're mode switches, not text input.
      const isFunctionKey = /^F\d+$/.test(e.key);

      if (isTypingContext && !isFunctionKey) return;

      const action = map[e.key];
      if (action) {
        e.preventDefault();
        action(e);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [map]);
}
```

This pattern is the one rule every interactive component must respect: function keys are global and always live, but ordinary character/Enter handling is suppressed while the barcode input or a text field has focus, so a scanned barcode's digits never accidentally trigger an unrelated hotkey.

## 7. Visual Mode Separation Reinforcement

Beyond the database-level ledger separation in `01_SYSTEM_ARCHITECTURE.md`, the UI reinforces it visually so an operator can never mistake which mode — and which money — they're looking at:

- Warung Mode uses the `warung` amber accent family throughout (buttons, active tab indicators, the mode badge).
- Agent Mode uses the distinct `agentmode` sky-blue accent family.
- The `<ModeIndicator>` in the header is always visible and never subtle — large text, high-contrast accent background, impossible to miss mid-transaction.

Proceed to `05_DOCKER_DEPLOYMENT.md`.
