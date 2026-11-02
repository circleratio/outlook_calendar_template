import type { EventTemplate } from "../core/template";

export type MessageKind = "success" | "error" | "warning";

export type View =
  | { name: "list" }
  | { name: "manage" }
  | { name: "edit"; template: EventTemplate | null; returnTo: "list" | "manage" };

/** Shared state and actions passed to every view. */
export interface AppContext {
  readonly templates: readonly EventTemplate[];
  /** True while stored data could not be read; saving is refused so it is not overwritten. */
  readonly readOnly: boolean;
  /** Persist `next`; on failure shows an error, keeps the previous list and returns false. */
  saveTemplates(next: EventTemplate[]): Promise<boolean>;
  /** Discard the stored data, including unreadable data, and leave read-only mode. */
  resetTemplates(): Promise<boolean>;
  apply(t: EventTemplate): Promise<void>;
  show(view: View): void;
  showMessage(kind: MessageKind, text: string): void;
}
