let linksData = {}; // This will be populated by the JSON data

// Fetch the JSON data
fetch('links_titles.json')
    .then(response => response.json())
    .then(data => {
        linksData = data;
        populateDropdown();
    })
    .catch(error => console.error('Failed to load JSON data:', error));

// Populate the dropdown with titles
function populateDropdown() {
    const dropdown = document.getElementById('sitemapDropdown');
    Object.entries(linksData).forEach(([url, title]) => {
        const option = document.createElement('option');
        option.value = url;
        option.textContent = title;  // Use the title for dropdown display
        dropdown.appendChild(option);
    });
}

// Display the selected link in the textarea and update the anchor tag
function displayLink() {
    const dropdown = document.getElementById('sitemapDropdown');
    const url = dropdown.value;
    const title = linksData[url];  // Retrieve the title using the URL
    const linkDisplayBox = document.getElementById('linkDisplayBox');
    const dynamicLink = document.getElementById('dynamicLink');
    
    linkDisplayBox.value = `Please see the below link for a leaflet - ${title}\n${url}`;
    dynamicLink.href = url; // Set the href attribute of the anchor tag
    dynamicLink.textContent = 'Click here to visit: ' + title; // Update the text to display
    adjustTextareaHeight(linkDisplayBox);
}

// Dynamically adjust the height of the textarea to fit the content, up to a maximum
function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto'; // Reset height to recalculate
    textarea.style.height = `${textarea.scrollHeight}px`; // Set height based on scroll height
    if (textarea.scrollHeight > 150) {
        textarea.style.height = '150px'; // Limit height to max-height
        textarea.scrollTop = textarea.scrollHeight; // Scroll to bottom if content exceeds max-height
    }
}

// Copy the content of the textarea to the clipboard
document.getElementById('copyButton').addEventListener('click', () => {
    const textToCopy = document.getElementById('linkDisplayBox').value;
    navigator.clipboard.writeText(textToCopy)
        .then(() => alert('Text copied to clipboard!'))
        .catch(err => console.error('Failed to copy text:', err));
});
