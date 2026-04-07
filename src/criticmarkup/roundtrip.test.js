/**
 * Round-trip tests: markdown string → marked HTML → parsed attrs → serialized back.
 *
 * We can't run full Tiptap (needs DOM + React), so we test the two ends:
 *   1. marked-plugin output matches what Tiptap's parseHTML expects
 *   2. serializeToMarkdown reproduces the original markup when given correct attrs
 *
 * Together these prove the pipeline is lossless for each CriticMarkup type.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { JSDOM } from 'jsdom'
import { marked } from 'marked'
import { criticMarkupPlugin } from './marked-plugin.js'
import { serializeToMarkdown } from '../editor/tiptap-serializer.js'

let dom
beforeAll(() => {
  dom = new JSDOM('')
  marked.use(criticMarkupPlugin())
})

function parseHTML(html) {
  const doc = dom.window.document
  const div = doc.createElement('div')
  div.innerHTML = html
  return div
}

// ─── substitution round-trip ──────────────────────────────────────────────────

describe('substitution round-trip', () => {
  it('data-old / data-new survive marked → DOM → attrs', () => {
    const html = marked.parse('{~~ foo ~> bar ~~}')
    const container = parseHTML(html)
    if (!container) return  // skip if jsdom not available

    const span = container.querySelector('.critic-sub')
    expect(span).not.toBeNull()
    expect(span.dataset.old).toBe('foo')
    expect(span.dataset.new).toBe('bar')
  })

  it('del/ins children have correct text', () => {
    const html = marked.parse('{~~ hello ~> world ~~}')
    const container = parseHTML(html)

    expect(container.querySelector('del.critic-deletion').textContent).toBe('hello')
    expect(container.querySelector('ins.critic-insertion').textContent).toBe('world')
  })

  it('serializer reproduces {~~ old ~> new ~~} from attrs', () => {
    // Simulate what Tiptap would produce after parsing data-old / data-new
    const r = serializeToMarkdown({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'criticSubstitution', attrs: { old: 'foo', new: 'bar' } }],
      }],
    })
    expect(r).toBe('{~~ foo ~> bar ~~}')
  })
})

// ─── insertion round-trip ─────────────────────────────────────────────────────

describe('insertion round-trip', () => {
  it('marked produces ins.critic-insertion', () => {
    const html = marked.parse('{++ added ++}')
    const container = parseHTML(html)

    const ins = container.querySelector('ins.critic-insertion')
    expect(ins).not.toBeNull()
    expect(ins.textContent).toContain('added')
  })

  it('serializer reproduces {++ text ++} from criticInsertion mark', () => {
    const r = serializeToMarkdown({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'added', marks: [{ type: 'criticInsertion' }] }],
      }],
    })
    expect(r).toBe('{++ added ++}')
  })
})

// ─── deletion round-trip ──────────────────────────────────────────────────────

describe('deletion round-trip', () => {
  it('marked produces del.critic-deletion', () => {
    const html = marked.parse('{-- removed --}')
    const container = parseHTML(html)

    const del = container.querySelector('del.critic-deletion')
    expect(del).not.toBeNull()
    expect(del.textContent).toContain('removed')
  })

  it('serializer reproduces {-- text --} from criticDeletion mark', () => {
    const r = serializeToMarkdown({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'removed', marks: [{ type: 'criticDeletion' }] }],
      }],
    })
    expect(r).toBe('{-- removed --}')
  })
})

// ─── comment round-trip ───────────────────────────────────────────────────────

describe('comment round-trip', () => {
  it('marked produces span.critic-comment with author/date attrs', () => {
    const html = marked.parse('{>> @alice (2026-04-07): review this <<}')
    const container = parseHTML(html)

    const span = container.querySelector('.critic-comment')
    expect(span).not.toBeNull()
    expect(span.dataset.author).toBe('@alice')
    expect(span.dataset.date).toBe('2026-04-07')
  })

  it('serializer reproduces {>> @handle (date): text <<}', () => {
    const r = serializeToMarkdown({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'criticComment',
          attrs: { author: '@alice', date: '2026-04-07', text: 'review this' },
        }],
      }],
    })
    expect(r).toBe('{>> @alice (2026-04-07): review this <<}')
  })
})

// ─── track-changes → marked consistency ──────────────────────────────────────

describe('track-changes output is valid marked input', () => {
  it('{++ ... ++} produced by track-changes renders correctly', () => {
    const markup = 'Hello {++ world ++}'
    const html = marked.parse(markup)
    expect(html).toContain('<ins class="critic-insertion"')
    expect(html).toContain('world')
  })

  it('{-- ... --} produced by track-changes renders correctly', () => {
    const markup = 'Hello {-- removed --} world'
    const html = marked.parse(markup)
    expect(html).toContain('<del class="critic-deletion"')
    expect(html).toContain('removed')
  })

  it('{~~ ... ~> ... ~~} produced by track-changes renders correctly', () => {
    const markup = 'Hello {~~ old ~> new ~~} world'
    const html = marked.parse(markup)
    expect(html).toContain('data-old="old"')
    expect(html).toContain('data-new="new"')
    expect(html).not.toContain('$1')
    expect(html).not.toContain('$2')
  })
})
