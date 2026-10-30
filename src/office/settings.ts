import { SETTINGS_KEY } from "../core/storage";
import { promisify } from "./appointment";

export interface SettingsGateway {
  load(): unknown;
  save(json: string): Promise<void>;
}

export function createOfficeSettingsGateway(): SettingsGateway {
  const settings = Office.context.roamingSettings;
  return {
    load: () => settings.get(SETTINGS_KEY),
    save: (json) => {
      settings.set(SETTINGS_KEY, json);
      return promisify<void>((cb) => settings.saveAsync(cb));
    },
  };
}
