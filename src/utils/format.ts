/**
 * Format large numbers to human-readable format
 */
export function formatAmount(amount: any): string {
  // Ensure amount is a number
  const numAmount = typeof amount === "number" ? amount : parseFloat(amount);

  // Check if conversion resulted in a valid number
  if (isNaN(numAmount)) {
    return "0.00";
  }

  if (numAmount >= 1_000_000_000) {
    return `${(numAmount / 1_000_000_000).toFixed(2)}B`;
  } else if (numAmount >= 1_000_000) {
    return `${(numAmount / 1_000_000).toFixed(2)}M`;
  } else if (numAmount >= 1_000) {
    return `${(numAmount / 1_000).toFixed(1)}K`;
  } else {
    return numAmount.toFixed(2);
  }
}

/**
 * Parse formatted amount string back to number
 * Examples: '$131.7K' -> 131700, '$1.13M' -> 1130000
 */
export function parseFormattedAmount(formattedAmount: string): number {
  if (!formattedAmount) return 0;

  // Remove currency symbol and any commas
  let cleanedStr = formattedAmount.replace(/[$,]/g, "").trim();

  // Extract the numeric part and the suffix
  const match = cleanedStr.match(/^([\d.]+)([KMB])?$/i);
  if (!match) return parseFloat(cleanedStr) || 0;

  const [, numPart, suffix] = match;
  const baseValue = parseFloat(numPart);

  if (isNaN(baseValue)) return 0;

  // Apply multiplier based on suffix
  if (suffix === "K" || suffix === "k") {
    return baseValue * 1_000;
  } else if (suffix === "M" || suffix === "m") {
    return baseValue * 1_000_000;
  } else if (suffix === "B" || suffix === "b") {
    return baseValue * 1_000_000_000;
  }

  return baseValue;
}
