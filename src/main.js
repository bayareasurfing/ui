import {
  Bot,
  Check,
  ChevronDown,
  CircleStop,
  Copy,
  Download,
  FileText,
  MessageSquare,
  PanelRight,
  Paperclip,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  createIcons,
} from "lucide";
import "./styles.css";

const modelOptions = [
  {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    name: "Qwen3 0.6B",
    size: "0.5 GB",
    detail: "Fast and light",
  },
  {
    id: "Qwen3-1.7B-q4f16_1-MLC",
    name: "Qwen3 1.7B",
    size: "1.1 GB",
    detail: "More capable",
  },
  {
    id: "Qwen3-4B-q4f16_1-MLC",
    name: "Qwen3 4B",
    size: "2.4 GB",
    detail: "Powerful, needs ~4 GB VRAM",
  },
  {
    id: "Qwen3-8B-q4f16_1-MLC",
    name: "Qwen3 8B",
    size: "4.7 GB",
    detail: "Best quality, needs ~6 GB VRAM",
  },
  {
    id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
    name: "Mistral 7B Instruct",
    size: "4.1 GB",
    detail: "Strong general chat, needs ~5 GB VRAM",
  },
  {
    id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
    name: "DeepSeek R1 7B",
    size: "4.1 GB",
    detail: "Reasoning focused, needs ~6 GB VRAM",
  },
  {
    id: "Llama-3.1-8B-Instruct-q4f16_1-MLC",
    name: "Llama 3.1 8B",
    size: "4.7 GB",
    detail: "Versatile assistant, needs ~5 GB VRAM",
  },
  {
    id: "gemma-2-9b-it-q4f16_1-MLC",
    name: "Gemma 2 9B",
    size: "5.4 GB",
    detail: "Highest capacity, needs ~7 GB VRAM",
  },
];

const chatStorageKey = "local-qwen-chats-v1";
const modelStorageKey = "local-qwen-model-state-v1";

function loadModelState() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(modelStorageKey));
    const hasModel = (modelId) => modelOptions.some((model) => model.id === modelId);
    const downloadedModelIds = Array.isArray(stored?.downloadedModelIds)
      ? [...new Set(stored.downloadedModelIds.filter((modelId) => typeof modelId === "string" && hasModel(modelId)))]
      : [];
    const selectedModelId = typeof stored?.selectedModelId === "string" && hasModel(stored.selectedModelId) ? stored.selectedModelId : modelOptions[0].id;
    return { downloadedModelIds, selectedModelId };
  } catch {
    return { downloadedModelIds: [], selectedModelId: modelOptions[0].id };
  }
}

function createChat() {
  return {
    context: "",
    contextName: "",
    id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    messages: [],
    title: "New chat",
    updatedAt: Date.now(),
  };
}

function loadChatState() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(chatStorageKey));
    if (!stored || !Array.isArray(stored.chats)) throw new Error("No saved chats");

    const chats = stored.chats
      .filter((chat) => chat && typeof chat.id === "string")
      .map((chat) => ({
        context: typeof chat.context === "string" ? chat.context.slice(0, 7000) : "",
        contextName: typeof chat.contextName === "string" ? chat.contextName : "",
        id: chat.id,
        messages: Array.isArray(chat.messages)
          ? chat.messages
              .filter((message) => message && ["user", "assistant"].includes(message.role) && typeof message.content === "string")
              .map((message) => ({ role: message.role, content: message.content }))
          : [],
        title: typeof chat.title === "string" && chat.title.trim() ? chat.title : "New chat",
        updatedAt: Number.isFinite(chat.updatedAt) ? chat.updatedAt : Date.now(),
      }));

    if (!chats.length) throw new Error("No saved chats");
    const activeChatId = chats.some((chat) => chat.id === stored.activeChatId) ? stored.activeChatId : chats[0].id;
    return { chats, activeChatId };
  } catch {
    const chat = createChat();
    return { chats: [chat], activeChatId: chat.id };
  }
}

const savedChatState = loadChatState();
const initialChat = savedChatState.chats.find((chat) => chat.id === savedChatState.activeChatId) || savedChatState.chats[0];
const savedModelState = loadModelState();

const iconSet = {
  Bot,
  Check,
  ChevronDown,
  CircleStop,
  Copy,
  Download,
  FileText,
  MessageSquare,
  PanelRight,
  Paperclip,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
};

const app = document.querySelector("#app");
const state = {
  activeModel: modelOptions.find((model) => model.id === savedModelState.selectedModelId) || modelOptions[0],
  activeChatId: initialChat.id,
  chats: savedChatState.chats,
  context: initialChat.context,
  contextName: initialChat.contextName,
  downloadedModelIds: new Set(savedModelState.downloadedModelIds),
  engine: null,
  engineModelId: "",
  error: "",
  isContextOpen: false,
  isGenerating: false,
  isLoading: false,
  isLoadingFromCache: false,
  loadingPromise: null,
  messages: initialChat.messages,
  modelMenuOpen: false,
  progress: 0,
  progressText: "Ready to download",
};

app.innerHTML = `
  <main class="app-shell">
    <aside class="sidebar" aria-label="Workspace navigation">
      <div class="sidebar-brand">
        <div class="brand-mark" aria-hidden="true"><i data-lucide="sparkles"></i></div>
        <span>Local AI</span>
      </div>
      <button class="new-chat-button" type="button" data-new-chat>
        <i data-lucide="plus"></i>
        <span>New chat</span>
      </button>
      <section class="chat-history" aria-label="Saved chats">
        <div class="sidebar-section-title">Conversations</div>
        <div class="chat-list" data-chat-list></div>
      </section>
      <button class="icon-button settings-button" type="button" title="Settings" aria-label="Settings">
        <i data-lucide="settings"></i>
      </button>
    </aside>

    <section class="chat-stage">
      <header class="topbar">
        <div class="app-title">
          <span class="eyebrow">ON-DEVICE CHAT</span>
          <span class="connection-status"><span></span> Private session</span>
        </div>
        <div class="topbar-actions">
          <button class="context-toggle subtle-button" type="button" data-context-toggle aria-expanded="false">
            <i data-lucide="panel-right"></i>
            <span>Context</span>
          </button>
          <button class="icon-button mobile-new-chat" type="button" title="New conversation" aria-label="New conversation" data-new-chat>
            <i data-lucide="plus"></i>
          </button>
        </div>
      </header>

      <div class="model-row">
        <div class="model-control">
          <button class="model-select" type="button" data-model-toggle aria-expanded="false">
            <span class="model-indicator"></span>
            <span data-model-name>Qwen3 0.6B</span>
            <i data-lucide="chevron-down"></i>
          </button>
          <div class="model-menu" data-model-menu hidden>
            ${modelOptions
              .map(
                (model, index) => `
                  <button class="model-option${index === 0 ? " selected" : ""}" type="button" data-model-id="${model.id}">
                    <span>
                      <strong>${model.name}</strong>
                      <small>${model.detail}</small>
                    </span>
                    <span class="model-size">${model.size}</span>
                  </button>`,
              )
              .join("")}
          </div>
        </div>
        <button class="model-state" type="button" data-model-state>
          <i data-lucide="download"></i>
          <span>Not downloaded</span>
        </button>
      </div>

      <section class="conversation" aria-live="polite">
        <div class="welcome" data-welcome>
          <div class="welcome-mark"><i data-lucide="bot"></i></div>
          <p class="eyebrow">LOCAL INTELLIGENCE</p>
          <h1>Start a private conversation.</h1>
          <p class="welcome-copy">Download a local model once, then chat directly in your browser.</p>
          <div class="prompt-grid">
            <button class="prompt-suggestion" type="button" data-prompt="Help me organize my thoughts about a project.">
              <span>Organize my thoughts</span>
              <i data-lucide="plus"></i>
            </button>
            <button class="prompt-suggestion" type="button" data-prompt="Read my context and give me a concise summary.">
              <span>Summarize my context</span>
              <i data-lucide="plus"></i>
            </button>
            <button class="prompt-suggestion" type="button" data-prompt="Help me think through a difficult decision.">
              <span>Think through a decision</span>
              <i data-lucide="plus"></i>
            </button>
          </div>
        </div>
        <div class="messages" data-messages></div>
      </section>

      <section class="composer-section">
        <div class="loading-status" data-loading-status hidden>
          <div class="loading-track"><span data-loading-bar></span></div>
          <span data-loading-copy>Preparing local model</span>
        </div>
        <div class="composer-shell">
          <div class="context-chip" data-context-chip hidden>
            <i data-lucide="file-text"></i>
            <span data-context-name>Reference context</span>
            <button type="button" title="Remove context" aria-label="Remove context" data-clear-context>
              <i data-lucide="x"></i>
            </button>
          </div>
          <textarea data-prompt-input rows="1" placeholder="Message locally..."></textarea>
          <div class="composer-footer">
            <div class="composer-tools">
              <button class="icon-button" type="button" title="Add reference context" aria-label="Add reference context" data-context-toggle>
                <i data-lucide="paperclip"></i>
              </button>
              <span class="composer-note">Runs entirely on this device</span>
            </div>
            <button class="send-button" type="button" title="Send message" aria-label="Send message" data-send>
              <i data-lucide="send"></i>
            </button>
          </div>
        </div>
        <p class="download-note" data-download-note>Qwen3 0.6B is a one-time ~0.5 GB browser download.</p>
      </section>
    </section>

    <aside class="context-panel" data-context-panel aria-hidden="true">
      <header class="panel-header">
        <div>
          <span class="eyebrow">REFERENCE</span>
          <h2>Context</h2>
        </div>
        <button class="icon-button" type="button" title="Close context" aria-label="Close context" data-context-toggle>
          <i data-lucide="x"></i>
        </button>
      </header>
      <div class="context-content">
        <p class="context-intro">Add background information that model should use throughout this conversation.</p>
        <label class="context-input-label" for="context-input">Notes or source text</label>
        <textarea id="context-input" class="context-input" data-context-input placeholder="Paste text, project notes, instructions, or a brief here..."></textarea>
        <div class="context-actions">
          <label class="upload-control" title="Add a text or Markdown file">
            <input type="file" accept=".txt,.md,.csv,.json,text/plain,text/markdown,application/json" data-context-file />
            <i data-lucide="paperclip"></i>
            <span>Attach file</span>
          </label>
          <span class="context-count" data-context-count>0 / 7,000 characters</span>
        </div>
      </div>
      <footer class="panel-footer">
        <button class="text-button" type="button" data-clear-context>Clear</button>
        <button class="apply-context" type="button" data-apply-context>
          <i data-lucide="check"></i>
          <span>Use context</span>
        </button>
      </footer>
    </aside>
    <div class="panel-scrim" data-panel-scrim></div>
  </main>
`;

createIcons({ icons: iconSet });

const elements = {
  applyContext: app.querySelector("[data-apply-context]"),
  clearContextButtons: app.querySelectorAll("[data-clear-context]"),
  contextChip: app.querySelector("[data-context-chip]"),
  contextCount: app.querySelector("[data-context-count]"),
  contextFile: app.querySelector("[data-context-file]"),
  contextInput: app.querySelector("[data-context-input]"),
  contextName: app.querySelector("[data-context-name]"),
  contextPanel: app.querySelector("[data-context-panel]"),
  contextToggles: app.querySelectorAll("[data-context-toggle]"),
  chatList: app.querySelector("[data-chat-list]"),
  conversation: app.querySelector(".conversation"),
  downloadNote: app.querySelector("[data-download-note]"),
  loadingBar: app.querySelector("[data-loading-bar]"),
  loadingCopy: app.querySelector("[data-loading-copy]"),
  loadingStatus: app.querySelector("[data-loading-status]"),
  messages: app.querySelector("[data-messages]"),
  modelMenu: app.querySelector("[data-model-menu]"),
  modelName: app.querySelector("[data-model-name]"),
  modelOptions: app.querySelectorAll("[data-model-id]"),
  modelState: app.querySelector("[data-model-state]"),
  modelToggle: app.querySelector("[data-model-toggle]"),
  newChatButtons: app.querySelectorAll("[data-new-chat]"),
  panelScrim: app.querySelector("[data-panel-scrim]"),
  promptInput: app.querySelector("[data-prompt-input]"),
  sendButton: app.querySelector("[data-send]"),
  welcome: app.querySelector("[data-welcome]"),
};

function updateIcons(container = app) {
  createIcons({ icons: iconSet, root: container });
}

function autoResizeInput() {
  elements.promptInput.style.height = "auto";
  elements.promptInput.style.height = `${Math.min(elements.promptInput.scrollHeight, 150)}px`;
}

function refreshContextUi() {
  const hasContext = Boolean(state.context.trim());
  const displayName = state.contextName || "Reference context";
  elements.contextChip.hidden = !hasContext;
  elements.contextName.textContent = displayName;
  elements.contextInput.value = state.context;
  elements.contextCount.textContent = `${state.context.length.toLocaleString()} / 7,000 characters`;
  updateIcons(elements.contextChip);
}

function getActiveChat() {
  return state.chats.find((chat) => chat.id === state.activeChatId);
}

function getChatTitle(messages) {
  const firstPrompt = messages.find((message) => message.role === "user")?.content.trim();
  if (!firstPrompt) return "New chat";
  return firstPrompt.replace(/\s+/g, " ").slice(0, 38);
}

function persistChats() {
  try {
    window.localStorage.setItem(chatStorageKey, JSON.stringify({ activeChatId: state.activeChatId, chats: state.chats }));
  } catch {
    // The app remains usable when browser storage is unavailable.
  }
}

function persistModelState() {
  try {
    window.localStorage.setItem(
      modelStorageKey,
      JSON.stringify({
        downloadedModelIds: [...state.downloadedModelIds],
        selectedModelId: state.activeModel.id,
      }),
    );
  } catch {
    // The app remains usable when browser storage is unavailable.
  }
}

function renderChatList() {
  const chatRows = [...state.chats].sort((first, second) => second.updatedAt - first.updatedAt).map((chat) => {
    const row = document.createElement("div");
    row.className = "chat-list-row";

    const select = document.createElement("button");
    select.className = "chat-list-item";
    select.type = "button";
    select.dataset.chatId = chat.id;
    select.disabled = state.isGenerating;
    select.setAttribute("aria-current", String(chat.id === state.activeChatId));
    select.innerHTML = '<i data-lucide="message-square"></i><span></span>';
    select.querySelector("span").textContent = chat.title;

    const remove = document.createElement("button");
    remove.className = "chat-delete icon-button";
    remove.type = "button";
    remove.dataset.deleteChat = chat.id;
    remove.disabled = state.isGenerating;
    remove.title = `Delete ${chat.title}`;
    remove.setAttribute("aria-label", `Delete ${chat.title}`);
    remove.innerHTML = '<i data-lucide="trash-2"></i>';

    row.append(select, remove);
    return row;
  });

  elements.chatList.replaceChildren(...chatRows);
  updateIcons(elements.chatList);
}

function syncActiveChat() {
  const chat = getActiveChat();
  if (!chat) return;
  chat.context = state.context;
  chat.contextName = state.contextName;
  chat.messages = state.messages;
  chat.title = getChatTitle(chat.messages);
  chat.updatedAt = Date.now();
  persistChats();
  renderChatList();
}

function activateChat(chatId, shouldFocus = false) {
  if (state.isGenerating) return;
  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat) return;

  state.activeChatId = chat.id;
  state.context = chat.context;
  state.contextName = chat.contextName;
  state.messages = chat.messages;
  elements.promptInput.value = "";
  elements.contextFile.value = "";
  autoResizeInput();
  refreshContextUi();
  renderMessages();
  persistChats();
  renderChatList();
  if (shouldFocus) elements.promptInput.focus();
}

function createNewChat() {
  if (state.isGenerating) return;
  const chat = createChat();
  state.chats.unshift(chat);
  activateChat(chat.id, true);
}

function deleteChat(chatId) {
  if (state.isGenerating) return;
  const chatIndex = state.chats.findIndex((chat) => chat.id === chatId);
  if (chatIndex === -1) return;

  const wasActive = chatId === state.activeChatId;
  state.chats.splice(chatIndex, 1);
  if (!state.chats.length) state.chats.push(createChat());

  if (wasActive) {
    const nextChat = [...state.chats].sort((first, second) => second.updatedAt - first.updatedAt)[0];
    activateChat(nextChat.id, true);
    return;
  }

  persistChats();
  renderChatList();
}

function clearActiveContext() {
  state.context = "";
  state.contextName = "";
  elements.contextInput.value = "";
  elements.contextFile.value = "";
  refreshContextUi();
  syncActiveChat();
}

function setContextPanel(open) {
  state.isContextOpen = open;
  app.querySelector(".app-shell").classList.toggle("context-open", open);
  elements.contextPanel.classList.toggle("is-open", open);
  elements.panelScrim.classList.toggle("is-visible", open);
  elements.contextPanel.setAttribute("aria-hidden", String(!open));
  elements.contextToggles.forEach((button) => button.setAttribute("aria-expanded", String(open)));
  if (open) {
    window.setTimeout(() => elements.contextInput.focus(), 160);
  }
}

function updateModelUi() {
  const loading = state.isLoading;
  const loadingFromCache = loading && state.isLoadingFromCache;
  const ready = Boolean(state.engine && state.engineModelId === state.activeModel.id);
  const downloaded = state.downloadedModelIds.has(state.activeModel.id);
  const canDownload = !state.error && !loading && !ready && !downloaded;
  elements.modelName.textContent = state.activeModel.name;
  elements.downloadNote.textContent = ready
    ? `${state.activeModel.name} is ready and running on this device.`
    : downloaded
      ? `${state.activeModel.name} is downloaded locally.`
      : `${state.activeModel.name} is a one-time ~${state.activeModel.size} browser download.`;

  elements.modelOptions.forEach((option) => {
    option.classList.toggle("selected", option.dataset.modelId === state.activeModel.id);
  });
  elements.modelState.classList.toggle("is-downloadable", canDownload);
  elements.modelState.disabled = !canDownload;

  if (state.error) {
    elements.modelState.innerHTML = `<i data-lucide="x"></i><span>Model unavailable</span>`;
  } else if (loadingFromCache) {
    elements.modelState.innerHTML = `<i data-lucide="shield-check"></i><span>Loading locally</span>`;
  } else if (loading) {
    elements.modelState.innerHTML = `<span class="loading-dot"></span><span>${Math.round(state.progress)}% loading</span>`;
  } else if (ready) {
    elements.modelState.innerHTML = `<i data-lucide="shield-check"></i><span>Ready locally</span>`;
  } else if (downloaded) {
    elements.modelState.innerHTML = `<i data-lucide="shield-check"></i><span>Downloaded locally</span>`;
  } else {
    elements.modelState.innerHTML = `<i data-lucide="download"></i><span class="model-state-copy">Not downloaded</span><span class="model-state-action">Download model</span>`;
  }
  updateIcons(elements.modelState);

  elements.loadingStatus.hidden = !loading || loadingFromCache;
  elements.loadingBar.style.width = `${Math.max(2, state.progress)}%`;
  elements.loadingCopy.textContent = state.progressText;
}

function toggleModelMenu(force) {
  state.modelMenuOpen = typeof force === "boolean" ? force : !state.modelMenuOpen;
  elements.modelMenu.hidden = !state.modelMenuOpen;
  elements.modelToggle.setAttribute("aria-expanded", String(state.modelMenuOpen));
}

function createMessage(role, content) {
  const article = document.createElement("article");
  article.className = `message message-${role}`;

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "YOU" : state.activeModel.name.toUpperCase();

  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = content;

  article.append(label, body);
  if (role === "assistant") {
    const action = document.createElement("button");
    action.className = "message-copy icon-button";
    action.type = "button";
    action.title = "Copy response";
    action.setAttribute("aria-label", "Copy response");
    action.innerHTML = '<i data-lucide="copy"></i>';
    action.addEventListener("click", async () => {
      await navigator.clipboard?.writeText(content);
      action.innerHTML = '<i data-lucide="check"></i>';
      updateIcons(action);
      window.setTimeout(() => {
        action.innerHTML = '<i data-lucide="copy"></i>';
        updateIcons(action);
      }, 1400);
    });
    article.append(action);
  }
  return article;
}

function renderMessages() {
  elements.messages.replaceChildren();
  elements.welcome.hidden = state.messages.length > 0;
  state.messages.forEach((message) => elements.messages.append(createMessage(message.role, message.content)));
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

function renderStreamingMessage(content) {
  let article = elements.messages.querySelector(".message-streaming");
  if (!article) {
    article = createMessage("assistant", "");
    article.classList.add("message-streaming");
    elements.messages.append(article);
  }
  article.querySelector(".message-body").textContent = content || "Thinking...";
  elements.conversation.scrollTop = elements.conversation.scrollHeight;
}

function setSendState() {
  elements.sendButton.disabled = state.isLoading;
  elements.sendButton.classList.toggle("is-stopping", state.isGenerating);
  elements.sendButton.innerHTML = state.isGenerating
    ? '<i data-lucide="circle-stop"></i>'
    : '<i data-lucide="send"></i>';
  elements.sendButton.title = state.isGenerating ? "Stop generating" : "Send message";
  elements.sendButton.setAttribute("aria-label", elements.sendButton.title);
  elements.newChatButtons.forEach((button) => {
    button.disabled = state.isGenerating;
  });
  elements.chatList.querySelectorAll("button").forEach((button) => {
    button.disabled = state.isGenerating;
  });
  updateIcons(elements.sendButton);
}

async function ensureModel() {
  if (state.engine && state.engineModelId === state.activeModel.id) return state.engine;
  if (state.loadingPromise) return state.loadingPromise;

  if (!navigator.gpu) {
    state.error = "WebGPU is not available in this browser.";
    updateModelUi();
    throw new Error(state.error);
  }

  state.error = "";
  state.isLoading = true;
  state.isLoadingFromCache = state.downloadedModelIds.has(state.activeModel.id);
  state.progress = 0;
  state.progressText = state.isLoadingFromCache
    ? `Loading ${state.activeModel.name}`
    : `Downloading ${state.activeModel.name}`;
  updateModelUi();
  setSendState();

  state.loadingPromise = import("@mlc-ai/web-llm")
    .then(({ CreateMLCEngine }) =>
      CreateMLCEngine(state.activeModel.id, {
        initProgressCallback: (report) => {
          state.progress = report.progress * 100;
          state.progressText = report.text || `Loading ${state.activeModel.name}`;
          updateModelUi();
        },
      }),
    )
    .then((engine) => {
      state.engine = engine;
      state.engineModelId = state.activeModel.id;
      state.downloadedModelIds.add(state.activeModel.id);
      state.progress = 100;
      state.progressText = "Model ready on this device";
      persistModelState();
      return engine;
    })
    .catch((error) => {
      state.error = error instanceof Error ? error.message : "Unable to load the local model.";
      throw error;
    })
    .finally(() => {
      state.isLoading = false;
      state.isLoadingFromCache = false;
      state.loadingPromise = null;
      updateModelUi();
      setSendState();
    });

  return state.loadingPromise;
}

function buildChatMessages() {
  const systemPrompt = state.context.trim()
    ? `You are a concise, helpful assistant. Use the following user-provided reference context when it is relevant. If the answer is not in the context, say so plainly.\n\nREFERENCE CONTEXT:\n${state.context.slice(0, 7000)}`
    : "You are a concise, helpful assistant running privately on the user's device.";
  return [{ role: "system", content: systemPrompt }, ...state.messages];
}

async function sendMessage() {
  if (state.isGenerating) {
    state.engine?.interruptGenerate();
    return;
  }

  const prompt = elements.promptInput.value.trim();
  if (!prompt || state.isLoading) return;

  state.messages.push({ role: "user", content: prompt });
  syncActiveChat();
  elements.promptInput.value = "";
  autoResizeInput();
  renderMessages();
  state.isGenerating = true;
  setSendState();

  try {
    const engine = await ensureModel();
    let response = "";
    renderStreamingMessage(response);
    const chunks = await engine.chat.completions.create({
      messages: buildChatMessages(),
      temperature: 0.7,
      max_tokens: 768,
      stream: true,
    });

    for await (const chunk of chunks) {
      response += chunk.choices[0]?.delta?.content || "";
      renderStreamingMessage(response);
    }

    state.messages.push({
      role: "assistant",
      content: response.trim() || "I could not produce a response. Please try again.",
    });
  } catch (error) {
    const errorMessage = state.error || (error instanceof Error ? error.message : "Something went wrong while running the local model.");
    state.messages.push({ role: "assistant", content: `Local model error: ${errorMessage}` });
  } finally {
    state.isGenerating = false;
    syncActiveChat();
    renderMessages();
    updateModelUi();
    setSendState();
  }
}

elements.contextToggles.forEach((button) => {
  button.addEventListener("click", () => setContextPanel(!state.isContextOpen));
});

elements.panelScrim.addEventListener("click", () => setContextPanel(false));

elements.contextInput.addEventListener("input", () => {
  if (elements.contextInput.value.length > 7000) {
    elements.contextInput.value = elements.contextInput.value.slice(0, 7000);
  }
  elements.contextCount.textContent = `${elements.contextInput.value.length.toLocaleString()} / 7,000 characters`;
});

elements.contextFile.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const text = await file.text();
  elements.contextInput.value = text.slice(0, 7000);
  elements.contextCount.textContent = `${elements.contextInput.value.length.toLocaleString()} / 7,000 characters`;
  state.contextName = file.name;
});

elements.applyContext.addEventListener("click", () => {
  state.context = elements.contextInput.value.trim();
  if (!state.context) state.contextName = "";
  refreshContextUi();
  syncActiveChat();
  setContextPanel(false);
});

elements.clearContextButtons.forEach((button) => {
  button.addEventListener("click", clearActiveContext);
});

elements.chatList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-chat]");
  if (deleteButton) {
    deleteChat(deleteButton.dataset.deleteChat);
    return;
  }

  const chatButton = event.target.closest("[data-chat-id]");
  if (chatButton) activateChat(chatButton.dataset.chatId);
});

elements.modelToggle.addEventListener("click", () => toggleModelMenu());

elements.modelState.addEventListener("click", () => {
  if (state.isLoading || state.engine || state.downloadedModelIds.has(state.activeModel.id)) return;
  ensureModel().catch(() => {
    // The model status already presents the loading failure.
  });
});

elements.modelOptions.forEach((option) => {
  option.addEventListener("click", async () => {
    const selected = modelOptions.find((model) => model.id === option.dataset.modelId);
    if (!selected || selected.id === state.activeModel.id) {
      toggleModelMenu(false);
      return;
    }
    if (state.isGenerating || state.isLoading) return;
    if (state.engine) await state.engine.unload();
    state.engine = null;
    state.engineModelId = "";
    state.activeModel = selected;
    state.error = "";
    persistModelState();
    toggleModelMenu(false);
    updateModelUi();
  });
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".model-control")) toggleModelMenu(false);
});

elements.promptInput.addEventListener("input", autoResizeInput);
elements.promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

elements.sendButton.addEventListener("click", sendMessage);
elements.newChatButtons.forEach((button) => button.addEventListener("click", createNewChat));

app.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.promptInput.value = button.dataset.prompt;
    autoResizeInput();
    elements.promptInput.focus();
  });
});

refreshContextUi();
renderChatList();
updateModelUi();
setSendState();
