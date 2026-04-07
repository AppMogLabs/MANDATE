"use client";

import { useState } from "react";
import { Button } from "@/components/interactive/Button";
import { Input } from "@/components/interactive/Input";
import { Select } from "@/components/interactive/Select";

const RESOURCE_OPTIONS = [
  { value: "COMPUTE", label: "COMPUTE" },
  { value: "ENERGY", label: "ENERGY" },
  { value: "CHIPS", label: "CHIPS" },
  { value: "COOLING", label: "COOLING" },
  { value: "TALENT", label: "TALENT" },
  { value: "DATA", label: "DATA" },
  { value: "CLEARANCE", label: "CLEARANCE" },
];

interface DirectActionPanelProps {
  readonly onPlaceOrder?: (resource: string, amount: number, price: number, side: "buy" | "sell") => Promise<void>;
  readonly onClaimProduction?: () => Promise<void>;
}

/**
 * DirectActionPanel — Manual game actions (Tier 3, on demand).
 * Player can place orders, cancel orders, and claim production directly.
 */
export function DirectActionPanel({ onPlaceOrder, onClaimProduction }: DirectActionPanelProps) {
  const [activeTab, setActiveTab] = useState<"order" | "production">("order");

  // Order form state
  const [resource, setResource] = useState("COMPUTE");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [submitting, setSubmitting] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handlePlaceOrder = async () => {
    const amt = parseFloat(amount);
    const prc = parseFloat(price);
    if (isNaN(amt) || isNaN(prc) || amt <= 0 || prc <= 0) return;

    setSubmitting(true);
    setStatusMessage(null);
    try {
      await onPlaceOrder?.(resource, amt, prc, side);
      setStatusMessage({ text: `${side === "buy" ? "Buy" : "Sell"} order submitted`, type: "success" });
      setAmount("");
      setPrice("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Order failed";
      setStatusMessage({ text: msg, type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const [claimingProduction, setClaimingProduction] = useState(false);

  const handleClaimProduction = async () => {
    setClaimingProduction(true);
    setStatusMessage(null);
    try {
      await onClaimProduction?.();
      setStatusMessage({ text: "Production claimed", type: "success" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      setStatusMessage({ text: msg, type: "error" });
    } finally {
      setClaimingProduction(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-surface-1 border-b border-border-default shrink-0">
        <button
          onClick={() => setActiveTab("order")}
          className={[
            "px-2 py-1 text-xs font-dashboard rounded transition-colors",
            activeTab === "order"
              ? "text-text-primary border-b-2 border-border-active"
              : "text-text-secondary hover:text-text-primary",
          ].join(" ")}
        >
          Place Order
        </button>
        <button
          onClick={() => setActiveTab("production")}
          className={[
            "px-2 py-1 text-xs font-dashboard rounded transition-colors",
            activeTab === "production"
              ? "text-text-primary border-b-2 border-border-active"
              : "text-text-secondary hover:text-text-primary",
          ].join(" ")}
        >
          Claim Production
        </button>
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {activeTab === "order" ? (
          <>
            {/* Side toggle */}
            <div className="flex gap-1">
              <button
                onClick={() => setSide("buy")}
                className={[
                  "flex-1 py-1.5 text-xs font-dashboard rounded transition-colors",
                  side === "buy"
                    ? "bg-status-success/20 text-status-success border border-status-success/30"
                    : "bg-surface-2 text-text-tertiary border border-border-default",
                ].join(" ")}
              >
                Buy
              </button>
              <button
                onClick={() => setSide("sell")}
                className={[
                  "flex-1 py-1.5 text-xs font-dashboard rounded transition-colors",
                  side === "sell"
                    ? "bg-status-critical/20 text-status-critical border border-status-critical/30"
                    : "bg-surface-2 text-text-tertiary border border-border-default",
                ].join(" ")}
              >
                Sell
              </button>
            </div>

            {/* Resource */}
            <div>
              <label className="text-[10px] text-text-tertiary font-dashboard block mb-1">
                Resource
              </label>
              <Select
                options={RESOURCE_OPTIONS}
                value={resource}
                onChange={setResource}
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-[10px] text-text-tertiary font-dashboard block mb-1">
                Amount
              </label>
              <Input
                value={amount}
                onChange={setAmount}
                placeholder="0.00"
                variant="terminal"
              />
            </div>

            {/* Price */}
            <div>
              <label className="text-[10px] text-text-tertiary font-dashboard block mb-1">
                Price (RATE per unit)
              </label>
              <Input
                value={price}
                onChange={setPrice}
                placeholder="0.0000"
                variant="terminal"
              />
            </div>

            {/* Total */}
            {amount && price && (
              <div className="text-xs font-dashboard text-text-secondary bg-surface-2 rounded px-2 py-1.5">
                Total: {(parseFloat(amount || "0") * parseFloat(price || "0")).toFixed(2)} RATE
              </div>
            )}

            {/* Submit */}
            <Button
              variant="primary"
              size="sm"
              disabled={!amount || !price || submitting}
              onClick={handlePlaceOrder}
            >
              {submitting ? "Submitting..." : `${side === "buy" ? "Buy" : "Sell"} ${resource}`}
            </Button>

            {/* Status message */}
            {statusMessage && (
              <div className={`text-xs font-dashboard rounded px-2 py-1.5 ${
                statusMessage.type === "success"
                  ? "bg-status-success/10 text-status-success"
                  : "bg-status-critical/10 text-status-critical"
              }`}>
                {statusMessage.text}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-text-secondary font-dashboard">
              Claim accumulated production from all your buildings.
            </p>
            <Button
              variant="primary"
              size="sm"
              disabled={claimingProduction}
              onClick={handleClaimProduction}
            >
              {claimingProduction ? "Claiming..." : "Claim All Production"}
            </Button>

            {/* Status message */}
            {statusMessage && (
              <div className={`text-xs font-dashboard rounded px-2 py-1.5 ${
                statusMessage.type === "success"
                  ? "bg-status-success/10 text-status-success"
                  : "bg-status-critical/10 text-status-critical"
              }`}>
                {statusMessage.text}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DirectActionPanel;
