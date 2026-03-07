'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { OLYMPIADS } from '@/config/olympiads';
import type { OlympiadId } from '@/config/olympiads';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-gray-100 rounded" />,
});

export interface GraphNode {
  id: string;
  name: string;
}

export interface GraphLink {
  source: string;
  target: string;
  olympiad: string;
  year: number;
  curvature: number;
}

interface GraphCanvasProps {
  nodes: GraphNode[];
  links: GraphLink[];
  rootId: string | null;
  expandedNodeIds: Set<string>;
  fitVersion: number;
  onNodeClick: (nodeId: string) => void;
  showLabels: boolean;
}

interface PositionedGraphNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export function GraphCanvas({
  nodes,
  links,
  rootId,
  expandedNodeIds,
  fitVersion,
  onNodeClick,
  showLabels,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const nodeCacheRef = useRef(new Map<string, PositionedGraphNode>());
  const nodePositionsRef = useRef(new Map<string, { x: number; y: number }>());
  const cachedRootIdRef = useRef<string | null>(null);
  const lastQueuedFitVersionRef = useRef(0);
  const pendingAutoFitRef = useRef(false);
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
      graphRef.current.d3Force('charge').strength(-200);
      graphRef.current.d3Force('link').distance(80);
    }
  }, [dimensions, nodes.length, links.length]);

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
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  const handleNodeDragEnd = useCallback(() => {
    pendingAutoFitRef.current = true;
  }, []);

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      // Track positions for placing new nodes near neighbors
      nodePositionsRef.current.set(node.id, { x: node.x, y: node.y });

      const label = node.name;
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px sans-serif`;

      const isRoot = node.id === rootId;
      const isExpanded = expandedNodeIds.has(node.id);

      const radius = isRoot ? 8 / globalScale : 5 / globalScale;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

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

      if (showLabels) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#374151';
        ctx.fillText(label, node.x, node.y + radius + 2 / globalScale);
      }
    },
    [expandedNodeIds, rootId, showLabels]
  );

  const linkColor = useCallback((link: any) => {
    const config = OLYMPIADS[link.olympiad as OlympiadId];
    return config?.color ?? '#999';
  }, []);

  const linkCurvature = useCallback((link: any) => {
    return link.curvature;
  }, []);

  const nodePointerAreaPaint = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const radius = node.id === rootId ? 8 / globalScale : 5 / globalScale;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 4 / globalScale, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [rootId]
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
  const graphData = useMemo(() => {
    if (rootId !== cachedRootIdRef.current) {
      cachedRootIdRef.current = rootId;
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
      return cachedNode;
    });

    return { nodes: graphNodes, links };
  }, [rootId, visibleLinkKey, visibleNodeKey]);

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
          linkWidth={1.5}
          linkCurvature={linkCurvature}
          width={dimensions.width}
          height={dimensions.height}
          cooldownTicks={100}
        />
      )}
    </div>
  );
}
