import type { AppContext } from "../context";
import { h } from "../dom";

function renderResetPanel(ctx: AppContext, root: HTMLElement): void {
  const panel = h("div", { class: "empty" });

  const showNormal = () => {
    panel.replaceChildren(
      h("p", {}, "テンプレートを使うには、保存済みのデータを初期化してください。"),
      h("button", { type: "button", class: "danger", onclick: showConfirm }, "初期化"),
    );
  };

  // Inline confirmation because window.confirm is not available in add-in task panes.
  const showConfirm = () => {
    panel.replaceChildren(
      h(
        "p",
        { class: "confirm" },
        "保存済みのデータをすべて削除します。元に戻せません。新しいバージョンのアドインで保存したデータの場合は、アドインを更新すると読み込める可能性があります。",
      ),
      h(
        "div",
        { class: "actions" },
        h(
          "button",
          {
            type: "button",
            class: "danger",
            onclick: async () => {
              if (await ctx.resetTemplates()) {
                ctx.show({ name: "list" });
                ctx.showMessage("success", "テンプレートを初期化しました");
              }
            },
          },
          "初期化する",
        ),
        h("button", { type: "button", onclick: showNormal }, "やめる"),
      ),
    );
  };

  showNormal();
  root.append(h("h1", {}, "テンプレートを適用"), panel);
}

export function renderListView(ctx: AppContext, root: HTMLElement): void {
  if (ctx.readOnly) {
    renderResetPanel(ctx, root);
    return;
  }

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
