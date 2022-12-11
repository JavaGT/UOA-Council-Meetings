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
        const existing_data = await acc
        console.log(`Waiting 1 second`)
        pause(1000)

        // Video data
        console.log(`Fetching video data for ${id}`)
        const url = `https://www.youtube.com/watch?v=${id}`
        const playlist = await getInfo(url)
        const info = playlist.items[0]
        delete info.formats

        // Transcripts
        console.log(`Fetching transcript for ${id}`)
        const transcript = await YoutubeTranscript.default.fetchTranscript(id)

        const video_data = { info, transcript }

        return { ...existing_data, [id]: video_data }
    }, Promise.resolve({}))

    await Object.entries(video_data).reduce(async (acc, [id, data]) => {
        await acc
        console.log(`Writing transcript for ${id}`)
        await fsp.writeFile(`./data/youtube_transcripts/${id}.json`, JSON.stringify(data, null, 2))
    }, Promise.resolve())

    // Read transcript files
    const transcript_files = await fsp.readdir('./data/youtube_transcripts')
    // filter out non json files
    const transcript_files_json = transcript_files.filter(x => x.endsWith('.json'))
    // read files
    console.log(transcript_files_json)
    const file_data = await Promise.all(transcript_files_json.map(async file => {
        console.log(`Reading transcript file ${file}`)
        const data = await fsp.readFile(`./data/youtube_transcripts/${file}`)
        return JSON.parse(data)
    }))

    console.log(JSON.stringify(file_data, null, 2))

    const metadata = Object.fromEntries(file_data.map(x => x.info).map(x => [x.id, x]))
    const transcripts = file_data.map(filedata => filedata.transcript.map((x, i, all) => {
        const context = all.slice(i, i + 4).map(x => x.text).join(' ')
        return { ...x, video_id: filedata.info.id, context: context }
    })).flat()

    await fsp.writeFile(`./data/youtube_metadata.json`, JSON.stringify(metadata, null, 2))
    await fsp.writeFile(`./data/youtube_transcripts.json`, JSON.stringify(transcripts, null, 2))
}
