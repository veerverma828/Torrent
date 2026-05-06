import {
  getMovieProgress,
  getEpisodeProgress,
  getContinueWatching,
  saveProgress,
  removeProgress,
} from "../progressTracker.js";

export const localProvider = {
  type: "local",

  getMovieProgress,

  getEpisodeProgress,

  getContinueWatching,

  saveProgress,

  removeProgress,
};
