// The Open Model Index registry — the flagship open-weight models we track.
// hfRepoId: Hugging Face model repo for download counts (null for runtime-only).
// github: the repo we track velocity for (stars/forks/contributors).

export interface ModelEntry {
  key: string
  name: string
  org: string
  family: string
  hfRepoId: string | null
  github: { owner: string; name: string } | null
}

export const MODEL_REGISTRY: ModelEntry[] = [
  {
    key: 'deepseek-v3',
    name: 'deepseek v3',
    org: 'deepseek-ai',
    family: 'deepseek',
    hfRepoId: 'deepseek-ai/DeepSeek-V3-0324',
    github: { owner: 'deepseek-ai', name: 'DeepSeek-V3' },
  },
  {
    key: 'deepseek-r1',
    name: 'deepseek r1',
    org: 'deepseek-ai',
    family: 'deepseek',
    hfRepoId: 'deepseek-ai/DeepSeek-R1',
    github: { owner: 'deepseek-ai', name: 'DeepSeek-R1' },
  },
  {
    key: 'llama-3.3-70b',
    name: 'llama 3.3 70b',
    org: 'meta-llama',
    family: 'llama',
    hfRepoId: 'meta-llama/Llama-3.3-70B-Instruct',
    github: { owner: 'meta-llama', name: 'llama' },
  },
  {
    key: 'qwen3-235b',
    name: 'qwen3 235b',
    org: 'Qwen',
    family: 'qwen',
    hfRepoId: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    github: { owner: 'QwenLM', name: 'Qwen3' },
  },
  {
    key: 'kimi-k2',
    name: 'kimi k2',
    org: 'moonshotai',
    family: 'kimi',
    hfRepoId: 'moonshotai/Kimi-K2-Instruct',
    github: { owner: 'MoonshotAI', name: 'kimi-code' },
  },
  {
    key: 'kimi-k3',
    name: 'kimi k3',
    org: 'moonshotai',
    family: 'kimi',
    hfRepoId: 'moonshotai/Kimi-K3',
    github: { owner: 'MoonshotAI', name: 'Kimi-K3' },
  },
  {
    key: 'mistral-small-3.1',
    name: 'mistral small 3.1',
    org: 'mistralai',
    family: 'mistral',
    hfRepoId: 'mistralai/Mistral-Small-3.1-24B-Instruct-2503',
    github: { owner: 'mistralai', name: 'mistral-vibe' },
  },
  {
    key: 'glm-4.5',
    name: 'glm 4.5',
    org: 'zai-org',
    family: 'glm',
    hfRepoId: 'zai-org/GLM-4.5',
    github: { owner: 'zai-org', name: 'GLM-4.5' },
  },
  // Runtime layer — the tools people run open models with (GitHub-only)
  {
    key: 'ollama',
    name: 'ollama',
    org: 'ollama',
    family: 'runtime',
    hfRepoId: null,
    github: { owner: 'ollama', name: 'ollama' },
  },
  {
    key: 'llama.cpp',
    name: 'llama.cpp',
    org: 'ggml-org',
    family: 'runtime',
    hfRepoId: null,
    github: { owner: 'ggml-org', name: 'llama.cpp' },
  },
  {
    key: 'vllm',
    name: 'vllm',
    org: 'vllm-project',
    family: 'runtime',
    hfRepoId: null,
    github: { owner: 'vllm-project', name: 'vllm' },
  },
]

export const MODEL_FAMILIES = ['deepseek', 'llama', 'qwen', 'kimi', 'mistral', 'glm', 'runtime'] as const
