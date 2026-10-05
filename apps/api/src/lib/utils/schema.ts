import { t } from "elysia";

/**
 * String enum validator without Elysia's implicit default.
 * `t.UnionEnum` sets `default: values[0]`, which silently fills missing
 * optional query/body fields (e.g. a PATCH without `status` would reset it).
 */
export const tEnum = <const T extends readonly string[]>(values: T) =>
  t.UnionEnum([...values] as unknown as [T[number], ...T[number][]], {
    default: undefined,
  });

export const tId = t.Object({ id: t.Numeric() });
export const tDate = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
/** Rupees, up to 2 decimals' worth of precision once stored as paise. */
export const tAmount = t.Number({
  exclusiveMinimum: 0,
  maximum: 10_000_000_000,
});
export const tNote = t.Nullable(t.String({ maxLength: 500 }));
/** Accepts any case / a leading @; controllers normalise with `normalizeUsername`. */
export const tUsername = t.String({
  pattern: "^@?[A-Za-z0-9_.]{3,16}$",
  error: "Username must be 3–16 letters, numbers, _ or .",
});
