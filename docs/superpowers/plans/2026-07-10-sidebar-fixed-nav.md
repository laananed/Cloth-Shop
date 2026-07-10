# Sidebar Fixed Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the five personal-center sidebar nav buttons visible while the sidebar body scrolls independently on desktop and mobile.

**Architecture:** Preserve the existing `aside.sidebar` structure and keep the current click-to-switch logic. Make the panel a fixed-height container, pin the header and navigation into a non-scrolling region, and move scrolling to the content column that holds the active sidebar panel. Update the scroll-tool helper so the up/down buttons target the active sidebar content area instead of the whole panel.

**Tech Stack:** Native HTML, CSS, and JavaScript; Node test runner for regression checks.

## Global Constraints

- Do not change backend, database, SQL, product ordering, search, cart, order, payment, refund, or admin page behavior.
- Do not rewrite `index.html`; keep existing `data-sidebar`, `data-sidebar-nav`, `data-sidebar-target`, and `data-sidebar-panel` hooks.
- Prefer CSS-first fixes; make JS changes only if needed for the scroll buttons.
- Keep mobile layout from overflowing horizontally or breaking the sidebar interactions.

---

### Task 1: Lock the sidebar frame and make the content column scroll

**Files:**
- Modify: `src/styles.css`
- Test: `tests/site.test.js`

**Interfaces:**
- Consumes: existing `.sidebar`, `.sidebar__panel`, `.sidebar__header`, `.sidebar__layout`, `.sidebar-nav`, `.sidebar__content`, `.sidebar-view`
- Produces: fixed-height sidebar shell with a sticky/fixed nav column and an independently scrolling content column

- [ ] **Step 1: Write the failing test**

```js
test('sidebar keeps the five nav buttons visible while content scrolls independently', () => {
  const html = readFileSync('index.html', 'utf8');
  const css = readFileSync('src/styles.css', 'utf8');

  assert.ok(html.includes('data-sidebar-nav'));
  assert.match(css, /\.sidebar__panel\s*\{[\s\S]*?height:\s*100vh;/);
  assert.match(css, /\.sidebar-nav\s*\{[\s\S]*?position:\s*sticky;/);
  assert.match(css, /\.sidebar__content\s*\{[\s\S]*?overflow-y:\s*auto;/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/site.test.js --test-name-pattern="sidebar keeps the five nav buttons visible while content scrolls independently"`
Expected: FAIL because the sidebar content is still tied to the whole panel scroll.

- [ ] **Step 3: Write minimal implementation**

```css
.sidebar__panel {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sidebar__layout {
  flex: 1;
  min-height: 0;
}

.sidebar-nav {
  position: sticky;
  top: 0;
}

.sidebar__content {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/site.test.js --test-name-pattern="sidebar keeps the five nav buttons visible while content scrolls independently"`
Expected: PASS.

### Task 2: Point the scroll tools at the active sidebar content

**Files:**
- Modify: `src/main.js`
- Test: `tests/site.test.js`

**Interfaces:**
- Consumes: `getActiveSidebarScrollContainer()`, `initScrollTools()`
- Produces: scroll tools that target `.sidebar__content` when the sidebar is open, otherwise the page

- [ ] **Step 1: Write the failing test**

```js
test('scroll tools route sidebar and page scrolling through the right targets', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.match(mainJs, /function getActiveSidebarScrollContainer\(\) \{[\s\S]*?return sidebar\.querySelector\('\.sidebar__content'\);/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/site.test.js --test-name-pattern="scroll tools route sidebar and page scrolling through the right targets"`
Expected: FAIL because the helper still returns `.sidebar__panel`.

- [ ] **Step 3: Write minimal implementation**

```js
function getActiveSidebarScrollContainer() {
  if (!sidebar || !sidebar.classList.contains('is-open')) {
    return null;
  }

  return sidebar.querySelector('.sidebar__content');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/site.test.js --test-name-pattern="scroll tools route sidebar and page scrolling through the right targets"`
Expected: PASS.

### Task 3: Verify the full suite

**Files:**
- Modify: none

**Interfaces:**
- Consumes: the updated CSS and scroll helper
- Produces: confidence that the sidebar behavior and existing regression checks still pass

- [ ] **Step 1: Run the full test suite**

Run: `npm.cmd test`
Expected: exit 0 with all tests passing.

- [ ] **Step 2: Run the JS syntax check**

Run: `node --check src/main.js`
Expected: exit 0 with no syntax errors.
