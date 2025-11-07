chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "rewrite-with-slide-polish",
    title: "Rewrite with Slide Polish",
    contexts: ["selection"],
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "rewrite-with-slide-polish") {
    // Store selected text and open popup
    chrome.storage.local.set({ selectedText: info.selectionText }, () => {
      chrome.action.openPopup()
    })
  }
})

// Open popup when requested by content script button
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "openPopup") {
    chrome.action.openPopup()
  }
})
