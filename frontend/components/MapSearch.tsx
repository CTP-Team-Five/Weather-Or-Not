//components/MapSearch.tsx

"use client";

import { useState, useEffect, useRef } from "react";

interface SearchResult {
    display_name: string;
    lat: string;
    lon: string;
}

interface MapSearchProps {
    onSelect: (coords: [number, number]) => void;
}

export default function MapSearch({ onSelect }: MapSearchProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const cache = useRef<Record<string, SearchResult[]>>({});

    // Fetch results from Nominatim
    async function fetchResults(q: string) {
        if (!q.trim()) {
            setResults([]);
            return;
        }

        // Cached?
        if (cache.current[q]) {
            setResults(cache.current[q]);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`
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

    // Debounce typing
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            if (query.length >= 2) fetchResults(query);
        }, 300);
    }, [query]);

    // Handle selection
    const handleSelect = (result: SearchResult) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        onSelect([lat, lon]);
        setQuery(result.display_name);
        setResults([]);
    };

    // Keyboard controls
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[activeIndex]) handleSelect(results[activeIndex]);
        }
    };

    return (
        <div
            style={{
                width: "100%",
                maxWidth: "420px",
                position: "relative",
            }}
        >
            {/* Input */}
            <input
                type="text"
                placeholder="Search for a place..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="glassy search-input"
                style={{
                    width: "100%",
                    padding: "0.8rem 1rem",
                    borderRadius: "10px",
                    border: "none",
                    outline: "none",
                    background: "rgba(45, 45, 45, 0.85)",
                    color: "#f1f1f1",
                    fontSize: "1rem",
                    backdropFilter: "blur(8px)",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                }}
            />

            {/* Results Dropdown */}
            {results.length > 0 && (
                <ul
                    style={{
                        listStyle: "none",
                        padding: 0,
                        marginTop: "0.4rem",
                        background: "rgba(25, 25, 25, 0.9)",
                        backdropFilter: "blur(8px)",
                        borderRadius: "10px",
                        overflow: "hidden",
                        boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                        maxHeight: "260px",
                        overflowY: "auto",
                        position: "absolute",
                        width: "100%",
                        zIndex: 3000,
                    }}
                >
                    {results.map((r, i) => (
                        <li
                            key={i}
                            onClick={() => handleSelect(r)}
                            style={{
                                padding: "0.7rem 1rem",
                                background:
                                    i === activeIndex
                                        ? "rgba(99, 102, 241, 0.25)"
                                        : "transparent",
                                cursor: "pointer",
                                color: "#f1f1f1",
                                transition: "background 0.2s ease",
                            }}
                        >
                            {r.display_name}
                        </li>
                    ))}
                </ul>
            )}

            {loading && (
                <p
                    style={{
                        textAlign: "center",
                        marginTop: "0.4rem",
                        fontSize: "0.9rem",
                        color: "#a1a1aa",
                    }}
                >
                    Searching...
                </p>
            )}
        </div>
    );
}
