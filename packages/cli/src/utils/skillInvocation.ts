/**
 * Splits the tokens that follow `/<skill-name>` into the skill's declared
 * positional arguments and the leftover user message. A skill declares its
 * arguments in its SKILL.md frontmatter (`arguments: name type`), so only the
 * first `argumentCount` tokens belong to the skill; everything after them is
 * the user's actual message and must travel separately, once the skill has
 * loaded.
 */
export function splitSkillInvocation(
	tokens: string[],
	argumentCount: number,
): {args: string; message: string} {
	const count = Math.max(0, argumentCount);
	return {
		args: tokens.slice(0, count).join(' '),
		message: tokens.slice(count).join(' '),
	};
}
