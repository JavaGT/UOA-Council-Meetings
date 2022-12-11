import { create, search, insertBatch } from "https://unpkg.com/@lyrasearch/lyra@latest/dist/esm/src/lyra.js";

const urlParams = new URLSearchParams(window.location.search);
const query = urlParams.get('query');
document.querySelector('input[name="query"]').value = query;
if (query) {
    document.querySelector('#results').innerHTML = '<span class="highlight">Searching...</span>';
}

if (query) {
    const db = create({
        schema: {
            "text": "string",
            "context": "string",
            "duration": "number",
            "offset": "number",
            "video_id": "string"
        },
    });

    // load data
    const metadata = await fetch('./data/youtube_metadata.json').then(x => x.json())
    const transcripts = await fetch('./data/youtube_transcripts.json').then(x => x.json())

    await insertBatch(db, transcripts);
    const searchResult = search(db, {
        term: query,
        properties: ["text", "context"],
    });

    document.getElementById('results').innerHTML = searchResult.hits ? searchResult.hits.map(hit => {
        let video_data = metadata[hit.document.video_id]
        const timestamp = Math.floor(hit.document.offset / 1000)
        console.log(video_data)
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const year = video_data.upload_date.slice(0, 4)
        const month = months[parseInt(video_data.upload_date.slice(4, 6))]
        const day = parseInt(video_data.upload_date.slice(6, 8))
        const date = `${day} ${month} ${year}`
        const querylist = query.split(' ')
        // bold words from list
        const context = hit.document.context = hit.document.context.replace(new RegExp(querylist.join('|'), 'gi'), (match) => `<span class="highlight">${match}</span>`)

        return `
            <a class="result" href="https://www.youtube.com/watch?v=${hit.document.video_id}&t=${timestamp}">
                <img class="thumbnail" src="${video_data.thumbnail}" alt="${video_data.title}">
                <div class="details">
                    <strong>${date}</strong><br>
                    <strong>${video_data.title}</strong>
                    <br>
                    <span>...${context}...</span>
                </div>
            </a>
        `;
    }).join('') : '<span class="highlight">No results found</span>"';

    console.log(`Found ${searchResult.hits.length} results.`);
    console.log(searchResult);
}