fetch('links_titles.json')
.then(response => {
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
})
.then(data => {
    console.log("Data loaded successfully:", data);
    linksData = data;
    populateDropdown();
})
.catch(error => {
    console.error('Error fetching JSON:', error);
});

function populateDropdown() {
    const dropdown = document.getElementById('sitemapDropdown');
    Object.entries(linksData).forEach(([url, title]) => {
        console.log("Adding option:", title);
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
