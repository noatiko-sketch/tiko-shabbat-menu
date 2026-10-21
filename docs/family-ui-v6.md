# Direct animated row dragging

- Every menu row now has its own always-visible drag grip beside edit/delete. The separate ordering-mode toggle is removed.
- The actual row tracks pointer movement, with a raised surface and shadow; surrounding rows slide to preview the new order. A placeholder line is no longer used.
- The source remains in its destination while the revision-checked backend saves. Cancelling or an invalid horizontal drop restores the original visual order. Pointer capture, edge scrolling, reduced-motion preferences and keyboard moves remain supported.
- Background refresh is suppressed during drag/save, and outstanding refresh results are invalidated at drag start. Dragging is unavailable while an inline edit or removal confirmation is open.
- Geometry tests cover continuous movement, both directions, variable heights/gaps, bounds, returning to the origin and moving a tall row into the last slot.

Verification: TypeScript, model/backend and geometry tests, production build. Physical mobile gestures were not verified in a browser in this update.
