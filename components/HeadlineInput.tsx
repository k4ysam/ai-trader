"use client";

import { useState, type KeyboardEvent, type FormEvent } from "react";

const EXAMPLES = [
  "NVDA beats Q4 earnings by 20%, data center revenue surges",
  "SEC announces investigation into NVDA accounting practices",
  "NVDA announces 10-for-1 stock split",
  "Competitor AMD unveils chip that matches NVDA H100 performance",
];

interface HeadlineInputProps {
  onSubmit: (headline: string) => void;
  isLoading: boolean;
  isCooldown?: boolean;
}

export default function HeadlineInput({ onSubmit, isLoading, isCooldown = false }: HeadlineInputProps) {
  const [value, setValue] = useState("");
  const disabled = isLoading || isCooldown;

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          className="flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          rows={2}
          placeholder="Enter a news headline about NVDA... (Enter to submit)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          maxLength={500}
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCooldown ? (
            "Wait..."
          ) : isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Analyzing
            </span>
          ) : (
            "Analyze"
          )}

        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => { setValue(ex); }}
            disabled={disabled}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
          >
            {ex.length > 50 ? ex.slice(0, 50) + "…" : ex}
          </button>
        ))}
      </div>
    </div>
  );
}
