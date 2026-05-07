const bannedWords = ["violence", "hate", "suicide"]; 

export const containsSensitiveContent = (text: string): boolean => {
  const lower = text.toLowerCase();

  return bannedWords.some((word) => lower.includes(word));
};