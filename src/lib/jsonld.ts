/**
 * Safe JSON-LD serialization for `<script type="application/ld+json" set:html>`.
 *
 * `JSON.stringify` does not escape `<`, so a content string containing
 * `</script>` (or `<!--`) could break out of the script element. We escape the
 * three characters that matter inside a <script> context to `\uXXXX` — still
 * valid JSON, but inert as markup. Defense-in-depth: our schema data is
 * author-owned, but this removes the entire injection class regardless of what
 * content lands in a product name or blog title.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
