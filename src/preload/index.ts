import { contextBridge, ipcRenderer } from "electron";
import type { FinlogApi } from "@/shared/contracts/finlog";

function invoke<TPayload, TResult>(
  channel: string,
  payload?: TPayload
): Promise<TResult> {
  return ipcRenderer.invoke(channel, payload) as Promise<TResult>;
}

const finlogApi: FinlogApi = {
  auth: {
    getSession: () => invoke("finlog:auth:getSession"),
    register: (input) => invoke("finlog:auth:register", input),
    login: (input) => invoke("finlog:auth:login", input),
    logout: () => invoke("finlog:auth:logout"),
    changePassword: (input) => invoke("finlog:auth:changePassword", input),
    getProfile: () => invoke("finlog:auth:getProfile"),
  },
  onboarding: {
    complete: (input) => invoke("finlog:onboarding:complete", input),
  },
  accounts: {
    list: () => invoke("finlog:accounts:list"),
    create: (input) => invoke("finlog:accounts:create", input),
    update: (input) => invoke("finlog:accounts:update", input),
    archive: (accountId) => invoke("finlog:accounts:archive", accountId),
    remove: (accountId) => invoke("finlog:accounts:remove", accountId),
  },
  categories: {
    list: () => invoke("finlog:categories:list"),
    create: (input) => invoke("finlog:categories:create", input),
    update: (input) => invoke("finlog:categories:update", input),
    deactivate: (categoryId) =>
      invoke("finlog:categories:deactivate", categoryId),
    merge: (input) => invoke("finlog:categories:merge", input),
    createSubcategory: (input) =>
      invoke("finlog:categories:createSubcategory", input),
  },
  transactions: {
    list: (filters) => invoke("finlog:transactions:list", filters),
    createIncome: (input) => invoke("finlog:transactions:createIncome", input),
    createExpense: (input) =>
      invoke("finlog:transactions:createExpense", input),
    createTransfer: (input) =>
      invoke("finlog:transactions:createTransfer", input),
    createConversion: (input) =>
      invoke("finlog:transactions:createConversion", input),
    createAdjustment: (input) =>
      invoke("finlog:transactions:createAdjustment", input),
    update: (input) => invoke("finlog:transactions:update", input),
    remove: (transactionId) =>
      invoke("finlog:transactions:remove", transactionId),
  },
  debts: {
    list: () => invoke("finlog:debts:list"),
    create: (input) => invoke("finlog:debts:create", input),
    registerPayment: (input) => invoke("finlog:debts:registerPayment", input),
    registerCollection: (input) =>
      invoke("finlog:debts:registerCollection", input),
    cancel: (debtId) => invoke("finlog:debts:cancel", debtId),
    archive: (debtId) => invoke("finlog:debts:archive", debtId),
    listPayments: (debtId) => invoke("finlog:debts:listPayments", debtId),
  },
  goals: {
    list: () => invoke("finlog:goals:list"),
    create: (input) => invoke("finlog:goals:create", input),
    contribute: (input) => invoke("finlog:goals:contribute", input),
    release: (input) => invoke("finlog:goals:release", input),
    cancel: (goalId) => invoke("finlog:goals:cancel", goalId),
    archive: (goalId) => invoke("finlog:goals:archive", goalId),
  },
  dashboard: {
    summary: (filters) => invoke("finlog:dashboard:summary", filters),
  },
  reports: {
    get: (filters) => invoke("finlog:reports:get", filters),
  },
  settings: {
    updateProfile: (input) => invoke("finlog:settings:updateProfile", input),
    updatePrimaryCurrency: (currency) =>
      invoke("finlog:settings:updatePrimaryCurrency", currency),
    exportJson: () => invoke("finlog:settings:exportJson"),
    importJson: () => invoke("finlog:settings:importJson"),
    createBackup: () => invoke("finlog:settings:createBackup"),
    restoreBackup: () => invoke("finlog:settings:restoreBackup"),
  },
};

contextBridge.exposeInMainWorld("finlog", finlogApi);
