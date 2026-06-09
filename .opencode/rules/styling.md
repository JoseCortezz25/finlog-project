---
paths: src/**/*.{ts,tsx}
---

The approach to style management is primarily based on Tailwind CSS along with shadcn/ui components. To maintain style consistency and reduce repetition, we will implement an organized system for creating and applying classes.

For frequently repeated styles, it is recommended to use the @apply directive in separate CSS files named according to the entity/component. This allows for visual consistency throughout the application while leveraging the efficiency of Tailwind.

Each reusable UI component must have its variants and styled states clearly defined. More complex or specific styles should be extracted into separate files and applied using @apply, instead of long strings of classes within the components.

For components with style variations based on properties, we will implement utility functions for class construction that generate the appropriate combinations based on the received props. This keeps the styling logic encapsulated and facilitates maintenance.

A mobile-first approach will be used for all responsive designs, leveraging Tailwind's capabilities to create adaptable interfaces for different screen sizes in a consistent and predictable manner.

## Editorial restraint rules

- Do not overuse badges, pills, uppercase micro-labels, or decorative status chips. They are allowed only when they communicate actionable state the user must notice immediately.
- Never use badge/pill labels as section decoration (for example: “Vista financiera”, “Bloque operativo”, “Workspace local”, or “Panorama financiero”). Use plain text hierarchy instead.
- Avoid aggressive shadows. Cards may use a single subtle shadow tier at most; navigation items, table rows, badges, and ordinary buttons should not add heavy drop shadows.
- Financial data must prioritize readability over ornamentation. Labels should clarify business meaning, not expose implementation details or add visual noise.
