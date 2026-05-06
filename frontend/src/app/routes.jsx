import { createBrowserRouter } from "react-router-dom";
import Layout from "./Layout.jsx";
import HomePage from "../pages/Home/HomePage.jsx";
import MoviePage from "../pages/Movie/MoviePage.jsx";
import SeriesPage from "../pages/Series/SeriesPage.jsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "movie/:id", element: <MoviePage /> },
      { path: "series/:id", element: <SeriesPage /> },
      {
        path: "series/:id/season/:season/episode/:episode",
        element: <SeriesPage />,
      },
    ],
  },
]);
