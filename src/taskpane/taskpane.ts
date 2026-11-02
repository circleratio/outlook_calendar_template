import { applyTemplate, DateTimeUnavailableError } from "../app/applyTemplate";
import { deserialize, exceedsLimit, serialize } from "../core/storage";
import type { EventTemplate } from "../core/template";
import { createOfficeAppointmentGateway } from "../office/appointment";
import { createOfficeSettingsGateway } from "../office/settings";
import type { AppContext, MessageKind, View } from "./context";
import { h } from "./dom";
import { renderEditView } from "./views/editView";
import { renderListView } from "./views/listView";
import { renderManageView } from "./views/manageView";

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function start(): void {
  const main = document.getElementById("main")!;
  const messageBar = document.getElementById("message")!;
  const settings = createOfficeSettingsGateway();
  const appointment = createOfficeAppointmentGateway();

  const loaded = deserialize(settings.load());
  let templates: EventTemplate[] = loaded.templates;
  let readOnly = loaded.warning !== undefined;

  const showMessage = (kind: MessageKind, text: string) => {
    messageBar.replaceChildren(h("div", { class: `message ${kind}`, role: kind === "success" ? "status" : "alert" }, text));
  };
  const clearMessage = () => messageBar.replaceChildren();

  const write = async (next: EventTemplate[]): Promise<boolean> => {
    const json = serialize(next);
    if (exceedsLimit(json, serialize(templates))) {
      showMessage("error", "保存容量の上限を超えます。本文を短くするか、不要なテンプレートを削除してください");
      return false;
    }
    try {
      await settings.save(json);
    } catch (e) {
      // Every save writes the whole list, so no rollback of roamingSettings is needed.
      showMessage("error", `保存に失敗しました: ${errorMessage(e)}`);
      return false;
    }
    templates = next;
    return true;
  };

  const ctx: AppContext = {
    get templates() {
      return templates;
    },

    get readOnly() {
      return readOnly;
    },

    async saveTemplates(next) {
      if (readOnly) {
        showMessage("error", "保存済みテンプレートを読み込めないため、保存できません");
        return false;
      }
      return write(next);
    },

    async resetTemplates() {
      if (!(await write([]))) return false;
      readOnly = false;
      return true;
    },

    async apply(t) {
      clearMessage();
      try {
        const { failures } = await applyTemplate(t, appointment);
        if (failures.length === 0) {
          showMessage("success", `テンプレート「${t.name}」を適用しました。内容を確認して、送信または保存してください`);
        } else {
          const detail = failures.map((f) => `${f.field}（${f.message}）`).join("、");
          showMessage("error", `次の項目を設定できませんでした: ${detail}`);
        }
      } catch (e) {
        if (e instanceof DateTimeUnavailableError) {
          showMessage("error", `イベントの日時を取得できませんでした: ${e.message}`);
        } else {
          showMessage("error", `適用に失敗しました: ${errorMessage(e)}`);
        }
      }
    },

    show(view: View) {
      clearMessage();
      main.replaceChildren();
      switch (view.name) {
        case "list":
          renderListView(ctx, main);
          break;
        case "manage":
          renderManageView(ctx, main);
          break;
        case "edit":
          renderEditView(ctx, main, view.template, view.returnTo);
          break;
      }
      window.scrollTo(0, 0);
    },

    showMessage,
  };

  ctx.show({ name: "list" });
  if (loaded.warning) {
    showMessage("warning", loaded.warning);
  }
}

Office.onReady((info) => {
  if (info.host === Office.HostType.Outlook) {
    start();
  }
});
