import { AutoComplete, type Option } from "@/components/common/autocomplete";
import { ModelsCard } from "@/components/custom/ModelsDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGlobalStore } from "@/lib/hooks";
import { fetchWithBaseUrl, fetcher } from "@/lib/utils";
import { AdminTokenSettings, TrainingRequest } from "@/types";
import { CheckCircle2, Dumbbell, List, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

interface DatasetListResponse {
  pushed_datasets: string[];
  local_datasets: string[];
}

export default function AITrainingPage() {
  const [selectedDatasetID, setSelectedDataset] = useState<string>("");
  const setSelectedModelType = useGlobalStore(
    (state) => state.setSelectedModelType,
  );
  const [trainingState, setTrainingState] = useState<
    "idle" | "loading" | "success"
  >("idle");
  const selectedModelType = useGlobalStore((state) => state.selectedModelType);
  const { data: adminSettingsTokens } = useSWR<AdminTokenSettings>(
    ["/admin/settings/tokens"],
    ([url]) => fetcher(url, "POST"),
  );
  const { data: datasetsList } = useSWR<DatasetListResponse>(
    ["/dataset/list"],
    ([url]) => fetcher(url, "POST"),
  );

  const launchModelTraining = async (datasetID: string, modelName: string) => {
    const trainingRequest: TrainingRequest = {
      dataset_name: datasetID,
      model_name: modelName,
      model_type: selectedModelType,
    };

    fetchWithBaseUrl("/training/start", "POST", trainingRequest);
    console.log("Launched training job");
  };

  const generateHuggingFaceModelName = async (dataset: string) => {
    // Model name followed by 10 random characters
    const randomChars = Math.random().toString(36).substring(2, 12);
    // Remove the name/... and replace with phospho-app/...
    const [, datasetName] = dataset.split("/");

    // Fetch whoami to get the username
    try {
      const result = await fetchWithBaseUrl(
        "/admin/huggingface/whoami",
        "POST",
      );
      // Check the status from the whoami response
      if (result.status === "success" && result.username) {
        // Include username in the model name if status is success
        return `phospho-app/${result.username}-${selectedModelType}-${datasetName}-${randomChars}`;
      } else {
        // Fallback without username if status is not success
        return `phospho-app/${selectedModelType}-${datasetName}-${randomChars}`;
      }
    } catch (error) {
      console.error("Error fetching whoami:", error);
      // Fallback without username in case of error
      return `phospho-app/${selectedModelType}-${datasetName}-${randomChars}`;
    }
  };

  const handleTrainModel = async () => {
    if (!selectedDatasetID) {
      toast.error("Please select a dataset to train the model.", {
        duration: 5000,
      });
      return;
    }

    if (!adminSettingsTokens?.huggingface) {
      toast.error("Please set a valid Hugging Face token in the settings.", {
        duration: 5000,
      });
      return;
    }

    // Set loading state
    setTrainingState("loading");

    try {
      // Generate a random model name
      const modelName = await generateHuggingFaceModelName(selectedDatasetID);
      const modelUrl = `https://huggingface.co/${modelName}`;

      // Send Slack notification and wait for response
      await launchModelTraining(selectedDatasetID, modelName);

      // After successful notification, wait 1 second then show success
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setTrainingState("success");
      toast.success(`Model training started! Check progress at: ${modelUrl}`, {
        duration: 5000,
      });

      return { success: true, modelName };
    } catch (error) {
      console.error("Error starting training job:", error);
      setTrainingState("idle");

      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred while starting the training job. Please try again later.";

      toast.error(errorMessage, {
        duration: 5000,
      });

      return { success: false, error: errorMessage };
    }
  };

  // Render button content based on training state
  const renderButtonContent = () => {
    switch (trainingState) {
      case "loading":
        return (
          <>
            <Loader2 className="size-5 mr-2 animate-spin" />
            Starting...
          </>
        );
      case "success":
        return (
          <>
            <CheckCircle2 className="size-5 mr-2 text-green-500" />
            Training job started
          </>
        );
      default:
        return (
          <>
            <Dumbbell className="size-5 mr-2" />
            Train AI model
          </>
        );
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Tabs defaultValue="train">
        <div className="flex justify-between">
          <TabsList className="flex flex-col md:flex-row gap-4 border-1">
            <TabsTrigger value="train">
              <Dumbbell className="size-4 mr-2" />
              Train AI model
            </TabsTrigger>
            <TabsTrigger value="view">
              <List className="size-4 mr-2" />
              View trained models
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="train">
          <Card className="w-full">
            <CardContent>
              <div className="flex flex-col md:flex-row gap-2 items-end">
                <div className="flex-1/2 flex flex-row md:flex-col gap-2 w-full">
                  <div className="text-xs text-muted-foreground md:w-1/2">
                    Dataset ID on Hugging Face:
                  </div>
                  <AutoComplete
                    key="dataset-autocomplete"
                    options={
                      datasetsList?.pushed_datasets.map((dataset) => ({
                        value: dataset,
                        label: dataset,
                      })) ?? []
                    }
                    value={{
                      value: selectedDatasetID,
                      label: selectedDatasetID,
                    }}
                    onValueChange={(option: Option) => {
                      setSelectedDataset(option.value);
                    }}
                    placeholder="e.g. username/dataset-name"
                    className="w-full"
                    emptyMessage="Make sure this is a public dataset available on Hugging Face."
                  />
                </div>
                <div className="flex-1/4 flex flex-row md:flex-col gap-2 w-full mb-1">
                  <div className="text-xs text-muted-foreground">
                    Type of model to train:
                  </div>
                  <Select
                    defaultValue={selectedModelType}
                    onValueChange={(value) =>
                      setSelectedModelType(value as "gr00t" | "ACT")
                    }
                  >
                    <SelectTrigger className="w-full border rounded-md p-2">
                      <SelectValue placeholder="Select model type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gr00t">gr00t</SelectItem>
                      <SelectItem value="ACT">ACT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="secondary"
                  className="flex-1/4 mb-1"
                  onClick={handleTrainModel}
                  disabled={!selectedDatasetID || trainingState !== "idle"}
                >
                  {renderButtonContent()}
                </Button>
              </div>
              <div className="text-muted-foreground text-sm mt-2">
                For more advanced options, such as changing the number of
                epochs, steps, etc..., please use the{" "}
                <code>/training/start</code> api endpoint.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="view">
          <ModelsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
