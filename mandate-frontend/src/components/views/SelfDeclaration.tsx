"use client";

import { useState, useCallback } from "react";
import { Toggle } from "@/components/interactive/Toggle";
import { Button } from "@/components/interactive/Button";

export interface SelfDeclarationResult {
  strategyFamiliar: boolean;
  aiFamiliar: boolean;
}

interface SelfDeclarationProps {
  readonly onComplete: (result: SelfDeclarationResult) => void;
}

export function SelfDeclaration({ onComplete }: SelfDeclarationProps) {
  const [strategyFamiliar, setStrategyFamiliar] = useState(false);
  const [aiFamiliar, setAIFamiliar] = useState(false);

  const handleBegin = useCallback(() => {
    onComplete({ strategyFamiliar, aiFamiliar });
  }, [strategyFamiliar, aiFamiliar, onComplete]);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-night-sky">
      <div className="bg-surface-2 rounded p-8 border border-border-default w-full max-w-md text-center">
        <h1 className="font-terminal text-2xl text-text-primary mb-6 tracking-wider">
          MANDATE
        </h1>
        <p className="font-dashboard text-sm text-text-secondary mb-8">
          Before we begin:
        </p>

        <div className="space-y-5 mb-8 text-left">
          <Toggle
            checked={strategyFamiliar}
            onChange={setStrategyFamiliar}
            label="I'm familiar with strategy games"
          />
          <Toggle
            checked={aiFamiliar}
            onChange={setAIFamiliar}
            label="I've used AI tools (ChatGPT, Claude, etc.)"
          />
        </div>

        <Button variant="primary" onClick={handleBegin}>
          Begin
        </Button>
      </div>
    </div>
  );
}
