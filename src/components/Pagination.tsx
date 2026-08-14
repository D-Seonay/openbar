"use client";

import React from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mt-6 pt-4 border-t border-rule">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="tap-target px-3 inline-flex items-center justify-center rounded-xl bg-paper-sunk border border-rule text-ink hover:bg-paper-sunk hover:text-terracotta disabled:opacity-50 disabled:hover:text-ink disabled:cursor-not-allowed transition-colors text-[13px] font-bold uppercase tracking-wider cursor-pointer"
      >
        Précédent
      </button>

      <span className="text-[13px] text-ink-soft font-bold px-3 uppercase tracking-wider">
        Page <span className="text-ink">{currentPage}</span> sur <span className="text-ink">{totalPages}</span>
      </span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="tap-target px-3 inline-flex items-center justify-center rounded-xl bg-paper-sunk border border-rule text-ink hover:bg-paper-sunk hover:text-terracotta disabled:opacity-50 disabled:hover:text-ink disabled:cursor-not-allowed transition-colors text-[13px] font-bold uppercase tracking-wider cursor-pointer"
      >
        Suivant
      </button>
    </div>
  );
}
