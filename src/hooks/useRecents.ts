import { useCallback, useEffect, useState } from "react";
import { db, getRecentEntries, type Recent } from "../lib/db";

export function useRecents() {
  const [recents, setRecents] = useState<Recent[]>([]);
  const [draftKeys, setDraftKeys] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    const [rows, drafts] = await Promise.all([
      getRecentEntries(),
      db.drafts.toArray(),
    ]);
    setRecents(rows);
    setDraftKeys(new Set(drafts.map((d) => d.key)));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = query.trim()
    ? recents.filter((r) => r.title.toLowerCase().includes(query.trim().toLowerCase()))
    : recents;

  return { recents, draftKeys, refresh, query, setQuery, filtered };
}
