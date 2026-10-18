import TablePagination from '@mui/material/TablePagination';
import React, { useState } from 'react';

// A crashing workload can produce dozens of rows (a Deployment with 15 CrashLoopBackOff pods, one
// Issue line per pod). Rather than render every row at once — which turns the report into an endless
// scroll — long lists are paged into chunks of RESOURCE_PAGE_SIZE with a range pager ("1–12 of N").
export const RESOURCE_PAGE_SIZE = 12;

// usePaginated slices `rows` into the current page. `page` is clamped in render so shrinking the list
// (e.g. toggling "Only show problems") can never leave the pager pointing past the last page.
export function usePaginated<T>(rows: T[], pageSize = RESOURCE_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    page: current,
    setPage,
    pageCount,
    pageSize,
    total: rows.length,
  };
}

// PaginationBar is the range-style pager Headlamp uses on its own tables ("1–12 of 40  ‹ ›"). It's
// MUI's TablePagination rendered standalone (component="div") below a table, with the rows-per-page
// selector hidden. It removes itself when everything fits on one page, so short lists are untouched.
export function PaginationBar({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (total <= pageSize) return null;
  return (
    <TablePagination
      component="div"
      count={total}
      page={page - 1}
      rowsPerPage={pageSize}
      rowsPerPageOptions={[]}
      onPageChange={(_, p) => onChange(p + 1)}
    />
  );
}
