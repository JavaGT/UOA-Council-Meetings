import fetch from 'node-fetch';
import { parse as parseHTML } from 'node-html-parser';
import YoutubeTranscript from 'youtube-transcript';
import { parse as parseURL } from 'url'
import { parse as parsePath } from 'path';
import { promises as fsp } from 'fs'
import { getInfo } from 'ytdl-getinfo'

// make directories
await fsp.mkdir('./data/youtube_transcripts', { recursive: true })

const parseAttr = (attr) => (x) => x[attr]
const pause = (t) => new Promise(r => setTimeout(r, t))

await getYoutubeData()

async function getYoutubeData() {
    const url = 'https://www.auckland.ac.nz/en/about-us/about-the-university/the-university/governance-and-committees/university-council/university-council-agenda-and-minutes.html'
    const html = await fetch(url).then(res => res.text());

    const document = parseHTML(html);

    const urls = document.querySelectorAll('[src^="https://www.youtube.com/embed/"]').map(x => x.getAttribute('src'))

    const ids = urls
        .map(parseURL)
        .map(parseAttr('pathname'))
        .map(parsePath)
        .map(parseAttr('name'));

    console.log(`Found ${ids.length} videos`)

    // Filter out videos that have already been downloaded
    const existing_ids = await fsp.readdir('./data/youtube_transcripts')
        .then(files => files.map(parsePath).map(parseAttr('name')))
    const new_ids = ids.filter(id => !existing_ids.includes(id))

    console.log(`Found ${new_ids.length} new videos`)

    const video_data = await new_ids.reduce(async (acc, id) => {
        await acc
        console.log(`Waiting 1 second`)
        pause(1000)

        // Video data
        console.log(`Fetching video data for ${id}`)
        const playlist = await getInfo(url)
        const info = playlist.items[0]

        // Transcripts
        console.log(`Fetching transcript for ${id}`)
        const transcript = await YoutubeTranscript.default.fetchTranscript(id)

        const video_data = { info, transcript }

        return { ...(await acc), [id]: video_data }
    }, Promise.resolve({}))

    await Object.entries(video_data).reduce(async (acc, [id, data]) => {
        await acc
        console.log(`Writing transcript for ${id}`)
        await fsp.writeFile(`./data/youtube_transcripts/${id}.json`, JSON.stringify(data, null, 2))
    }, Promise.resolve())
}
