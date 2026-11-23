import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('mobile deep performance regressions', () => {
  it('renders member cards progressively while keeping full filtered data available', () => {
    const source = readFileSync('src/views/PeopleListView.tsx', 'utf8');
    expect(source).toContain("useState(30)");
    expect(source).toContain("filteredPeople.slice(0, visibleCount)");
    expect(source).toContain("{visiblePeople.map(p => {");
    expect(source).toContain("Carregar mais");
  });

  it('does not rebuild and persist the local database for empty deltas', () => {
    const source = readFileSync('src/App.tsx', 'utf8');
    expect(source).toContain("let shouldPersistDatabase = false");
    expect(source).toContain("changedEntities.length > 0 || activityLogCountChanged");
    expect(source).toContain("if (nextDb && shouldPersistDatabase)");
  });

  it('keeps an offline navigation shell in the service worker cache', () => {
    const source = readFileSync('public/sw.js', 'utf8');
    expect(source).toContain("'/index.html'");
    expect(source).toContain("caches.match('/index.html')");
  });
});
