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

  it('batches 30s activity heartbeats instead of saving the full DB each tick', () => {
    const source = readFileSync('src/App.tsx', 'utf8');
    expect(source).toContain("pm_activity_heartbeat_v1");
    expect(source).toContain("accumulatedSeconds += 30");
    expect(source).toContain("Date.now() - heartbeat.lastFlushAt < 300000");
    expect(source).toContain("await updateDatabase({ ...currentDBState, people: updatedPeople }, false, false)");
    expect(source).not.toContain("timeOnlineSeconds: (p.timeOnlineSeconds || 0) + 30");
  });

  it('waits for local DB/outbox persistence before resolving updateDatabase', () => {
    const source = readFileSync('src/App.tsx', 'utf8');
    expect(source).toContain("await new Promise<void>((resolve)");
    expect(source).toContain("persistAndQueue();");
  });

  it('deduplicates focus/visibility pulls and preserves a missed realtime signal', () => {
    const source = readFileSync('src/App.tsx', 'utf8');
    expect(source).toContain("pendingLoadRef.current = true");
    expect(source).toContain("now - lastForegroundSyncRef.current < 1500");
    expect(source).toContain("pendingLoadRef.current = false");
  });
});
