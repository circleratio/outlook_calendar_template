type Attrs = Record<string, string | boolean | ((e: Event) => void)>;
type Child = Node | string | null | undefined | false;

/** Create an element. Text children are inserted as text nodes, so user input is never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === "function") {
      el.addEventListener(key.replace(/^on/, "").toLowerCase(), value);
    } else if (typeof value === "boolean") {
      if (value) el.setAttribute(key, "");
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}
