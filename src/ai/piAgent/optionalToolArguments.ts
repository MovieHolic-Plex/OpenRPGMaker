import type { JsonSchema } from '@/editor/tools/types';

// Strict providers require every property. Null represents an unused optional field;
// concrete zero/false/empty arrays retain their meaning and must never stand for omission.
export const NULLABLE_OPTIONAL_TOOLS = new Set([
  'read_world_terrain', 'edit_world_terrain', 'set_map_properties', 'import_region_reference', 'read_spatial_reference',
]);

export function nullableOptionalParameters(schema: JsonSchema): Record<string, unknown> {
  const next: Record<string, unknown> = { ...schema };
  if (schema.items) next.items = nullableOptionalParameters(schema.items);
  if (schema.properties) {
    const required = new Set(schema.required ?? []);
    const properties = Object.fromEntries(Object.entries(schema.properties).map(([key, child]) => {
      let converted = nullableOptionalParameters(child);
      if (!required.has(key)) {
        const types = child.type ? (Array.isArray(child.type) ? child.type : [child.type]) : [];
        converted = { ...converted, ...(types.length ? {type:[...new Set([...types,'null'])]} : {}),
          description: `${child.description ?? ''} 사용하지 않는 선택값은 null. 0/false/빈 배열은 실제 값이다.` };
        if (child.enum) converted.enum = [...child.enum, null];
      }
      return [key, converted];
    }));
    next.properties = properties;
  }
  return next;
}

export function omitUnusedOptionalArguments(schema: JsonSchema, value: unknown): unknown {
  if (Array.isArray(value)) return schema.items ? value.map(v=>omitUnusedOptionalArguments(schema.items!,v)) : value;
  if (!value || typeof value !== 'object' || !schema.properties) return value;
  const required = new Set(schema.required ?? []);
  return Object.fromEntries(Object.entries(value).filter(([key,v]) =>
    !(v === null && schema.properties?.[key] && !required.has(key))).map(([key,v]) =>
    [key,schema.properties?.[key] ? omitUnusedOptionalArguments(schema.properties[key]!,v) : v]));
}
