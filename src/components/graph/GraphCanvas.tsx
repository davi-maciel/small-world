'use client';

import { useRef, useEffect, useCallback } from 'react';
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
  isRoot: boolean;
  isExpanded: boolean;
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
  onNodeClick: (nodeId: string) => void;
}

export function GraphCanvas({ nodes, links, onNodeClick }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);

  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        graphRef.current.width(containerRef.current.clientWidth);
        graphRef.current.height(containerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNodeClick = useCallback(
    (node: any) => {
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name;
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px sans-serif`;

      const isRoot = node.isRoot;
      const isExpanded = node.isExpanded;

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

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#374151';
      ctx.fillText(label, node.x, node.y + radius + 2 / globalScale);
    },
    []
  );

  const linkColor = useCallback((link: any) => {
    const config = OLYMPIADS[link.olympiad as OlympiadId];
    return config?.color ?? '#999';
  }, []);

  const linkCurvature = useCallback((link: any) => {
    return link.curvature;
  }, []);

  return (
    <div ref={containerRef} className="h-[500px] w-full border border-gray-200 rounded-lg overflow-hidden">
      <ForceGraph2D
        ref={graphRef}
        graphData={{ nodes, links }}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const radius = node.isRoot ? 8 / globalScale : 5 / globalScale;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 4 / globalScale, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        onNodeClick={handleNodeClick}
        linkColor={linkColor}
        linkWidth={1.5}
        linkCurvature={linkCurvature}
        width={containerRef.current?.clientWidth}
        height={500}
        cooldownTicks={100}
      />
    </div>
  );
}
