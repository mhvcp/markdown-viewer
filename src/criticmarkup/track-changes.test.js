import { describe, it, expect } from 'vitest'
import { applyTrackChanges } from './track-changes.js'

// ─── helpers ─────────────────────────────────────────────────────────────────

const tc = (before, after) => applyTrackChanges(before, after)

// ─── no-op ───────────────────────────────────────────────────────────────────

describe('no change', () => {
  it('identical strings return the same string', () => {
    expect(tc('Hello world', 'Hello world')).toBe('Hello world')
  })

  it('empty string', () => {
    expect(tc('', '')).toBe('')
  })
})

// ─── pure insertion ───────────────────────────────────────────────────────────

describe('insertion', () => {
  it('append word', () => {
    expect(tc('Hello', 'Hello world')).toBe('Hello {++ world ++}')
  })

  it('prepend word', () => {
    expect(tc('world', 'Hello world')).toBe('{++ Hello ++} world')
  })

  it('insert in middle', () => {
    expect(tc('Hello world', 'Hello beautiful world')).toBe('Hello {++ beautiful ++} world')
  })

  it('append sentence', () => {
    const r = tc('Hello.', 'Hello. Please add here.')
    expect(r).toBe('Hello. {++ Please add here. ++}')
  })

  it('multi-word insert preserves spaces outside markup', () => {
    const r = tc('A B', 'A X Y B')
    expect(r).toBe('A {++ X Y ++} B')
  })
})

// ─── pure deletion ────────────────────────────────────────────────────────────

describe('deletion', () => {
  it('delete trailing word', () => {
    expect(tc('Hello world', 'Hello')).toBe('Hello {-- world --}')
  })

  it('delete leading word', () => {
    expect(tc('Hello world', 'world')).toBe('{-- Hello --} world')
  })

  it('delete middle word', () => {
    expect(tc('Hello beautiful world', 'Hello world')).toBe('Hello {-- beautiful --} world')
  })
})

// ─── substitution ─────────────────────────────────────────────────────────────

describe('substitution', () => {
  it('single word replacement', () => {
    expect(tc('Hello world', 'Hello earth')).toBe('Hello {~~ world ~> earth ~~}')
  })

  it('substitution order: old first, new second', () => {
    const r = tc('foo bar', 'foo baz')
    expect(r).toMatch(/\{~~ bar ~> baz ~~\}/)
    expect(r).not.toMatch(/\{~~ baz ~> bar ~~\}/)
  })

  it('replace first word', () => {
    expect(tc('Hello world', 'Hi world')).toBe('{~~ Hello ~> Hi ~~} world')
  })

  it('multi-word substitution', () => {
    const r = tc('The quick brown fox', 'The slow red fox')
    expect(r).toContain('{~~ quick ~> slow ~~}')
    expect(r).toContain('{~~ brown ~> red ~~}')
    expect(r).toContain('fox')
  })
})

// ─── mixed operations ─────────────────────────────────────────────────────────

describe('mixed operations', () => {
  it('delete and append', () => {
    const r = tc('Hello world', 'Hi there planet')
    expect(r).toContain('{~~')
    expect(r).not.toBe('Hello world')
  })

  it('insert + delete in different positions', () => {
    const r = tc('Alpha Beta Gamma', 'Alpha NEW Beta')
    expect(r).toContain('Alpha')
    expect(r).not.toBe('Alpha Beta Gamma')
    expect(r).not.toBe('Alpha NEW Beta')
    expect(r).toMatch(/\{[+~-]/)
  })
})

// ─── whitespace handling ──────────────────────────────────────────────────────

describe('whitespace', () => {
  it('preserves leading space outside markup', () => {
    const r = tc('Hello world', 'Hello  world')
    expect(r).not.toMatch(/\{[+-]+ \s/)
  })

  it('newline in diff does not break markup delimiters', () => {
    const r = tc('Line one\n\nLine two', 'Line one\n\nLine two added')
    expect(r).toContain('{++')
    expect(r).not.toContain('{++\n')
  })
})

// ─── atomic CriticMarkup blocks — pass-through ───────────────────────────────

describe('existing CriticMarkup is never re-wrapped', () => {
  it('existing insertion passes through unchanged', () => {
    const before = 'Hello {++ world ++}'
    expect(tc(before, before)).toBe(before)
  })

  it('existing deletion passes through unchanged', () => {
    const before = 'Hello {-- old --} world'
    expect(tc(before, before)).toBe(before)
  })

  it('existing substitution passes through unchanged', () => {
    const before = '{~~ old ~> new ~~} world'
    expect(tc(before, before)).toBe(before)
  })

  it('existing highlight passes through unchanged', () => {
    const before = 'Hello {== important ==} world'
    expect(tc(before, before)).toBe(before)
  })

  it('existing comment passes through unchanged', () => {
    const before = 'Hello {>> @alice (2026-01-01): review <<} world'
    expect(tc(before, before)).toBe(before)
  })

  it('does NOT wrap an existing insertion in another insertion', () => {
    const before = '{++ existing ++}'
    const after  = '{++ existing ++} and more'
    const r = tc(before, after)
    expect(r).toContain('{++ existing ++}')
    expect(r).toContain('{++ and more ++}')
    expect(r).not.toMatch(/\{\+\+[^}]*\{\+\+/)
  })

  it('does NOT wrap an existing substitution in another block', () => {
    const before = 'text {~~ old ~> new ~~} end'
    const after  = 'text {~~ old ~> new ~~} end added'
    const r = tc(before, after)
    expect(r).toContain('{~~ old ~> new ~~}')
    expect(r).toContain('{++ added ++}')
    expect(r).not.toMatch(/\{~~.*\{~~/)
  })

  it('catastrophic nesting regression — does not produce nested markup', () => {
    const before = 'Wie geht das am besten?'
    const after  = 'Wie geht das am besten? Wie geht das weiter?'
    const r = tc(before, after)
    expect(r).not.toMatch(/\{[~+-].*\{[~+-]/)
    expect(r).toContain('{++')
  })
})

// ─── deleting CriticMarkup blocks ────────────────────────────────────────────

describe('deleting existing CriticMarkup blocks', () => {
  it('{++ x ++} deleted → rejected insertion → empty string', () => {
    const r = tc('Hello {++ world ++}', 'Hello')
    // The insertion is rejected — "world" never landed, nothing to show
    expect(r).not.toContain('{++')
    expect(r).not.toContain('{--')
    expect(r).toContain('Hello')
  })

  it('{-- x --} deleted → confirmed deletion, keep the mark', () => {
    const r = tc('Hello {-- old --} world', 'Hello world')
    // The deletion block itself was deleted — it's still gone, keep the mark
    expect(r).toContain('{-- old --}')
  })

  it('{~~ old ~> new ~~} deleted → new text was visible, now deleted → {-- new --}', () => {
    const r = tc('Hello {~~ world ~> earth ~~}', 'Hello')
    expect(r).toContain('{-- earth --}')
    expect(r).not.toContain('{~~')
  })

  it('{== x ==} deleted → highlighted text removed → {-- x --}', () => {
    const r = tc('Hello {== important ==} world', 'Hello world')
    expect(r).toContain('{-- important --}')
    expect(r).not.toContain('{==')
  })

  it('{>> comment <<} deleted → removed silently', () => {
    const r = tc('Hello {>> @alice: note <<} world', 'Hello world')
    expect(r).not.toContain('{>>')
    expect(r).not.toContain('{--')
    expect(r).toContain('Hello')
  })

  it('plain text + CriticMarkup mixed deletion', () => {
    // User had "Hello {++ added ++} world" and deleted the whole thing
    const r = tc('Hello {++ added ++} world', 'Hello')
    expect(r).toContain('{-- world --}')
    expect(r).not.toContain('{++')
  })
})

// ─── edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('from empty to text', () => {
    expect(tc('', 'Hello world')).toBe('{++ Hello world ++}')
  })

  it('from text to empty', () => {
    expect(tc('Hello world', '')).toBe('{-- Hello world --}')
  })

  it('single character change', () => {
    expect(tc('cat', 'bat')).toContain('{~~')
  })

  it('punctuation-only change', () => {
    expect(tc('Hello world.', 'Hello world!')).toContain('{~~')
  })

  it('does not double-wrap when called twice', () => {
    const before = 'Hello world'
    const after  = 'Hello earth'
    const first  = tc(before, after)
    const second = tc(first, first)
    expect(second).toBe(first)
  })

  it('self-diff is always a no-op', () => {
    const marked = 'Foo {~~ bar ~> qux ~~} baz'
    expect(tc(marked, marked)).toBe(marked)
  })

  it('no spurious comment markers appended on any edit', () => {
    // Regression: old code appended {>> @handle: edit <<} on every blur
    const r = tc('Hello world', 'Hello earth')
    expect(r).not.toContain('{>>')
  })
})
