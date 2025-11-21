/*
┌──────────────────────────────────────────────────────────────────────────────┐
│ @author: Davidson Gomes                                                      │
│ @file: /app/agents/forms/BasicInfoTab.tsx                                    │
│ Developed by: Davidson Gomes                                                 │
│ Creation date: May 13, 2025                                                  │
│ Contact: contato@evolution-api.com                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ @copyright © Evolution API 2025. All rights reserved.                        │
│ Licensed under the Apache License, Version 2.0                               │
│                                                                              │
│ You may not use this file except in compliance with the License.             │
│ You may obtain a copy of the License at                                      │
│                                                                              │
│    http://www.apache.org/licenses/LICENSE-2.0                                │
│                                                                              │
│ Unless required by applicable law or agreed to in writing, software          │
│ distributed under the License is distributed on an "AS IS" BASIS,            │
│ WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.     │
│ See the License for the specific language governing permissions and          │
│ limitations under the License.                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ @important                                                                   │
│ For any future changes to the code in this file, it is recommended to        │
│ include, together with the modification, the information of the developer    │
│ who changed it and the date of modification.                                 │
└──────────────────────────────────────────────────────────────────────────────┘
*/
"use client";

import { useState } from "react";
import { AgentTypeSelector } from "@/app/agents/AgentTypeSelector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Agent, AgentType } from "@/types/agent";
import { ApiKey } from "@/services/agentService";
import { A2AAgentConfig } from "../config/A2AAgentConfig";
import { LLMAgentConfig } from "../config/LLMAgentConfig";
import { sanitizeAgentName } from "@/lib/utils";
import { KnowledgeBase } from "@/types/knowledgeBase";
import { X } from "lucide-react";

interface ModelOption {
  value: string;
  label: string;
  provider: string;
}

interface BasicInfoTabProps {
  values: Partial<Agent>;
  onChange: (values: Partial<Agent>) => void;
  apiKeys: ApiKey[];
  availableModels: ModelOption[];
  onOpenApiKeysDialog: () => void;
  knowledgeBases: KnowledgeBase[];
}

export function BasicInfoTab({
  values,
  onChange,
  apiKeys,
  availableModels,
  onOpenApiKeysDialog,
  knowledgeBases,
}: BasicInfoTabProps) {
  const [knowledgePopoverOpen, setKnowledgePopoverOpen] = useState(false);
  const handleNameBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const sanitizedName = sanitizeAgentName(e.target.value);
    if (sanitizedName !== e.target.value) {
      onChange({ ...values, name: sanitizedName });
    }
  };

  const handleTypeChange = (type: AgentType) => {
    let newValues: Partial<Agent> = { ...values, type };

    const knowledgeDefaults = {
      knowledge_base_ids: values.config?.knowledge_base_ids || [],
      rag_top_k: values.config?.rag_top_k ?? 5,
      rag_score_threshold: values.config?.rag_score_threshold ?? 0.35,
    };

    if (type === "llm") {
      newValues = {
        ...newValues,
        model: "openai/gpt-4.1-nano",
        instruction: "",
        role: "",
        goal: "",
        agent_card_url: undefined,
        config: {
          tools: [],
          mcp_servers: [],
          custom_mcp_servers: [],
          custom_tools: {
            http_tools: [],
          },
          sub_agents: [],
          ...knowledgeDefaults,
        },
      };
    } else if (type === "a2a") {
      newValues = {
        ...newValues,
        model: undefined,
        instruction: undefined,
        role: undefined,
        goal: undefined,
        agent_card_url: "",
        api_key_id: undefined,
        config: undefined,
      };
    } else if (type === "loop") {
      newValues = {
        ...newValues,
        model: undefined,
        instruction: undefined,
        role: undefined,
        goal: undefined,
        agent_card_url: undefined,
        api_key_id: undefined,
        config: {
          sub_agents: [],
          custom_mcp_servers: [],
          ...knowledgeDefaults,
        },
      };
    } else if (type === "workflow") {
      newValues = {
        ...newValues,
        model: undefined,
        instruction: undefined,
        role: undefined,
        goal: undefined,
        agent_card_url: undefined,
        api_key_id: undefined,
        config: {
          sub_agents: [],
          workflow: {
            nodes: [],
            edges: [],
          },
          ...knowledgeDefaults,
        },
      };
    } else if (type === "task") {
      newValues = {
        ...newValues,
        model: undefined,
        instruction: undefined,
        role: undefined,
        goal: undefined,
        agent_card_url: undefined,
        api_key_id: undefined,
        config: {
          tasks: [],
          sub_agents: [],
          ...knowledgeDefaults,
        },
      };
    } else {
      newValues = {
        ...newValues,
        model: undefined,
        instruction: undefined,
        role: undefined,
        goal: undefined,
        agent_card_url: undefined,
        api_key_id: undefined,
        config: {
          sub_agents: [],
          custom_mcp_servers: [],
          ...knowledgeDefaults,
        },
      };
    }

    onChange(newValues);
  };

  const currentConfig = values.config || {};
  const selectedKnowledgeBaseIds = currentConfig.knowledge_base_ids || [];
  const selectedBases = knowledgeBases.filter((base) =>
    selectedKnowledgeBaseIds.includes(base.id)
  );

  const updateConfig = (configPatch: Partial<Agent["config"]>) => {
    onChange({
      ...values,
      config: {
        ...(values.config || {}),
        ...configPatch,
      },
    });
  };

  const toggleKnowledgeBase = (id: string) => {
    const existing = new Set(selectedKnowledgeBaseIds);
    if (existing.has(id)) {
      existing.delete(id);
    } else {
      existing.add(id);
    }
    updateConfig({ knowledge_base_ids: Array.from(existing) });
  };

  const removeKnowledgeBase = (id: string) => {
    updateConfig({
      knowledge_base_ids: selectedKnowledgeBaseIds.filter((baseId) => baseId !== id),
    });
  };

  const handleRagInput = (field: "rag_top_k" | "rag_score_threshold", value: number) => {
    updateConfig({ [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="type" className="text-right text-neutral-300">
          Agent Type
        </Label>
        <div className="col-span-3">
          <AgentTypeSelector
            value={values.type || "llm"}
            onValueChange={handleTypeChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="name" className="text-right text-neutral-300">
          Name
        </Label>
        <Input
          id="name"
          value={values.name || ""}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          onBlur={handleNameBlur}
          className="col-span-3 bg-[#222] border-[#444] text-white"
        />
      </div>

      {values.type !== "a2a" && (
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="description" className="text-right text-neutral-300">
            Description
          </Label>
          <Input
            id="description"
            value={values.description || ""}
            onChange={(e) =>
              onChange({ ...values, description: e.target.value })
            }
            className="col-span-3 bg-[#222] border-[#444] text-white"
          />
        </div>
      )}

      {values.type !== "a2a" && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-neutral-300">
              Knowledge Bases
            </Label>
            <div className="col-span-3 space-y-2">
              <Popover open={knowledgePopoverOpen} onOpenChange={setKnowledgePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between bg-[#1d1d1d] border-[#333] text-white hover:bg-[#2a2a2a]"
                  >
                    {selectedKnowledgeBaseIds.length > 0
                      ? `${selectedKnowledgeBaseIds.length} selected`
                      : "Select knowledge bases"}
                    <span className="text-xs text-neutral-400">
                      Context for RAG
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 bg-[#1a1a1a] border-[#333] text-white">
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {knowledgeBases.length === 0 ? (
                      <p className="text-sm text-neutral-400">
                        No knowledge bases found. Create one under “Knowledge Bases”.
                      </p>
                    ) : (
                      knowledgeBases.map((base) => (
                        <label
                          key={base.id}
                          className="flex items-start gap-3 text-sm text-neutral-200 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedKnowledgeBaseIds.includes(base.id)}
                            onCheckedChange={() => toggleKnowledgeBase(base.id)}
                          />
                          <div>
                            <p className="font-medium">{base.name}</p>
                            <p className="text-xs text-neutral-500">
                              {base.description || "No description"}
                            </p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {selectedBases.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedBases.map((base) => (
                    <Badge
                      key={base.id}
                      variant="secondary"
                      className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1"
                    >
                      {base.name}
                      <button
                        type="button"
                        onClick={() => removeKnowledgeBase(base.id)}
                        className="text-neutral-400 hover:text-white"
                        aria-label={`Remove ${base.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <p className="text-xs text-neutral-500">
                Agents with linked knowledge bases automatically retrieve context before every response.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-neutral-300">Context top-K</Label>
              <Input
                type="number"
                min={1}
                value={currentConfig.rag_top_k ?? 5}
                onChange={(event) => handleRagInput("rag_top_k", Number(event.target.value))}
                className="bg-[#222] border-[#444] text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-neutral-300">Score threshold</Label>
              <Input
                type="number"
                step={0.05}
                min={0}
                max={1}
                value={currentConfig.rag_score_threshold ?? 0.35}
                onChange={(event) =>
                  handleRagInput("rag_score_threshold", Number(event.target.value))
                }
                className="bg-[#222] border-[#444] text-white"
              />
            </div>
          </div>
        </div>
      )}

      {values.type === "llm" && (
        <LLMAgentConfig
          apiKeys={apiKeys}
          availableModels={availableModels}
          values={values}
          onChange={onChange}
          onOpenApiKeysDialog={onOpenApiKeysDialog}
        />
      )}

      {values.type === "loop" && values.config?.max_iterations && (
        <div className="space-y-1 text-xs text-neutral-400">
          <div>
            <strong>Max. Iterations:</strong> {values.config.max_iterations}
          </div>
        </div>
      )}

      {values.type === "workflow" && (
        <div className="space-y-1 text-xs text-neutral-400">
          <div>
            <strong>Type:</strong> Visual Flow
          </div>
          {values.config?.workflow && (
            <div>
              <strong>Elements:</strong>{" "}
              {values.config.workflow.nodes?.length || 0} nodes,{" "}
              {values.config.workflow.edges?.length || 0} connections
            </div>
          )}
        </div>
      )}
    </div>
  );
}
