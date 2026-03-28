"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface TooltipPosition {
  top: number;
  left: number;
}

interface TooltipContextValue {
  depth: number;
}

const TooltipContext = createContext<TooltipContextValue>({ depth: 0 });

function useTooltipDepth(): number {
  return useContext(TooltipContext).depth;
}

interface TooltipProps {
  trigger: ReactNode;
  content: ReactNode;
  delay?: number;
  dismissDelay?: number;
  className?: string;
}

function computePosition(
  triggerRect: DOMRect,
  tooltipEl: HTMLDivElement,
  depth: number
): TooltipPosition {
  const pad = 8;
  const offset = 4 + depth * 2;
  const tw = tooltipEl.offsetWidth;
  const th = tooltipEl.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer right
  if (triggerRect.right + offset + tw + pad < vw) {
    return {
      top: Math.min(
        Math.max(pad, triggerRect.top),
        vh - th - pad
      ),
      left: triggerRect.right + offset,
    };
  }
  // Fall back left
  if (triggerRect.left - offset - tw - pad > 0) {
    return {
      top: Math.min(
        Math.max(pad, triggerRect.top),
        vh - th - pad
      ),
      left: triggerRect.left - offset - tw,
    };
  }
  // Fall back below
  if (triggerRect.bottom + offset + th + pad < vh) {
    return {
      top: triggerRect.bottom + offset,
      left: Math.min(
        Math.max(pad, triggerRect.left),
        vw - tw - pad
      ),
    };
  }
  // Fall back above
  return {
    top: triggerRect.top - offset - th,
    left: Math.min(
      Math.max(pad, triggerRect.left),
      vw - tw - pad
    ),
  };
}

export function Tooltip({
  trigger,
  content,
  delay = 300,
  dismissDelay = 200,
  className = "",
}: TooltipProps) {
  const depth = useTooltipDepth();
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const clearTimers = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const show = useCallback(() => {
    clearTimers();
    showTimer.current = setTimeout(() => {
      setVisible(true);
    }, delay);
  }, [clearTimers, delay]);

  const hide = useCallback(() => {
    clearTimers();
    hideTimer.current = setTimeout(() => {
      setVisible(false);
    }, dismissDelay);
  }, [clearTimers, dismissDelay]);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  // Reposition when visible
  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const pos = computePosition(rect, tooltipRef.current, depth);
    setPosition(pos);
  }, [visible, depth]);

  // Keyboard: Escape to dismiss
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setVisible(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [visible]);

  // z-index must be above the Dashboard Tour overlay (z-2500) and its
  // explanation card (z-2501) so tooltips triggered during the tour are visible.
  const zIndex = 3000 + depth * 10;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        tabIndex={0}
        className="inline-flex cursor-help"
      >
        {trigger}
      </span>
      {mounted &&
        visible &&
        createPortal(
          <TooltipContext.Provider value={{ depth: depth + 1 }}>
            <div
              ref={tooltipRef}
              onMouseEnter={cancelHide}
              onMouseLeave={hide}
              className={`fixed bg-surface-3 border border-border-default rounded px-3 py-2 text-sm text-text-primary font-dashboard max-w-sm shadow-none ${className}`}
              style={{
                top: position.top,
                left: position.left,
                zIndex,
              }}
              role="tooltip"
            >
              {content}
            </div>
          </TooltipContext.Provider>,
          document.body
        )}
    </>
  );
}

export default Tooltip;
