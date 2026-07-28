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
    <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-white/[0.06]">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 rounded-xl bg-ink-2 border border-white/[0.08] text-cream hover:bg-white/[0.04] hover:text-orange disabled:opacity-50 disabled:hover:text-cream disabled:cursor-not-allowed transition-colors text-xs font-bold tracking-wider uppercase cursor-pointer"
      >
        Précédent
      </button>
      
      <span className="text-xs text-muted font-bold px-3 uppercase tracking-wider">
        Page <span className="text-cream">{currentPage}</span> sur <span className="text-cream">{totalPages}</span>
      </span>
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 rounded-xl bg-ink-2 border border-white/[0.08] text-cream hover:bg-white/[0.04] hover:text-orange disabled:opacity-50 disabled:hover:text-cream disabled:cursor-not-allowed transition-colors text-xs font-bold tracking-wider uppercase cursor-pointer"
      >
        Suivant
      </button>
    </div>
  );
}
