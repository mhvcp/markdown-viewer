import { Decoration, ViewPlugin } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

const marks = {
  insertion:    Decoration.mark({ class: 'cm-critic-insertion' }),
  deletion:     Decoration.mark({ class: 'cm-critic-deletion' }),
  substitution: Decoration.mark({ class: 'cm-critic-substitution' }),
  highlight:    Decoration.mark({ class: 'cm-critic-highlight' }),
  comment:      Decoration.mark({ class: 'cm-critic-comment' }),
}

const PATTERNS = [
  { re: /\{\+\+([\s\S]*?)\+\+\}/g,         mark: marks.insertion },
  { re: /\{--([\s\S]*?)--\}/g,              mark: marks.deletion },
  { re: /\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g,  mark: marks.substitution },
  { re: /\{==([\s\S]*?)==\}/g,              mark: marks.highlight },
  { re: /\{>>([\s\S]*?)<<\}/g,              mark: marks.comment },
]

function buildDecorations(view) {
  const builder = new RangeSetBuilder()
  const text = view.state.doc.toString()

  const all = []
  for (const { re, mark } of PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      all.push({ from: m.index, to: m.index + m[0].length, mark })
    }
  }
  all.sort((a, b) => a.from - b.from)

  for (const { from, to, mark } of all) {
    builder.add(from, to, mark)
  }
  return builder.finish()
}

export const criticMarkupExtension = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildDecorations(view)
    }
    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)
