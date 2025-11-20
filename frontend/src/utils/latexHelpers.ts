/**
 * Utilities for handling LaTeX and mathematical notation
 */

/**
 * Detect if text likely contains LaTeX that's missing backslashes
 * Common patterns: "imes" should be "\times", "Sigma" should be "\Sigma", etc.
 */
export const detectMissingBackslashes = (text: string): boolean => {
  const patterns = [
    /\bimes\b/i,           // times
    /\bfrac\b/i,           // frac
    /\bsqrt\b/i,           // sqrt
    /\bsum\b/i,            // sum (might be intentional word)
    /\bint\b/i,            // int (might be intentional word)
    /\bbegin\{/i,          // begin{
    /\bend\{/i,            // end{
    /\b(alpha|beta|gamma|delta|theta|lambda|mu|sigma)\b/i,  // Greek letters
  ]

  return patterns.some(pattern => pattern.test(text))
}

/**
 * Auto-fix common LaTeX issues where backslashes are missing
 */
export const autoFixLatex = (text: string): string => {
  return text
    // Common LaTeX commands that might be missing backslashes
    .replace(/([^\\])times\b/g, '$1\\times')
    .replace(/^times\b/g, '\\times')
    .replace(/([^\\])div\b/g, '$1\\div')
    .replace(/^div\b/g, '\\div')
    .replace(/([^\\])frac\{/g, '$1\\frac{')
    .replace(/^frac\{/g, '\\frac{')
    .replace(/([^\\])sqrt\{/g, '$1\\sqrt{')
    .replace(/^sqrt\{/g, '\\sqrt{')
    .replace(/([^\\])begin\{/g, '$1\\begin{')
    .replace(/^begin\{/g, '\\begin{')
    .replace(/([^\\])end\{/g, '$1\\end{')
    .replace(/^end\{/g, '\\end{')
    
    // Greek letters (be careful with actual words)
    // Only fix if they're likely LaTeX (inside $ or followed by specific patterns)
    .replace(/\$([^$]*[^\\])(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)([^a-z]|$)/gi, 
      (match, before, letter, after) => `$${before}\\${letter}${after}`)
    .replace(/\$([^$]*[^\\])(Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega)([^a-z]|$)/g,
      (match, before, letter, after) => `$${before}\\${letter}${after}`)
}

/**
 * Validate if LaTeX syntax is likely correct
 */
export const validateLatex = (text: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  // Check for unmatched $
  const inlineMathMatches = text.match(/\$/g)
  if (inlineMathMatches && inlineMathMatches.length % 2 !== 0) {
    errors.push('Unmatched $ delimiter for inline math')
  }
  
  // Check for unmatched $$
  const displayMathMatches = text.match(/\$\$/g)
  if (displayMathMatches && displayMathMatches.length % 2 !== 0) {
    errors.push('Unmatched $$ delimiter for display math')
  }
  
  // Check for unmatched braces within math
  const mathSections = text.match(/\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$/g) || []
  mathSections.forEach((math, idx) => {
    const openBraces = (math.match(/\{/g) || []).length
    const closeBraces = (math.match(/\}/g) || []).length
    if (openBraces !== closeBraces) {
      errors.push(`Math expression ${idx + 1}: Unmatched braces ({ vs })`)
    }
  })
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Format LaTeX for display (add proper spacing, line breaks)
 */
export const formatLatexForDisplay = (text: string): string => {
  return text
    .replace(/\\\\/g, '\n') // Convert \\ to actual line breaks for display mode
    .trim()
}

