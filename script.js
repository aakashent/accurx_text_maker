let linksData = {}; // This will be populated by the JSON data

// Fetch the JSON data
fetch('links_titles.json')
.then(response => response.json())
.then(data => {
    linksData = data;
    populateDropdown();
});

// Function to populate the dropdown
function populateDropdown() {
    const dropdown = document.getElementById('sitemapDropdown');
    Object.entries(linksData).forEach(([url, title]) => {
        const option = document.createElement('option');
        option.value = url;
        option.textContent = title;
        dropdown.appendChild(option);
    });
}

// Function to display link and update textarea
function displayLink() {
    const dropdown = document.getElementById('sitemapDropdown');
    const url = dropdown.value;
    const title = linksData[url];
    const linkDisplayBox = document.getElementById('linkDisplayBox');
    
    linkDisplayBox.value = `Please see the below link for a leaflet - ${title}\n${url}`;
}

// Event listener for the Copy button
document.getElementById('copyButton').addEventListener('click', () => {
    const textToCopy = document.getElementById('linkDisplayBox').value;
    navigator.clipboard.writeText(textToCopy)
        .then(() => alert('Text copied to clipboard!'))
        .catch(err => console.error('Failed to copy text: ', err));
});
