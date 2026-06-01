import { isServerMode } from "./server-mode";
import * as local from "./storage-local";
import * as remote from "./storage-remote";

const impl = isServerMode() ? remote : local;

export const SHARED_VAULT_ID = impl.SHARED_VAULT_ID;
export const migrateLegacyStorage = impl.migrateLegacyStorage;
export const loadVault = impl.loadVault;
export const saveVault = impl.saveVault;
export const invalidateVaultCache = impl.invalidateVaultCache;
export const patchVault = impl.patchVault;
