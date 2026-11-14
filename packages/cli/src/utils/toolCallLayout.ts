import type {ToolCallBatch, ToolCallEntry, ToolCallStatus} from '../types';
import {
	buildBullets,
	bulletTargetMax,
	combineStatus,
	type BulletView,
} from './toolCallBullets';
import type {UnifiedDiff} from './diffRows';
import {buildCallDiff, buildDiffSummary} from './toolCallDiff';
import {splitTruncated, wrapText} from './formatLink';

export type LayoutRow =
	| {type: 'root'; status: ToolCallStatus; callCount: number}
	| {type: 'bullet'; bullet: BulletView}
	| {type: 'error'; bullet: BulletView}
	| {type: 'diff'; call: ToolCallEntry; diff: UnifiedDiff; indent: number}
	| {type: 'command'; bullet: BulletView; line: string};

export interface ToolCallLayout {
	rows: LayoutRow[];
	/** Height when collapsed: the root line, or the lone bullet. */
	collapsedHeight: number;
	/** Full content height when expanded (before the chatHeight cap). */
	expandedFullHeight: number;
	/** Height actually used: expanded ? min(full, chatHeight) : collapsed. */
	height: number;
	bullets: BulletView[];
	/**
	 * True when the batch renders a `■ N tools` root above its bullets. A
	 * single-call batch flattens to a lone `●` with no root.
	 */
	hasRoot: boolean;
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

/** What a left-click on a tool-call row should do. */
export type RowClickAction =
	| {type: 'toggleGroup'}
	| {type: 'toggleDiff'; callId: string}
	| {type: 'toggleCommand'; key: string}
	| {type: 'ignore'};

/**
 * Resolves a left-click on content line `line` of a tool-call block.
 *
 * Only a row's own interactive line acts on it. A diff viewer toggles from its
 * header line alone, so clicking the diff text — which is most of the viewer —
 * never collapses it; the user has to click the bullet or the `± path` header
 * again.
 *
 * `hasRoot` tells a root-level bullet (a single-call batch, which has no root
 * to click) apart from a child bullet inside a batch: the former toggles its
 * own detail, the latter has nothing of its own to toggle.
 */
export function resolveRowClick(
	span: LayoutRowSpan | undefined,
	line: number,
	hasRoot: boolean,
): RowClickAction {
	if (!span) return {type: 'ignore'};
	const row = span.row;
	if (row.type === 'root') {
		return {type: 'toggleGroup'};
	}
	if (row.type === 'bullet') {
		if (row.bullet.hasDiff) {
			return {type: 'toggleDiff', callId: row.bullet.diffCallIds[0]!};
		}
		if (row.bullet.expandable) {
			return {type: 'toggleCommand', key: row.bullet.key};
		}
		return hasRoot ? {type: 'ignore'} : {type: 'toggleGroup'};
	}
	if (row.type === 'diff') {
		return line === span.start
			? {type: 'toggleDiff', callId: row.call.id}
			: {type: 'ignore'};
	}
	if (row.type === 'command') {
		return {type: 'toggleCommand', key: row.bullet.key};
	}
	return {type: 'ignore'};
}

/**
 * Gap between a bullet's own indent and its expanded command continuation
 * lines (must match the renderer).
 */
export const COMMAND_GAP = 3;

export interface ToolCallLayoutOptions {
	expanded: boolean;
	isDiffExpanded: (callId: string) => boolean;
	isCommandExpanded: (bulletKey: string) => boolean;
	chatHeight: number;
	/** Content width available to the message. */
	width: number;
}

/** Cap for one expanded diff viewer (header + body), per design. */
export function maxDiffHeight(chatHeight: number): number {
	return Math.max(3, chatHeight - 8);
}

function diffHeight(
	diff: UnifiedDiff,
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
 *
 * A batch of one call renders as a lone bullet with no root; a batch of
 * several renders a `■ N tools` root that folds the whole batch away.
 */
export function buildToolCallLayout(
	batch: ToolCallBatch,
	options: ToolCallLayoutOptions,
): ToolCallLayout {
	const {expanded, isDiffExpanded, isCommandExpanded, chatHeight, width} =
		options;
	const bullets = buildBullets(batch.calls);
	// Root is decided by call count, not bullet count: one get_web_page call
	// asking for several URLs becomes several bullets, and `■ 1 tool` must
	// never appear — a single-call batch flattens to root-level bullets.
	const hasRoot = batch.calls.length > 1;
	const rows: LayoutRow[] = [];

	const appendBullets = (withDetails: boolean) => {
		for (const bullet of bullets) {
			rows.push({type: 'bullet', bullet});
			if (!withDetails) continue;
			if (bullet.error) {
				rows.push({type: 'error', bullet});
			}
			if (bullet.expandable && isCommandExpanded(bullet.key)) {
				const targetMax = bulletTargetMax(bullet, width);
				const {rest} = splitTruncated(bullet.target, targetMax);
				const commandIndent = bullet.indent + COMMAND_GAP;
				const wrapWidth = Math.max(1, width - commandIndent);
				for (const line of wrapText(rest, wrapWidth)) {
					rows.push({type: 'command', bullet, line});
				}
			}
			for (const callId of bullet.diffCallIds) {
				const call = batch.calls.find(item => item.id === callId);
				if (!call) continue;
				const diffExpanded = isDiffExpanded(callId);
				rows.push({
					type: 'diff',
					call,
					indent: bullet.indent,
					diff: diffExpanded ? buildCallDiff(call) : buildDiffSummary(call),
				});
			}
		}
	};

	if (hasRoot) {
		rows.push({
			type: 'root',
			status: combineStatus(batch.calls.map(call => call.status)),
			callCount: batch.calls.length,
		});
		if (expanded) appendBullets(true);
	} else {
		appendBullets(expanded);
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
		: collapsedHeight;

	return {
		rows,
		collapsedHeight,
		expandedFullHeight,
		height,
		bullets,
		hasRoot,
		rowSpans,
	};
}
