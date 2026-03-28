"use client";

import type { DataLineageNode } from "@/mock/types";

interface DataLineageProps {
  nodes: DataLineageNode[];
}

export function DataLineage({ nodes }: DataLineageProps) {
  // Build tree: find roots (no parentId), then children
  const roots = nodes.filter((n) => !n.parentId);
  const childMap = new Map<string, DataLineageNode[]>();
  for (const node of nodes) {
    if (node.parentId) {
      const siblings = childMap.get(node.parentId) || [];
      siblings.push(node);
      childMap.set(node.parentId, siblings);
    }
  }

  function renderNode(node: DataLineageNode, depth: number) {
    const children = childMap.get(node.id) || [];
    return (
      <div key={node.id} style={{ paddingLeft: depth * 16 }}>
        <div
          className={`flex items-center gap-2 py-1.5 px-2 rounded text-xs font-terminal ${
            node.poisoned
              ? "bg-status-critical/15 border border-status-critical/30"
              : "hover:bg-surface-hover/50"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              node.poisoned ? "bg-status-critical" : "bg-status-success"
            }`}
          />
          <span className="text-text-secondary truncate">{node.label}</span>
          <span className="text-text-tertiary ml-auto tabular-nums shrink-0">
            {node.sourceHash.slice(0, 8)}...
          </span>
          <span
            className={`tabular-nums shrink-0 ${
              node.purityScore > 80
                ? "text-status-success"
                : node.purityScore > 50
                  ? "text-status-warning"
                  : "text-status-critical"
            }`}
          >
            {node.purityScore}%
          </span>
        </div>
        {children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      {roots.map((root) => renderNode(root, 0))}
    </div>
  );
}

export default DataLineage;
