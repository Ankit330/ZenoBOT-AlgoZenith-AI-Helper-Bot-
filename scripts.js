// Check if the API key is already saved
chrome.storage.local.get(['apiKey'], function(result) {
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
    }
  });
  
  document.getElementById('botSendKeyButton').addEventListener('click', function() {
    const apiKey = document.getElementById('apiKey').value;
    console.log(apiKey);
    
    if (apiKey) {
      // Save the API key to chrome storage
      chrome.storage.local.set({ apiKey: apiKey }, function() {
        console.log('API Key saved successfully.');
        showSuccessMessage();
        
        // Send the API key to content.js using messaging
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "SET_API_KEY", apiKey: apiKey });
          }
        });
      });
    } else {
      console.error('API Key is empty');
    }
  });
  
  function showSuccessMessage() {
    const successMessage = document.getElementById('successMessage');
    successMessage.style.display = 'block'; // Show success message
    
    // Close the popup after 1 second
    setTimeout(() => {
      window.close(); // Close the popup
    }, 1000);
  }
  