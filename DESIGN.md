# Design System Strategy: High-Precision Enterprise

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Surgical Ledger."** 

In the high-stakes environment of healthcare adjudication, the UI must function like a precision instrument. We are moving beyond the "generic SaaS dashboard" to create an editorialized, high-trust environment. The experience is defined by **Intentional Negative Space** and **Asymmetric Information Density**. Rather than a rigid, boxy grid, we utilize a "layered-pane" approach where data feels etched into the interface. We break the "template" look by using exaggerated typographic scales—pairing oversized, quiet headlines with dense, highly legible data tables to create an authoritative, clinical rhythm.

## 2. Colors & Surface Architecture
The palette is rooted in a disciplined monochromatic base, punctuated by high-signal "Procedure Blue" to guide the user’s eye toward critical path actions.

### Surface Hierarchy & Nesting
We reject the "flat" web. Depth is achieved through a stack of tonal layers that mimic the physical overlap of medical charts.
*   **Base Layer:** `surface` (#F7F9FB) – The primary canvas for the application.
*   **The Inset:** `surface-container-low` (#F0F4F7) – Used for sidebar navigation or secondary utility panels.
*   **The Focus:** `surface-container-lowest` (#FFFFFF) – Used for primary content cards and data entry areas to provide maximum "pop" against the gray background.

### The "No-Line" Rule
Standard 1px borders are strictly prohibited for structural sectioning. Boundaries must be defined by shifting between `surface-container` tiers. If a section ends, the background color must change.
*   *Example:* A `surface-container-highest` header bar sits flush against a `surface` workspace. The 2-3% tonal shift is enough for the eye to perceive a boundary without the "clutter" of a line.

### Signature Textures: Glass & Gradients
To avoid a sterile, "bootstrap" feel, apply a **Subtle Surgical Glow** to primary CTAs. Instead of flat `#2563EB`, use a linear gradient: `secondary` (#0053DC) to `secondary-dim` (#0049C2). 
*   **Glassmorphism:** For floating modals or "always-on" status chips, use `surface-container-lowest` at 85% opacity with a `12px` backdrop-blur. This keeps the user grounded in their clinical context.

## 3. Typography
We use a dual-font system to balance clinical efficiency with authoritative hardware-like branding.

*   **Display & Headlines (Manrope):** These are our "Editorial" moments. Use `display-sm` for page headers with wide letter-spacing (-0.02em). This conveys the "Architect" persona—stable and modern.
*   **Data & UI (Inter):** All functional labels, inputs, and dense tables utilize Inter. Its tall x-height ensures readability at `body-sm` (0.75rem) during complex adjudication tasks.
*   **Hierarchy as Navigation:** A `label-md` in `on-surface-variant` should be used for metadata to create a clear "secondary" layer of information, ensuring the `title-md` primary data point remains the hero of the cell.

## 4. Elevation & Depth
In this system, elevation is a product of light and material, not "shadow effects."

*   **The Layering Principle:** Stack `surface-container-lowest` cards on top of `surface-container-low` backgrounds. This creates a "Natural Lift."
*   **Ambient Shadows:** For elevated elements (like a dropdown or flyout), use a tinted shadow: `0 8px 32px rgba(15, 23, 42, 0.06)`. By using a navy-tinted shadow instead of pure black, the elevation feels integrated into the professional environment.
*   **The "Ghost Border" Fallback:** In high-density data tables where tonal shifts might be too subtle, use a "Ghost Border": `outline-variant` (#A9B4B9) at **15% opacity**. This provides a guide for the eye without creating visual noise.

## 5. Components
Each component must feel like a custom-machined part.

*   **Buttons:**
    *   *Primary:* `secondary` (#0053DC) background with `on-secondary` text. `DEFAULT` (4px) rounding.
    *   *Tertiary (Ghost):* No border. Transparent background. Use `on-primary-fixed` text. Only appears on hover with a `surface-container-high` background shift.
*   **Input Fields:** Use `surface-container-lowest` for the fill. The border is a `Ghost Border` until focused. On focus, the border shifts to `secondary` with a 2px "outer glow" of `secondary-container`.
*   **Data Cards:** **Strictly no dividers.** Group related medical codes using `spacing-4` (0.9rem) of vertical white space. Use a `surface-container-high` vertical pill (2px wide) on the far left of a card to indicate a "Selected" or "Active" state.
*   **Chips:** High-trust status indicators. Use `primary-container` for neutral states and `error-container` for adjudication denials. Text must always be the "on-container" variant for AAA accessibility.
*   **Adjudication Timeline:** A custom component using a vertical line in `outline-variant` (20% opacity) with `secondary` nodes to represent touchpoints in a claim’s history.

## 6. Do's and Don'ts

### Do:
*   **Embrace High Density:** Healthcare professionals prefer seeing more data with less scrolling. Use `body-sm` and `spacing-2` to pack information tightly, but keep it legible through strict typographic hierarchy.
*   **Use Asymmetry:** Place primary actions on the top right, but keep metadata "staggered" on the left to create an editorial flow.
*   **Tonal Nesting:** Always place a lighter container inside a darker surface to create focus.

### Don't:
*   **Don't use 100% Black:** Never use `#000000`. Use `on-surface` (#2A3439) for text to maintain the clinical, softer-on-the-eyes gray-scale.
*   **No Rounded Pills:** Avoid `full` rounding for buttons. Stick to `DEFAULT` (4px) or `md` (6px) to maintain the "Architectural" feel. Pills feel too consumer-grade; rectangles with subtle radii feel like professional software.
*   **No Heavy Dividers:** If you feel the need to add a line, try adding `0.5rem` of whitespace instead. If that fails, use a tonal background shift.