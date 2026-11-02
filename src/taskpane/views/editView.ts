import { parseEmailList } from "../../core/attendees";
import {
  createEmptyTemplate,
  EventTemplate,
  MAX_NAME_LENGTH,
  TemplateSensitivity,
  validateTemplate,
} from "../../core/template";
import type { AppContext } from "../context";
import { h } from "../dom";

type FieldKey = keyof Omit<EventTemplate, "id">;

export function renderEditView(
  ctx: AppContext,
  root: HTMLElement,
  original: EventTemplate | null,
  returnTo: "list" | "manage",
): void {
  const base = original ?? createEmptyTemplate();

  const inputs = {
    name: h("input", { type: "text", id: "f-name", value: base.name }),
    subject: h("input", { type: "text", id: "f-subject", value: base.subject }),
    body: h("textarea", { id: "f-body", rows: "6" }),
    location: h("input", { type: "text", id: "f-location", value: base.location }),
    requiredAttendees: h("textarea", { id: "f-required", rows: "2" }),
    optionalAttendees: h("textarea", { id: "f-optional", rows: "2" }),
    durationMinutes: h("input", {
      type: "number",
      id: "f-duration",
      min: "1",
      max: "1440",
      step: "1",
      value: base.durationMinutes === null ? "" : String(base.durationMinutes),
    }),
    sensitivity: h(
      "select",
      { id: "f-sensitivity" },
      h("option", { value: "unchanged" }, "変更しない"),
      h("option", { value: "normal" }, "公開"),
      h("option", { value: "private" }, "非公開"),
    ),
  };
  inputs.sensitivity.value = base.sensitivity;
  inputs.body.value = base.body;
  inputs.requiredAttendees.value = base.requiredAttendees.join("\n");
  inputs.optionalAttendees.value = base.optionalAttendees.join("\n");

  const errorEls = {} as Record<FieldKey, HTMLElement>;
  const field = (key: FieldKey, label: string, control: HTMLElement, hint?: string) => {
    errorEls[key] = h("div", { class: "field-error", role: "alert" });
    return h(
      "div",
      { class: "field" },
      h("label", { for: control.id }, label),
      control,
      hint ? h("div", { class: "hint" }, hint) : null,
      errorEls[key],
    );
  };

  const readForm = (): EventTemplate => {
    const duration = inputs.durationMinutes.value.trim();
    return {
      id: base.id,
      name: inputs.name.value.trim(),
      subject: inputs.subject.value,
      body: inputs.body.value,
      location: inputs.location.value.trim(),
      requiredAttendees: parseEmailList(inputs.requiredAttendees.value),
      optionalAttendees: parseEmailList(inputs.optionalAttendees.value),
      // Number("") is 0, so treat blank explicitly as "not set".
      durationMinutes: duration === "" ? null : Number(duration),
      sensitivity: inputs.sensitivity.value as TemplateSensitivity,
    };
  };

  const save = async () => {
    for (const el of Object.values(errorEls)) el.textContent = "";

    const t = readForm();
    // The browser leaves value empty when a number input holds non-numeric text.
    if (inputs.durationMinutes.validity.badInput) t.durationMinutes = NaN;

    const errors = validateTemplate(t, [...ctx.templates]);
    if (errors.length > 0) {
      for (const e of errors) {
        if (e.field !== "id") errorEls[e.field].textContent = e.message;
      }
      ctx.showMessage("error", "入力内容に誤りがあります");
      return;
    }

    const next = original
      ? ctx.templates.map((x) => (x.id === original.id ? t : x))
      : [...ctx.templates, t];
    if (await ctx.saveTemplates(next)) {
      ctx.show({ name: returnTo });
      ctx.showMessage("success", `テンプレート「${t.name}」を保存しました`);
    }
  };

  root.append(
    h("h1", {}, original ? "テンプレートの編集" : "テンプレートの新規作成"),
    field("name", "テンプレート名（必須）", inputs.name, `${MAX_NAME_LENGTH}文字以内`),
    field("subject", "件名", inputs.subject),
    field("body", "本文", inputs.body),
    h(
      "div",
      { class: "hint" },
      "件名・本文では {日付} {開始時刻} {終了時刻} が適用時の日時に置き換わります（例: 2026/11/05(木)、10:00）。",
    ),
    field("location", "場所", inputs.location),
    field("requiredAttendees", "必須出席者", inputs.requiredAttendees, "メールアドレスをカンマ・セミコロン・改行で区切って入力"),
    field("optionalAttendees", "任意出席者", inputs.optionalAttendees, "メールアドレスをカンマ・セミコロン・改行で区切って入力"),
    field("durationMinutes", "会議時間（分）", inputs.durationMinutes, "空欄の場合は終了日時を変更しません"),
    field("sensitivity", "公開範囲", inputs.sensitivity, "非公開にすると、他の人の予定表には件名や場所などの詳細が表示されません"),
    h(
      "div",
      { class: "actions" },
      h("button", { type: "button", class: "primary", onclick: save }, "保存"),
      h("button", { type: "button", onclick: () => ctx.show({ name: returnTo }) }, "キャンセル"),
    ),
  );
}
