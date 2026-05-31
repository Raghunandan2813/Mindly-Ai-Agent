// components/MemoryGraph.tsx
// Interactive Canvas-based knowledge graph visualization.
// Renders nodes as circles and edges as connecting lines with force-directed layout.
'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface GraphNode {
  id: string;
  label: string;
  node_type: string;
  content: string;
  // Layout properties
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
  strength: number;
}

interface MemoryGraphProps {
  nodes: any[];
  edges: any[];
  onDeleteNode?: (nodeId: string) => void;
}

// Node type → color mapping (monochrome palette)
const NODE_COLORS: Record<string, string> = {
  person: '#ffffff',
  pet: '#d4d4d4',
  preference: '#a3a3a3',
  fact: '#737373',
  skill: '#e5e5e5',
  location: '#b0b0b0',
  attribute: '#8a8a8a',
};

const LIGHT_NODE_COLORS: Record<string, string> = {
  person: '#000000',
  pet: '#404040',
  preference: '#737373',
  fact: '#a3a3a3',
  skill: '#262626',
  location: '#525252',
  attribute: '#737373',
};

export default function MemoryGraph({ nodes: rawNodes, edges: rawEdges, onDeleteNode }: MemoryGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const dragRef = useRef<{ node: GraphNode | null; offsetX: number; offsetY: number }>({
    node: null, offsetX: 0, offsetY: 0
  });

  // Initialize graph layout
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.width || 350;
    const h = canvas.height || 500;
    const centerX = w / 2;
    const centerY = h / 2;

    // Place nodes in a circular layout, preserving existing coordinates to prevent jumpy layout resets
    const graphNodes: GraphNode[] = rawNodes.map((n, i) => {
      const existing = nodesRef.current.find(en => en.id === n.id);
      if (existing && !isNaN(existing.x) && !isNaN(existing.y)) {
        return {
          ...n,
          x: existing.x,
          y: existing.y,
          vx: existing.vx || 0,
          vy: existing.vy || 0,
        };
      }

      const angle = (i / Math.max(rawNodes.length, 1)) * Math.PI * 2;
      const radius = Math.min(w, h) * 0.3 + (Math.random() - 0.5) * 80;
      return {
        ...n,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });

    nodesRef.current = graphNodes;
    edgesRef.current = rawEdges.map((e: any) => ({
      ...e,
    }));
  }, [rawNodes, rawEdges]);

  // Force-directed simulation + rendering
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const w = canvas.width;
    const h = canvas.height;

    // ---- Force simulation step ----
    const REPULSION = 3000;
    const ATTRACTION = 0.01;
    const DAMPING = 0.85;
    const CENTER_GRAVITY = 0.002;

    // Sanity check: Ensure no coordinates or velocities are NaN. If they are, heal them instantly.
    let hasNaN = false;
    for (const node of nodes) {
      if (isNaN(node.x) || isNaN(node.y) || isNaN(node.vx) || isNaN(node.vy)) {
        hasNaN = true;
        break;
      }
    }

    if (hasNaN) {
      console.warn('[MemoryGraph] NaN coordinate/velocity detected! Auto-healing layout...');
      nodes.forEach((node, idx) => {
        const angle = (idx / Math.max(nodes.length, 1)) * Math.PI * 2;
        const radius = Math.min(w, h) * 0.25;
        node.x = (w / 2) + Math.cos(angle) * radius;
        node.y = (h / 2) + Math.sin(angle) * radius;
        node.vx = 0;
        node.vy = 0;
      });
    }

    // Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        
        // Safety Cushion: Clamp minimum distance to 30px to prevent division-by-zero 
        // gravity explosion (which pushes coordinates to NaN and makes the graph disappear)
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 30);
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    // Attraction along edges
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (const edge of edges) {
      const source = nodeMap.get(edge.source_id);
      const target = nodeMap.get(edge.target_id);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      
      // Safety Cushion: Clamp minimum distance to 1px to prevent division-by-zero NaN explosion if nodes touch
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = dist * ATTRACTION;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      
      if (!isNaN(fx) && !isNaN(fy)) {
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // Center gravity + update positions
    for (const node of nodes) {
      if (dragRef.current.node?.id === node.id) continue; // skip dragged node

      node.vx += (w / 2 - node.x) * CENTER_GRAVITY;
      node.vy += (h / 2 - node.y) * CENTER_GRAVITY;
      node.vx *= DAMPING;
      node.vy *= DAMPING;
      node.x += node.vx;
      node.y += node.vy;

      // Boundary clamping
      node.x = Math.max(40, Math.min(w - 40, node.x));
      node.y = Math.max(40, Math.min(h - 40, node.y));
    }

    // ---- Render ----
    ctx.clearRect(0, 0, w, h);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const cBg = isLight ? '#f5f5f5' : '#000000';
    const cGrid = isLight ? '#e5e5e5' : '#0f0f0f';
    const cEdgeNormal = isLight ? '#d4d4d4' : '#333333';
    const cEdgeHighlight = isLight ? '#000000' : '#ffffff';
    const cEdgeTextNormal = isLight ? '#737373' : '#404040';
    const cEdgeTextHighlight = isLight ? '#171717' : '#d4d4d4';
    const cNodeBgNormal = isLight ? '#ffffff' : '#141414';
    const cNodeSelected = isLight ? '#000000' : '#ffffff';
    const cNodeConnected = isLight ? '#a3a3a3' : '#888888';
    const cNodeTextSelected = isLight ? '#ffffff' : '#000000';
    const cNodeBadge = isLight ? '#737373' : '#525252';
    const themeColors = isLight ? LIGHT_NODE_COLORS : NODE_COLORS;

    // Background
    ctx.fillStyle = cBg;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = cGrid;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw edges
    for (const edge of edges) {
      const source = nodeMap.get(edge.source_id);
      const target = nodeMap.get(edge.target_id);
      if (!source || !target) continue;

      const isHighlighted = selectedNode &&
        (selectedNode.id === edge.source_id || selectedNode.id === edge.target_id);

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = isHighlighted ? cEdgeHighlight : cEdgeNormal;
      ctx.lineWidth = isHighlighted ? 2 : 1;
      ctx.stroke();

      // Edge label at midpoint
      const mx = (source.x + target.x) / 2;
      const my = (source.y + target.y) / 2;
      ctx.fillStyle = isHighlighted ? cEdgeTextHighlight : cEdgeTextNormal;
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(edge.relation, mx, my - 4);
    }

    // Draw nodes
    for (const node of nodes) {
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;
      const isConnected = selectedNode && edges.some(
        e => (e.source_id === selectedNode.id && e.target_id === node.id) ||
             (e.target_id === selectedNode.id && e.source_id === node.id)
      );
      
      const radius = node.label === 'user' ? 22 : (isSelected || isHovered ? 18 : 14);
      const color = themeColors[node.node_type] || (isLight ? '#525252' : '#737373');

      // Glow for selected/connected nodes
      if (isSelected || isConnected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = `${color}15`;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? cNodeSelected : (isHovered ? color : cNodeBgNormal);
      ctx.fill();
      ctx.strokeStyle = isSelected ? cNodeSelected : (isConnected ? cNodeConnected : cEdgeNormal);
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      // Node label
      ctx.fillStyle = isSelected ? cNodeTextSelected : color;
      ctx.font = `${isSelected ? 'bold ' : ''}11px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const label = node.label.length > 12 ? node.label.slice(0, 10) + '..' : node.label;
      ctx.fillText(label, node.x, node.y);

      // Type badge below
      ctx.fillStyle = cNodeBadge;
      ctx.font = '8px monospace';
      ctx.fillText(node.node_type, node.x, node.y + radius + 10);
    }

    animationRef.current = requestAnimationFrame(render);
  }, [selectedNode, hoveredNode]);

  // Start/stop animation
  useEffect(() => {
    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [render]);

  // Canvas resize using ResizeObserver to prevent asynchronous sizing lags on mobile
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const newW = width || parent.clientWidth || 350;
        const newH = height || parent.clientHeight || 500;
        
        canvas.width = newW;
        canvas.height = newH;

        // If nodes were initialized at (0,0) or got stuck at the top-left boundary
        // due to mobile loading lag, re-spread them nicely in the center!
        if (nodesRef.current.length > 0) {
          const isStuck = nodesRef.current.some(
            n => n.x === 0 || (Math.abs(n.x - 40) < 5 && Math.abs(n.y - 40) < 5)
          );
          if (isStuck && newW > 100 && newH > 100) {
            nodesRef.current.forEach((node, idx) => {
              const angle = (idx / nodesRef.current.length) * Math.PI * 2;
              const radius = Math.min(newW, newH) * 0.25;
              node.x = newW / 2 + Math.cos(angle) * radius;
              node.y = newH / 2 + Math.sin(angle) * radius;
              node.vx = 0;
              node.vy = 0;
            });
          }
        }
      }
    });

    resizeObserver.observe(parent);
    return () => resizeObserver.disconnect();
  }, []);

  // Mouse & Touch interaction handlers
  const getNodeAtPosition = useCallback((x: number, y: number): GraphNode | null => {
    for (const node of nodesRef.current) {
      const dx = x - node.x;
      const dy = y - node.y;
      const radius = node.label === 'user' ? 22 : 14;
      if (dx * dx + dy * dy < (radius + 4) * (radius + 4)) {
        return node;
      }
    }
    return null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = getNodeAtPosition(x, y);
    if (node) {
      dragRef.current = { node, offsetX: x - node.x, offsetY: y - node.y };
      setSelectedNode(node);
    } else {
      setSelectedNode(null);
    }
  }, [getNodeAtPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragRef.current.node) {
      dragRef.current.node.x = x - dragRef.current.offsetX;
      dragRef.current.node.y = y - dragRef.current.offsetY;
      dragRef.current.node.vx = 0;
      dragRef.current.node.vy = 0;
    } else {
      const node = getNodeAtPosition(x, y);
      setHoveredNode(node);
      canvas.style.cursor = node ? 'grab' : 'default';
    }
  }, [getNodeAtPosition]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = { node: null, offsetX: 0, offsetY: 0 };
  }, []);

  // Mobile Native Touch Support
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const node = getNodeAtPosition(x, y);
    if (node) {
      dragRef.current = { node, offsetX: x - node.x, offsetY: y - node.y };
      setSelectedNode(node);
      e.preventDefault(); // Stop screen bouncing
    } else {
      setSelectedNode(null);
    }
  }, [getNodeAtPosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (dragRef.current.node) {
      dragRef.current.node.x = x - dragRef.current.offsetX;
      dragRef.current.node.y = y - dragRef.current.offsetY;
      dragRef.current.node.vx = 0;
      dragRef.current.node.vy = 0;
      e.preventDefault(); // Stop screen scrolling while playing with nodes
    } else {
      const node = getNodeAtPosition(x, y);
      setHoveredNode(node);
    }
  }, [getNodeAtPosition]);

  return (
    <div className="relative w-full h-full min-h-[500px] bg-[var(--bg-primary)] rounded-xl border border-[var(--border)] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      />

      {/* Selected node info panel */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 animate-fade-in-up">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] uppercase tracking-wider">
                {selectedNode.node_type}
              </span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{selectedNode.label}</span>
            </div>
            {onDeleteNode && selectedNode.label !== 'user' && (
              <button
                onClick={() => onDeleteNode(selectedNode.id)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
              >
                Delete
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{selectedNode.content}</p>
        </div>
      )}

      {/* Empty state */}
      {rawNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[var(--text-muted)] text-sm">No memory nodes yet</p>
            <p className="text-[var(--text-muted)] text-xs mt-1">Start chatting to build your knowledge graph</p>
          </div>
        </div>
      )}
    </div>
  );
}
