function decodeJsonStringPrefix(raw: string): string {
  for (let end = raw.length; end >= 0; end -= 1) {
    try {
      return JSON.parse(`"${raw.slice(0, end)}"`) as string;
    } catch {
      // The stream may end in an incomplete escape sequence.
    }
  }
  return '';
}

export function extractStreamingField(text: string, field: 'answer' | 'thought'): string {
  const marker = `"${field}"`;
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) return '';

  let valueStart = markerIndex + marker.length;
  while (/\s/.test(text[valueStart] ?? '')) valueStart += 1;
  if (text[valueStart] !== ':') return '';

  valueStart += 1;
  while (/\s/.test(text[valueStart] ?? '')) valueStart += 1;
  if (text[valueStart] !== '"') return '';

  const rawStart = valueStart + 1;
  let escaped = false;
  for (let index = rawStart; index < text.length; index += 1) {
    const character = text[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === '"') {
      return decodeJsonStringPrefix(text.slice(rawStart, index));
    }
  }

  return decodeJsonStringPrefix(text.slice(rawStart));
}
