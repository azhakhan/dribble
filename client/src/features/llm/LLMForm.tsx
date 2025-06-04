import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useLLMStore } from "@/shared/store/useLLMStore";
import {
  useCreateLLMMutation,
  useUpdateLLMMutation,
  useLLMQuery
} from "@/shared/hooks/useLLMsQuery";
import type { CreateLLMRequest, UpdateLLMRequest } from "@/shared/lib/api";

interface LLMFormData {
  name: "openai" | "anthropic" | "gemini" | "ollama";
  model: string;
  api_key?: string;
  base_url?: string;
  api_version?: string;
  settings?: string; // JSON string for form handling
  default?: boolean;
}

interface LLMFormProps {
  onSuccess?: () => void;
}

export function LLMForm({ onSuccess }: LLMFormProps) {
  const { selectedLLM, isEditing, closeForm } = useLLMStore();
  const createMutation = useCreateLLMMutation();
  const updateMutation = useUpdateLLMMutation();

  // Fetch LLM data if editing
  const { data: llmData } = useLLMQuery(isEditing ? selectedLLM?.id : undefined);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting }
  } = useForm<LLMFormData>({
    defaultValues: {
      name: "openai",
      model: "",
      api_key: "",
      base_url: "",
      api_version: "",
      settings: "",
      default: false
    }
  });

  const selectedName = watch("name");

  // Reset form when LLM data is loaded or when switching between create/edit
  useEffect(() => {
    if (isEditing && llmData) {
      reset({
        name: llmData.name,
        model: llmData.model,
        api_key: "", // Don't populate API key for security
        base_url: llmData.base_url || "",
        api_version: llmData.api_version || "",
        settings: llmData.settings ? JSON.stringify(llmData.settings, null, 2) : "",
        default: llmData.default || false
      });
    } else if (!isEditing) {
      reset({
        name: "openai",
        model: "",
        api_key: "",
        base_url: "",
        api_version: "",
        settings: "",
        default: false
      });
    }
  }, [isEditing, llmData, reset]);

  const onSubmit = async (data: LLMFormData) => {
    try {
      let settings: Record<string, unknown> | undefined;

      // Parse settings JSON if provided
      if (data.settings?.trim()) {
        try {
          settings = JSON.parse(data.settings);
        } catch {
          toast.error("Invalid JSON in settings field");
          return;
        }
      }

      const payload = {
        name: data.name,
        model: data.model,
        api_key: data.api_key || undefined,
        base_url: data.base_url || undefined,
        api_version: data.api_version || undefined,
        settings,
        default: data.default || false
      };

      if (isEditing && selectedLLM) {
        await updateMutation.mutateAsync({
          llmId: selectedLLM.id,
          data: payload as UpdateLLMRequest
        });
        toast.success("LLM configuration updated successfully");
      } else {
        await createMutation.mutateAsync(payload as CreateLLMRequest);
        toast.success("LLM configuration created successfully");
      }

      closeForm();
      onSuccess?.();
    } catch (error) {
      // FastAPI HTTPException always returns errors in response.data.detail
      let errorMessage = "Unknown error occurred";

      // Check if it's an axios error with response data
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response?: { data?: { detail?: string } } };
        if (axiosError.response?.data?.detail) {
          errorMessage = axiosError.response.data.detail;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    }
  };

  const getModelPlaceholder = (name: string) => {
    switch (name) {
      case "openai":
        return "gpt-4, gpt-3.5-turbo, etc.";
      case "anthropic":
        return "claude-3-opus, claude-3-sonnet, etc.";
      case "gemini":
        return "gemini-pro, gemini-pro-vision, etc.";
      case "ollama":
        return "llama2, codellama, etc.";
      default:
        return "Enter model name";
    }
  };

  const getBaseUrlPlaceholder = (name: string) => {
    switch (name) {
      case "openai":
        return "https://api.openai.com/v1 (optional)";
      case "anthropic":
        return "https://api.anthropic.com (optional)";
      case "gemini":
        return "https://generativelanguage.googleapis.com (optional)";
      case "ollama":
        return "http://localhost:11434 (required)";
      default:
        return "Base URL";
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Provider *</Label>
          <Controller
            name="name"
            control={control}
            rules={{ required: "Provider is required" }}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="ollama">Ollama</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model *</Label>
          <Input
            id="model"
            placeholder={getModelPlaceholder(selectedName)}
            {...register("model", { required: "Model is required" })}
          />
          {errors.model && <p className="text-sm text-destructive">{errors.model.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="api_key">API Key</Label>
          <Input
            id="api_key"
            type="password"
            placeholder={isEditing ? "Leave empty to keep current key" : "Enter API key"}
            {...register("api_key")}
          />
          {errors.api_key && <p className="text-sm text-destructive">{errors.api_key.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="base_url">Base URL</Label>
          <Input
            id="base_url"
            placeholder={getBaseUrlPlaceholder(selectedName)}
            {...register("base_url")}
          />
          {errors.base_url && <p className="text-sm text-destructive">{errors.base_url.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="api_version">API Version</Label>
          <Input
            id="api_version"
            placeholder="e.g., 2023-12-01-preview"
            {...register("api_version")}
          />
          {errors.api_version && (
            <p className="text-sm text-destructive">{errors.api_version.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings">Additional Settings (JSON)</Label>
          <Textarea
            id="settings"
            placeholder='{"temperature": 0.7, "max_tokens": 1000}'
            rows={4}
            {...register("settings")}
          />
          {errors.settings && <p className="text-sm text-destructive">{errors.settings.message}</p>}
        </div>

        <div className="flex items-center space-x-2">
          <Controller
            name="default"
            control={control}
            render={({ field }) => (
              <Checkbox id="default" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <Label
            htmlFor="default"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Set as default LLM
          </Label>
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : isEditing ? "Update LLM" : "Create LLM"}
        </Button>
      </div>
    </form>
  );
}
