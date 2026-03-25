import { useState, useEffect, useRef } from "react";

export function SearchDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      // Load Pagefind on first open
      loadPagefind();
    }
  }, [isOpen]);

  async function loadPagefind() {
    if (typeof window !== "undefined" && !(window as any).__pagefind) {
      try {
        // Pagefind is generated at build time into /pagefind/
        const module = await import(
          /* @vite-ignore */
          new URL("/pagefind/pagefind.js", window.location.origin).href
        );
        (window as any).__pagefind = module;
      } catch {
        // Pagefind not yet built — will be available after build
      }
    }
  }

  async function handleSearch(q: string) {
    setQuery(q);
    if (!q.trim()) return;

    const pagefind = (window as any).__pagefind;
    if (!pagefind) return;

    const search = await pagefind.search(q);
    const results = await Promise.all(
      search.results.slice(0, 10).map((r: any) => r.data())
    );
    setSearchResults(results);
  }

  const [searchResults, setSearchResults] = useState<any[]>([]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300
          px-3 py-1.5 text-sm text-gray-500 hover:border-gray-400
          dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500
          transition-colors"
        aria-label="Search (Cmd+K)"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline-flex items-center rounded border border-gray-300 px-1 text-xs dark:border-gray-600">
          {"\u2318"}K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setIsOpen(false)}
    >
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-gray-200 dark:border-gray-700 px-4">
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search notes and posts..."
            className="w-full bg-transparent px-3 py-4 text-sm outline-none dark:text-white"
          />
          <kbd className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-400 dark:border-gray-600">
            Esc
          </kbd>
        </div>
        {searchResults.length > 0 && (
          <ul className="max-h-80 overflow-y-auto p-2">
            {searchResults.map((result, i) => (
              <li key={i}>
                <a
                  href={result.url}
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {result.meta?.title || result.url}
                  </div>
                  {result.excerpt && (
                    <div
                      className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: result.excerpt }}
                    />
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
        {query && searchResults.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}
