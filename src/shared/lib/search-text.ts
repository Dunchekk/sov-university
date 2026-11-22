const stopWords = new Set([
  "в",
  "во",
  "и",
  "к",
  "на",
  "о",
  "об",
  "от",
  "по",
  "с",
  "со",
  "из",
  "за",
  "для",
]);
const russianEnding =
  /(?:иями|ями|ами|ого|ему|ому|ыми|ими|иях|ях|ах|ией|ие|ия|ии|ый|ий|ой|ая|яя|ое|ее|ую|юю|ых|их|ом|ем|ам|ям|ов|ев|ей|а|я|ы|и|у|ю|е|о)$/u;

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function stem(word: string) {
  if (!/^[а-я]{5,}$/u.test(word)) return word;
  const root = word.replace(russianEnding, "");
  return root.length >= 4 ? root : word;
}

export function searchQuery(value: string) {
  const term = value.trim().slice(0, 80);
  const phrase = normalize(term);
  const words = phrase.split(" ").filter(Boolean);
  const significant = words.filter((word) => !stopWords.has(word));
  return {
    term,
    phrase,
    words: [...new Set(significant.length ? significant : words)].slice(0, 8),
  };
}

export type SearchQuery = ReturnType<typeof searchQuery>;

export function searchPrefixes(word: string) {
  const root = stem(word);
  return [
    root,
    ...Array.from(root, (letter, index) =>
      letter === "е" ? `${root.slice(0, index)}ё${root.slice(index + 1)}` : "",
    )
      .filter(Boolean)
      .slice(0, 4),
  ];
}

function oneEditAway(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 1) return false;
  if (left.length > right.length) return oneEditAway(right, left);
  let i = 0;
  while (i < left.length && left[i] === right[i]) i++;
  if (left.length !== right.length) return left.slice(i) === right.slice(i + 1);
  return (
    left.slice(i + 1) === right.slice(i + 1) ||
    (left[i] === right[i + 1] &&
      left[i + 1] === right[i] &&
      left.slice(i + 2) === right.slice(i + 2))
  );
}

function wordScore(query: string, word: string, fuzzy: boolean) {
  if (word === query) return 12;
  if (word.startsWith(query)) return 10;
  if (stem(word).startsWith(stem(query))) return 8;
  if (fuzzy && query.length >= 5 && oneEditAway(query, word)) return 3;
  return 0;
}

export function searchScore(
  query: SearchQuery,
  title: string,
  aliases: readonly string[] = [],
  detail = "",
  fuzzy = false,
) {
  if (!query.words.length) return 0;
  const labels = [title, ...aliases].map(normalize);
  let phraseScore = 0;
  for (const [index, label] of labels.entries()) {
    const weight = index === 0 ? 2 : 0;
    if (label === query.phrase)
      phraseScore = Math.max(phraseScore, 80 + weight);
    else if (label.startsWith(query.phrase))
      phraseScore = Math.max(phraseScore, 58 + weight);
    else if (` ${label}`.includes(` ${query.phrase}`))
      phraseScore = Math.max(phraseScore, 44 + weight);
  }
  const titleWords = labels.flatMap((label) => label.split(" "));
  const detailWords = normalize(detail).split(" ");
  let total = 0;
  for (const word of query.words) {
    const best = Math.max(
      0,
      ...titleWords.map((candidate) => wordScore(word, candidate, fuzzy)),
      ...detailWords.map((candidate) =>
        Math.max(0, wordScore(word, candidate, false) - 6),
      ),
    );
    if (!best) return 0;
    total += best;
  }
  return phraseScore + total / query.words.length;
}
