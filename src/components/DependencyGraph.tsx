import '@xyflow/react/dist/style.css';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import {
  Background,
  Controls,
  type Edge,
  MarkerType,
  type Node,
  ReactFlow,
} from '@xyflow/react';
import React, { useMemo } from 'react';
import { AT_RISK_THRESHOLD, riskColor } from '../riskColor';
import { GraphNodeType, ReportGraph } from '../types';

// Layered layout: one column per node type, following the dependency
// direction (Ingress/Service → workload → config/storage → node/add-on).
const TYPE_COLUMN: Record<GraphNodeType, number> = {
  network: 0,
  workload: 1,
  config: 2,
  storage: 2,
  infra: 3,
  addon: 3,
};

const NODE_WIDTH = 220;
const COLUMN_GAP = 300;
const ROW_GAP = 64;

function buildNodes(graph: ReportGraph): Node[] {
  const byColumn = new Map<number, typeof graph.nodes>();
  for (const n of graph.nodes) {
    const col = TYPE_COLUMN[n.type] ?? 4;
    const list = byColumn.get(col) ?? [];
    list.push(n);
    byColumn.set(col, list);
  }

  const rfNodes: Node[] = [];
  for (const [col, list] of byColumn) {
    list.sort(
      (a, b) =>
        (a.namespace ?? '').localeCompare(b.namespace ?? '') || a.name.localeCompare(b.name)
    );
    list.forEach((n, row) => {
      rfNodes.push({
        id: n.id,
        position: { x: col * COLUMN_GAP, y: row * ROW_GAP },
        connectable: false,
        data: {
          label: (
            <div title={`${n.kind} · risk ${n.risk}${n.status ? ` · ${n.status}` : ''}`}>
              <strong>{n.name}</strong>
              <div style={{ fontSize: 10, opacity: 0.85 }}>
                {n.kind}
                {n.namespace ? ` · ${n.namespace}` : ''} · risk {n.risk}
              </div>
            </div>
          ),
        },
        style: {
          background: riskColor(n.risk),
          color: '#fff',
          border:
            n.risk >= AT_RISK_THRESHOLD
              ? '2px solid #ff5252'
              : '1px solid rgba(255,255,255,0.25)',
          borderRadius: 8,
          padding: '4px 8px',
          width: NODE_WIDTH,
          fontSize: 12,
          textAlign: 'left' as const,
        },
      });
    });
  }
  return rfNodes;
}

function buildEdges(graph: ReportGraph): Edge[] {
  return graph.edges.map((e, i) => ({
    id: `${e.from}->${e.to}#${i}`,
    source: e.from,
    target: e.to,
    label: e.type,
    labelStyle: { fontSize: 9 },
    style: { stroke: '#9e9e9e' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#9e9e9e' },
  }));
}

export function DependencyGraph({ graph }: { graph: ReportGraph }) {
  const theme = useTheme();
  const nodes = useMemo(() => buildNodes(graph), [graph]);
  const edges = useMemo(() => buildEdges(graph), [graph]);

  if (graph.nodes.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Dependency Graph
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Nodes colored by propagated risk (green 0 → red 100); edges labeled by dependency type.
      </Typography>
      <Box sx={{ height: 520, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          colorMode={theme.palette.mode}
          fitView
          minZoom={0.1}
          nodesConnectable={false}
          edgesFocusable={false}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </Box>
    </Box>
  );
}
