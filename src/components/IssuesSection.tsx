import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';
import { PaginationBar, usePaginated } from './Pagination';

// IssuesSection lists the report's issues, one alert per line. A single crashing Deployment emits one
// issue per pod, so this is the list most likely to run into the dozens — it's paged like the tables.
export function IssuesSection({ issues }: { issues?: string[] }) {
  const pg = usePaginated(issues ?? []);
  if (!issues || issues.length === 0) return null;
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Issues
      </Typography>
      {pg.items.map((issue, i) => (
        <Alert key={i} severity="warning" sx={{ mb: 1 }}>
          {issue}
        </Alert>
      ))}
      <PaginationBar page={pg.page} pageSize={pg.pageSize} total={pg.total} onChange={pg.setPage} />
    </Box>
  );
}
