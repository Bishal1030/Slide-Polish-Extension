(function injectSlidePolishButton() {
  const BUTTON_ID = "slide-polish-fab";
  const STYLE_ID = "slide-polish-fab-style";

  function createStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* Scope styles to only affect our button */
      #${BUTTON_ID} {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 2147483647;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)), rgba(28, 39, 51, 0.72);
        backdrop-filter: blur(30px) saturate(180%);
        -webkit-backdrop-filter: blur(30px) saturate(180%);
        color: #E6F0FA;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        padding: 10px 18px;
        font-size: 13px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-weight: 600;
        letter-spacing: 0.2px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 9px;
        transition: all 0.2s ease;
      }
      #${BUTTON_ID}:hover { 
        transform: translateY(-2px); 
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.16);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)), rgba(28, 39, 51, 0.78);
        border-color: rgba(255, 255, 255, 0.2);
      }
      #${BUTTON_ID}:active { 
        transform: translateY(0); 
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      }
      #${BUTTON_ID} .sp-icon {
        width: 18px;
        height: 18px;
        object-fit: contain;
        filter: brightness(1.1) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
      }
      #${BUTTON_ID} .sp-text {
        font-weight: 600;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
      }
      @media (max-width: 900px) {
        #${BUTTON_ID} { 
          right: 16px; 
          bottom: 16px; 
          padding: 9px 13px; 
          font-size: 12px; 
        }
        #${BUTTON_ID} .sp-icon {
          width: 16px;
          height: 16px;
        }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function ensureButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.title = "Rewrite with SlidePolish - Professional slide formatter";
    
    const iconUrl = chrome.runtime.getURL("assets/star48.png");
    btn.innerHTML = `
      <img src="${iconUrl}" alt="SlidePolish" class="sp-icon" />
      <span class="sp-text">Polish Slide</span>
    `;
    btn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "openPopup" });
    }, { once: false });

    document.documentElement.appendChild(btn);
  }

  function init() {
    createStyle();
    ensureButton();
  }

  // Slides is a SPA; observe DOM changes and re-ensure button
  const observer = new MutationObserver(() => {
    init();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Initial run
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


