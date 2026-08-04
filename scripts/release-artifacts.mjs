export function formatArchiveInventory(entries) {
  return `${[...entries].sort((left, right) => left.localeCompare(right, 'en')).join('\n')}\n`;
}

export function formatSha256Sums(records) {
  return [...records]
    .sort((left, right) => left.filename.localeCompare(right.filename, 'en'))
    .map(({ digest, filename }) => `${digest}  ${filename}\n`)
    .join('');
}
