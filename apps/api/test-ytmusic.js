const YTMusic = require("ytmusic-api");

async function test() {
  try {
    const ytmusic = new YTMusic();
    await ytmusic.initialize();
    
    const songs = await ytmusic.searchSongs("bodyslam");
    console.log(songs.slice(0, 2));
  } catch (e) {
    console.error(e);
  }
}

test();
