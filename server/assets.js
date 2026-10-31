/** Append a version query to relative ES module specifiers so a deploy cannot reuse cached files. */
export function bustModuleSpecifiers(code, version) {
  const stamp = String(version || '').replace(/[^a-z0-9]/gi, '');
  if (!stamp) return String(code || '');
  return String(code || '').replace(
    /((?:import|export)\s+(?:[\s\S]*?\sfrom\s+)?)(['"])(\.\.?\/[^'"]+?)\2/g,
    (full, lead, quote, spec) => {
      if (/[?#]/.test(spec)) return full;
      return `${lead}${quote}${spec}?v=${stamp}${quote}`;
    },
  );
}
