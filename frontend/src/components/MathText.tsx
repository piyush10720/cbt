import React from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MathTextProps {
  text: string
  className?: string
  block?: boolean
}

/**
 * Component that renders text with inline and block LaTeX/Math expressions
 * Supports both inline ($...$) and display ($$...$$) math mode
 */
const MathText: React.FC<MathTextProps> = ({ text, className = '', block = false }) => {
  if (!text) return null

  // Pre-process text to handle common Unicode math symbols and convert to LaTeX
  const preprocessText = (content: string) => {
    return content
      // Common Unicode symbols to LaTeX
      .replace(/×/g, '\\times')
      .replace(/÷/g, '\\div')
      .replace(/≤/g, '\\leq')
      .replace(/≥/g, '\\geq')
      .replace(/≠/g, '\\neq')
      .replace(/±/g, '\\pm')
      .replace(/∞/g, '\\infty')
      .replace(/√/g, '\\sqrt')
      .replace(/∑/g, '\\sum')
      .replace(/∫/g, '\\int')
      .replace(/π/g, '\\pi')
      .replace(/α/g, '\\alpha')
      .replace(/β/g, '\\beta')
      .replace(/γ/g, '\\gamma')
      .replace(/δ/g, '\\delta')
      .replace(/θ/g, '\\theta')
      .replace(/λ/g, '\\lambda')
      .replace(/μ/g, '\\mu')
      .replace(/σ/g, '\\sigma')
      .replace(/Σ/g, '\\Sigma')
      .replace(/Δ/g, '\\Delta')
      .replace(/Ω/g, '\\Omega')
      .replace(/∈/g, '\\in')
      .replace(/∉/g, '\\notin')
      .replace(/⊂/g, '\\subset')
      .replace(/⊆/g, '\\subseteq')
      .replace(/∪/g, '\\cup')
      .replace(/∩/g, '\\cap')
      .replace(/∅/g, '\\emptyset')
      .replace(/→/g, '\\rightarrow')
      .replace(/←/g, '\\leftarrow')
      .replace(/↔/g, '\\leftrightarrow')
      .replace(/⇒/g, '\\Rightarrow')
      .replace(/⇐/g, '\\Leftarrow')
      .replace(/⇔/g, '\\Leftrightarrow')
      .replace(/∀/g, '\\forall')
      .replace(/∃/g, '\\exists')
      .replace(/¬/g, '\\neg')
      .replace(/∧/g, '\\wedge')
      .replace(/∨/g, '\\vee')
      .replace(/°/g, '^\\circ')
  }

  const renderTextWithMath = (content: string) => {
    // Pre-process to handle Unicode math symbols
    content = preprocessText(content)
    // Replace display math ($$...$$) first - must match multiline
    const displayMathRegex = /\$\$([\s\S]*?)\$\$/g

    // Split by display math first
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    // Process display math
    displayMathRegex.lastIndex = 0
    while ((match = displayMathRegex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const beforeText = content.substring(lastIndex, match.index)
        parts.push(...processInlineMath(beforeText, parts.length))
      }

      // Add display math
      try {
        const mathHtml = katex.renderToString(match[1].trim(), {
          displayMode: true,
          throwOnError: false,
          output: 'html',
          trust: (context: any) => ['\\url', '\\href', '\\includegraphics'].indexOf(context.command) < 0,
          strict: false,
          macros: {
            "\\eqref": "\\href{###1}{(\\text{#1})}",
            "\\label": "\\htmlId{#1}{}",
            "\\ref": "\\href{###1}{\\text{#1}}",
            "\\tag": "\\text{(#1)}"
          }
        })
        parts.push(
          <span
            key={`display-${parts.length}`}
            dangerouslySetInnerHTML={{ __html: mathHtml }}
            className="block my-3 overflow-x-auto"
          />
        )
      } catch (e) {
        // If rendering fails, show the raw LaTeX with better formatting
        console.error('KaTeX display math error:', e)
        const errorMsg = e instanceof Error ? e.message : 'Rendering error'
        parts.push(
          <div key={`display-error-${parts.length}`} className="block my-2 p-3 rounded border border-red-300 bg-red-50">
            <p className="text-xs text-red-700 mb-1">LaTeX Error: {errorMsg}</p>
            <pre className="font-mono text-sm text-gray-700 whitespace-pre-wrap">
              $${ match[1].trim()}$$
            </pre>
          </div>
        )
      }

      lastIndex = displayMathRegex.lastIndex
    }

    // Add remaining text after last display math
    if (lastIndex < content.length) {
      const remainingText = content.substring(lastIndex)
      parts.push(...processInlineMath(remainingText, parts.length))
    }

    return parts
  }

  const processInlineMath = (text: string, startKey: number) => {
    const parts: React.ReactNode[] = []
    const inlineMathRegex = /\$([^\$\n]+?)\$/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    inlineMathRegex.lastIndex = 0
    while ((match = inlineMathRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const plainText = text.substring(lastIndex, match.index)
        if (plainText) {
          parts.push(
            <span key={`text-${startKey}-${parts.length}`}>{plainText}</span>
          )
        }
      }

      // Add inline math
      try {
        const mathHtml = katex.renderToString(match[1], {
          displayMode: false,
          throwOnError: false,
          output: 'html',
          trust: (context: any) => ['\\url', '\\href', '\\includegraphics'].indexOf(context.command) < 0,
          strict: false,
          macros: {
            "\\eqref": "\\href{###1}{(\\text{#1})}",
            "\\label": "\\htmlId{#1}{}",
            "\\ref": "\\href{###1}{\\text{#1}}"
          }
        })
        parts.push(
          <span
            key={`inline-${startKey}-${parts.length}`}
            dangerouslySetInnerHTML={{ __html: mathHtml }}
            className="inline-block align-middle mx-0.5"
          />
        )
      } catch (e) {
        // If rendering fails, show the raw LaTeX
        console.error('KaTeX inline math error:', e)
        parts.push(
          <span key={`inline-error-${startKey}-${parts.length}`} className="font-mono text-xs text-red-600 bg-red-50 px-1 rounded">
            ${match[1]}$
          </span>
        )
      }

      lastIndex = inlineMathRegex.lastIndex
    }

    // Add remaining text after last inline math
    if (lastIndex < text.length) {
      const plainText = text.substring(lastIndex)
      if (plainText) {
        parts.push(
          <span key={`text-${startKey}-${parts.length}`}>{plainText}</span>
        )
      }
    }

    return parts.length > 0 ? parts : [text]
  }

  const renderedContent = renderTextWithMath(text)

  if (block) {
    return (
      <div className={`whitespace-pre-wrap ${className}`}>
        {renderedContent}
      </div>
    )
  }

  return (
    <span className={className}>
      {renderedContent}
    </span>
  )
}

export default MathText

