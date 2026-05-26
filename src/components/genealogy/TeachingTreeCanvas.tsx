'use client';

import { useRef, useEffect, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import type { ForceGraphMethods } from 'react-force-graph-2d';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-gray-100 rounded" />,
});

export interface TeachingNode {
  id: string;
  name: string;
}

export interface TeachingLink {
  source: string;
  target: string;
}

export interface TeachingTreeCanvasHandle {
  renderHighRes(scale: number): string | null;
}

interface TeachingTreeCanvasProps {
  nodes: TeachingNode[];
  links: TeachingLink[];
  selectedId: string | null;
  showLabels: boolean;
  onNodeClick: (nodeId: string) => void;
  ancestorIds: Set<string>;
  descendantIds: Set<string>;
  nodeColor: string;
}

function hashNumber(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return h;
}

interface PositionedNode extends TeachingNode {
  x: number;
  y: number;
  fx: number;
  fy: number;
}

function findConnectedComponents(
  nodes: TeachingNode[],
  links: TeachingLink[]
): TeachingNode[][] {
  const parent = new Map<string, string>();
  for (const n of nodes) parent.set(n.id, n.id);

  function find(id: string): string {
    while (parent.get(id) !== id) {
      parent.set(id, parent.get(parent.get(id)!)!);
      id = parent.get(id)!;
    }
    return id;
  }

  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const link of links) {
    if (parent.has(link.source) && parent.has(link.target)) {
      union(link.source, link.target);
    }
  }

  const groups = new Map<string, TeachingNode[]>();
  for (const n of nodes) {
    const root = find(n.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(n);
  }

  return [...groups.values()].sort((a, b) => b.length - a.length);
}

function computeTreeLayout(
  nodes: TeachingNode[],
  links: TeachingLink[],
  height: number | null,
  selectedId: string | null
): PositionedNode[] {
  if (nodes.length === 0) return [];

  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const link of links) {
    if (!nodeIds.has(link.source) || !nodeIds.has(link.target)) continue;
    if (!children.has(link.source)) children.set(link.source, []);
    children.get(link.source)!.push(link.target);
    if (!parents.has(link.target)) parents.set(link.target, []);
    parents.get(link.target)!.push(link.source);
  }

  const depth = new Map<string, number>();
  const useSelectedCentric = selectedId != null && nodeIds.has(selectedId);

  if (useSelectedCentric) {
    // Shortest-path BFS outward from selected: descendants get +d, ancestors get -d.
    depth.set(selectedId, 0);

    let queue: string[] = [selectedId];
    let head = 0;
    while (head < queue.length) {
      const id = queue[head++];
      const d = depth.get(id)!;
      for (const child of children.get(id) || []) {
        if (!depth.has(child)) {
          depth.set(child, d + 1);
          queue.push(child);
        }
      }
    }

    queue = [selectedId];
    head = 0;
    while (head < queue.length) {
      const id = queue[head++];
      const d = depth.get(id)!;
      for (const parent of parents.get(id) || []) {
        // Skip if already assigned (defensive against cycles or shortcut edges).
        if (!depth.has(parent)) {
          depth.set(parent, d - 1);
          queue.push(parent);
        }
      }
    }
  } else {
    // Fallback: longest-path BFS from roots (used in full-graph mode).
    // Uses an enqueue counter per node to prevent exponential blowup on
    // diamond-shaped DAGs and infinite loops on cycles.
    const roots = nodes.filter((n) => !parents.has(n.id) || parents.get(n.id)!.length === 0);
    const queue: string[] = [];
    const enqueued = new Map<string, number>();
    const maxEnqueues = 2;
    for (const root of roots) {
      depth.set(root.id, 0);
      queue.push(root.id);
      enqueued.set(root.id, 1);
    }
    let head = 0;
    while (head < queue.length) {
      const id = queue[head++];
      const d = depth.get(id)!;
      for (const child of children.get(id) || []) {
        const existing = depth.get(child);
        if (existing == null || d + 1 > existing) {
          depth.set(child, d + 1);
          const count = enqueued.get(child) ?? 0;
          if (count < maxEnqueues) {
            queue.push(child);
            enqueued.set(child, count + 1);
          }
        }
      }
    }
  }

  for (const n of nodes) {
    if (!depth.has(n.id)) depth.set(n.id, 0);
  }

  const byDepth = new Map<number, TeachingNode[]>();
  for (const n of nodes) {
    const d = depth.get(n.id)!;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(n);
  }

  const sortedDepths = [...byDepth.keys()].sort((a, b) => a - b);
  const minDepth = sortedDepths[0];
  const levelSpacing = 200;
  const minGap = 60;
  const jitterRange = 40;

  const yPos = new Map<string, number>();

  const placeGroup = (
    group: TeachingNode[],
    anchorMap: Map<string, string[]>,
    d: number
  ) => {
    for (const n of group) {
      const aList = (anchorMap.get(n.id) || []).filter((a) => yPos.has(a));
      const anchorYs = aList.map((a) => yPos.get(a)!);
      const base = anchorYs.length > 0
        ? anchorYs.reduce((a, b) => a + b, 0) / anchorYs.length
        : 0;
      const depthJitter = jitterRange * (1 + Math.abs(d) * 0.6);
      const jitter = ((hashNumber(n.id) % 1000) / 1000 - 0.5) * depthJitter;
      yPos.set(n.id, base + jitter);
    }
    group.sort((a, b) => (yPos.get(a.id) ?? 0) - (yPos.get(b.id) ?? 0));
    for (let i = 1; i < group.length; i++) {
      const prev = yPos.get(group[i - 1].id)!;
      const curr = yPos.get(group[i].id)!;
      if (curr - prev < minGap) {
        yPos.set(group[i].id, prev + minGap);
      }
    }
  };

  if (useSelectedCentric) {
    yPos.set(selectedId, 0);

    // Descendants outward: +1, +2, ... — anchor on parents (closer to selected).
    for (const d of sortedDepths.filter((x) => x > 0)) {
      placeGroup(byDepth.get(d)!, parents, d);
    }
    // Ancestors outward: -1, -2, ... — anchor on children (closer to selected).
    for (const d of sortedDepths.filter((x) => x < 0).reverse()) {
      placeGroup(byDepth.get(d)!, children, d);
    }
  } else {
    // Root group seeded uniformly, then descend by parents like before.
    const rootGroup = byDepth.get(sortedDepths[0]) || [];
    for (let i = 0; i < rootGroup.length; i++) {
      const y = rootGroup.length === 1
        ? 0
        : (i / (rootGroup.length - 1) - 0.5) * (rootGroup.length - 1) * minGap;
      yPos.set(rootGroup[i].id, y);
    }
    for (let di = 1; di < sortedDepths.length; di++) {
      const d = sortedDepths[di];
      placeGroup(byDepth.get(d)!, parents, d);
    }
  }

  // Scale y positions to fill available height (skipped when height is null,
  // e.g., when laying out individual components before packing).
  if (height != null) {
    const allYs = nodes.map((n) => yPos.get(n.id) ?? 0);
    const minY = Math.min(...allYs);
    const maxY = Math.max(...allYs);
    const yRange = maxY - minY;
    const padY = 60;
    const targetRange = height - 2 * padY;

    if (yRange > 0 && targetRange > 0) {
      const scale = targetRange / yRange;
      const mid = (minY + maxY) / 2;
      for (const n of nodes) {
        const y = yPos.get(n.id) ?? 0;
        yPos.set(n.id, (y - mid) * scale);
      }
    }
  }

  return nodes.map((n) => {
    const d = depth.get(n.id)!;
    const fx = (d - minDepth) * levelSpacing;
    const fy = yPos.get(n.id) ?? 0;
    return { ...n, fx, fy, x: fx, y: fy };
  });
}

export const TeachingTreeCanvas = forwardRef<TeachingTreeCanvasHandle, TeachingTreeCanvasProps>(
  function TeachingTreeCanvas({ nodes, links, selectedId, showLabels, onNodeClick, ancestorIds, descendantIds, nodeColor }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
    const globalScaleRef = useRef(1);
    const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
    const fitPendingRef = useRef(true);

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
        graphRef.current.d3Force('charge', null);
        graphRef.current.d3Force('center', null);
        graphRef.current.d3Force('link', null);
      }
    }, [dimensions, nodes.length]);

    // Capture-phase pointerdown so we record the start position before
    // react-force-graph's internal handlers run. handleNodeClick checks the
    // distance and ignores clicks that came from a drag the lib misclassified.
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const onDown = (e: PointerEvent) => {
        pointerDownRef.current = { x: e.clientX, y: e.clientY };
      };
      el.addEventListener('pointerdown', onDown, { capture: true });
      return () => el.removeEventListener('pointerdown', onDown, { capture: true });
    }, []);

    useEffect(() => {
      fitPendingRef.current = true;
    }, [selectedId, nodes.length, links.length, dimensions?.width]);

    const focusNodes = useMemo((): { neighbors: string[]; side: 'right' | 'left' } | null => {
      if (!selectedId) return null;
      const directDescendants: string[] = [];
      const directTeachers: string[] = [];
      for (const link of links) {
        if (link.source === selectedId) directDescendants.push(link.target);
        else if (link.target === selectedId) directTeachers.push(link.source);
      }
      if (directDescendants.length > 0) return { neighbors: directDescendants, side: 'right' };
      if (directTeachers.length > 0) return { neighbors: directTeachers, side: 'left' };
      return null;
    }, [selectedId, links]);

    const graphData = useMemo(() => {
      const h = dimensions?.height ?? 500;

      if (selectedId !== null) {
        return {
          nodes: computeTreeLayout(nodes, links, h, selectedId),
          links: links.map((l) => ({ ...l })),
        };
      }

      // Full-graph: lay out each connected component independently, then pack.
      const components = findConnectedComponents(nodes, links);

      const componentLayouts: PositionedNode[][] = [];
      const bboxes: { w: number; h: number }[] = [];

      for (const compNodes of components) {
        const compIds = new Set(compNodes.map((n) => n.id));
        const compLinks = links.filter(
          (l) => compIds.has(l.source) && compIds.has(l.target)
        );
        const positioned = computeTreeLayout(compNodes, compLinks, null, null);
        componentLayouts.push(positioned);

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const n of positioned) {
          if (n.fx < minX) minX = n.fx;
          if (n.fx > maxX) maxX = n.fx;
          if (n.fy < minY) minY = n.fy;
          if (n.fy > maxY) maxY = n.fy;
        }
        bboxes.push({
          w: positioned.length > 0 ? maxX - minX : 0,
          h: positioned.length > 0 ? maxY - minY : 0,
        });
      }

      const gapX = 300;
      const gapY = 200;
      const targetWidth = Math.max(
        bboxes[0]?.w ?? 0,
        (dimensions?.width ?? 800) * 0.8
      );

      // Row packing: place components left-to-right, wrap to new row when overflow.
      const allNodes: PositionedNode[] = [];
      let curX = 0;
      let curY = 0;
      let rowMaxH = 0;

      for (let i = 0; i < componentLayouts.length; i++) {
        const positioned = componentLayouts[i];
        const bbox = bboxes[i];

        if (i > 0 && curX + bbox.w > targetWidth) {
          curX = 0;
          curY += rowMaxH + gapY;
          rowMaxH = 0;
        }

        // Normalize component to start at (0,0) then offset.
        let minX = Infinity, minY = Infinity;
        for (const n of positioned) {
          if (n.fx < minX) minX = n.fx;
          if (n.fy < minY) minY = n.fy;
        }

        for (const n of positioned) {
          const fx = n.fx - minX + curX;
          const fy = n.fy - minY + curY;
          allNodes.push({ ...n, fx, fy, x: fx, y: fy });
        }

        curX += bbox.w + gapX;
        if (bbox.h > rowMaxH) rowMaxH = bbox.h;
      }

      // Center everything around (0, 0) so zoomToFit works well.
      let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;
      for (const n of allNodes) {
        if (n.fx < gMinX) gMinX = n.fx;
        if (n.fx > gMaxX) gMaxX = n.fx;
        if (n.fy < gMinY) gMinY = n.fy;
        if (n.fy > gMaxY) gMaxY = n.fy;
      }
      const cx = (gMinX + gMaxX) / 2;
      const cy = (gMinY + gMaxY) / 2;
      for (const n of allNodes) {
        n.fx -= cx;
        n.fy -= cy;
        n.x = n.fx;
        n.y = n.fy;
      }

      return {
        nodes: allNodes,
        links: links.map((l) => ({ ...l })),
      };
    }, [nodes, links, dimensions, selectedId]);

    const handleEngineStop = useCallback(() => {
      const fg = graphRef.current;
      if (!fg || !fitPendingRef.current || !dimensions) return;
      fitPendingRef.current = false;

      const isMobile = dimensions.width < 640;

      if (isMobile && focusNodes && selectedId) {
        const selected = graphData.nodes.find((n) => n.id === selectedId);
        const neighbors = focusNodes.neighbors
          .map((id) => graphData.nodes.find((n) => n.id === id))
          .filter((n): n is NonNullable<typeof n> => n != null);

        if (selected && neighbors.length > 0) {
          const W = dimensions.width;
          const H = dimensions.height;
          const sx = selected.x;
          const sy = selected.y;
          const ys = [sy, ...neighbors.map((n) => n.y)];
          const xs = neighbors.map((n) => n.x);

          const xRange = focusNodes.side === 'right' ? Math.max(...xs) - sx : sx - Math.min(...xs);
          const yMin = Math.min(...ys);
          const yMax = Math.max(...ys);
          const yRange = yMax - yMin;

          const zoomX = (W * 0.5) / Math.max(xRange, 1);
          const zoomY = yRange > 0 ? (H * 0.7) / yRange : zoomX;
          const zoom = Math.min(zoomX, zoomY);

          const selectedScreenXFrac = focusNodes.side === 'right' ? 0.25 : 0.75;
          const centerX = sx + (W / 2 - selectedScreenXFrac * W) / zoom;
          const centerY = (yMin + yMax) / 2;

          fg.centerAt(centerX, centerY, 250);
          fg.zoom(zoom, 250);
          return;
        }
      }

      fg.zoomToFit(250, 100);
    }, [dimensions, focusNodes, selectedId, graphData.nodes]);

    const handleNodeClick = useCallback(
      (node: any, event: MouseEvent) => {
        const down = pointerDownRef.current;
        if (down) {
          const dx = event.clientX - down.x;
          const dy = event.clientY - down.y;
          if (Math.sqrt(dx * dx + dy * dy) > 3) return;
        }
        onNodeClick(node.id);
      },
      [onNodeClick]
    );

    const nodeCanvasObject = useCallback(
      (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        globalScaleRef.current = globalScale;
        const isSelected = node.id === selectedId;
        const isAncestor = ancestorIds.has(node.id);
        const isDescendant = descendantIds.has(node.id);
        const isHighlighted = isSelected || isAncestor || isDescendant;

        const radius = isSelected ? 7 / globalScale : 5 / globalScale;

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

        if (isSelected) {
          ctx.fillStyle = '#111827';
        } else if (isAncestor) {
          ctx.fillStyle = '#2563EB';
        } else if (isDescendant) {
          ctx.fillStyle = '#16A34A';
        } else if (selectedId) {
          ctx.fillStyle = '#E5E7EB';
        } else {
          ctx.fillStyle = nodeColor;
        }
        ctx.fill();

        if (isHighlighted) {
          ctx.strokeStyle = '#111827';
          ctx.lineWidth = 1.5 / globalScale;
          ctx.stroke();
        }

        if (showLabels) {
          const fontSize = 12 / globalScale;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const labelX = node.x;
          const labelY = node.y + radius + 3 / globalScale;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3 / globalScale;
          ctx.lineJoin = 'round';
          ctx.strokeText(node.name, labelX, labelY);
          ctx.fillStyle = isHighlighted || !selectedId ? '#111827' : '#D1D5DB';
          ctx.fillText(node.name, labelX, labelY);
        }
      },
      [selectedId, showLabels, ancestorIds, descendantIds, nodeColor]
    );

    const linkColor = useCallback(
      (link: any) => {
        if (!selectedId) return 'rgba(156, 163, 175, 0.5)';
        const src = typeof link.source === 'string' ? link.source : link.source?.id;
        const tgt = typeof link.target === 'string' ? link.target : link.target?.id;
        const isAncestorLink =
          (ancestorIds.has(src) || src === selectedId) &&
          (ancestorIds.has(tgt) || tgt === selectedId);
        const isDescendantLink =
          (descendantIds.has(src) || src === selectedId) &&
          (descendantIds.has(tgt) || tgt === selectedId);
        if (isAncestorLink || isDescendantLink) return 'rgba(55, 65, 81, 0.6)';
        return 'rgba(229, 231, 235, 0.3)';
      },
      [selectedId, ancestorIds, descendantIds]
    );

    const nodeMap = useMemo(
      () => new Map(graphData.nodes.map((n) => [n.id, n])),
      [graphData.nodes]
    );

    const linkCurvature = useCallback(
      (link: any) => {
        const srcId = typeof link.source === 'string' ? link.source : link.source?.id;
        const tgtId = typeof link.target === 'string' ? link.target : link.target?.id;
        const src = nodeMap.get(srcId);
        const tgt = nodeMap.get(tgtId);
        if (!src || !tgt) return 0;
        if (Math.abs(src.x - tgt.x) > 1) return 0;
        if (!selectedId) {
          return tgt.y > src.y ? 0.4 : -0.4;
        }
        const sel = nodeMap.get(selectedId);
        if (!sel) return 0;
        const xSign = Math.sign(src.x - sel.x);
        const ySign = Math.sign(tgt.y - src.y);
        if (xSign === 0 || ySign === 0) return 0;
        return xSign * ySign * 0.4;
      },
      [selectedId, nodeMap]
    );

    const nodePointerAreaPaint = useCallback(
      (node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const radius = (node.id === selectedId ? 7 : 5) / globalScale;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4 / globalScale, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      },
      [selectedId]
    );

    // Trigger repaint on selection change
    useEffect(() => {
      if (!graphRef.current) return;
      const { x, y } = graphRef.current.centerAt();
      graphRef.current.centerAt(x, y, 0);
    }, [selectedId]);

    // High-res render for PNG export — fits all nodes with labels, independent of camera.
    useImperativeHandle(ref, () => ({
      renderHighRes(scale: number) {
        if (graphData.nodes.length === 0) return null;

        // Bounding box from node positions, padded to fit labels.
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const n of graphData.nodes) {
          if (n.x < minX) minX = n.x;
          if (n.x > maxX) maxX = n.x;
          if (n.y < minY) minY = n.y;
          if (n.y > maxY) maxY = n.y;
        }

        // Measure the widest label to determine horizontal padding.
        // Labels are center-aligned, so half the width extends each side.
        const measureCtx = document.createElement('canvas').getContext('2d')!;
        measureCtx.font = 'bold 12px sans-serif';
        let maxLabelHalf = 0;
        for (const n of graphData.nodes) {
          const w = measureCtx.measureText(n.name).width / 2;
          if (w > maxLabelHalf) maxLabelHalf = w;
        }
        const padX = maxLabelHalf + 20;
        const padTop = 40;
        const padBottom = 60;
        minX -= padX;
        maxX += padX;
        minY -= padTop;
        maxY += padBottom;

        const graphW = maxX - minX || 1;
        const graphH = maxY - minY || 1;

        // Canvas sized to graph aspect ratio, longest side scales with node count.
        const n = graphData.nodes.length;
        const targetLong = Math.max(400, Math.min(1000, n * 30)) * scale;
        const aspect = graphW / graphH;
        let w: number, h: number;
        if (aspect >= 1) {
          w = targetLong;
          h = Math.round(targetLong / aspect);
        } else {
          h = targetLong;
          w = Math.round(targetLong * aspect);
        }

        const zoom = Math.min(w / graphW, h / graphH, 8);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        const ctx = offscreen.getContext('2d')!;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-cx, -cy);

        const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
        const arrowLen = 16 / zoom;

        // Draw links with curvature and arrow heads.
        for (const link of graphData.links) {
          const srcId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
          const tgtId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;
          const src = nodeMap.get(srcId);
          const tgt = nodeMap.get(tgtId);
          if (!src || !tgt) continue;

          const curv = linkCurvature(link);
          ctx.strokeStyle = linkColor(link);
          ctx.lineWidth = 1.5 / zoom;
          ctx.beginPath();
          ctx.moveTo(src.x, src.y);

          let arrDx: number, arrDy: number;

          if (curv !== 0) {
            // Quadratic Bezier — curvature applied perpendicular to the link.
            // Only triggers for vertical sibling edges (src.x ≈ tgt.x).
            const mx = (src.x + tgt.x) / 2;
            const my = (src.y + tgt.y) / 2;
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const cpX = mx + curv * dy;
            const cpY = my - curv * dx;
            ctx.quadraticCurveTo(cpX, cpY, tgt.x, tgt.y);
            arrDx = tgt.x - cpX;
            arrDy = tgt.y - cpY;
          } else {
            ctx.lineTo(tgt.x, tgt.y);
            arrDx = tgt.x - src.x;
            arrDy = tgt.y - src.y;
          }
          ctx.stroke();

          // Arrow head at target.
          const arrMag = Math.sqrt(arrDx * arrDx + arrDy * arrDy) || 1;
          const ux = arrDx / arrMag;
          const uy = arrDy / arrMag;
          const ax = tgt.x - ux * arrowLen;
          const ay = tgt.y - uy * arrowLen;
          const pw = arrowLen * 0.4;
          ctx.fillStyle = ctx.strokeStyle;
          ctx.beginPath();
          ctx.moveTo(tgt.x, tgt.y);
          ctx.lineTo(ax - uy * pw, ay + ux * pw);
          ctx.lineTo(ax + uy * pw, ay - ux * pw);
          ctx.closePath();
          ctx.fill();
        }

        // Draw nodes — labels follow the Nomes toggle.
        for (const node of graphData.nodes) {
          nodeCanvasObject(node, ctx, zoom);
        }

        ctx.restore();

        // Watermark in bottom-right corner.
        const wmSize = Math.max(10, Math.round(w / 120));
        ctx.font = `${wmSize}px monospace`;
        ctx.fillStyle = 'rgba(156, 163, 175, 0.8)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('smallworld.ipho.com.br', w - wmSize, h - wmSize * 0.6);

        return offscreen.toDataURL('image/png');
      },
    }), [graphData, nodeCanvasObject, linkColor, linkCurvature]);

    return (
      <div ref={containerRef} className="h-[350px] w-full border border-gray-200 rounded-lg overflow-hidden sm:h-[500px]">
        {dimensions && (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            onNodeClick={handleNodeClick}
            onEngineStop={handleEngineStop}
            linkColor={linkColor}
            linkCurvature={linkCurvature}
            linkWidth={1.5}
            linkDirectionalArrowLength={16}
            linkDirectionalArrowRelPos={1}
            width={dimensions.width}
            height={dimensions.height}
            cooldownTicks={10}
          />
        )}
      </div>
    );
  }
);
