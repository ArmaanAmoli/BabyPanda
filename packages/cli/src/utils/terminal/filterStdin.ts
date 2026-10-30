import {PassThrough} from 'node:stream';
import {
	parseMouseEvent,
	isIncompleteMouseSequence,
	type MouseEvent,
} from './mouse';
import {ESC} from './input';
import type {ReadStream} from 'node:tty';

export class FilteredStdin extends PassThrough {
	private buffer = '';

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

			this.push(Buffer.from(this.buffer[0]));
			this.buffer = this.buffer.slice(1);
		}
	}
}
