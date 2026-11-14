/**
 * Label of the status-bar activity indicator, shown next to the shared
 * braille spinner whenever the agent is mid-run. Compaction wins over a
 * pending permission (both only occur mid-run, and compaction is the rarer,
 * more specific state); the caller renders nothing at all when idle.
 */
export function activityLabel(
	compacting: boolean,
	permissionPending: boolean,
): string {
	if (compacting) return 'Compacting';
	if (permissionPending) return 'Awaiting permission';
	return 'Responding';
}
