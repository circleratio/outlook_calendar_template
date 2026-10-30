import type { EventTemplate } from "../core/template";

export type MessageKind = "success" | "error" | "warning";

export type View =
  | { name: "list" }
  | { name: "manage" }
  | { name: "edit"; template: EventTemplate | null; returnTo: "list" | "manage" };

/** Shared state and actions passed to every view. */
export interface AppContext {
  readonly templates: readonly EventTemplate[];
  /** Persist `next`; on failure shows an error, keeps the previous list and returns false. */
  saveTemplates(next: EventTemplate[]): Promise<boolean>;
  apply(t: EventTemplate): Promise<void>;
  show(view: View): void;
  showMessage(kind: MessageKind, text: string): void;
}
