// Real-time track-changes Tiptap extension.
//
// Every keystroke that changes the document is intercepted via ProseMirror's
// appendTransaction hook. Insertions get a `criticInsertion` mark; deletions
// are kept in-place with a `criticDeletion` mark instead of being removed.
//
// Smart cancellation: if the user deletes text that was itself a
// `criticInsertion` from this session, the marks cancel out — the insertion
// mark is stripped and the text removed (net-zero change, as if never typed).
//
// Position arithmetic
// -------------------
// appendTransaction receives:
//   • transactions[]  — the transactions just applied
//   • oldState        — state BEFORE those transactions
//   • newState        — state AFTER those transactions (already committed)
//
// Our job is to build a *new* transaction (`newTr`) on top of newState that
// re-inserts deleted content (with criticDeletion) and adds criticInsertion
// marks to inserted ranges.
//
// We replay each ReplaceStep from the original transactions. For each step we
// know:
//   • step.from / step.to  → range deleted in the doc BEFORE that step
//   • step.slice.content   → content inserted in its place
//
// To work in newTr's coordinate space we combine:
//   • tr.mapping  — maps positions through all steps of that transaction
//   • a running `extraOffset` that accumulates chars we have re-inserted so far
//     in newTr (because each re-insertion shifts subsequent positions forward)

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { ReplaceStep, ReplaceAroundStep } from 'prosemirror-transform'
import { Fragment } from 'prosemirror-model'

const TRACK_META = 'trackChanges'
const pluginKey  = new PluginKey('trackChanges')

// ── fragment helpers ──────────────────────────────────────────────────────────

/** True if every child text node of fragment carries criticInsertion. */
function fragmentAllInsertion(fragment, insMarkType) {
  if (fragment.childCount === 0) return false
  let all = true
  fragment.forEach(node => {
    if (!node.isText || !insMarkType.isInSet(node.marks)) {
      all = false
    }
  })
  return all
}

/** Clone fragment replacing marks on each text node. */
function mapFragmentMarks(fragment, fn) {
  const nodes = []
  fragment.forEach(node => {
    if (node.isText) {
      nodes.push(node.mark(fn(node.marks, node)))
    } else {
      nodes.push(node.copy(mapFragmentMarks(node.content, fn)))
    }
  })
  return Fragment.fromArray(nodes)
}

/** Add criticDeletion mark to every text node in fragment. */
function markFragmentDeletion(fragment, delMarkType, author) {
  const delMark = delMarkType.create({ author: author || '' })
  return mapFragmentMarks(fragment, marks => {
    // Remove any existing ins/del, then add deletion
    const cleaned = marks.filter(
      m => m.type.name !== 'criticInsertion' && m.type.name !== 'criticDeletion'
    )
    return [...cleaned, delMark]
  })
}

// ── plugin factory ────────────────────────────────────────────────────────────

function makePlugin(getOptions) {
  return new Plugin({
    key: pluginKey,

    appendTransaction(transactions, oldState, newState) {
      // Skip transactions with no doc change, or our own transactions
      const relevant = transactions.filter(
        tr => tr.docChanged && !tr.getMeta(TRACK_META)
      )
      if (relevant.length === 0) return null

      const { tracking, author } = getOptions()
      if (!tracking) return null

      const schema  = newState.schema
      const insType = schema.marks.criticInsertion
      const delType = schema.marks.criticDeletion
      if (!insType || !delType) return null

      // We build newTr on top of newState
      let newTr = newState.tr
      newTr.setMeta(TRACK_META, true)

      // `extraOffset` tracks how many positions we have inserted into newTr
      // beyond what was in newState. Used to adjust positions for subsequent ops.
      let extraOffset = 0

      // We need to replay steps in the order they were applied, across all
      // relevant transactions in sequence.
      // State before a given transaction = oldState mapped through all prior ones.
      // We track a "docBeforeTx" reference for each transaction.
      let docBeforeTx = oldState.doc

      for (const tr of relevant) {
        // Within one transaction, steps are applied sequentially.
        // `stepDoc` is the document state just before this step within the tx.
        let stepDoc = docBeforeTx

        // Partial mapping: positions through steps[0..i-1] within this tx
        // We build this incrementally.
        const stepMappings = []

        for (let si = 0; si < tr.steps.length; si++) {
          const step    = tr.steps[si]
          const stepMap = step.getMap()
          stepMappings.push(stepMap)

          // Build a mapping from OLD doc positions (before this tx) to
          // positions after all steps up to and including step[si].
          // Actually we want positions in stepDoc (before this step).
          // stepDoc is the doc just before this step within the transaction.

          if (step instanceof ReplaceStep || step instanceof ReplaceAroundStep) {
            const from  = step.from   // in stepDoc
            const to    = step.to     // in stepDoc
            const slice = step instanceof ReplaceAroundStep ? step.insert : step.slice

            // Map `from` through all earlier steps in this tx to get position
            // in the final newState doc, then add extraOffset for our own insertions.
            let mappedFrom = from
            for (let pi = 0; pi < si; pi++) {
              mappedFrom = stepMappings[pi].map(mappedFrom)
            }
            mappedFrom += extraOffset

            // ── DELETION: content at [from, to) in stepDoc was removed ──────
            if (from < to) {
              const deletedFrag = stepDoc.slice(from, to).content

              if (fragmentAllInsertion(deletedFrag, insType)) {
                // NET-ZERO: user deleted their own insertion.
                // The text is already gone from newState; we just need to
                // remove the criticInsertion marks that are still on the
                // re-inserted region... but wait, it's already deleted in
                // newState, so there's nothing to unmark.
                // The deletion already happened — net result is correct: gone.
                // No action needed; extraOffset unchanged.
              } else {
                // Re-insert deleted content with criticDeletion mark
                const markedFrag = markFragmentDeletion(deletedFrag, delType, author)
                newTr = newTr.insert(mappedFrom, markedFrag)

                // Count how many inline positions were added
                // For inline content, fragment.size ≈ total text + node sizes
                const addedSize = markedFrag.size
                extraOffset += addedSize
              }
            }

            // ── INSERTION: slice.content was inserted at `from` (after deletion) ──
            if (slice && slice.content.size > 0) {
              // After the deletion (if any), insertion landed at `from` in stepDoc's
              // coordinate mapped forward. In newState it's at:
              //   mappedFrom (which already accounts for the re-insertion offset)
              //   but the deletion re-insertion shifted things, so the actual
              //   insertion start in newTr is mappedFrom + (re-inserted size if from==to,
              //   else mappedFrom since deletion re-insert was AT mappedFrom and
              //   insertion follows right after deleted content).
              //
              // Actually: after we re-insert at mappedFrom, the inserted content
              // from the original step is now AFTER the re-inserted deleted block.
              // In newState (before newTr), the inserted content is at:
              //   newState position = (mappedFrom - extraOffset_before_this_step) + addedDeletedSize_this_step
              // which equals mappedFrom in newTr after the re-insertion.
              //
              // Simpler: the inserted range in newTr starts at:
              //   mappedFrom + (size_of_reinserted_deletion if from < to else 0)
              const deletedSize  = from < to ? stepDoc.slice(from, to).content.size : 0
              const wasNetZero   = from < to && fragmentAllInsertion(stepDoc.slice(from, to).content, insType)
              const reinsertedSz = wasNetZero ? 0 : deletedSize

              const insStart = mappedFrom + reinsertedSz
              const insEnd   = insStart + slice.content.size

              // Add criticInsertion mark to the inserted range
              if (insEnd > insStart) {
                newTr = newTr.addMark(insStart, insEnd, insType.create({ author: author || '' }))
              }
            }
          }

          // Advance stepDoc to the state after this step
          const stepResult = step.apply(stepDoc)
          if (stepResult.doc) stepDoc = stepResult.doc
        }

        // After processing all steps of this tx, advance docBeforeTx
        docBeforeTx = tr.doc
      }

      // Restore cursor to where newState left it
      try {
        const sel = newState.selection
        // Map the selection through our extra insertions.
        // Our insertions were all of deleted content; the cursor should stay
        // at the typing position which is already correct in newState.
        // We just need to map it through newTr's steps.
        const mapped = sel.map(newTr.doc, newTr.mapping)
        newTr = newTr.setSelection(mapped)
      } catch {
        // leave selection as-is
      }

      if (newTr.steps.length === 0) return null
      return newTr
    },
  })
}

// ── Tiptap Extension ──────────────────────────────────────────────────────────

export const TrackChanges = Extension.create({
  name: 'trackChanges',

  addOptions() {
    return {
      tracking: false,
      author:   '',
    }
  },

  addProseMirrorPlugins() {
    const ext = this
    return [makePlugin(() => ext.options)]
  },
})
