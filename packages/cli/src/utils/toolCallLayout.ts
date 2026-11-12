import type {ToolCallBatch, ToolCallEntry} from '../types';
import {
	buildBullets,
	bulletTargetMax,
	type BulletView,
} from './toolCallBullets';
import {
	buildSideBySide,
	computeAfterContent,
	countDiffChanges,
	type SideBySideDiff,
} from './diffRows';
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

function beforeAfterContent(call: ToolCallEntry): {
	before: string;
	after: string;
} {
	return {
		before: call.before ?? '',
		after: computeAfterContent(call.name, call.before ?? null, call.arguments),
	};
}

function buildDiff(call: ToolCallEntry): SideBySideDiff {
	const {before, after} = beforeAfterContent(call);
	return buildSideBySide(before, after);
}

/**
 * Header-only diff for a collapsed viewer: the real added/removed counts
 * without building the side-by-side rows, which are not rendered yet.
 */
function buildDiffSummary(call: ToolCallEntry): SideBySideDiff {
	const {before, after} = beforeAfterContent(call);
	const {added, removed} = countDiffChanges(before, after);
	return {rows: [], firstChangeIndex: 0, added, removed};
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
					diff: diffExpanded ? buildDiff(call) : buildDiffSummary(call),
				});
			}
		}
	}
	if (!expanded && bullets.length > COLLAPSED_MAX_BULLETS) {
		rows.push({type: 'overflowHint'});
	}

	const collapsedHeight = rows.length;
	let expandedFullHeight = 0;
	if (expanded) {
		expandedFullHeight = rows.reduce((total, row) => {
			if (row.type === 'diff') {
				return (
					total + diffHeight(row.diff, isDiffExpanded(row.call.id), chatHeight)
				);
			}
			return total + 1;
		}, 0);
	}

	const height = expanded
		? Math.min(expandedFullHeight, Math.max(1, chatHeight))
		: Math.min(COLLAPSED_MAX_ROWS, collapsedHeight);

	return {
		rows,
		collapsedHeight: Math.min(COLLAPSED_MAX_ROWS, collapsedHeight),
		expandedFullHeight,
		height,
		bullets,
	};
}
