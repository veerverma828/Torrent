import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import Layout from "./Layout.jsx";

const HomePage = lazy(() => import("../pages/Home/HomePage.jsx"));
const MoviePage = lazy(() => import("../pages/Movie/MoviePage.jsx"));
const SeriesPage = lazy(() => import("../pages/Series/SeriesPage.jsx"));

const withSuspense = (Component) => (
  <Suspense fallback={<div className="page-loader">Loading...</div>}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: withSuspense(HomePage) },
      { path: "movie/:id", element: withSuspense(MoviePage) },
      { path: "series/:id", element: withSuspense(SeriesPage) },
      {
        path: "series/:id/season/:season/episode/:episode",
        element: withSuspense(SeriesPage),
      },
    ],
  },
]);
