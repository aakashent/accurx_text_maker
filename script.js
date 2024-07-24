window.onload = function() {
    fetch('sitemap.xml')
    .then(response => response.text())
    .then(data => {
        let parser = new DOMParser();
        let xml = parser.parseFromString(data, "application/xml");
        populateDropdown(xml);
    });
    document.getElementById('copyButton').addEventListener('click', copyToClipboard);
};

function populateDropdown(xml) {
    let urls = xml.getElementsByTagName('loc');
    let dropdown = document.getElementById('sitemapDropdown');
    let urlArray = Array.from(urls);

    // Sort URL array by text content alphabetically
    urlArray.sort((a, b) => {
        return a.textContent.localeCompare(b.textContent);
    });

    for (let i = 0; i < urlArray.length; i++) {
        let option = document.createElement('option');
        option.textContent = urlArray[i].textContent; // or use another child for a more descriptive text
        option.value = urlArray[i].textContent;
        dropdown.appendChild(option);
    }
}

function displayLink() {
    let dropdown = document.getElementById('sitemapDropdown');
    let displayDiv = document.getElementById('linkDisplay');
    displayDiv.innerHTML = `Please see the below link for a leaflet - <a href="${dropdown.value}">${dropdown.options[dropdown.selectedIndex].text}</a>`;
}

function copyToClipboard() {
    let textToCopy = document.getElementById('linkDisplay').textContent;
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('Text copied to clipboard');
    }).catch(err => {
        alert('Failed to copy text: ', err);
    });
}
