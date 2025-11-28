import { Question } from "@/lib/api";

export const QUESTION_TYPES: Array<{ label: string; value: Question['type'] }> = [
  { label: 'Single Choice (MCQ)', value: 'mcq_single' },
  { label: 'Multiple Choice (MSQ)', value: 'mcq_multi' },
  { label: 'True / False', value: 'true_false' },
  { label: 'Numeric Answer', value: 'numeric' },
  { label: 'Descriptive', value: 'descriptive' }
]

export const LATEX_TEMPLATES = [
  { symbol: 'x²', latex: 'x^{2}', label: 'Superscript/Power' },
  { symbol: 'x₂', latex: 'x_{2}', label: 'Subscript' },
  { symbol: '½', latex: '\\frac{1}{2}', label: 'Fraction' },
  { symbol: '[  ]', latex: '\\begin{bmatrix} a & b \\\\\\\\ c & d \\\\end{bmatrix}', label: '2x2 Matrix' },
]

export const MATH_SYMBOLS = [
  { symbol: 'α', latex: '\\alpha', label: 'Alpha' },
  { symbol: 'β', latex: '\\beta', label: 'Beta' },
  { symbol: 'γ', latex: '\\gamma', label: 'Gamma' },
  { symbol: 'δ', latex: '\\delta', label: 'Delta' },
  { symbol: 'θ', latex: '\\theta', label: 'Theta' },
  { symbol: 'λ', latex: '\\lambda', label: 'Lambda' },
  { symbol: 'μ', latex: '\\mu', label: 'Mu' },
  { symbol: 'σ', latex: '\\sigma', label: 'Sigma' },
  { symbol: 'Σ', latex: '\\Sigma', label: 'Sigma (capital)' },
  { symbol: 'π', latex: '\\pi', label: 'Pi' },
  { symbol: 'Δ', latex: '\\Delta', label: 'Delta (capital)' },
  { symbol: 'Ω', latex: '\\Omega', label: 'Omega' },
  { symbol: '∞', latex: '\\infty', label: 'Infinity' },
  { symbol: '√', latex: '\\sqrt{}', label: 'Square root' },
  { symbol: '∫', latex: '\\int', label: 'Integral' },
  { symbol: '∑', latex: '\\sum', label: 'Summation' },
  { symbol: '≤', latex: '\\leq', label: 'Less or equal' },
  { symbol: '≥', latex: '\\geq', label: 'Greater or equal' },
  { symbol: '≠', latex: '\\neq', label: 'Not equal' },
  { symbol: '≈', latex: '\\approx', label: 'Approximately' },
  { symbol: '×', latex: '\\times', label: 'Times' },
  { symbol: '÷', latex: '\\div', label: 'Division' },
  { symbol: '±', latex: '\\pm', label: 'Plus minus' },
  { symbol: '∈', latex: '\\in', label: 'Element of' },
  { symbol: '∉', latex: '\\notin', label: 'Not element of' },
  { symbol: '⊂', latex: '\\subset', label: 'Subset' },
  { symbol: '∪', latex: '\\cup', label: 'Union' },
  { symbol: '∩', latex: '\\cap', label: 'Intersection' },
  { symbol: '∅', latex: '\\emptyset', label: 'Empty set' },
  { symbol: '→', latex: '\\rightarrow', label: 'Right arrow' },
  { symbol: '⇒', latex: '\\Rightarrow', label: 'Implies' },
  { symbol: '∀', latex: '\\forall', label: 'For all' },
  { symbol: '∃', latex: '\\exists', label: 'There exists' },
  { symbol: '¬', latex: '\\neg', label: 'Not' },
  { symbol: '∧', latex: '\\wedge', label: 'And' },
  { symbol: '∨', latex: '\\vee', label: 'Or' },
]


export const NEGATIVE_MARKING_OPTIONS = [
  { label: 'No Negative Marking', value: 'none', fraction: 0 },
  { label: '1/4 of Marks', value: '1/4', fraction: 0.25 },
  { label: '1/3 of Marks', value: '1/3', fraction: 0.333 },
  { label: '1/2 of Marks', value: '1/2', fraction: 0.5 },
  { label: 'Custom', value: 'custom', fraction: 0 },
]