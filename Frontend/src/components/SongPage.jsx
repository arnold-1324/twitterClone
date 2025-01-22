import React, { useState, useEffect } from "react";
import { Box, Flex, Input, Button, Grid, Spinner, useToast, Text } from "@chakra-ui/react";
import axios from "axios";
import SongCard from "./SongCard";
import "./SongPage.css"; // Import CSS for rotating animation

const SongPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lyrics, setLyrics] = useState([]);
  const [currentStanza, setCurrentStanza] = useState(0);
  const toast = useToast();

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
         // Assuming lyrics are part of the API response
      }));
      setSongs(songsData);
      console.log(songsData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong while fetching songs.",
        status: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const playSong = (song) => {
    if (currentSong?.previewUrl === song.previewUrl && isPlaying) {
      setIsPlaying(false);
    } else {
      setCurrentSong(song);
      setIsPlaying(true);
      setLyrics(song.lyrics);
      setCurrentStanza(0);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentStanza((prev) => (prev + 1) % lyrics.length);
      }, 3000); // Change stanza every 3 seconds
      return () => clearInterval(interval);
    }
  }, [isPlaying, lyrics.length]);

  return (
    <Box p={6} bg="gray.900" minH="100vh">
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
                isPlaying={currentSong?.previewUrl === song.previewUrl && isPlaying}
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
        <audio
          src={currentSong.previewUrl}
          autoPlay={isPlaying}
          onEnded={() => setIsPlaying(false)}
          controls
          style={{ display: "none" }}
        />
      )}

      {lyrics.length > 0 && (
        <Box mt={6} p={4} bg="gray.800" borderRadius="md">
          {lyrics.map((stanza, index) => (
            <Text
              key={index}
              color={index === currentStanza ? "green.500" : "white"}
              fontSize="lg"
              mb={2}
            >
              {stanza}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default SongPage;
