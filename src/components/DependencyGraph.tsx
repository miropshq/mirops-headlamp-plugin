import '@xyflow/react/dist/style.css';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useTheme } from '@mui/material/styles';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import {
  Background,
  Controls,
  type Edge,
  MarkerType,
  type Node,
  ReactFlow,
} from '@xyflow/react';
import React, { useMemo, useState } from 'react';
import { AT_RISK_THRESHOLD, riskColor } from '../riskColor';
import { GraphNode, GraphNodeType, ReportGraph } from '../types';

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

const MIN_RISK_MARKS = [0, 25, 50, 75].map(v => ({ value: v, label: String(v) }));

interface VisibleGraph {
  nodes: GraphNode[];
  // Direct neighbors of focus nodes, shown dimmed for context only
  dimmedIds: Set<string>;
}

// The report always ships the FULL mirror; filtering is purely client-side.
// Default: only risky nodes plus their direct neighbors. Risk propagation
// guarantees an impacted dependent is never green, so this cannot hide an
// affected component.
function filterByRisk(graph: ReportGraph, showAll: boolean, minRisk: number): VisibleGraph {
  if (showAll) {
    return { nodes: graph.nodes, dimmedIds: new Set() };
  }

  const focusIds = new Set(
    graph.nodes.filter(n => n.risk > 0 && n.risk >= minRisk).map(n => n.id)
  );

  const neighborIds = new Set<string>();
  for (const e of graph.edges) {
    if (focusIds.has(e.from) && !focusIds.has(e.to)) neighborIds.add(e.to);
    if (focusIds.has(e.to) && !focusIds.has(e.from)) neighborIds.add(e.from);
  }

  return {
    nodes: graph.nodes.filter(n => focusIds.has(n.id) || neighborIds.has(n.id)),
    dimmedIds: neighborIds,
  };
}

function buildNodes(visible: VisibleGraph): Node[] {
  const byColumn = new Map<number, GraphNode[]>();
  for (const n of visible.nodes) {
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
      const dimmed = visible.dimmedIds.has(n.id);
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
        style: dimmed
          ? {
              background: '#616161',
              color: '#fff',
              opacity: 0.55,
              border: '1px dashed rgba(255,255,255,0.4)',
              borderRadius: 8,
              padding: '4px 8px',
              width: NODE_WIDTH,
              fontSize: 12,
              textAlign: 'left' as const,
            }
          : {
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

function buildEdges(graph: ReportGraph, visibleIds: Set<string>): Edge[] {
  return graph.edges
    .filter(e => visibleIds.has(e.from) && visibleIds.has(e.to))
    .map((e, i) => ({
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
  const [showAll, setShowAll] = useState(false);
  const [minRisk, setMinRisk] = useState(0);

  const visible = useMemo(
    () => filterByRisk(graph, showAll, minRisk),
    [graph, showAll, minRisk]
  );
  const nodes = useMemo(() => buildNodes(visible), [visible]);
  const edges = useMemo(() => {
    const visibleIds = new Set(visible.nodes.map(n => n.id));
    return buildEdges(graph, visibleIds);
  }, [graph, visible]);

  if (graph.nodes.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Dependency Graph
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', mb: 1 }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showAll}
              onChange={e => setShowAll(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Show all</Typography>}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="body2" color={showAll ? 'text.disabled' : 'text.secondary'}>
            Min risk
          </Typography>
          <ButtonGroup size="small" disabled={showAll} variant="outlined">
            {MIN_RISK_MARKS.map(m => (
              <Button
                key={m.value}
                variant={minRisk === m.value ? 'contained' : 'outlined'}
                onClick={() => setMinRisk(m.value)}
              >
                {m.label}
              </Button>
            ))}
          </ButtonGroup>
        </Box>
        <Typography variant="caption" color="text.secondary">
          showing {visible.nodes.length} of {graph.nodes.length} components
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Nodes colored by propagated risk (green 0 → red 100); gray dashed nodes are
        healthy direct neighbors shown for context; edges labeled by dependency type.
      </Typography>
      <Box sx={{ height: 520, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <ReactFlow
          // Remount on filter change so fitView re-frames the visible graph
          key={`${showAll}-${minRisk}`}
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
