/** Bounded arithmetic parser: no JavaScript execution, property lookup, or ambient globals. */
export const DAMAGE_FORMULA_VARIABLES = ['power', 'a.atk', 'a.def', 'a.mind', 'a.agi', 'a.hp', 'a.mp', 'a.level', 'b.atk', 'b.def', 'b.mind', 'b.agi', 'b.hp', 'b.mp', 'b.level'] as const;
export type DamageFormulaContext = Readonly<Record<string, number>>;
export type FormulaResult = { ok: true; value: number } | { ok: false; error: string };
export function evaluateDamageFormula(source: string, context: DamageFormulaContext): FormulaResult {
  try {
    if (!source.trim() || source.length > 512) throw new Error('수식은 1~512자여야 합니다.');
    const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*)?|[^\s]/g) ?? [];
    let index = 0;
    let depth = 0;
    const checked = (value: number): number => {
      if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error('0 나눗셈 또는 계산 범위 초과입니다.');
      return value;
    };
    const atom = (): number => {
      if (++depth > 32) throw new Error('괄호 중첩은 32단계까지 가능합니다.');
      const token = tokens[index++];
      let value: number;
      if (token === '+' || token === '-') value = (token === '-' ? -1 : 1) * atom();
      else if (token === '(') {
        value = expression();
        if (tokens[index++] !== ')') throw new Error('닫는 괄호가 필요합니다.');
      } else if (token && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) value = Number(token);
      else if (DAMAGE_FORMULA_VARIABLES.includes(token as typeof DAMAGE_FORMULA_VARIABLES[number])) {
        value = context[token];
      } else throw new Error(`허용되지 않은 기호: ${token ?? '수식 끝'}`);
      depth--;
      return checked(value);
    };
    const product = (): number => {
      let value = atom();
      while (tokens[index] === '*' || tokens[index] === '/' || tokens[index] === '%') {
        const op = tokens[index++]; const right = atom();
        value = checked(op === '*' ? value * right : op === '/' ? value / right : value % right);
      }
      return value;
    };
    const expression = (): number => {
      let value = product();
      while (tokens[index] === '+' || tokens[index] === '-') {
        const op = tokens[index++]; const right = product();
        value = checked(op === '+' ? value + right : value - right);
      }
      return value;
    };
    const value = expression();
    if (index !== tokens.length) throw new Error(`예상하지 못한 기호: ${tokens[index]}`);
    return { ok: true, value: Math.max(0, Math.round(value)) };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : '잘못된 수식입니다.' }; }
}
export const FORMULA_PREVIEW_CONTEXT: DamageFormulaContext = Object.fromEntries(DAMAGE_FORMULA_VARIABLES.map(key => [key, key === 'power' ? 10 : key.endsWith('level') ? 1 : 20]));
export function formulaBattlerContext(a: { attackPower: number; defense: number; mind: number; agility: number; hp: number; mp: number; level?: number }, b: typeof a, power: number): DamageFormulaContext {
  const result: Record<string, number> = { power };
  for (const [prefix, battler] of [['a', a], ['b', b]] as const) {
    for (const [name, value] of Object.entries({ atk: battler.attackPower, def: battler.defense, mind: battler.mind, agi: battler.agility, hp: battler.hp, mp: battler.mp, level: battler.level ?? 1 })) result[`${prefix}.${name}`] = value;
  }
  return result;
}
