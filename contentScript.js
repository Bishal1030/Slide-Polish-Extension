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
        background: #bdc3c7; /* fallback for old browsers */
        background: -webkit-linear-gradient(to right, #bdc3c7, #2c3e50); /* Chrome 10-25, Safari 5.1-6 */
        background: linear-gradient(to right, #bdc3c7, #2c3e50); /* W3C, IE 10+/ Edge, Firefox 16+, Chrome 26+, Opera 12+, Safari 7+ */
        backdrop-filter: blur(14px) saturate(150%);
        -webkit-backdrop-filter: blur(14px) saturate(150%);
        color: #ffffff;
        border: none;
        outline: none;
        border-radius: 8px;
        padding: 10px 18px;
        font-size: 13px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-weight: 600;
        letter-spacing: 0.3px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      }
      #${BUTTON_ID}:hover { 
        transform: translateY(-1px); 
        background: linear-gradient(to right, #c3c9cd, #34495e);
      }
      #${BUTTON_ID}:active { 
        transform: translateY(0); 
      }
      #${BUTTON_ID} .sp-icon {
        width: 18px;
        height: 18px;
        object-fit: contain;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      }
      #${BUTTON_ID} .sp-text {
        font-weight: 600;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
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
    
    const iconUrl = chrome.runtime.getURL("assets/star2.png");
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


