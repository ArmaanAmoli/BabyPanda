import {PassThrough} from 'node:stream';
import {
	parseMouseEvent,
	isIncompleteMouseSequence,
	type MouseEvent,
} from './mouse';
import {ESC} from './input';

export class FilteredStdin extends PassThrough {
	private buffer = '';

	private readonly mouseListeners = new Set<(event: MouseEvent) => void>();

	constructor(input: NodeJS.ReadableStream) {
		super();

		input.on('data', chunk => {
			this.process(chunk.toString());
		});

		input.on('end', () => {
			this.end();
		});
	}

	onMouse(listener: (event: MouseEvent) => void) {
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
