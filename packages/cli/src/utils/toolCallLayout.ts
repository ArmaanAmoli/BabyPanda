import type {ToolCallBatch, ToolCallEntry} from '../types';
import {buildBullets, type BulletView} from './toolCallBullets';
import {
	buildSideBySide,
	computeAfterContent,
	type SideBySideDiff,
} from './diffRows';

export type LayoutRow =
	| {type: 'header'}
	| {type: 'bullet'; bullet: BulletView}
	| {type: 'error'; bullet: BulletView}
	| {type: 'diff'; call: ToolCallEntry; diff: SideBySideDiff}
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

function buildDiff(call: ToolCallEntry): SideBySideDiff {
	const before = call.before ?? '';
	const after = computeAfterContent(
		call.name,
		call.before ?? null,
		call.arguments,
	);
	return buildSideBySide(before, after);
}

/**
 * Computes the row layout of a ToolCallMessage. The same layout drives both
 * the rendered component and the ChatBox item height, so they can never
 * disagree. Diff row counts are only computed for expanded diffs.
 */
export function buildToolCallLayout(
	batch: ToolCallBatch,
	expanded: boolean,
	isDiffExpanded: (callId: string) => boolean,
	chatHeight: number,
): ToolCallLayout {
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
		if (expanded) {
			for (const callId of bullet.diffCallIds) {
				const call = batch.calls.find(item => item.id === callId);
				if (!call) continue;
				const diffExpanded = isDiffExpanded(callId);
				rows.push({
					type: 'diff',
					call,
					diff: diffExpanded ? buildDiff(call) : EMPTY_DIFF,
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

const EMPTY_DIFF: SideBySideDiff = {
	rows: [],
	firstChangeIndex: 0,
	added: 0,
	removed: 0,
};
