import type { EventTemplate } from "../../core/template";
import type { AppContext } from "../context";
import { h } from "../dom";

export function renderManageView(ctx: AppContext, root: HTMLElement): void {
  const rows = ctx.templates.map((t) => renderRow(ctx, t));

  root.append(
    h("h1", {}, "テンプレート管理"),
    rows.length > 0 ? h("div", { class: "list" }, ...rows) : h("p", { class: "empty" }, "テンプレートがありません。"),
    h(
      "div",
      { class: "actions" },
      h(
        "button",
        { type: "button", class: "primary", onclick: () => ctx.show({ name: "edit", template: null, returnTo: "manage" }) },
        "新規作成",
      ),
      h("button", { type: "button", onclick: () => ctx.show({ name: "list" }) }, "戻る"),
    ),
  );
}

function renderRow(ctx: AppContext, t: EventTemplate): HTMLElement {
  const row = h("div", { class: "item row" });

  const showNormal = () => {
    row.replaceChildren(
      h("span", { class: "name" }, t.name),
      h(
        "button",
        { type: "button", onclick: () => ctx.show({ name: "edit", template: t, returnTo: "manage" }) },
        "編集",
      ),
      h("button", { type: "button", onclick: showConfirm }, "削除"),
    );
  };

  // Inline confirmation because window.confirm is not available in add-in task panes.
  const showConfirm = () => {
    row.replaceChildren(
      h("span", { class: "name confirm" }, `「${t.name}」を削除しますか？`),
      h(
        "button",
        {
          type: "button",
          class: "danger",
          onclick: async () => {
            const next = ctx.templates.filter((x) => x.id !== t.id);
            if (await ctx.saveTemplates(next)) {
              ctx.show({ name: "manage" });
              ctx.showMessage("success", `テンプレート「${t.name}」を削除しました`);
            }
          },
        },
        "削除する",
      ),
      h("button", { type: "button", onclick: showNormal }, "やめる"),
    );
  };

  showNormal();
  return row;
}
