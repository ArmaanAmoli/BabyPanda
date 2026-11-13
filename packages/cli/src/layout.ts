/**
 * Layout constants shared by the app shell and its components.
 *
 * These live apart from the app component so a component can size itself
 * without importing the whole app module graph (which reaches the server and
 * the database).
 */

/** Horizontal padding the app applies to its main column. */
export const PADDING_APP = 2;

/** Blank rows between the chat area and the prompt box. */
export const GAP_CHAT_BOX_PROMPT_BOX = 1;
