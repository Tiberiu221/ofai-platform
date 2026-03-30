const { buildFuzzySearch } = require('../../src/helpers/search');

describe('search helper', () => {
  describe('buildFuzzySearch', () => {
    it('returns condition with ILIKE + similarity for marked columns', () => {
      const result = buildFuzzySearch([
        { col: 'o.title', ilike: true, similarity: true },
        { col: 'o.description', ilike: true, similarity: false },
        { col: 'b.name', ilike: true, similarity: true },
      ], 1);

      expect(result.condition).toContain('o.title ILIKE $1');
      expect(result.condition).toContain('o.description ILIKE $1');
      expect(result.condition).toContain('b.name ILIKE $1');
      expect(result.condition).toContain('similarity(o.title, $2)');
      expect(result.condition).toContain('similarity(b.name, $2)');
      // description should NOT have similarity
      expect(result.condition).not.toContain('similarity(o.description');
    });

    it('returns 2 params when similarity columns exist', () => {
      const result = buildFuzzySearch([
        { col: 'b.name', ilike: true, similarity: true },
      ], 1);

      expect(result.paramCount).toBe(2);
      const params = result.params('test');
      expect(params).toEqual(['%test%', 'test']);
    });

    it('returns 1 param when no similarity columns', () => {
      const result = buildFuzzySearch([
        { col: 'o.description', ilike: true, similarity: false },
      ], 3);

      expect(result.paramCount).toBe(1);
      expect(result.condition).toContain('$3');
      expect(result.condition).not.toContain('similarity');
      const params = result.params('query');
      expect(params).toEqual(['%query%']);
    });

    it('generates orderClause with GREATEST for multiple similarity columns', () => {
      const result = buildFuzzySearch([
        { col: 'o.title', ilike: true, similarity: true },
        { col: 'b.name', ilike: true, similarity: true },
      ], 1);

      expect(result.orderClause).toContain('GREATEST');
      expect(result.orderClause).toContain('similarity(o.title, $2)');
      expect(result.orderClause).toContain('similarity(b.name, $2)');
    });

    it('uses correct paramIdx offset', () => {
      const result = buildFuzzySearch([
        { col: 'b.name', ilike: true, similarity: true },
      ], 5);

      expect(result.condition).toContain('$5');
      expect(result.condition).toContain('$6');
    });
  });
});
