import { describe, it, expect, beforeAll } from 'vitest'
import { marked } from 'marked'
import { criticMarkupPlugin } from './marked-plugin.js'

beforeAll(() => {
  marked.use(criticMarkupPlugin())
})

function parse(md) {
  return marked.parse(md)
}

// ─── insertion ────────────────────────────────────────────────────────────────

describe('insertion {++ text ++}', () => {
  it('renders as <ins class="critic-insertion">', () => {
    const html = parse('{++ hello ++}')
    expect(html).toContain('<ins class="critic-insertion"')
    expect(html).toContain('hello')
  })

  it('preserves inner text', () => {
    const html = parse('{++ added text ++}')
    expect(html).toContain('added text')
  })

  it('works mid-sentence', () => {
    const html = parse('Hello {++ beautiful ++} world')
    expect(html).toContain('Hello')
    expect(html).toContain('<ins class="critic-insertion"')
    expect(html).toContain('beautiful')
    expect(html).toContain('world')
  })
})

// ─── deletion ────────────────────────────────────────────────────────────────

describe('deletion {-- text --}', () => {
  it('renders as <del class="critic-deletion">', () => {
    const html = parse('{-- removed --}')
    expect(html).toContain('<del class="critic-deletion"')
    expect(html).toContain('removed')
  })
})

// ─── highlight ────────────────────────────────────────────────────────────────

describe('highlight {== text ==}', () => {
  it('renders as <mark class="critic-highlight">', () => {
    const html = parse('{== important ==}')
    expect(html).toContain('<mark class="critic-highlight"')
    expect(html).toContain('important')
  })
})

// ─── substitution ────────────────────────────────────────────────────────────

describe('substitution {~~ old ~> new ~~}', () => {
  it('renders as span.critic-sub', () => {
    const html = parse('{~~ old ~> new ~~}')
    expect(html).toContain('class="critic-sub"')
  })

  it('renders old text in <del class="critic-deletion">', () => {
    const html = parse('{~~ old ~> new ~~}')
    expect(html).toContain('<del class="critic-deletion">old</del>')
  })

  it('renders new text in <ins class="critic-insertion">', () => {
    const html = parse('{~~ old ~> new ~~}')
    expect(html).toContain('<ins class="critic-insertion">new</ins>')
  })

  it('does NOT contain literal $1 or $2 — regression for broken capture groups', () => {
    const html = parse('{~~ old text ~> new text ~~}')
    expect(html).not.toContain('$1')
    expect(html).not.toContain('$2')
  })

  it('stores data-old and data-new attributes', () => {
    const html = parse('{~~ foo ~> bar ~~}')
    expect(html).toContain('data-old="foo"')
    expect(html).toContain('data-new="bar"')
  })

  it('multi-word substitution', () => {
    const html = parse('{~~ quick brown ~> slow red ~~}')
    expect(html).toContain('quick brown')
    expect(html).toContain('slow red')
  })

  it('special chars in content do not break attributes', () => {
    const html = parse('{~~ it\'s ~> its ~~}')
    expect(html).toContain('critic-sub')
    expect(html).not.toContain('$1')
  })
})

// ─── comment ─────────────────────────────────────────────────────────────────

describe('comment {>> @handle (date): text <<}', () => {
  it('renders as span.critic-comment', () => {
    const html = parse('{>> @alice (2026-04-07): review this <<}')
    expect(html).toContain('class="critic-comment"')
  })

  it('stores data-author', () => {
    const html = parse('{>> @alice (2026-04-07): review this <<}')
    expect(html).toContain('data-author="@alice"')
  })

  it('stores data-date', () => {
    const html = parse('{>> @alice (2026-04-07): review this <<}')
    expect(html).toContain('data-date="2026-04-07"')
  })

  it('includes comment text in title attribute', () => {
    const html = parse('{>> @bob (2026-01-01): needs work <<}')
    expect(html).toContain('needs work')
  })
})

// ─── ordering — substitution before del/ins to avoid overlap ────────────────

describe('ordering', () => {
  it('substitution takes priority over del/ins on overlapping syntax', () => {
    // {~~ a ~> b ~~} must not be partially matched by del or ins patterns
    const html = parse('{~~ only ~> this ~~}')
    expect(html).toContain('critic-sub')
    // should NOT produce a bare critic-deletion span
    const delCount = (html.match(/critic-deletion/g) || []).length
    const insCount = (html.match(/critic-insertion/g) || []).length
    // exactly one del and one ins, inside the sub span
    expect(delCount).toBe(1)
    expect(insCount).toBe(1)
  })
})
