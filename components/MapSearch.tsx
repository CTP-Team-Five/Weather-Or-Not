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
}

function splitDisplayName(displayName: string) {
    const parts = displayName.split(",");
    const name = parts[0]?.trim() || displayName;
    const detail = parts.slice(1).join(",").trim();
    return { name, detail };
}

export default function MapSearch({ onSelect }: MapSearchProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const cache = useRef<Record<string, SearchResult[]>>({});

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
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(q)}`,
                { headers: { "User-Agent": "WeatherOrNot/1.0 (xyz@gmail.com)" } }
            );
            const data = await res.json();
            cache.current[q] = data;
            setResults(data);
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
