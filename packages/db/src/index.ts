import { getProjectName, writeLogs } from '@baby-panda/utils';
import {
  SQLSafeExecutor,
  createSession as createSessionMethod,
  createMessage as createMessageMethod,
  getMessages as getMessagesMethod,
  getMessagesAfterTimestamp as getMessagesAfterTimestampMethod,
  addProvider as addProviderMethod,
  getProviders as getProvidersMethod,
  getSessions as getSessionsMethod,
  updateSession as updateSessionMethod,
  getSession as getSessionMethod,
  getSessionsByProjectDirectory as getSessionsByProjectDirectoryMethod,
  getCompactionSummaries as getCompactionSummariesMethod,
  getMostRecentCompactionSummary as getMostRecentCompactionSummaryMethod,
  addCompactionSummary as addCompactionSummaryMethod,
  getMessagesForSummary as getMessagesForSummaryMethod,
} from './methods';
import { LogType } from '@baby-panda/types';

function wrapWithSQLSafeExecutor<TArgs extends readonly unknown[], TResult>(
  method: (...args: TArgs) => Promise<TResult>,
) {
  try {
    return (...args: TArgs) => SQLSafeExecutor(method, args);
  } catch (err) {
    writeLogs(LogType.db, getProjectName(), 'common', `${err}`);
  }
}

export { SQLSafeExecutor };
export const createSession = wrapWithSQLSafeExecutor(createSessionMethod);
export const createMessage = wrapWithSQLSafeExecutor(createMessageMethod);
export const getMessages = wrapWithSQLSafeExecutor(getMessagesMethod);
export const getMessagesAfterTimestamp = wrapWithSQLSafeExecutor(getMessagesAfterTimestampMethod);
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
export const addCompactionSummary = wrapWithSQLSafeExecutor(addCompactionSummaryMethod);
export const getMessagesForSummary = wrapWithSQLSafeExecutor(getMessagesForSummaryMethod);
