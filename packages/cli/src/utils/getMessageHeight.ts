import type {CleanedMessage} from '@baby-panda/types';

export const PADDING_MESSAGE_BOX = 1;
export const MARGIN_TOP_MESSAGE_BOX = 1;

export function getMessageHeight(message: CleanedMessage) {
	const {content} = message;
	const lines = content.split('\n').length;
	// lines + margin + 2*padding
	const height = lines + MARGIN_TOP_MESSAGE_BOX + 2 * PADDING_MESSAGE_BOX;
	return height;
	/*
    margin
    padding
    msg1......
    padding
    ---------
    margin
    padding
    msg2
    padding
    */
}
