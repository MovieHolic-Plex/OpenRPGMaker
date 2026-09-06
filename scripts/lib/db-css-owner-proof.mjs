const covers = (owner, removed) => owner === removed
  || (owner === 'font' && (removed === 'line-height' || /^font-(?:family|size|weight|style|stretch|variant)$/.test(removed)))
  || (owner === 'border' && /^border-(?:(?:top|right|bottom|left)(?:-(?:width|style|color))?|width|style|color)$/.test(removed))
  || (owner === 'background' && removed === 'background-color')
  || (owner === 'overflow' && /^overflow-[xy]$/.test(removed))
  || (['padding', 'margin'].includes(owner) && new RegExp(`^${owner}-(top|right|bottom|left)$`).test(removed))
  || (owner === 'border-radius' && /^border-(top|bottom)-(left|right)-radius$/.test(removed));

export const selectorIdentity = selector => selector.replace(/\s+/g, ' ').trim();

/** Return exact surviving declaration evidence; selector existence alone is insufficient. */
export function designatedDeclarations(declarations, owner, property, hasExplicitDefault = false) {
  const matches = declarations.filter(d => d.file === owner.file && selectorIdentity(d.selector) === selectorIdentity(owner.selector) && d.context === owner.context && covers(d.property, property));
  if (!matches.length && !hasExplicitDefault) throw new Error(`Missing designated property ${owner.file} ${owner.selector}: ${property}`);
  return matches;
}
