import { getProjectName, writeLogs, formatErrorChain } from '@baby-panda/utils';
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
  getCompactionSummaries as getCompactionSummariesMethod,
  getMostRecentCompactionSummary as getMostRecentCompactionSummaryMethod,
  getMessagesForSummary as getMessagesForSummaryMethod,
} from './methods';
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
      // log the full causal chain instead.
      await writeLogs(LogType.db, getProjectName(), 'common', formatErrorChain(error));
      throw error;
    }
  };
}

export { SQLSafeExecutor };
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
export const getCompactionSummaries = wrapWithSQLSafeExecutor(getCompactionSummariesMethod);
export const getMostRecentCompactionSummary = wrapWithSQLSafeExecutor(
  getMostRecentCompactionSummaryMethod,
);
export const getMessagesForSummary = wrapWithSQLSafeExecutor(getMessagesForSummaryMethod);
