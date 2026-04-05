const { extractCoordinates, isAllowedDomain } = require("../../src/helpers/mapsParser");

describe("isAllowedDomain", () => {
  it("allows Google Maps domains", () => {
    expect(isAllowedDomain("https://maps.app.goo.gl/abc123")).toBe(true);
    expect(isAllowedDomain("https://goo.gl/maps/xyz")).toBe(true);
    expect(isAllowedDomain("https://www.google.com/maps/@46.7,23.5")).toBe(true);
    expect(isAllowedDomain("https://www.google.ro/maps/place/Test")).toBe(true);
    expect(isAllowedDomain("https://maps.google.com/maps")).toBe(true);
    expect(isAllowedDomain("https://maps.google.ro/maps")).toBe(true);
  });

  it("rejects non-Google domains", () => {
    expect(isAllowedDomain("https://evil.com/maps")).toBe(false);
    expect(isAllowedDomain("https://maps.evil.com")).toBe(false);
    expect(isAllowedDomain("https://not-google.com/@46.7,23.5")).toBe(false);
    expect(isAllowedDomain("https://google.com.evil.com/")).toBe(false);
  });

  it("rejects non-HTTP protocols", () => {
    expect(isAllowedDomain("ftp://maps.google.com")).toBe(false);
    expect(isAllowedDomain("javascript:alert(1)")).toBe(false);
    expect(isAllowedDomain("file:///etc/passwd")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(isAllowedDomain("not a url")).toBe(false);
    expect(isAllowedDomain("")).toBe(false);
  });
});

describe("extractCoordinates", () => {
  it("extracts from !3d/!4d pattern (highest priority)", () => {
    const url = "https://www.google.com/maps/place/Cluj/@46.7712101,23.6236353,17z/data=!3d46.7712101!4d23.6236353";
    const result = extractCoordinates(url);
    expect(result).toEqual({ lat: 46.7712101, lng: 23.6236353 });
  });

  it("extracts from @lat,lng pattern", () => {
    const url = "https://www.google.com/maps/@44.4268,26.1025,17z";
    const result = extractCoordinates(url);
    expect(result).toEqual({ lat: 44.4268, lng: 26.1025 });
  });

  it("extracts from ?q=lat,lng pattern", () => {
    const url = "https://maps.google.com/maps?q=45.9432,24.9668";
    const result = extractCoordinates(url);
    expect(result).toEqual({ lat: 45.9432, lng: 24.9668 });
  });

  it("extracts from ll=lat,lng pattern", () => {
    const url = "https://maps.google.com/maps?ll=47.0465,21.9189&z=15";
    const result = extractCoordinates(url);
    expect(result).toEqual({ lat: 47.0465, lng: 21.9189 });
  });

  it("prefers !3d/!4d over @lat,lng", () => {
    // !3d has the actual pin location, @ has viewport center
    const url = "https://www.google.com/maps/place/Test/@46.0,23.0,12z/data=!3d46.5!4d23.5";
    const result = extractCoordinates(url);
    expect(result).toEqual({ lat: 46.5, lng: 23.5 }); // !3d wins
  });

  it("handles negative coordinates", () => {
    const url = "https://www.google.com/maps/@-33.8688,151.2093,15z";
    const result = extractCoordinates(url);
    expect(result).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it("returns null for URLs without coordinates", () => {
    expect(extractCoordinates("https://maps.app.goo.gl/abc123")).toBeNull();
    expect(extractCoordinates("https://www.google.com/maps/search/restaurant")).toBeNull();
  });

  it("rejects out-of-range coordinates", () => {
    // Lat > 90
    expect(extractCoordinates("https://maps.google.com/@91.0,23.0,15z")).toBeNull();
    // Lng > 180
    expect(extractCoordinates("https://maps.google.com/@46.0,181.0,15z")).toBeNull();
  });
});
