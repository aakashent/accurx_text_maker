let linksData = {}; // This will be populated by the JSON data

fetch('links_titles.json')
.then(response => response.json())
.then(data => {
    linksData = data;
    populateDropdown();
});

function populateDropdown() {
    const dropdown = document.getElementById('sitemapDropdown');
    Object.entries(linksData).forEach(([url, title]) => {
        const option = document.createElement('option');
        option.value = url;
        option.textContent = title;  // Use the title for dropdown display
        dropdown.appendChild(option);
    });
}

function displayLink() {
    const dropdown = document.getElementById('sitemapDropdown');
    const url = dropdown.value;
    const title = linksData[url];  // Retrieve the title using the URL
    const displayDiv = document.getElementById('linkDisplay');
    displayDiv.innerHTML = `Please see the below link for a leaflet - ${title}<br><a href="${url}">${url}</a>`;
}
