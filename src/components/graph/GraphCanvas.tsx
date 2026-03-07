'use client';

import { useRef, useEffect, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import { OLYMPIADS } from '@/config/olympiads';
import type { OlympiadId } from '@/config/olympiads';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-gray-100 rounded" />,
});

export interface GraphNode {
  id: string;
  name: string;
  isMultiOlympiad?: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
  olympiad: string;
  year: number;
  curvature: number;
}

export interface GraphCanvasHandle {
  renderHighRes(scale: number): string | null;
}

interface GraphCanvasProps {
  nodes: GraphNode[];
  links: GraphLink[];
  rootId: string | null;
  expandedNodeIds: Set<string>;
  fitVersion: number;
  onNodeClick: (nodeId: string) => void;
  showLabels: boolean;
  fullGraph?: boolean;
}

interface PositionedGraphNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

type PositionedGraphLink = Omit<GraphLink, 'source' | 'target'> & {
  source: string | PositionedGraphNode;
  target: string | PositionedGraphNode;
};

function resolveLinkNode(
  endpoint: PositionedGraphLink['source'] | PositionedGraphLink['target'],
  nodeById: Map<string, PositionedGraphNode>
): PositionedGraphNode | null {
  if (typeof endpoint === 'string') {
    return nodeById.get(endpoint) ?? null;
  }

  return endpoint ?? null;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas({
  nodes,
  links,
  rootId,
  expandedNodeIds,
  fitVersion,
  onNodeClick,
  showLabels,
  fullGraph,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
  const nodeCacheRef = useRef(new Map<string, PositionedGraphNode>());
  const nodePositionsRef = useRef(new Map<string, { x: number; y: number }>());
  const cachedRootIdRef = useRef<string | null>(null);
  const lastQueuedFitVersionRef = useRef(0);
  const pendingAutoFitRef = useRef(false);
  const globalScaleRef = useRef(1);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (graphRef.current) {
      const chargeForce = graphRef.current.d3Force('charge') as
        | { strength: (strength: number) => void }
        | undefined;
      const linkForce = graphRef.current.d3Force('link') as
        | { distance: (distance: number) => void }
        | undefined;

      chargeForce?.strength(fullGraph ? -60 : -200);
      linkForce?.distance(fullGraph ? 40 : 80);
    }
  }, [dimensions, nodes.length, links.length, fullGraph]);

  useEffect(() => {
    if (!dimensions || fitVersion <= lastQueuedFitVersionRef.current) return;

    lastQueuedFitVersionRef.current = fitVersion;
    pendingAutoFitRef.current = true;
  }, [dimensions, fitVersion]);

  const handleEngineStop = useCallback(() => {
    if (graphRef.current && pendingAutoFitRef.current) {
      graphRef.current.zoomToFit(250, 80);
      pendingAutoFitRef.current = false;
    }
  }, []);

  const handleNodeClick = useCallback(
    (node: any) => {
      if (!fullGraph) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick, fullGraph]
  );

  const handleNodeDragEnd = useCallback(() => {
    if (!fullGraph) {
      pendingAutoFitRef.current = true;
    }
  }, [fullGraph]);

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      nodePositionsRef.current.set(node.id, { x: node.x, y: node.y });
      globalScaleRef.current = globalScale;

      const label = node.name;
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px sans-serif`;

      const isRoot = node.id === rootId;
      // Full graph: world-space sizes (scale with zoom). Focused: screen-space.
      const radius = fullGraph ? 4 : isRoot ? 8 / globalScale : 5 / globalScale;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

      if (fullGraph) {
        if (node.isMultiOlympiad) {
          ctx.fillStyle = '#6B7280';
          ctx.fill();
          ctx.strokeStyle = '#111827';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = '#D1D5DB';
          ctx.fill();
        }
      } else {
        const isExpanded = expandedNodeIds.has(node.id);

        if (isRoot) {
          ctx.fillStyle = '#111827';
        } else if (isExpanded) {
          ctx.fillStyle = '#6B7280';
        } else {
          ctx.fillStyle = '#D1D5DB';
        }
        ctx.fill();

        if (isRoot || isExpanded) {
          ctx.strokeStyle = '#111827';
          ctx.lineWidth = 1.5 / globalScale;
          ctx.stroke();
        }
      }

      const shouldShowLabel = showLabels;
      if (shouldShowLabel) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#374151';
        const labelOffset = fullGraph ? radius + 1 : radius + 2 / globalScale;
        ctx.fillText(label, node.x, node.y + labelOffset);
      }
    },
    [expandedNodeIds, rootId, showLabels, fullGraph]
  );

  const linkColor = useCallback((link: any) => {
    const config = OLYMPIADS[link.olympiad as OlympiadId];
    return config?.color ?? '#999';
  }, []);

  const linkCurvature = useCallback((link: any) => {
    return link.curvature;
  }, []);

  // In full graph mode, scale link width with zoom to keep world-space proportions
  const fullGraphLinkWidth = useCallback(() => {
    return 1 * globalScaleRef.current;
  }, []);

  const nodePointerAreaPaint = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const radius = fullGraph ? 4 : node.id === rootId ? 8 / globalScale : 5 / globalScale;
      const padding = fullGraph ? 3 : 4 / globalScale;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + padding, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [rootId, fullGraph]
  );

  const visibleNodeKey = useMemo(
    () => nodes.map((node) => node.id).sort().join('|'),
    [nodes]
  );

  const visibleLinkKey = useMemo(
    () =>
      links
        .map((link) => `${link.source}|${link.target}|${link.olympiad}|${link.year}`)
        .sort()
        .join('|'),
    [links]
  );

  const expandedNodeKey = useMemo(
    () => [...expandedNodeIds].sort().join('|'),
    [expandedNodeIds]
  );

  useEffect(() => {
    if (!graphRef.current) return;

    // Root/expanded/label changes only affect node painting, so request a single
    // redraw without disabling the library's idle auto-pause behavior.
    const { x, y } = graphRef.current.centerAt();
    graphRef.current.centerAt(x, y, 0);
  }, [expandedNodeKey, rootId, showLabels]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps use stable string keys instead of array references
  const graphData = useMemo((): { nodes: PositionedGraphNode[]; links: PositionedGraphLink[] } => {
    const cacheKey = fullGraph ? '__full__' : rootId;
    if (cacheKey !== cachedRootIdRef.current) {
      cachedRootIdRef.current = cacheKey;
      nodeCacheRef.current.clear();
      nodePositionsRef.current.clear();
    }

    const cache = nodeCacheRef.current;
    const posMap = nodePositionsRef.current;
    const visibleNodeIds = new Set(nodes.map((node) => node.id));

    for (const cachedId of cache.keys()) {
      if (!visibleNodeIds.has(cachedId)) {
        cache.delete(cachedId);
        posMap.delete(cachedId);
      }
    }

    const graphNodes = nodes.map((node) => {
      let cachedNode = cache.get(node.id);

      if (!cachedNode) {
        cachedNode = { ...node };

        const neighborLink = links.find(
          (link) => link.source === node.id || link.target === node.id
        );
        if (neighborLink) {
          const neighborId = neighborLink.source === node.id ? neighborLink.target : neighborLink.source;
          const neighborPos = posMap.get(neighborId);
          if (neighborPos) {
            cachedNode.x = neighborPos.x + (Math.random() - 0.5) * 40;
            cachedNode.y = neighborPos.y + (Math.random() - 0.5) * 40;
            cachedNode.vx = 0;
            cachedNode.vy = 0;
          }
        }

        cache.set(node.id, cachedNode);
        return cachedNode;
      }

      cachedNode.name = node.name;
      cachedNode.isMultiOlympiad = node.isMultiOlympiad;
      return cachedNode;
    });

    return {
      nodes: graphNodes,
      links: links as PositionedGraphLink[],
    };
  }, [rootId, fullGraph, visibleLinkKey, visibleNodeKey]);

  // High-res offscreen render — kept in a ref so the imperative handle is always current
  const renderHighResRef = useRef<(scale: number) => string | null>(null);
  renderHighResRef.current = (scale: number) => {
    const fg = graphRef.current;
    if (!fg || !dimensions) return null;

    const w = dimensions.width * scale;
    const h = dimensions.height * scale;

    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d')!;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Get current viewport transform
    const currentZoom: number = fg.zoom();
    const center = fg.centerAt();

    // Apply viewport transform at higher resolution
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(currentZoom * scale, currentZoom * scale);
    ctx.translate(-center.x, -center.y);

    // Draw links from the same memoized data passed into the live canvas.
    const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]));
    for (const link of graphData.links) {
      const src = resolveLinkNode(link.source, nodeById);
      const tgt = resolveLinkNode(link.target, nodeById);
      if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) {
        continue;
      }

      const config = OLYMPIADS[link.olympiad as OlympiadId];
      ctx.strokeStyle = config?.color ?? '#999';
      // The library renders linkWidth in screen-space (divides by globalScale).
      // For our offscreen render, we draw in graph-space directly.
      // Full graph world-space: 1 graph unit. Focused screen-space: 1.5 / zoom graph units.
      ctx.lineWidth = fullGraph ? 1 : 1.5 / currentZoom;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);

      const c = link.curvature ?? 0;
      if (c !== 0) {
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const cpx = (src.x + tgt.x) / 2 - dy * c;
        const cpy = (src.y + tgt.y) / 2 + dx * c;
        ctx.quadraticCurveTo(cpx, cpy, tgt.x, tgt.y);
      } else {
        ctx.lineTo(tgt.x, tgt.y);
      }
      ctx.stroke();
    }

    // Draw nodes (reuse the same rendering logic)
    for (const node of graphData.nodes) {
      if (node.x == null || node.y == null) continue;
      nodeCanvasObject(node, ctx, currentZoom);
    }

    ctx.restore();
    return offscreen.toDataURL('image/png');
  };

  useImperativeHandle(ref, () => ({
    renderHighRes(scale: number) {
      return renderHighResRef.current?.(scale) ?? null;
    },
  }), []);

  return (
    <div ref={containerRef} className="h-[350px] w-full border border-gray-200 rounded-lg overflow-hidden sm:h-[500px]">
      {dimensions && (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={nodePointerAreaPaint}
          onNodeClick={handleNodeClick}
          onNodeDragEnd={handleNodeDragEnd}
          onEngineStop={handleEngineStop}
          linkColor={linkColor}
          linkWidth={fullGraph ? fullGraphLinkWidth : 1.5}
          linkCurvature={linkCurvature}
          width={dimensions.width}
          height={dimensions.height}
          cooldownTicks={100}
        />
      )}
    </div>
  );
});
