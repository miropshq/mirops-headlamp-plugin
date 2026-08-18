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
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import React, { useEffect, useMemo, useState } from 'react';
import { HIGH_RISK_THRESHOLD, riskSeverity } from '../riskColor';
import { GraphNode, GraphNodeType, ReportGraph } from '../types';

// Layered layout, read left→right as "what fails" → "what it depends on":
// failing workloads/pods on the left, the storage/config they use next, the
// node they run on, and add-ons pinned to the far right. Empty columns are
// compacted away in buildNodes so a missing layer never leaves a gap.
const TYPE_COLUMN: Record<GraphNodeType, number> = {
  network: 0,
  workload: 1,
  config: 2,
  storage: 2,
  infra: 3,
  addon: 4,
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
  // Count names so a namespace is shown only when a name is ambiguous (appears on more than one
  // visible node). Unique names render clean — just the name — with no namespace at all.
  const nameCounts = new Map<string, number>();
  for (const n of visible.nodes) {
    const col = TYPE_COLUMN[n.type] ?? 4;
    const list = byColumn.get(col) ?? [];
    list.push(n);
    byColumn.set(col, list);
    nameCounts.set(n.name, (nameCounts.get(n.name) ?? 0) + 1);
  }

  // Compact the used columns to consecutive indices, so a missing layer (e.g. no network nodes)
  // doesn't leave an empty leading column that pushes everything right and stretches the edges.
  const denseIndex = new Map(
    [...byColumn.keys()].sort((a, b) => a - b).map((col, i) => [col, i])
  );

  const rfNodes: Node[] = [];
  for (const [col, list] of byColumn) {
    const x = (denseIndex.get(col) ?? 0) * COLUMN_GAP;
    list.sort(
      (a, b) =>
        (a.namespace ?? '').localeCompare(b.namespace ?? '') || a.name.localeCompare(b.name)
    );
    list.forEach((n, row) => {
      const dimmed = visible.dimmedIds.has(n.id);
      const { level, color } = riskSeverity(n.risk);
      // Only disambiguate with the namespace when this name isn't unique among visible nodes.
      const showNamespace = !!n.namespace && (nameCounts.get(n.name) ?? 0) > 1;
      rfNodes.push({
        id: n.id,
        position: { x, y: row * ROW_GAP },
        connectable: false,
        data: {
          label: (
            <div title={`${n.kind} · risk ${n.risk} (${level})${n.status ? ` · ${n.status}` : ''}`}>
              <strong>{n.name}</strong>
              {/* Namespace only when the name is ambiguous — two same-named workloads (e.g. app in
                  test4 vs test5) need it to be told apart; unique names stay clean, like the design. */}
              {showNamespace && (
                <span style={{ fontSize: 10, opacity: 0.7 }}> · {n.namespace}</span>
              )}
              {/* Risk value is the point of the graph — show the number, then the severity word. */}
              <div style={{ fontSize: 10, opacity: 0.85 }}>
                {n.kind} · <strong>{n.risk}</strong> {level}
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
              background: color,
              color: '#fff',
              border:
                n.risk >= HIGH_RISK_THRESHOLD
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
  // The computed layout is the starting point; useNodesState holds the live positions so nodes can
  // be dragged to untangle the graph by hand. Re-sync whenever the filter recomputes the layout.
  const computedNodes = useMemo(() => buildNodes(visible), [visible]);
  const computedEdges = useMemo(() => {
    const visibleIds = new Set(visible.nodes.map(n => n.id));
    return buildEdges(graph, visibleIds);
  }, [graph, visible]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  useEffect(() => setNodes(computedNodes), [computedNodes, setNodes]);
  useEffect(() => setEdges(computedEdges), [computedEdges, setEdges]);

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
        Failing workloads on the left, add-ons on the right; each node shows its risk value (0–100)
        and severity, colored None→Critical; gray dashed nodes are healthy direct neighbors shown for
        context; edges labeled by dependency type. Drag any node to untangle the layout.
      </Typography>
      <Box sx={{ height: 520, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <ReactFlow
          // Remount on filter change so fitView re-frames the visible graph
          key={`${showAll}-${minRisk}`}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
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
