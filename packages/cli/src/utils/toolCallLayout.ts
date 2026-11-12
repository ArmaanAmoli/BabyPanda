import type {ToolCallBatch, ToolCallEntry} from '../types';
import {
	buildBullets,
	bulletTargetMax,
	type BulletView,
} from './toolCallBullets';
import type {SideBySideDiff} from './diffRows';
import {buildCallDiff, buildDiffSummary} from './toolCallDiff';
import {splitTruncated, wrapText} from './formatLink';

export type LayoutRow =
	| {type: 'header'}
	| {type: 'bullet'; bullet: BulletView}
	| {type: 'error'; bullet: BulletView}
	| {type: 'diff'; call: ToolCallEntry; diff: SideBySideDiff}
	| {type: 'command'; bullet: BulletView; line: string}
	| {type: 'overflowHint'};

export interface ToolCallLayout {
	rows: LayoutRow[];
	/** Height when collapsed: min(5, content). */
	collapsedHeight: number;
	/** Full content height when expanded (before the chatHeight cap). */
	expandedFullHeight: number;
	/** Height actually used: expanded ? min(full, chatHeight) : collapsed. */
	height: number;
	bullets: BulletView[];
	/**
	 * Content-line span of every entry in `rows`. A diff row occupies as many
	 * lines as its viewer renders, so a terminal row cannot be used directly
	 * as an index into `rows`.
	 */
	rowSpans: LayoutRowSpan[];
}

/** Content-line span of one layout row. */
export interface LayoutRowSpan {
	/** Index into `ToolCallLayout.rows`. */
	index: number;
	/** The row this span belongs to. */
	row: LayoutRow;
	/** First content line (0-based) the row occupies. */
	start: number;
	/** Number of content lines the row occupies. */
	lines: number;
}

/** Maps a content line back to the row that occupies it. */
export function rowSpanAtLine(
	spans: LayoutRowSpan[],
	line: number,
): LayoutRowSpan | undefined {
	for (const span of spans) {
		if (line >= span.start && line < span.start + span.lines) return span;
	}
	return undefined;
}

export const COLLAPSED_MAX_ROWS = 5;
export const COLLAPSED_MAX_BULLETS = 3;

/** Left indent of expanded command continuation lines (must match the renderer). */
export const COMMAND_INDENT = 5;

export interface ToolCallLayoutOptions {
	expanded: boolean;
	isDiffExpanded: (callId: string) => boolean;
	isCommandExpanded: (bulletKey: string) => boolean;
	chatHeight: number;
	/** Content width available to the message (marker column excluded). */
	width: number;
}

/** Cap for one expanded diff viewer (header + body), per design. */
export function maxDiffHeight(chatHeight: number): number {
	return Math.max(3, chatHeight - 8);
}

function diffHeight(
	diff: SideBySideDiff,
	expanded: boolean,
	chatHeight: number,
): number {
	if (!expanded) return 1;
	return Math.min(diff.rows.length + 1, maxDiffHeight(chatHeight));
}

/** Content lines one layout row occupies (only diff rows are ever taller). */
function rowLineCount(
	row: LayoutRow,
	isDiffExpanded: (callId: string) => boolean,
	chatHeight: number,
): number {
	if (row.type === 'diff') {
		return diffHeight(row.diff, isDiffExpanded(row.call.id), chatHeight);
	}
	return 1;
}

/**
 * Computes the row layout of a ToolCallMessage. The same layout drives both
 * the rendered component and the ChatBox item height, so they can never
 * disagree. Side-by-side rows are only built for expanded diffs (a collapsed
 * one still carries its real added/removed counts for the header); expanded
 * shell commands add one row per wrapped continuation line of the command
 * that was cut off by the bullet's '…'.
 */
export function buildToolCallLayout(
	batch: ToolCallBatch,
	options: ToolCallLayoutOptions,
): ToolCallLayout {
	const {expanded, isDiffExpanded, isCommandExpanded, chatHeight, width} =
		options;
	const bullets = buildBullets(batch.calls);
	const rows: LayoutRow[] = [{type: 'header'}];
	const visibleBullets = expanded
		? bullets
		: bullets.slice(0, COLLAPSED_MAX_BULLETS);

	for (const bullet of visibleBullets) {
		rows.push({type: 'bullet', bullet});
		if (expanded && bullet.error) {
			rows.push({type: 'error', bullet});
		}
		if (expanded && bullet.expandable && isCommandExpanded(bullet.key)) {
			const targetMax = bulletTargetMax(bullet, width);
			const {rest} = splitTruncated(bullet.target, targetMax);
			const wrapWidth = Math.max(1, width - COMMAND_INDENT);
			for (const line of wrapText(rest, wrapWidth)) {
				rows.push({type: 'command', bullet, line});
			}
		}
		if (expanded) {
			for (const callId of bullet.diffCallIds) {
				const call = batch.calls.find(item => item.id === callId);
				if (!call) continue;
				const diffExpanded = isDiffExpanded(callId);
				rows.push({
					type: 'diff',
					call,
					diff: diffExpanded ? buildCallDiff(call) : buildDiffSummary(call),
				});
			}
		}
	}
	if (!expanded && bullets.length > COLLAPSED_MAX_BULLETS) {
		rows.push({type: 'overflowHint'});
	}

	const collapsedHeight = rows.length;
	const rowSpans: LayoutRowSpan[] = [];
	let contentLines = 0;
	for (const [index, row] of rows.entries()) {
		const lines = rowLineCount(row, isDiffExpanded, chatHeight);
		rowSpans.push({index, row, start: contentLines, lines});
		contentLines += lines;
	}
	const expandedFullHeight = expanded ? contentLines : 0;

	const height = expanded
		? Math.min(expandedFullHeight, Math.max(1, chatHeight))
		: Math.min(COLLAPSED_MAX_ROWS, collapsedHeight);

	return {
		rows,
		collapsedHeight: Math.min(COLLAPSED_MAX_ROWS, collapsedHeight),
		expandedFullHeight,
		height,
		bullets,
		rowSpans,
	};
}
