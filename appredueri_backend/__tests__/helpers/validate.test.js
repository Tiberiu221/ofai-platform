const {
  isValidEmail,
  sanitizeString,
  validateInt,
  isValidCoordinates,
  parsePagination,
  paginatedResponse,
  isValidRomanianPhone,
  validatePassword,
  validateBusinessRequest,
  ALLOWED_IMAGE_MIMES,
} = require("../../src/helpers/validate");

describe("isValidEmail", () => {
  it("accepts valid emails", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("test.name+tag@domain.co")).toBe(true);
    expect(isValidEmail("a@b.c")).toBe(true);
  });

  it("rejects null/undefined/empty", () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects non-string", () => {
    expect(isValidEmail(123)).toBe(false);
    expect(isValidEmail({})).toBe(false);
  });

  it("rejects invalid formats", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("@no-local.com")).toBe(false);
    expect(isValidEmail("no-domain@")).toBe(false);
    expect(isValidEmail("spaces in@email.com")).toBe(false);
  });

  it("rejects emails exceeding RFC 5321 length limits", () => {
    const longLocal = "a".repeat(65) + "@example.com";
    expect(isValidEmail(longLocal)).toBe(false);
    const longTotal = "a".repeat(64) + "@" + "b".repeat(190) + ".com";
    expect(isValidEmail(longTotal)).toBe(false);
  });
});

describe("sanitizeString", () => {
  it("trims whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  it("truncates to maxLength", () => {
    expect(sanitizeString("abcdefghij", 5)).toBe("abcde");
  });

  it("returns null for non-string", () => {
    expect(sanitizeString(null)).toBeNull();
    expect(sanitizeString(undefined)).toBeNull();
    expect(sanitizeString(123)).toBeNull();
    expect(sanitizeString("")).toBeNull();
  });

  it("uses default maxLength of 500", () => {
    const long = "x".repeat(600);
    expect(sanitizeString(long)).toHaveLength(500);
  });
});

describe("validateInt", () => {
  it("parses valid integers", () => {
    expect(validateInt("42")).toBe(42);
    expect(validateInt(7)).toBe(7);
    expect(validateInt("0")).toBe(0);
  });

  it("returns null for non-numeric", () => {
    expect(validateInt("abc")).toBeNull();
    expect(validateInt(null)).toBeNull();
    expect(validateInt(undefined)).toBeNull();
    expect(validateInt("")).toBeNull();
  });

  it("enforces min/max bounds", () => {
    expect(validateInt("5", { min: 10 })).toBeNull();
    expect(validateInt("100", { max: 50 })).toBeNull();
    expect(validateInt("25", { min: 10, max: 50 })).toBe(25);
  });

  it("rejects negative by default (min: 0)", () => {
    expect(validateInt("-1")).toBeNull();
  });
});

describe("isValidCoordinates", () => {
  it("accepts valid coordinates", () => {
    expect(isValidCoordinates(46.77, 23.59)).toBe(true); // Cluj-Napoca
    expect(isValidCoordinates(0, 0)).toBe(true);
    expect(isValidCoordinates(-90, -180)).toBe(true);
    expect(isValidCoordinates(90, 180)).toBe(true);
  });

  it("accepts string numbers", () => {
    expect(isValidCoordinates("46.77", "23.59")).toBe(true);
  });

  it("rejects out-of-range", () => {
    expect(isValidCoordinates(91, 0)).toBe(false);
    expect(isValidCoordinates(0, 181)).toBe(false);
    expect(isValidCoordinates(-91, 0)).toBe(false);
  });

  it("rejects non-numeric", () => {
    expect(isValidCoordinates("abc", "def")).toBe(false);
    expect(isValidCoordinates(null, null)).toBe(false);
  });
});

describe("parsePagination", () => {
  it("parses valid page and limit", () => {
    const result = parsePagination({ page: "3", limit: "25" });
    expect(result).toEqual({ page: 3, limit: 25, offset: 50 });
  });

  it("uses defaults for missing params", () => {
    const result = parsePagination({});
    expect(result).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it("caps limit at maxLimit", () => {
    const result = parsePagination({ limit: "500" }, { maxLimit: 100 });
    expect(result.limit).toBe(100);
  });

  it("handles page < 1", () => {
    const result = parsePagination({ page: "0" });
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
  });

  it("handles NaN inputs", () => {
    const result = parsePagination({ page: "abc", limit: "xyz" });
    expect(result).toEqual({ page: 1, limit: 20, offset: 0 });
  });
});

describe("paginatedResponse", () => {
  it("returns correct structure", () => {
    const result = paginatedResponse([1, 2, 3], 50, 2, 10);
    expect(result).toEqual({
      data: [1, 2, 3],
      pagination: { page: 2, limit: 10, total: 50, totalPages: 5 },
    });
  });

  it("handles zero total", () => {
    const result = paginatedResponse([], 0, 1, 20);
    expect(result.pagination.totalPages).toBe(0);
  });
});

describe("isValidRomanianPhone", () => {
  it("accepts valid RO phone numbers", () => {
    expect(isValidRomanianPhone("0721234567")).toBe(true);
    expect(isValidRomanianPhone("+40721234567")).toBe(true);
    expect(isValidRomanianPhone("40721234567")).toBe(true);
    expect(isValidRomanianPhone("0264-123-456")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(isValidRomanianPhone("123")).toBe(false);
    expect(isValidRomanianPhone("+1234567890")).toBe(false);
    expect(isValidRomanianPhone("")).toBe(false);
    expect(isValidRomanianPhone(null)).toBe(false);
  });
});

describe("validatePassword", () => {
  it("accepts valid passwords", () => {
    const result = validatePassword("Secure123");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects short passwords", () => {
    const result = validatePassword("Ab1");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/8 caractere/);
  });

  it("rejects passwords without digits", () => {
    const result = validatePassword("NoDigitsHere");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/cifră/);
  });

  it("rejects null/empty", () => {
    expect(validatePassword(null).valid).toBe(false);
    expect(validatePassword("").valid).toBe(false);
    expect(validatePassword(undefined).valid).toBe(false);
  });
});

describe("validateBusinessRequest", () => {
  it("accepts valid business request", () => {
    const result = validateBusinessRequest({
      name: "Restaurant Test",
      city_id: 1,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing name", () => {
    const result = validateBusinessRequest({ city_id: 1 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Numele/);
  });

  it("rejects missing city", () => {
    const result = validateBusinessRequest({ name: "Test Business" });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Orașul/);
  });

  it("validates phone format when provided", () => {
    const result = validateBusinessRequest({
      name: "Test",
      city_id: 1,
      phone: "invalid-phone",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/telefon/);
  });

  it("validates website URL when provided", () => {
    const result = validateBusinessRequest({
      name: "Test",
      city_id: 1,
      website: "not a url at all !!!",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects short description", () => {
    const result = validateBusinessRequest({
      name: "Test",
      city_id: 1,
      description: "short",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/10 caractere/);
  });
});

describe("ALLOWED_IMAGE_MIMES", () => {
  it("allows JPEG, PNG, WebP, GIF", () => {
    expect(ALLOWED_IMAGE_MIMES).toContain("image/jpeg");
    expect(ALLOWED_IMAGE_MIMES).toContain("image/png");
    expect(ALLOWED_IMAGE_MIMES).toContain("image/webp");
    expect(ALLOWED_IMAGE_MIMES).toContain("image/gif");
  });

  it("blocks SVG (XSS vector)", () => {
    expect(ALLOWED_IMAGE_MIMES).not.toContain("image/svg+xml");
  });
});
