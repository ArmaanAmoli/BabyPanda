import { getProjectName, logError } from '@baby-panda/utils';
import {
  SQLSafeExecutor,
  createSession as createSessionMethod,
  createMessage as createMessageMethod,
  getMessages as getMessagesMethod,
  addProvider as addProviderMethod,
  getProviders as getProvidersMethod,
  getSessions as getSessionsMethod,
  updateSession as updateSessionMethod,
  getSession as getSessionMethod,
  getSessionsByProjectDirectory as getSessionsByProjectDirectoryMethod,
  renameSession as renameSessionMethod,
  getSessionName as getSessionNameMethod,
  getCompactionSummaries as getCompactionSummariesMethod,
  getMostRecentCompactionSummary as getMostRecentCompactionSummaryMethod,
  getMessagesForSummary as getMessagesForSummaryMethod,
  getWebApiKeys as getWebApiKeysMethod,
  deleteSession as deleteSessionMethod,
  closeDatabase,
} from './methods';
import { runMigrations, syncWAL } from './index.db';
import { LogType } from '@baby-panda/types';

function wrapWithSQLSafeExecutor<TArgs extends readonly unknown[], TResult>(
  method: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await SQLSafeExecutor(method, args);
    } catch (error: unknown) {
      // `${error}` would only render the top-level wrapper (e.g. Drizzle's
      // "Failed query" message) and hide the real driver error in `cause` —
      // logError renders the full causal chain as the cause.
      await logError(LogType.db, getProjectName(), 'common', 'database query failed', error);
      throw error;
    }
  };
}

export { SQLSafeExecutor, runMigrations, syncWAL };
export const createSession = wrapWithSQLSafeExecutor(createSessionMethod);
export const createMessage = wrapWithSQLSafeExecutor(createMessageMethod);
export const getMessages = wrapWithSQLSafeExecutor(getMessagesMethod);
export const addProvider = wrapWithSQLSafeExecutor(addProviderMethod);
export const getProviders = wrapWithSQLSafeExecutor(getProvidersMethod);
export const getSessions = wrapWithSQLSafeExecutor(getSessionsMethod);
export const updateSession = wrapWithSQLSafeExecutor(updateSessionMethod);
export const getSession = wrapWithSQLSafeExecutor(getSessionMethod);
export const getSessionsByProjectDirectory = wrapWithSQLSafeExecutor(
  getSessionsByProjectDirectoryMethod,
);
export const renameSession = wrapWithSQLSafeExecutor(renameSessionMethod);
export const getSessionName = wrapWithSQLSafeExecutor(getSessionNameMethod);
export const getCompactionSummaries = wrapWithSQLSafeExecutor(getCompactionSummariesMethod);
export const getMostRecentCompactionSummary = wrapWithSQLSafeExecutor(
  getMostRecentCompactionSummaryMethod,
);
export const getMessagesForSummary = wrapWithSQLSafeExecutor(getMessagesForSummaryMethod);
export const getWebApiKeys = wrapWithSQLSafeExecutor(getWebApiKeysMethod);
export const deleteSession = wrapWithSQLSafeExecutor(deleteSessionMethod);
export { closeDatabase };
