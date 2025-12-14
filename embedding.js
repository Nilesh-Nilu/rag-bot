// Simple TF-IDF style text processing (no embedding model needed)

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

function termFrequency(tokens) {
  const freq = {};
  for (const token of tokens) {
    freq[token] = (freq[token] || 0) + 1;
  }
  return freq;
}

export function getTextVector(text) {
  const tokens = tokenize(text);
  return termFrequency(tokens);
}

export function cosineSimilarity(vec1, vec2) {
  const allTerms = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  for (const term of allTerms) {
    const v1 = vec1[term] || 0;
    const v2 = vec2[term] || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  }
  
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}
