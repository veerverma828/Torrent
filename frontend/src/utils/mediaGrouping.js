export function groupByGenre(
  items,
  { maxGenres = 6, maxPerGenre = 20, minItemsPerGenre = 4 } = {}
) {
  const byGenre = new Map();

  for (const item of items) {
    for (const genre of item.genres || []) {
      if (!byGenre.has(genre)) byGenre.set(genre, []);
      byGenre.get(genre).push(item);
    }
  }

  return [...byGenre.entries()]
    .filter(([, list]) => list.length >= minItemsPerGenre)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxGenres)
    .map(([genre, list]) => ({
      genre,
      items: list.slice(0, maxPerGenre),
    }));
}
