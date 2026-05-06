import { RouterProvider } from "react-router-dom";
import Providers from "./providers.jsx";
import { router } from "./routes.jsx";

function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}

export default App;
