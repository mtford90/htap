/**
 * Line matching for the text pager's less-style search.
 */

/** Zero-based indices of the lines containing the needle, ignoring case. */
export const matchingLineIndices = (text: string, needle: string): number[] => {
  if (!needle) {
    return [];
  }
  const lower = needle.toLowerCase();
  return text.split("\n").reduce<number[]>((indices, line, index) => {
    if (line.toLowerCase().includes(lower)) {
      indices.push(index);
    }
    return indices;
  }, []);
};
