import {PassThrough} from 'node:stream';
import {
	parseMouseEvent,
	isIncompleteMouseSequence,
	type MouseEvent,
} from './mouse';
import {ESC, PASTE_START, PASTE_END, isPasteStartPrefix} from './input';
import type {ReadStream} from 'node:tty';

/**
 * Terminals send CR (or CRLF) for newlines inside a pasted block, while the
 * editor model is LF-only. Normalizing here — the single choke point every
 * pasted byte passes through — means no consumer can ever observe a carriage
 * return, and none of them has to remember to strip one.
 */
function normalizeNewlines(text: string): string {
	return text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

export class FilteredStdin extends PassThrough {
	private buffer = '';

	/**
	 * Non-null while a bracketed paste is open. The body is accumulated here so
	 * the whole paste can be emitted as one chunk: the OS splits a large paste
	 * across several reads, and emitting each read separately would turn one
	 * paste into several inserts.
	 */
	private pasteBody: string | null = null;

	private readonly mouseListeners = new Set<(event: MouseEvent) => void>();

	private readonly onData = (chunk: Buffer | string) => {
		this.process(chunk.toString());
	};

	private readonly onEnd = () => {
		this.end();
	};

	public constructor(private readonly source: ReadStream) {
		super();

		source.on('data', this.onData);

		source.on('end', this.onEnd);
	}

	public dispose() {
		this.source.off('data', this.onData);
		this.source.off('end', this.onEnd);
	}

	public get isTTY() {
		return this.source.isTTY;
	}

	public get isRaw() {
		return this.source.isRaw;
	}

	public setRawMode(mode: boolean) {
		this.source.setRawMode(mode);
		return this;
	}

	public ref() {
		this.source.ref();
		return this;
	}

	public unref() {
		this.source.unref();
		return this;
	}

	public destroySoon() {
		this.destroy();
	}

	public onMouse(listener: (event: MouseEvent) => void) {
		this.mouseListeners.add(listener);

		return () => {
			this.mouseListeners.delete(listener);
		};
	}

	private process(data: string) {
		this.buffer += data;

		while (this.buffer.length > 0) {
			// A paste is open: swallow everything up to its end marker, then
			// emit the whole body at once.
			if (this.pasteBody !== null) {
				const endIndex = this.buffer.indexOf(PASTE_END);

				if (endIndex === -1) {
					this.pasteBody += this.buffer;
					this.buffer = '';
					break;
				}

				this.pasteBody += this.buffer.slice(0, endIndex);
				this.buffer = this.buffer.slice(endIndex + PASTE_END.length);
				this.emitPaste(this.pasteBody);
				this.pasteBody = null;
				continue;
			}

			const parsed = parseMouseEvent(this.buffer);

			if (parsed) {
				for (const listener of this.mouseListeners) {
					listener(parsed.event);
				}

				this.buffer = this.buffer.slice(parsed.length);
				continue;
			}

			if (isIncompleteMouseSequence(this.buffer)) {
				break;
			}

			const pasteStartIndex = this.buffer.indexOf(PASTE_START);

			if (pasteStartIndex === -1) {
				const escapeIndex = this.buffer.indexOf(ESC);

				if (escapeIndex === -1) {
					this.push(Buffer.from(this.buffer));
					this.buffer = '';
					break;
				}

				if (escapeIndex > 0) {
					this.push(Buffer.from(this.buffer.slice(0, escapeIndex)));
					this.buffer = this.buffer.slice(escapeIndex);
					continue;
				}

				// The buffer opens with ESC but is neither a mouse sequence nor
				// a complete paste start. It may still become one once the rest
				// of the marker arrives, so wait rather than leak the bytes as
				// literal text.
				if (isPasteStartPrefix(this.buffer)) {
					break;
				}

				this.push(Buffer.from(this.buffer[0]));
				this.buffer = this.buffer.slice(1);
				continue;
			}

			if (pasteStartIndex > 0) {
				this.push(Buffer.from(this.buffer.slice(0, pasteStartIndex)));
				this.buffer = this.buffer.slice(pasteStartIndex);
				continue;
			}

			this.pasteBody = '';
			this.buffer = this.buffer.slice(PASTE_START.length);
		}
	}

	private emitPaste(body: string) {
		if (body.length === 0) return;

		this.push(Buffer.from(normalizeNewlines(body)));
	}
}
