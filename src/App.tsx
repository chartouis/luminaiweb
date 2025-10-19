import { useState, useEffect, type FC } from "react";
import {
  FileText,
  Play,
  Download,
  Share2,
  Sparkles,
  Loader,
  ChevronDown,
} from "lucide-react";

interface Scene {
  scene: number;
  script: string;
  photoPrompt: string;
  audioPrompt: string;
  backgroundPrompt: string;
}

interface State {
  id: string;
  batchId: string;
  ImgStatus: string;
  VidStatus: string;
  scene: Scene;
  imgurl: string;
  vidurl: string;
  vidId: string;
}

type CurrentPage = "landing" | "create" | "result";

// Configuration - update this with your API base URL
const API_BASE_URL = "http://localhost:8082"; // Change to your API URL

const App: FC = () => {
  const [currentPage, setCurrentPage] = useState<CurrentPage>("landing");
  const [inputValue, setInputValue] = useState<string>("");
  const [sceneNumber, setSceneNumber] = useState<number>(5);
  const [states, setStates] = useState<State[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [generatingLLM, setGeneratingLLM] = useState<boolean>(false);
  const [generatingVideo, setGeneratingVideo] = useState<boolean>(false);
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(new Set());
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll states every 3 seconds when generating
  useEffect(() => {
    if (!batchId || !generatingVideo) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/upload/states`);
        if (!response.ok) throw new Error("Failed to fetch states");

        const allStates: State[] = await response.json();
        const batchStates = allStates.filter((s) => s.batchId === batchId);
        setStates(batchStates);

        // Check if all videos are finished
        const allFinished =
          batchStates.length > 0 &&
          batchStates.every((s) => s.VidStatus === "finished");

        if (allFinished) {
          clearInterval(pollInterval);
          // Wait 2 minutes before fetching the video
          setTimeout(async () => {
            try {
              const videoResponse = await fetch(
                `http://localhost:8082/api/upload/video/${batchId}`
              );
              if (videoResponse.ok) {
                const videoBlob = await videoResponse.blob();
                const url = URL.createObjectURL(videoBlob);
                setVideoUrl(url);
                setGeneratingVideo(false);
                setCurrentPage("result");
              } else {
                setError("Failed to fetch video");
                setGeneratingVideo(false);
              }
            } catch (err) {
              console.error("Error fetching video:", err);
              setError("Failed to fetch video");
              setGeneratingVideo(false);
            }
          }, 120000); // 2 minutes = 120000 milliseconds
        }
      } catch (err) {
        console.error("Error polling states:", err);
        setError("Failed to check video status");
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [batchId, generatingVideo]);

  const handleGenerateLLM = async (): Promise<void> => {
    if (!inputValue.trim()) return;

    setGeneratingLLM(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload/text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: inputValue,
          scene_number: sceneNumber,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to upload text");
      }

      const newBatchId = await response.text();
      setBatchId(newBatchId);

      // Wait a moment for backend to process, then fetch initial states
      setTimeout(async () => {
        try {
          const statesResponse = await fetch(
            `${API_BASE_URL}/api/upload/states`
          );
          if (statesResponse.ok) {
            const allStates: State[] = await statesResponse.json();
            const batchStates = allStates.filter(
              (s) => s.batchId === newBatchId
            );
            setStates(batchStates);
            setSelectedScenes(new Set(batchStates.map((s) => s.id)));
          }
        } catch (err) {
          console.error("Error fetching initial states:", err);
        }
        setGeneratingLLM(false);
      }, 2000);
    } catch (err) {
      console.error("Error generating scenes:", err);
      setError("Failed to generate scenes. Please try again.");
      setGeneratingLLM(false);
    }
  };

  const handleGenerateVideo = async (): Promise<void> => {
    if (!batchId) return;
    setGeneratingVideo(true);
    setError(null);
    // Polling will handle the rest
  };

  const toggleScene = (sceneId: string): void => {
    const newSelected = new Set(selectedScenes);
    if (newSelected.has(sceneId)) {
      newSelected.delete(sceneId);
    } else {
      newSelected.add(sceneId);
    }
    setSelectedScenes(newSelected);
  };

  const getCurrentProgress = (): { current: number; total: number } => {
    const finishedCount = states.filter(
      (s) => s.VidStatus === "finished"
    ).length;
    return { current: finishedCount, total: states.length };
  };

  const getStatusText = (state: State): string => {
    if (state.VidStatus === "finished") return "✓ Complete";
    if (state.VidStatus === "processing") return "⏳ Processing video...";
    if (state.ImgStatus === "processing") return "🎨 Generating image...";
    return "⏳ Queued";
  };

  // Landing Page
  if (currentPage === "landing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              <span className="text-xl font-bold text-gray-900">LuminAi</span>
            </div>
            <button
              onClick={() => setCurrentPage("create")}
              className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition"
            >
              Get Started
            </button>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto px-4 py-24 text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Turn your text into an AI-generated story video.
          </h1>
          <p className="text-2xl text-gray-600 mb-12">
            Powered by Open-AI + Higgsfield. Bring your imagination to life.
          </p>

          <div className="flex justify-center gap-4 mb-24">
            <button
              onClick={() => setCurrentPage("create")}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-lg font-semibold hover:shadow-xl transition transform hover:scale-105"
            >
              Get Started
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mt-20">
            {[
              {
                icon: FileText,
                title: "Text Input",
                desc: "Paste any story or concept",
              },
              {
                icon: Sparkles,
                title: "AI Magic",
                desc: "Auto-generate video scenes",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="bg-white rounded-lg p-8 border border-slate-200 hover:shadow-lg transition"
              >
                <f.icon className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                <h3 className="font-semibold text-lg text-gray-900 mb-2">
                  {f.title}
                </h3>
                <p className="text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Create Page
  if (currentPage === "create") {
    const progress = getCurrentProgress();

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentPage("landing")}
              className="flex items-center gap-2"
            >
              <Sparkles className="w-6 h-6 text-indigo-600" />
              <span className="text-xl font-bold text-gray-900">
                AI Story2Video
              </span>
            </button>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                <div className="p-6">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Enter your text or story here…"
                    className="w-full h-40 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent resize-none"
                    disabled={generatingLLM || generatingVideo}
                  />

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of scenes: {sceneNumber}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={sceneNumber}
                      onChange={(e) => setSceneNumber(Number(e.target.value))}
                      className="w-full"
                      disabled={generatingLLM || generatingVideo}
                    />
                  </div>

                  {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded-lg">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <button
                    onClick={handleGenerateLLM}
                    disabled={
                      !inputValue.trim() || generatingLLM || generatingVideo
                    }
                    className="w-full mt-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {generatingLLM ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                    {generatingLLM ? "Generating…" : "Generate Video Script"}
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              {states.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Generated Scenes
                    </h2>
                    {generatingVideo && (
                      <span className="text-sm text-gray-600">
                        {progress.current} / {progress.total} complete
                      </span>
                    )}
                  </div>

                  {states.map((state) => (
                    <div
                      key={state.id}
                      className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden hover:shadow-lg transition"
                    >
                      <button
                        onClick={() =>
                          setExpandedScene(
                            expandedScene === state.id ? null : state.id
                          )
                        }
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition"
                      >
                        <div className="flex items-center gap-4 text-left flex-1">
                          <input
                            type="checkbox"
                            checked={selectedScenes.has(state.id)}
                            onChange={() => toggleScene(state.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 text-indigo-600 rounded"
                            disabled={generatingVideo}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">
                                Scene {state.scene.scene}
                              </h3>
                              {generatingVideo && (
                                <span className="text-xs text-gray-500">
                                  {getStatusText(state)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-1">
                              {state.scene.script}
                            </p>
                          </div>
                        </div>
                        <ChevronDown
                          className={`w-5 h-5 text-gray-400 transition ${
                            expandedScene === state.id ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {expandedScene === state.id && (
                        <div className="px-6 pb-4 space-y-3 border-t border-slate-200 bg-slate-50">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                              Script
                            </p>
                            <p className="text-gray-700">
                              {state.scene.script}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                              🎨 Photo Prompt
                            </p>
                            <p className="text-sm text-gray-600">
                              {state.scene.photoPrompt}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                              🎧 Audio Prompt
                            </p>
                            <p className="text-sm text-gray-600">
                              {state.scene.audioPrompt}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                              🏙 Background
                            </p>
                            <p className="text-sm text-gray-600">
                              {state.scene.backgroundPrompt}
                            </p>
                          </div>
                          {state.imgurl && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                                Generated Image
                              </p>
                              <img
                                src={state.imgurl}
                                alt={`Scene ${state.scene.scene}`}
                                className="rounded-lg max-w-full"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={handleGenerateVideo}
                    disabled={
                      selectedScenes.size === 0 ||
                      generatingVideo ||
                      generatingLLM
                    }
                    className="w-full py-4 mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {generatingVideo ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                    {generatingVideo
                      ? `Generating Video: ${progress.current}/${progress.total} scenes`
                      : "Generate Video"}
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-md border border-slate-200 p-12 text-center">
                  <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-gray-600">
                    Generate a script to see scenes here
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Result Page
  if (currentPage === "result") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentPage("landing")}
              className="flex items-center gap-2"
            >
              <Sparkles className="w-6 h-6 text-indigo-600" />
              <span className="text-xl font-bold text-gray-900">
                AI Story2Video
              </span>
            </button>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <div className="inline-block mb-4 text-6xl">🎉</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Your video is ready!
            </h1>
            <p className="text-gray-600">Download, share, or create another</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
            {videoUrl ? (
              <video controls className="w-full aspect-video" src={videoUrl}>
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="bg-black aspect-video flex items-center justify-center">
                <Play className="w-20 h-20 text-white opacity-50" />
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <button
              onClick={() => {
                if (videoUrl) {
                  const a = document.createElement("a");
                  a.href = videoUrl;
                  a.download = `video-${batchId}.mp4`;
                  a.click();
                }
              }}
              disabled={!videoUrl}
              className="py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              Download Video
            </button>
            <button
              onClick={() => {
                if (batchId) {
                  navigator.clipboard.writeText(
                    `${API_BASE_URL}/api/upload/video/${batchId}`
                  );
                  alert("Video link copied to clipboard!");
                }
              }}
              className="py-4 px-6 border-2 border-indigo-600 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" />
              Share Link
            </button>
            <button
              onClick={() => {
                setCurrentPage("create");
                setStates([]);
                setInputValue("");
                setSelectedScenes(new Set());
                setBatchId(null);
                setVideoUrl(null);
                setError(null);
              }}
              className="py-4 px-6 border-2 border-slate-300 text-gray-700 rounded-lg font-semibold hover:bg-slate-50 transition"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default App;
