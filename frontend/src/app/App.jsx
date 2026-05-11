import { RouterProvider } from "react-router-dom";
import Providers from "./providers.jsx";
import { router } from "./routes.jsx";
import CrossDeviceSyncIndicator from "../components/sync/CrossDeviceSyncIndicator.jsx";

function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
      <CrossDeviceSyncIndicator />
    </Providers>
  );
}

export default App;
