# LOTR Animated Backgrounds — Design Spec

**Date:** 2026-06-29  
**Scope:** Two animated background effects for the existing Angular LOTR-themed chat app.

---

## Overview

Add two distinct CSS-driven animated backgrounds:
- **Login page** (`JoinForm`): Brasas de Mordor — floating ember particles
- **Chat page** (`ChatRoom`): Auroras de Rivendell — slow color-wave overlays

No external libraries. No canvas. Performance-safe for both short sessions (login) and extended ones (chat).

---

## Background 1: Brasas de Mordor (Login)

### Goal
Create atmosphere on first impression. Glowing ember/spark particles rise from the bottom and fade out, evoking Mordor's fires.

### Visual
~25 small circles (2–5px), colored between `#ff4500` (orange) and `#8b1a1a` (dark red), scattered randomly on the X axis, rising upward with a fade-out over 4–8 seconds each. Staggered delays prevent synchronization.

### Implementation

**Template (`join-form.html`):**
```html
<div class="ember-bg">
  <span *ngFor="let e of embers" class="ember"
        [style.left.%]="e.x"
        [style.width.px]="e.size"
        [style.height.px]="e.size"
        [style.animationDuration.s]="e.duration"
        [style.animationDelay.s]="e.delay"
        [style.background]="e.color">
  </span>
</div>
```

**Component (`join-form.ts`):**
```ts
embers = Array.from({ length: 25 }, () => ({
  x: Math.random() * 100,
  size: 2 + Math.random() * 3,
  duration: 4 + Math.random() * 4,
  delay: Math.random() * 6,
  color: `hsl(${10 + Math.random() * 20}, 90%, ${25 + Math.random() * 20}%)`
}));
```

**CSS (`join-form.css`):**
```css
.ember-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.ember {
  position: absolute;
  bottom: -10px;
  border-radius: 50%;
  opacity: 0;
  animation: rise linear infinite;
  filter: blur(0.5px);
}

@keyframes rise {
  0%   { transform: translateY(0) scale(1);   opacity: 0; }
  10%  { opacity: 0.9; }
  90%  { opacity: 0.3; }
  100% { transform: translateY(-100vh) scale(0.3); opacity: 0; }
}
```

**Layout adjustment (`join-form.html`):** The existing `.lotr-bg` wrapper gets `position: relative; z-index: 1` so the card floats above the embers.

---

## Background 2: Auroras de Rivendell (Chat)

### Goal
Ambient, non-distracting background for extended chat sessions. Slow-moving color gradients in green-blue-gold tones, evoking Rivendell's ethereal glow.

### Visual
Three absolutely-positioned `<div>` layers, each with a large `radial-gradient` blob. Each layer animates its `background-position` on a different cycle (12s, 17s, 22s), creating a gentle breathing/flowing effect without hard motion.

### Implementation

**Template (`chat-room.html`):** Insert as first child of `.chat-layout`:
```html
<div class="aurora-bg">
  <div class="aurora a1"></div>
  <div class="aurora a2"></div>
  <div class="aurora a3"></div>
</div>
```

**CSS (`chat-room.css`):**
```css
.aurora-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.aurora {
  position: absolute;
  inset: -50%;
  width: 200%;
  height: 200%;
  opacity: 1;
}

.a1 {
  background: radial-gradient(ellipse 60% 40% at 30% 60%, rgba(26,74,58,0.18) 0%, transparent 70%);
  animation: drift1 17s ease-in-out infinite alternate;
}

.a2 {
  background: radial-gradient(ellipse 50% 50% at 70% 30%, rgba(201,168,76,0.06) 0%, transparent 65%);
  animation: drift2 22s ease-in-out infinite alternate;
}

.a3 {
  background: radial-gradient(ellipse 70% 35% at 50% 80%, rgba(13,31,60,0.25) 0%, transparent 70%);
  animation: drift3 12s ease-in-out infinite alternate;
}

@keyframes drift1 {
  from { transform: translate(0, 0) rotate(0deg); }
  to   { transform: translate(4%, 3%) rotate(5deg); }
}

@keyframes drift2 {
  from { transform: translate(0, 0) rotate(0deg); }
  to   { transform: translate(-5%, 4%) rotate(-4deg); }
}

@keyframes drift3 {
  from { transform: translate(0, 0) rotate(0deg); }
  to   { transform: translate(3%, -3%) rotate(3deg); }
}
```

**Layout:** Existing sidebar and chat container already use `rgba(0,0,0,0.x)` backgrounds, which act as natural overlays. No layout changes needed — `.chat-layout` remains `position: relative` and all children stay above `z-index: 0`.

---

## Constraints & Non-goals

- No canvas, no JS animation loops, no external deps
- `pointer-events: none` on both backgrounds — zero interference with UI interactions
- `position: fixed` ensures coverage across scroll (chat messages scroll independently inside `.messages`)
- No changes to routing, services, or models
- Does not implement: parallax mouse tracking, sound, video backgrounds, or per-room aurora color variants

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/app/components/join-form/join-form.html` | Add `ember-bg` wrapper + `*ngFor` embers |
| `frontend/src/app/components/join-form/join-form.ts` | Add `embers[]` array in component |
| `frontend/src/app/components/join-form/join-form.css` | Add `.ember-bg`, `.ember`, `@keyframes rise` |
| `frontend/src/app/components/chat-room/chat-room.html` | Add `aurora-bg` + 3 aurora divs |
| `frontend/src/app/components/chat-room/chat-room.css` | Add `.aurora-bg`, `.aurora`, `.a1/.a2/.a3`, keyframes |
