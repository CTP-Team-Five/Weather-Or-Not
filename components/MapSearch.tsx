//components/MapSearch.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { HiMagnifyingGlass } from "react-icons/hi2";
import styles from "./MapSearch.module.css";

export interface SearchResult {
    display_name: string;
    name?: string;
    lat: string;
    lon: string;
    boundingbox?: string[];
    class?: string;
    type?: string;
    address?: Record<string, string>;
}

interface MapSearchProps {
    onSelect: (coords: [number, number], searchResult?: SearchResult) => void;
    /** When true, focus the input on mount (homepage hero CTA → /map flow). */
    autoFocus?: boolean;
    /** Bias the vague-query fallback toward suffixes relevant to this
     *  activity. Hike → trail/national park; surf → beach/point;
     *  snowboard → ski resort/mountain. Falls back to a generic mix
     *  when omitted. */
    activity?: 'hike' | 'surf' | 'snowboard';
}

const FALLBACK_SUFFIXES: Record<'hike' | 'surf' | 'snowboard' | 'generic', string[]> = {
    hike: ['national park', 'state park', 'trail'],
    surf: ['beach', 'point', 'surf spot'],
    snowboard: ['ski resort', 'ski area', 'mountain'],
    generic: ['national park', 'state park', 'beach'],
};

function splitDisplayName(displayName: string) {
    const parts = displayName.split(",");
    const name = parts[0]?.trim() || displayName;
    const detail = parts.slice(1).join(",").trim();
    return { name, detail };
}

export default function MapSearch({ onSelect, autoFocus = false, activity }: MapSearchProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const cache = useRef<Record<string, SearchResult[]>>({});
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus on mount when requested. Wrapped in a tick to make sure the
    // element is in the DOM and any layout shifts are settled.
    useEffect(() => {
        if (!autoFocus) return;
        const id = window.setTimeout(() => inputRef.current?.focus(), 50);
        return () => window.clearTimeout(id);
    }, [autoFocus]);

    async function fetchOne(q: string): Promise<SearchResult[]> {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&q=${encodeURIComponent(q)}`,
        );
        return (await res.json()) as SearchResult[];
    }

    async function fetchResults(q: string) {
        if (!q.trim()) {
            setResults([]);
            return;
        }
        if (cache.current[q]) {
            setResults(cache.current[q]);
            return;
        }
        setLoading(true);
        try {
            const primary = await fetchOne(q);

            // Nominatim ranks by exact name match first, so single-word
            // queries like "acadia" surface "Acadia Parish, LA" but never
            // "Acadia National Park" because the park's name is the full
            // 3-word string. When we get few results AND the query looks
            // like an outdoor-relevant single word, retry with common
            // suffixes appended and merge the unique results back in.
            // Cheap UX fix that closes the biggest user-expectation gap
            // without swapping geocoders.
            const looksGeneric =
                primary.length < 3 && /^[A-Za-z]+$/.test(q.trim());
            let merged = primary;
            if (looksGeneric) {
                const suffixes = FALLBACK_SUFFIXES[activity ?? 'generic'];
                const extras = await Promise.all(
                    suffixes.map((s) => fetchOne(`${q} ${s}`).catch(() => [])),
                );
                const seen = new Set(primary.map((r) => `${r.lat},${r.lon}`));
                for (const list of extras) {
                    for (const r of list) {
                        const key = `${r.lat},${r.lon}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            merged.push(r);
                        }
                    }
                }
            }

            cache.current[q] = merged;
            setResults(merged);
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            if (query.length >= 2) fetchResults(query);
            else setResults([]);
        }, 300);
    }, [query]);

    const handleSelect = (result: SearchResult) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        onSelect([lat, lon], result);
        const shortLabel = result.name || result.display_name.split(",")[0].trim();
        setQuery(shortLabel);
        setResults([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[activeIndex]) handleSelect(results[activeIndex]);
        } else if (e.key === "Escape") {
            setResults([]);
        }
    };

    return (
        <div className={styles.root}>
            <div className={styles.inputWrap}>
                <HiMagnifyingGlass className={styles.icon} />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search for a spot..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setActiveIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    className={styles.input}
                    autoComplete="off"
                    spellCheck={false}
                />
                {loading && <div className={styles.spinner} aria-label="Searching" />}
            </div>

            {results.length > 0 && (
                <ul className={styles.dropdown} role="listbox">
                    {results.map((r, i) => {
                        const { name, detail } = splitDisplayName(r.display_name);
                        return (
                            <li
                                key={i}
                                role="option"
                                aria-selected={i === activeIndex}
                                onClick={() => handleSelect(r)}
                                className={`${styles.item} ${i === activeIndex ? styles.itemActive : ""}`}
                            >
                                <div className={styles.itemName}>{r.name || name}</div>
                                {detail && <div className={styles.itemDetail}>{detail}</div>}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
