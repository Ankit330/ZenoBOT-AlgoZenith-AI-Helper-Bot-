const BTN_ID = "ai-helper-button";
const CHAT_ID = "ai-helper-chat-container";

let lastPath = "";
const problemDataMap = new Map();
const chatState = JSON.parse(localStorage.getItem("chatState")) || {};

const darkConfig = {
  background: "#161d29",
  text: "#2b384e",
  buttonText: "hsla(0, 0%, 100%, .9)",
  borderColor: "#557486",
  buttonBackground: "linear-gradient(to right, hsla(0, 0%, 100%, .6), #eaf1fd)",
  deleteButton: "red",
  userMessage: "hsla(0, 0%, 100%, .9)",
  botMessage: "#2b384e",
  zenoBOT : "hsla(0, 0%, 100%, .9)",
  userMessageText: "#161d29",
  botMessageText: "hsla(0, 0%, 100%, .9)"

};

const lightConfig = {
  background: "#ffffff",
  text: "#hsla(0, 0%, 100%, .9)",
  buttonText: "#ffffff",
  borderColor: "#a9c3d0",
  buttonBackground: "linear-gradient(to right, #033042, #005c83)",
  deleteButton: "#d32f2f",
  userMessage: "#CECECEFF",
  botMessage: "#ddf6ff",
  zenoBOT : "#000000",
  userMessageText: "#161d29",
  botMessageText: "#161d29"
};


addInjectScript();

window.addEventListener("xhrDataFetched", (event)=>{
  const data = event.detail;
  if(data.url && data.url.match(/https:\/\/api2\.maang\.in\/problems\/user\/\d+/)){
    const isMatch = data.url.match(/\/(\d+)$/);
    if(isMatch){
      const id = isMatch[1];
      problemDataMap.set(id, data.response);
      console.log(data.response);
    }
  }
});

function getCurrentProblemId() {
  const isMatch = window.location.pathname.match(/-(\d+)$/);
  return isMatch ? isMatch[1] : null;
}

function getProblemDataById(id) {
  if (id && problemDataMap.has(id)) {
    return problemDataMap.get(id);
  }
  console.log(`No data found for id = ${id}`);
  return null;
}

async function getChatHistory(id) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([id], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[id] || []);
      }
    });
  });
}

async function setChatHistory(id, chatHistory) {
  return new Promise((resolve, reject) => {
    const data = {};
    data[id] = chatHistory;

    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

async function removeChatHistory(id) {
  await new Promise((resolve, reject) => {
    chrome.storage.local.remove(id, () => {
      if (chrome.runtime.lastError) {
        console.error("Error deleting chat history:", chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

async function initializeChat() {
  const firstMessage = "Hi! I'm here to help you with your problem. Please ask a question related to the problem, and I'll assist you with that.";
  const botResponse = await getResponse(firstMessage);
  showLoadingIndicator(false);
  displayBotResponse(botResponse);
}


function buildInitialPrompt(userMessage) {
  const id = getCurrentProblemId();
  const problemData = getProblemDataById(id);

  const prompt = {
    instruction: "You are an AI assistant designed to help users with coding problems. Analyze the given problem details and respond only to queries directly related to the problem. If the query is irrelevant, reply with: 'Invalid question. Please ask a question related to the problem.' Do not provide complete solutions or code directly. Instead, give hints, explanations, or problem tags based on the user's query. If the user asks for code, encourage them to think and offer hints first. Ensure your responses remain focused on guiding the user to solve the problem themselves.",
    problem_details: problemData,
    query: {
      type: "problem-solving",
      question: userMessage,
      language_preference: "c++.14"
    },
    restrictions: "Ensure that the response is strictly related to the problem provided. Any unrelated questions should be answered with: 'Invalid question. Please ask a question related to the problem.' Provide hints, tags, or explanations, but do not provide the complete solution or code directly. Encourage the user to solve the problem themselves by offering hints and guidance."
  };

  console.log(JSON.stringify(prompt, null, 2));
  return JSON.stringify(prompt, null, 2);
}


async function getResponse(userMessage) {
  const apiKey = "AIzaSyB40fGLdHq8tp51R8_YQLX0D65GdyrJ23o";
  try {
    const id = getCurrentProblemId();
    if (!id) throw new Error("Problem ID not found");

    let chatHistory = await getChatHistory(id);

    if (chatHistory.length === 0) {
      chatHistory = [
        {
          role: "user",
          parts: [{ text: buildInitialPrompt(userMessage) }],
        },
      ];
    } else {
      chatHistory.push({
        role: "user",
        parts: [{ text: userMessage }],
      });
    }

    const payload = { contents: chatHistory };
    // console.log("Payload Sent:", JSON.stringify(payload, null, 2));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) throw new Error(`Error: ${response.status}`);
    const data = await response.json();
    const AiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No response";
    chatHistory.push({
      role: "model",
      parts: [{ text: AiResponse }],
    });

    await setChatHistory(id, chatHistory);
    return AiResponse;
  } catch (error) {
    console.error("Error fetching response:", error);
    return "Error: Unable to fetch response.";
  }
}


async function sendMessage(userMessage) {
  displayUserMessage(userMessage); // Display user message on the interface.
  showLoadingIndicator(true); // Show loading indicator when processing the response.
  
  // Check if it's the first time (no history yet)
  const id = getCurrentProblemId();
  const chatHistory = await getChatHistory(id);
  
  if (chatHistory.length === 0) {
    initializeChat();
  } else {
    // Send normal user message and bot's response
    const botRes = await getResponse(userMessage);
    showLoadingIndicator(false); // Hide loading indicator after response.
    displayBotResponse(botRes); // Display bot's response.
    storeMessage(userMessage, botRes); // Store the user and bot messages.
  }
}
function storeMessage(userMessage, botResponse) {
  if (!chatState[lastPath]) chatState[lastPath] = [];
  chatState[lastPath].push({ sender: "user", message: userMessage });
  chatState[lastPath].push({ sender: "bot", message: botResponse });
  localStorage.setItem("chatState", JSON.stringify(chatState));
}



let config = darkConfig;
function detectTheme() {
    const themeButton = document.querySelector('button[role="switch"]');
    if (themeButton) {
        const isDarkMode = themeButton.getAttribute('aria-checked') === "true";
        config = isDarkMode ? darkConfig : lightConfig;
        updateChatTheme();
    }
}

function updateChatTheme() {
    const button = document.getElementById(BTN_ID);

    button.style.color = config.zenoBOT;

    button.addEventListener("mouseenter", () => {
      button.style.background = config.background;
      button.style.color = config.zenoBOT;
    });

    button.addEventListener("mouseleave", () => {
      button.style.background = "transparent";
      button.style.color = config.zenoBOT;
    });
  

    const chat = document.getElementById(CHAT_ID);
    if (!chat) return;

    chat.style.backgroundColor = config.background;
    chat.style.borderColor = config.borderColor;

    const chatBody = document.getElementById(`${CHAT_ID}-body`);
    if (chatBody) {
        chatBody.style.backgroundColor = config.background;
        
        Array.from(chatBody.children).forEach(messageContainer => {
            const messageElement = messageContainer.querySelector("div:first-child");
            const isUserMessage = messageContainer.style.alignItems === "flex-end";

            if (messageElement) {
                messageElement.style.backgroundColor = isUserMessage ? config.userMessage : config.botMessage;
                messageElement.style.color = isUserMessage ? config.userMessageText : config.botMessageText;
            }
        });
    }

    const input = chat.querySelector("textarea");
    if (input) {
        input.style.backgroundColor = config.background;
        input.style.color = config.zenoBOT;
        input.style.borderColor = config.borderColor;
    }

    const sendButton = Array.from(chat.querySelectorAll("button")).find(
        button => button.textContent.trim() === "Send"
    );
    if (sendButton) {
        sendButton.style.background = config.buttonBackground;
        sendButton.style.color = config.background;
    }

    const loadingIndicator = document.getElementById("loading-indicator");
    if (loadingIndicator) {
        loadingIndicator.style.color = config.zenoBOT;
    }
    const reSizer = document.getElementById(`${CHAT_ID}-resizeBar`);
    if (reSizer) {
      reSizer.style.backgroundColor = config.borderColor;
    }
}

function observeThemeChanges() {
    const themeButton = document.querySelector('button[role="switch"]');
    if (themeButton) {
        themeButton.addEventListener("click", detectTheme);

        const observer = new MutationObserver(detectTheme);
        observer.observe(themeButton, { attributes: true, attributeFilter: ["aria-checked"] });
    }
}

// Initialization
function addInjectScript() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("inject.js");
    script.onload = () => console.log("Script loaded");
    document.documentElement.insertAdjacentElement("afterbegin", script);
    script.remove();
}

const observer = new MutationObserver(() => {
    if (checkPageChange()) handlePageChange();
});
observer.observe(document.body, { childList: true, subtree: true });
handlePageChange();

// Page and Chat Management
function checkPageChange() {
    const currentPath = window.location.pathname;
    if (currentPath === lastPath) return false;
    lastPath = currentPath;
    return true;
}

function isProblemPage() {
    return window.location.pathname.startsWith("/problems/") && window.location.pathname.length > "/problems/".length;
}

function clearPage() {
    document.getElementById(BTN_ID)?.remove();
    document.getElementById(CHAT_ID)?.remove();
}

function handlePageChange() {
    if (isProblemPage()) {
        clearPage();
        addInjectScript();
        createButton();
        detectTheme();
        observeThemeChanges();
        if (chatState[lastPath]) createChat();
    }
}

function createButton() {
  const btn = document.createElement("li");
  btn.innerHTML = `<button id="ai-helper-button"><span>🤖</span><span>ZenoBOT</span></button>`;

  const button = btn.querySelector("button");
  button.style.cssText = `
      position: relative;
      left: 3px;
      cursor: pointer;
      color: ${config.zenoBOT};
      background: transparent;
      font-size: 0.90rem;
      font-family: DM Sans, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 0.5rem;
      padding: 0.36rem 1rem;
      width: 100%;
      gap: 0.1rem;
      transition-duration: .3s;
  `;

  const span = button.querySelector("span:first-child");
  span.style.cssText = `
      font-size: 1.1rem;
      color: ${config.buttonText};
  `;

  const nav = document.querySelector(".d-flex.flex-row.p-0.gap-2.justify-content-between.m-0.hide-scrollbar");
  nav?.insertAdjacentElement("afterend", btn);
  btn.addEventListener("click", toggleChat);

  button.addEventListener("mouseenter", () => {
      button.style.background = `${config.background}`;
      button.style.color = `${config.buttonText}`;
  });
  
  button.addEventListener("mouseleave", () => {
      button.style.background = "transparent";
      button.style.color = `${config.buttonText}`;
  });

  button.addEventListener("focus", () => {
      button.style.outline = "none";
  });
}

function toggleChat() {
    const chat = document.getElementById(CHAT_ID);
    if (chat) chat.style.display = chat.style.display === "none" ? "flex" : "none";
    else createChat();
}

function displayMessage(message, isUser) {
    const chatBody = document.getElementById(`${CHAT_ID}-body`);
    const messageElement = document.createElement("div");
    const messageContainer = document.createElement("div");

    messageContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: ${isUser ? "flex-end" : "flex-start"};
        margin-bottom: 10px;
        gap: 3px;
        width: 100%;
    `;

    messageElement.style.cssText = `
        padding: 10px 15px;
        border-radius: 10px;
        max-width: 70%;
        word-break: break-word;
        font-size: 15px;
        background-color: ${isUser ? config.userMessage : config.botMessage};
        color: ${isUser ? config.userMessageText : config.botMessageText};
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        line-height: 1.5;
        overflow-wrap: break-word;
        text-overflow: ellipsis;
        white-space: pre-wrap;
        transition: all 0.2s ease-in-out;
    `;

    const timestamp = document.createElement("span");
    timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    timestamp.style.cssText = `font-size: 10px; color: #aaa; margin-top: 5px;`;
    messageElement.textContent = message;
    messageContainer.appendChild(messageElement);

    if (isUser) messageContainer.appendChild(timestamp);

    chatBody.prepend(messageContainer);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function showLoadingIndicator(show) {
  const loadingIndicator = document.getElementById("loading-indicator");
  if (!loadingIndicator) return;

  if (show) {
      loadingIndicator.style.display = "block";
  } else {
      loadingIndicator.style.display = "none";
  }
}

function displayUserMessage(userMessage) { displayMessage(userMessage, true); }
function displayBotResponse(botResponse) { displayMessage(botResponse, false); }

function createChat() {
  if (document.getElementById(CHAT_ID)) return;

  const desc = document.querySelector(".py-4.px-3.coding_desc_container__gdB9M");
  if (!desc) return;

  const chat = document.createElement("div");
  chat.id = CHAT_ID;
  chat.style.cssText = `
      margin: 10px;
      width: 97.5%;
      height: 450px;
      display: flex;
      flex-direction: column;
      border-radius: 8px;
      background-color: ${config.background};
      border: 1px solid ${config.borderColor};
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      gap: 5px;
  `;
  
  const resizeBar = document.createElement("div");
  resizeBar.id = `${CHAT_ID}-resizeBar`;
  resizeBar.style.cssText = `
      height: 1.5px;
      background-color: ${config.borderColor};
      cursor: row-resize;
      width:100%;
  `;
  
  let isResizing = false;

  resizeBar.addEventListener("mousedown", (e) => {
      isResizing = true;
      document.body.style.cursor = "row-resize";
      document.addEventListener("mousemove", resizeHandler);
      document.addEventListener("mouseup", stopResizing);
  });

  const resizeHandler = (e) => {
      if (!isResizing) return;
      const newHeight = e.clientY - chat.getBoundingClientRect().top;
      chat.style.height = `${Math.max(200, newHeight)}px`; 
  };

  const stopResizing = () => {
      if (isResizing) {
          isResizing = false;
          document.body.style.cursor = "default";
          document.removeEventListener("mousemove", resizeHandler);
          document.removeEventListener("mouseup", stopResizing);
      }
  };

  
  const chatBody = document.createElement("div");
  chatBody.id = `${CHAT_ID}-body`;
  chatBody.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column-reverse;
      gap: 10px;
      padding: 10px;
      background-color: transparent;
      overflow-y: scroll;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
  `;

  const chatFooter = document.createElement("div");
  chatFooter.style.cssText = `
      display: flex;
      gap: 10px;
      padding: 10px;
      background-color: transparent;
      align-items: flex-end;
      box-sizing: border-box;
  `;

  const input = document.createElement("textarea");
  input.placeholder = "Message ZenoBOT";
  input.style.cssText = `
      flex: 1;
      color: ${config.zenoBOT};
      padding: 10px;
      border-radius: 15px;
      border: 1px solid ${config.borderColor};
      outline: none;
      font-size: 15px;
      font-family: DM Sans;
      background-color: ${config.text};
      resize: none;
      overflow-y: scroll;
      min-height: 40px;
      max-height: 150px;
      max-width: 100%; 
      word-break: break-word;
      line-height: 1.5;
      box-sizing: border-box;
  `;
  input.style.scrollbarWidth = 'none'; 
  input.style.msOverflowStyle = 'none';
  input.style.WebkitOverflowScrolling = 'touch'; 
  input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = `${input.scrollHeight}px`;
  });

  input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
          e.preventDefault();
          showLoadingIndicator(true);
          sendMessage(input.value.trim());
          input.value = "";
          input.style.cssText = `
              flex: 1;
              color: ${config.zenoBOT};
              padding: 10px;
              border-radius: 15px;
              border: 1px solid ${config.borderColor};
              outline: none;
              font-size: 15px;
              font-family: DM Sans;
              background-color: ${config.text};
              resize: none;
              overflow: hidden;
              min-height: 40px;
              max-height: 150px;
              max-width: 100%; 
              word-break: break-word;
              line-height: 1.5;
              box-sizing: border-box;
          `;
      }
  });

  const loadingIndicator = document.createElement("div");
  loadingIndicator.id = "loading-indicator";
  loadingIndicator.style.cssText = `
      display: none;
      font-size: 14px;
      color: ${config.zenoBOT};
      text-align: left;
      left: 10px;
      padding-left: 15px; 
  `;

  loadingIndicator.textContent = "ZenoBOT is typing...";

  const sendButton = document.createElement("button");
  sendButton.textContent = "Send";
  sendButton.style.cssText = `
      padding: 10px 15px;
      margin-bottom: 10px;
      border-radius: 6px;
      font-family: DM Sans;
      background: ${config.buttonBackground};
      color: ${config.background};
      border: none;
      cursor: pointer;
      font-size: 14px;
      height: 50px;
      align-self: flex-end; 
  `;
  sendButton.addEventListener("click", () => {
      if (input.value.trim()) sendMessage(input.value.trim());
      input.value = "";
      showLoadingIndicator(true);
      input.style.cssText = `
          flex: 1;
          color: ${config.zenoBOT};
          padding: 10px;
          border-radius: 15px;
          border: 1px solid ${config.borderColor};
          outline: none;
          font-size: 15px;
          font-family: DM Sans;
          background-color: ${config.text};
          resize: none;
          overflow: hidden;
          min-height: 40px;
          max-height: 150px;
          max-width: 100%; 
          word-break: break-word;
          line-height: 1.5;
          box-sizing: border-box;
      `;
  });

  const closeButton = document.createElement("button");
  closeButton.textContent = "Delete";
  closeButton.style.cssText = `
      background: transparent;
      border: none;
      font-size: 14px;
      font-family: DM Sans;
      color: ${config.deleteButton};
      cursor: pointer;
      align-self: flex-end; 
      margin: 5px;
  `;
  closeButton.addEventListener("click", () => {
      const id = getCurrentProblemId();
      removeChatHistory(id);
      chat.remove();
      chatState[lastPath] = null;
      localStorage.setItem("chatState", JSON.stringify(chatState));
  });

  chatFooter.appendChild(input);
  chatFooter.appendChild(sendButton);
  chat.appendChild(closeButton);
  chat.appendChild(chatBody);
  chat.appendChild(loadingIndicator);
  chat.appendChild(chatFooter);
  chat.appendChild(resizeBar);
  desc.insertAdjacentElement("beforebegin", chat);

  if (chatState[lastPath]) {
      chatState[lastPath].forEach(({ sender, message }) => {
          sender === "user" ? displayUserMessage(message) : displayBotResponse(message);
      });
  }
}


