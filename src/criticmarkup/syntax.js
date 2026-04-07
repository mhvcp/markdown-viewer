// CriticMarkup syntax helpers
// Standard patterns: {++ add ++}  {-- del --}  {~~ old ~> new ~~}  {== highlight ==}  {>> comment <<}
// VCP comment format: {>> @handle (YYYY-MM-DD): text <<}

export const CM_RE = {
  insertion:     /\{\+\+([\s\S]*?)\+\+\}/g,
  deletion:      /\{--([\s\S]*?)--\}/g,
  substitution:  /\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g,
  highlight:     /\{==([\s\S]*?)==\}/g,
  comment:       /\{>>([\s\S]*?)<<\}/g,
}

export function formatVCPComment(handle, text) {
  const date = new Date().toISOString().split('T')[0]
  const h = handle.startsWith('@') ? handle : `@${handle}`
  return `{>> ${h} (${date}): ${text} <<}`
}

// Wraps currently selected text with a CriticMarkup comment.
// If text is selected it becomes the annotated span.
export function buildCommentInsertion(handle, commentText, selectedText = '') {
  const date = new Date().toISOString().split('T')[0]
  const h = handle.startsWith('@') ? handle : `@${handle}`
  if (selectedText) {
    // Highlight the selection and attach a comment right after
    return `{== ${selectedText} ==}{>> ${h} (${date}): ${commentText} <<}`
  }
  return `{>> ${h} (${date}): ${commentText} <<}`
}
