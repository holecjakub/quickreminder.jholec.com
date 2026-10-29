/** A length in points of the fake 1512 × 982 pt screen; `--pt` scales the scene. */
export function px(pt: number): string {
  return `calc(${pt} * var(--pt) * 1px)`;
}
