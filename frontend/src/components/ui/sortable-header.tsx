'use client';
import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface SortableHeaderProps {
  label: string;
  field: string;
  currentSort: string;
  currentOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}

export function SortableHeader({ label, field, currentSort, currentOrder, onSort }: SortableHeaderProps) {
  const active = currentSort === field;
  return (
    <th
      className="p-3 text-left cursor-pointer select-none hover:bg-gray-100 transition-colors"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          currentOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        )}
      </span>
    </th>
  );
}

export function useSort(defaultField: string, defaultOrder: 'asc' | 'desc' = 'desc') {
  const [sortBy, setSortBy] = useState(defaultField);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultOrder);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return { sortBy, sortOrder, handleSort };
}
