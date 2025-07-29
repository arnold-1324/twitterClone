import React, { useState, useEffect } from "react";
import { Box, Flex, Input, Button, Grid, Spinner, Text, IconButton } from "@chakra-ui/react";
import { FaDownload, FaHeart } from "react-icons/fa";
import { useToast } from "@chakra-ui/react";
import axios from "axios";
import SongCard from "./SongCard";
import Controls from "./MusicPlayer/Controls";
import Player from "./MusicPlayer/Player";
import Seekbar from "./MusicPlayer/Seekbar";
import Track from "./MusicPlayer/Track";
import VolumeBar from "./MusicPlayer/VolumeBar";
import "./SongPage.css"; // Import CSS for rotating animation
import useDownloadSong from "../hooks/useDownloadSong";
import loaderSvg from "../assets/loader.svg";
import Lyrics from "./Lyrics"; // Import the new Lyrics component

const SongPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lyrics, setLyrics] = useState([]);
  const [currentStanza, setCurrentStanza] = useState(0);
  const [volume, setVolume] = useState(0.3);
  const [seekTime, setSeekTime] = useState(0);
  const [appTime, setAppTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const toast = useToast();
  const { downloadSong, showAnimation } = useDownloadSong();

  const searchSongs = async () => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      const response = await axios.get("https://spotify23.p.rapidapi.com/search", {
        params: {
          q: searchQuery,
          type: "multi",
          offset: 0,
          limit: 4,
          numberOfTopResults: 5,
        },
        headers: {
          "x-rapidapi-key": "c263dc9547msh6a3b8befac77f1ep1903f6jsn85c748a598a3",
          "x-rapidapi-host": "spotify23.p.rapidapi.com",
        },
      });

      const data = response.data;
      const songsData = data.tracks.items.map(item => ({
        id: item.data.id,
        title: item.data.name,
        subtitle: item.data.artists.items.map(artist => artist.profile.name).join(", "),
        image: item.data.albumOfTrack.coverArt.sources[0].url,
        previewUrl: item.data.preview_url,
        lyrics: item.data.lyrics || [],
      }));
      setSongs(songsData);
    } catch (error) {
      console.error("Error fetching songs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSongDetails = async (songId, SongCoverImg) => {
    try {
      const response = await axios.get(`https://spotify23.p.rapidapi.com/tracks/`, {
        params: { ids: songId },
        headers: {
          "x-rapidapi-key": "c263dc9547msh6a3b8befac77f1ep1903f6jsn85c748a598a3",
          "x-rapidapi-host": "spotify23.p.rapidapi.com",
        },
      });

      const lyricsResponse = await axios.get(`https://spotify23.p.rapidapi.com/track_lyrics/`, {
        params: { id: songId },
        headers: {
          "x-rapidapi-key": "c263dc9547msh6a3b8befac77f1ep1903f6jsn85c748a598a3",
          "x-rapidapi-host": "spotify23.p.rapidapi.com",
        },
      });

      const data = response.data.tracks[0];
      const lyricsData = lyricsResponse.data.lyrics.lines.map(line => line.words);

      return {
        id: data.id,
        title: data.name,
        subtitle: data.artists.map(artist => artist.name).join(", "),
        image: SongCoverImg,
        previewUrl: data.preview_url,
        lyrics: lyricsData,
      };
    } catch (error) {
      console.error("Error fetching song details:", error);
      return null;
    }
  };

  const playSong = async (song) => {
    if (currentSong?.id === song.id && isPlaying) {
      setIsPlaying(false);
    } else {
      const songDetails = await fetchSongDetails(song.id, song.image);
      if (songDetails) {
        setCurrentSong(songDetails);
        setIsPlaying(true);
        setLyrics(songDetails.lyrics);
        setCurrentStanza(0);
      }
    }
  };

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentStanza((prev) => (prev + 1) % lyrics.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, lyrics.length]);

  return (
    <Box p={6} bg="gray.900" minH="100vh" maxW="100vw" >
      {showAnimation && (
        <Box
          position="fixed"
          top="0"
          left="0"
          width="100%"
          height="100%"
          bg="rgba(0, 0, 0, 0.8)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex="1000"
        >
          <Box className="wave-animation">
            <img src={loaderSvg} alt="loader" className="loader-svg left" />
            <FaHeart className="heart-icon cracked-heart" />
            <img src={loaderSvg} alt="loader" className="loader-svg right" />
          </Box>
          <Text fontSize="4xl" color="white" textAlign="center" mt={4}>
            Downloading...
          </Text>
        </Box>
      )}
      <Text fontSize="3xl" color="white" mb={6} textAlign="center">
        Spotify Song Search
      </Text>

      <Flex justify="center" mb={6}>
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for songs, artists, or albums"
          size="lg"
          width="50%"
          color="white"
          bg="gray.700"
          _focus={{ borderColor: "green.500" }}
        />
        <Button
          onClick={searchSongs}
          colorScheme="green"
          size="lg"
          ml={2}
          isLoading={loading}
        >
          Search
        </Button>
      </Flex>

      {loading ? (
        <Flex justify="center">
          <Spinner size="xl" color="green.500" />
        </Flex>
      ) : (
        <Grid templateColumns="repeat(1, 1fr)" gap={6} flexDirection={'row'}>
          {songs.length > 0 ? (
            songs.map((song, index) => (
              <SongCard
                key={index}
                song={song}
                isPlaying={currentSong?.id === song.id && isPlaying}
                onPlay={() => playSong(song)}
              />
            ))
          ) : (
            <Text color="white" textAlign="center">
              No results found.
            </Text>
          )}
        </Grid>
      )}

      {currentSong && (
        <Box mt={6} p={4} bg="gray.800" borderRadius="md">
          <Track isPlaying={isPlaying} isActive={true} activeSong={currentSong} />
          <Flex justify="space-between" alignItems="center">
            <Controls
              isPlaying={isPlaying}
              isActive={true}
              repeat={repeat}
              setRepeat={setRepeat}
              shuffle={shuffle}
              setShuffle={setShuffle}
              currentSongs={songs}
              handlePlayPause={() => setIsPlaying(!isPlaying)}
              handlePrevSong={() => setCurrentSong(songs[(songs.indexOf(currentSong) - 1 + songs.length) % songs.length])}
              handleNextSong={() => setCurrentSong(songs[(songs.indexOf(currentSong) + 1) % songs.length])}
            />
            <IconButton
              icon={<FaDownload />}
              colorScheme="teal"
              size="lg"
              onClick={() => downloadSong(currentSong)}
              aria-label="Download Song"
              className="download-btn unique-btn"
            />
          </Flex>
          <Seekbar
            value={appTime}
            min="0"
            max={duration}
            onInput={(event) => setSeekTime(event.target.value)}
            setSeekTime={setSeekTime}
            appTime={appTime}
          />
          <Player
            activeSong={currentSong}
            volume={volume}
            isPlaying={isPlaying}
            seekTime={seekTime}
            repeat={repeat}
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={(event) => setAppTime(event.target.currentTime)}
            onLoadedData={(event) => setDuration(event.target.duration)}
          />
          <VolumeBar value={volume} min="0" max="1" onChange={(event) => setVolume(event.target.value)} setVolume={setVolume} />
          <Lyrics lyrics={lyrics} currentTime={appTime} isPlaying={isPlaying} />
        </Box>
      )}
    </Box>
  );
};

export default SongPage;