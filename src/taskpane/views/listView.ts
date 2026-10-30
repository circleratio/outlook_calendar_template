import type { AppContext } from "../context";
import { h } from "../dom";

export function renderListView(ctx: AppContext, root: HTMLElement): void {
  const toManage = h("button", { type: "button", class: "link", onclick: () => ctx.show({ name: "manage" }) }, "テンプレート管理");

  if (ctx.templates.length === 0) {
    root.append(
      h("h1", {}, "テンプレートを適用"),
      h(
        "div",
        { class: "empty" },
        h("p", {}, "テンプレートがありません。テンプレートを作成してください。"),
        h(
          "button",
          {
            type: "button",
            class: "primary",
            onclick: () => ctx.show({ name: "edit", template: null, returnTo: "list" }),
          },
          "新規作成",
        ),
      ),
      h("div", { class: "footer" }, toManage),
    );
    return;
  }

  const applyButton = h("button", { type: "button", class: "primary", disabled: true }, "適用");
  let selectedId: string | null = null;

  const items = ctx.templates.map((t) =>
    h(
      "label",
      { class: "item" },
      h("input", {
        type: "radio",
        name: "template",
        value: t.id,
        onchange: () => {
          selectedId = t.id;
          applyButton.disabled = false;
        },
      }),
      h("span", {}, t.name),
    ),
  );

  applyButton.addEventListener("click", async () => {
    const t = ctx.templates.find((x) => x.id === selectedId);
    if (!t) return;
    applyButton.disabled = true;
    try {
      await ctx.apply(t);
    } finally {
      applyButton.disabled = false;
    }
  });

  root.append(
    h("h1", {}, "テンプレートを適用"),
    h("div", { class: "list", role: "radiogroup" }, ...items),
    h("div", { class: "actions" }, applyButton),
    h("div", { class: "footer" }, toManage),
  );
}
