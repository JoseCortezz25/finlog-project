import { ipcMain } from "electron";
import { FinlogService } from "@/main/application/services/finlog-service";

const finlogService = new FinlogService();

type HandlerGroup = keyof FinlogService;

export function registerFinlogHandlers() {
  registerGroup("auth");
  registerGroup("onboarding");
  registerGroup("accounts");
  registerGroup("categories");
  registerGroup("transactions");
  registerGroup("debts");
  registerGroup("goals");
  registerGroup("dashboard");
  registerGroup("reports");
  registerGroup("settings");
}

function registerGroup(group: HandlerGroup) {
  const api = finlogService[group];
  if (!api || typeof api !== "object") {
    return;
  }

  for (const [methodName, method] of Object.entries(api)) {
    ipcMain.handle(`finlog:${group}:${methodName}`, async (_event, payload) => {
      if (typeof method !== "function") {
        throw new Error("Operacion IPC invalida.");
      }

      return method(payload);
    });
  }
}
